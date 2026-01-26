#!/usr/bin/env node

/**
 * Skill Installer CLI
 *
 * Installs skills from the Skills Registry to your local agent directory.
 *
 * Usage:
 *   npx skill-install <skill-id> [options]
 *   node scripts/install-skill.mjs <skill-id> [options]
 *
 * Options:
 *   --agent <name>    Target agent (codex, claude, opencode, cursor, antigravity)
 *   --scope <scope>   Installation scope (project, global)
 *   --registry <url>  Registry URL (default: from environment or hardcoded)
 *   --list            List available skills
 *   --help            Show help
 *
 * Examples:
 *   node scripts/install-skill.mjs ui-ux-pro-max --agent claude --scope project
 *   node scripts/install-skill.mjs ui-ux-pro-max --agent codex --scope global
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Extract } from "node:stream";

// Agent configurations
const AGENTS = {
  codex: {
    label: "Codex",
    projectDir: ".codex/skills",
    globalDir: path.join(os.homedir(), ".codex/skills"),
  },
  claude: {
    label: "Claude Code",
    projectDir: ".claude/skills",
    globalDir: path.join(os.homedir(), ".claude/skills"),
  },
  opencode: {
    label: "OpenCode",
    projectDir: ".opencode/skills",
    globalDir: path.join(os.homedir(), ".opencode/skills"),
  },
  cursor: {
    label: "Cursor",
    projectDir: ".cursor/skills",
    globalDir: path.join(os.homedir(), ".cursor/skills"),
  },
  antigravity: {
    label: "Antigravity",
    projectDir: ".antigravity/skills",
    globalDir: path.join(os.homedir(), ".antigravity/skills"),
  },
};

// Default registry URL (can be overridden via env or flag)
const DEFAULT_REGISTRY_URL = process.env.SKILL_REGISTRY_URL || "https://github.com/xue1213888/skills-repo";

function printHelp() {
  console.log(`
Skill Installer CLI

Usage:
  node scripts/install-skill.mjs <skill-id> [options]

Options:
  --agent <name>    Target agent: ${Object.keys(AGENTS).join(", ")}
  --scope <scope>   Installation scope: project, global (default: project)
  --registry <url>  Registry GitHub URL
  --list            List available skills from registry
  --help            Show this help message

Examples:
  node scripts/install-skill.mjs ui-ux-pro-max --agent claude
  node scripts/install-skill.mjs ui-ux-pro-max --agent codex --scope global
`);
}

function parseArgs(argv) {
  const args = {
    skillId: null,
    agent: "claude",
    scope: "project",
    registry: DEFAULT_REGISTRY_URL,
    list: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--list" || arg === "-l") {
      args.list = true;
    } else if (arg === "--agent" || arg === "-a") {
      args.agent = argv[++i];
    } else if (arg === "--scope" || arg === "-s") {
      args.scope = argv[++i];
    } else if (arg === "--registry" || arg === "-r") {
      args.registry = argv[++i];
    } else if (!arg.startsWith("-")) {
      args.skillId = arg;
    }
  }

  return args;
}

async function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "skill-installer/1.0" } }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
  });
}

async function fetchJson(url) {
  const data = await httpGet(url);
  return JSON.parse(data);
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "skill-installer/1.0" } }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }

      const file = createWriteStream(destPath);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
      file.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function fetchRegistryIndex(registryUrl) {
  // Extract owner/repo from URL
  const match = registryUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Invalid registry URL: ${registryUrl}`);
  const repoSlug = match[1].replace(/\.git$/, "");

  // Try to fetch the registry index
  const indexUrl = `https://raw.githubusercontent.com/${repoSlug}/main/site/public/registry/index.json`;
  try {
    return await fetchJson(indexUrl);
  } catch {
    // Fallback to API
    const apiUrl = `https://api.github.com/repos/${repoSlug}/contents/site/public/registry/index.json`;
    const apiRes = await fetchJson(apiUrl);
    if (apiRes.content) {
      return JSON.parse(Buffer.from(apiRes.content, "base64").toString("utf8"));
    }
    throw new Error("Could not fetch registry index");
  }
}

async function findSkillInIndex(index, skillId) {
  for (const skill of index.skills || []) {
    if (skill.id === skillId) {
      return skill;
    }
  }
  return null;
}

async function downloadAndExtractSkill(registryUrl, skillPath, destDir) {
  const match = registryUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Invalid registry URL: ${registryUrl}`);
  const repoSlug = match[1].replace(/\.git$/, "");

  // Get the tree to find all files in the skill directory
  const treeUrl = `https://api.github.com/repos/${repoSlug}/git/trees/main?recursive=1`;
  const treeRes = await fetchJson(treeUrl);

  const skillPrefix = `skills/${skillPath}/`;
  const skillFiles = (treeRes.tree || [])
    .filter(item => item.type === "blob" && item.path.startsWith(skillPrefix))
    .filter(item => !item.path.endsWith(".x_skill.yaml")); // Exclude internal metadata

  if (skillFiles.length === 0) {
    throw new Error(`No files found for skill at path: ${skillPath}`);
  }

  // Create destination directory
  await fs.mkdir(destDir, { recursive: true });

  // Download each file
  for (const file of skillFiles) {
    const relativePath = file.path.slice(skillPrefix.length);
    const destPath = path.join(destDir, relativePath);

    // Create subdirectories if needed
    await fs.mkdir(path.dirname(destPath), { recursive: true });

    // Download file
    const rawUrl = `https://raw.githubusercontent.com/${repoSlug}/main/${file.path}`;
    console.log(`  Downloading: ${relativePath}`);
    await downloadFile(rawUrl, destPath);
  }

  return skillFiles.length;
}

async function listSkills(registryUrl) {
  console.log("Fetching skill registry...\n");

  const index = await fetchRegistryIndex(registryUrl);

  if (!index.skills || index.skills.length === 0) {
    console.log("No skills found in registry.");
    return;
  }

  console.log(`Found ${index.skills.length} skill(s):\n`);

  for (const skill of index.skills) {
    console.log(`  ${skill.id}`);
    if (skill.title) console.log(`    Title: ${skill.title}`);
    if (skill.description) console.log(`    Description: ${skill.description}`);
    if (skill.tags?.length) console.log(`    Tags: ${skill.tags.join(", ")}`);
    console.log("");
  }
}

async function installSkill(skillId, agentId, scope, registryUrl) {
  const agent = AGENTS[agentId];
  if (!agent) {
    console.error(`Unknown agent: ${agentId}`);
    console.error(`Available agents: ${Object.keys(AGENTS).join(", ")}`);
    process.exit(1);
  }

  const targetDir = scope === "global" ? agent.globalDir : path.resolve(agent.projectDir);

  console.log(`Installing skill: ${skillId}`);
  console.log(`  Agent: ${agent.label}`);
  console.log(`  Scope: ${scope}`);
  console.log(`  Target: ${targetDir}\n`);

  // Fetch registry index
  console.log("Fetching registry index...");
  const index = await fetchRegistryIndex(registryUrl);

  // Find skill in index
  const skill = await findSkillInIndex(index, skillId);
  if (!skill) {
    console.error(`Skill not found: ${skillId}`);
    console.error("\nUse --list to see available skills.");
    process.exit(1);
  }

  console.log(`Found skill: ${skill.title || skillId}`);
  if (skill.description) console.log(`  ${skill.description}\n`);

  // Determine skill path (category/subcategory/id)
  const skillPath = skill.path || `${skill.category}/${skill.subcategory}/${skill.id}`;
  const destDir = path.join(targetDir, skillId);

  // Check if already installed
  try {
    await fs.access(destDir);
    console.error(`Skill already installed at: ${destDir}`);
    console.error("Remove existing installation first.");
    process.exit(1);
  } catch {
    // Not installed, good
  }

  // Download and extract
  console.log("Downloading skill files...");
  const fileCount = await downloadAndExtractSkill(registryUrl, skillPath, destDir);

  console.log(`\nInstalled ${fileCount} file(s) to: ${destDir}`);
  console.log("\nDone!");
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.list) {
    await listSkills(args.registry);
    process.exit(0);
  }

  if (!args.skillId) {
    console.error("Error: skill-id is required\n");
    printHelp();
    process.exit(1);
  }

  if (!AGENTS[args.agent]) {
    console.error(`Error: unknown agent "${args.agent}"`);
    console.error(`Available agents: ${Object.keys(AGENTS).join(", ")}`);
    process.exit(1);
  }

  if (!["project", "global"].includes(args.scope)) {
    console.error(`Error: scope must be "project" or "global"`);
    process.exit(1);
  }

  try {
    await installSkill(args.skillId, args.agent, args.scope, args.registry);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
