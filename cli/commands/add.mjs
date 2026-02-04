import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { AGENTS } from "../lib/agents.mjs";
import { getDefaultRegistryRef, getDefaultRegistryUrl, normalizeRegistryUrl } from "../lib/config.mjs";
import { getArchiveRootDir, getCodeloadTarballUrl, parseGitHubRepoSlug } from "../lib/github.mjs";
import { fetchRegistryIndex, findSkillById } from "../lib/registry.mjs";
import { assertSlug, splitPath } from "../lib/validation.mjs";

function parseArgs(args) {
  const result = {
    skillName: null,
    agent: "claude",
    scope: "project",
    registry: undefined,
    ref: undefined
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--agent' && i + 1 < args.length) {
      result.agent = args[++i];
    } else if (arg === '--scope' && i + 1 < args.length) {
      result.scope = args[++i];
    } else if (arg === '--registry' && i + 1 < args.length) {
      result.registry = args[++i];
    } else if ((arg === '--ref' || arg === '--branch') && i + 1 < args.length) {
      result.ref = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (!arg.startsWith('-')) {
      result.skillName = arg;
    }
  }

  return result;
}

function printHelp() {
  const agentsList = Object.keys(AGENTS).join(", ");
  console.log(`
Usage: npx aiskill add <skill-name> [options]

Install a skill from the registry

Arguments:
  <skill-name>         Name of the skill to install

Options:
  --agent <name>       Target agent (${agentsList})
                       Default: claude
  --scope <scope>      Installation scope (project, global)
                       Default: project
  --registry <url>     Custom registry URL
                       Default: $SKILL_REGISTRY_URL or package repository URL
  --ref <ref>          Git ref (branch or tag) to use
                       Default: $SKILL_REGISTRY_REF or "main"
  --help, -h          Show this help message

Examples:
  npx aiskill add ui-ux-pro-max
  npx aiskill add ui-ux-pro-max --agent codex --scope global
  npx aiskill add ui-ux-pro-max --registry https://github.com/your-org/skills-repo --ref main
`);
}

function exitCode(p) {
  return new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", (code, signal) => {
      if (signal) return resolve(128);
      resolve(code ?? 0);
    });
  });
}

async function downloadAndExtract({ tarballUrl, memberPath, stripComponents, targetDir }) {
  const curl = spawn("curl", ["-fsSL", tarballUrl], { stdio: ["ignore", "pipe", "pipe"] });
  const tar = spawn(
    "tar",
    [
      "-xz",
      "-f",
      "-",
      `--strip-components=${stripComponents}`,
      "--exclude=.x_skill.yaml",
      "-C",
      targetDir,
      memberPath
    ],
    { stdio: ["pipe", "ignore", "pipe"] }
  );

  curl.stdout.pipe(tar.stdin);
  curl.stderr.pipe(process.stderr);
  let tarErr = "";
  tar.stderr.setEncoding("utf8");
  tar.stderr.on("data", (chunk) => {
    tarErr += chunk;
  });

  let [curlCode, tarCode] = await Promise.all([exitCode(curl), exitCode(tar)]);
  if (curlCode !== 0) throw new Error(`curl failed (${curlCode}) while downloading: ${tarballUrl}`);
  if (tarCode !== 0) {
    let details = tarErr.trim();
    throw new Error(`tar failed (${tarCode}) while extracting: ${memberPath}${details ? `\n${details}` : ""}`);
  }
}

async function listTarballEntries(tarballUrl) {
  const curl = spawn("curl", ["-fsSL", tarballUrl], { stdio: ["ignore", "pipe", "pipe"] });
  const tar = spawn("tar", ["-tz", "-f", "-"], { stdio: ["pipe", "pipe", "pipe"] });

  curl.stdout.pipe(tar.stdin);
  curl.stderr.pipe(process.stderr);
  tar.stderr.pipe(process.stderr);

  let out = "";
  tar.stdout.setEncoding("utf8");
  tar.stdout.on("data", (chunk) => {
    out += chunk;
  });

  let [curlCode, tarCode] = await Promise.all([exitCode(curl), exitCode(tar)]);
  if (curlCode !== 0) throw new Error(`curl failed (${curlCode}) while downloading: ${tarballUrl}`);
  if (tarCode !== 0) throw new Error(`tar failed (${tarCode}) while listing archive`);

  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}

async function findSkillDirInTarball({ tarballUrl, rootDir, skillId }) {
  const entries = await listTarballEntries(tarballUrl);
  const needle = `/skills/`;
  const suffix = `/${skillId}/SKILL.md`;
  const matches = new Set();

  for (const e of entries) {
    if (!e.startsWith(`${rootDir}${needle}`)) continue;
    if (!e.endsWith(suffix)) continue;
    matches.add(e.replace(/\/SKILL\.md$/, ""));
  }

  if (matches.size === 0) {
    throw new Error(`Skill "${skillId}" not found in archive`);
  }
  if (matches.size > 1) {
    throw new Error(`Multiple skill paths found in archive for "${skillId}": ${Array.from(matches).join(", ")}`);
  }

  return Array.from(matches)[0];
}

async function installSkill(skillName, agent, scope, registry, ref) {
  assertSlug("skill-name", skillName);

  // Validate agent
  const agentConfig = AGENTS[agent];
  if (!agentConfig) {
    throw new Error(`Unknown agent "${agent}". Valid options: ${Object.keys(AGENTS).join(', ')}`);
  }

  // Validate scope
  if (scope !== 'project' && scope !== 'global') {
    throw new Error(`Invalid scope "${scope}". Valid options: project, global`);
  }

  console.log(`\n📦 Installing skill: ${skillName}`);
  console.log(`   Agent: ${agentConfig.label}`);
  console.log(`   Scope: ${scope}\n`);

  // Fetch skill metadata
  console.log('🔍 Fetching skill metadata...');
  const index = await fetchRegistryIndex(registry, ref);
  const skill = findSkillById(index, skillName);
  if (!skill) throw new Error(`Skill "${skillName}" not found in registry`);
  console.log(`   Found: ${skill.title}`);
  console.log(`   Category: ${skill.category}/${skill.subcategory}\n`);

  // Determine target directory
  const targetBaseDir =
    scope === "project" ? path.resolve(process.cwd(), agentConfig.projectDir) : agentConfig.globalDir;
  const resolvedBase = path.resolve(targetBaseDir);
  const targetDir = path.resolve(targetBaseDir, skillName);
  if (!targetDir.startsWith(resolvedBase + path.sep)) {
    throw new Error("Refusing to write outside the agent skills directory");
  }

  // Check if skill already exists
  try {
    await fs.access(targetDir);
    console.log(`⚠️  Skill already exists at: ${targetDir}`);
    console.log('   Please remove it first or choose a different location.\n');
    process.exit(1);
  } catch {
    // Directory doesn't exist, proceed with installation
  }

  // Extract repo slug from registry URL
  const { owner, repo } = parseGitHubRepoSlug(registry);

  // Build installation command
  const skillPath = skill.repoPath;
  const pathParts = splitPath(skillPath);
  const stripComponents = pathParts.length + 1; // +1 for repo root directory in tarball

  const tarballUrl = getCodeloadTarballUrl({ owner, repo, ref });
  const rootDir = getArchiveRootDir({ repo, ref });
  const tarPath = `${rootDir}/${skillPath}`;

  console.log('📥 Downloading skill files...');

  // Create target directory
  await fs.mkdir(targetDir, { recursive: true });

  try {
    await downloadAndExtract({ tarballUrl, memberPath: tarPath, stripComponents, targetDir });
  } catch (err) {
    // Fallback: the registry can lag behind the repo tree. Re-discover the skill directory from the archive.
    const msg = err instanceof Error ? err.message : String(err);
    try {
      if (!msg.includes("tar failed")) throw err;
      console.log("⚠️  Registry index path not found in archive; searching for the correct skill directory...");
      const discoveredPath = await findSkillDirInTarball({ tarballUrl, rootDir, skillId: skillName });
      const discoveredStrip = splitPath(discoveredPath).length;
      const discoveredRepoPath = discoveredPath.startsWith(`${rootDir}/`)
        ? discoveredPath.slice(`${rootDir}/`.length)
        : discoveredPath;
      console.log(`   Using archive path: ${discoveredRepoPath}`);
      await downloadAndExtract({ tarballUrl, memberPath: discoveredPath, stripComponents: discoveredStrip, targetDir });
    } catch (fallbackErr) {
      await fs.rm(targetDir, { recursive: true, force: true });
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`Failed to download skill: ${fallbackMsg}`);
    }
  }

  // Verify installation
  const files = await fs.readdir(targetDir);
  if (files.length === 0) {
    await fs.rm(targetDir, { recursive: true, force: true });
    throw new Error('Installation failed: No files were extracted');
  }

  console.log(`\n✅ Successfully installed skill to: ${targetDir}`);
  console.log(`   Files: ${files.length} files\n`);

  // Check for SKILL.md
  if (files.includes('SKILL.md')) {
    console.log('📖 To view instructions, run:');
    console.log(`   cat "${path.join(targetDir, 'SKILL.md')}"\n`);
  }
}

export async function addCommand(args) {
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  if (!parsed.skillName) {
    console.error('Error: Missing required argument <skill-name>');
    console.error('Run "npx aiskill add --help" for usage information');
    process.exit(1);
  }

  const registry = normalizeRegistryUrl(parsed.registry ?? (await getDefaultRegistryUrl()));
  if (!registry) {
    throw new Error('Registry URL not configured. Set SKILL_REGISTRY_URL or pass --registry.');
  }
  const ref = (parsed.ref ?? getDefaultRegistryRef()).trim() || "main";

  await installSkill(parsed.skillName, parsed.agent, parsed.scope, registry, ref);
}
