// scripts/sync-skill-files.mjs
// Fetches skill files from source repositories into the configured cache directory
// Run this before build-registry.mjs to populate skill content

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import fg from "fast-glob";
import YAML from "yaml";
import { loadConfig, getBuildConfig } from "./lib/config.mjs";

const SKILL_YAML_GLOB = "skills/*/*/.x_skill.yaml";

const SKILL_FILE_IGNORE = [
  ".git",
  "node_modules",
  ".next",
  "dist",
  "out",
  "__pycache__",
  ".DS_Store",
  ".x_skill.yaml",
  "skill.yaml"
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readYamlFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return YAML.parse(raw);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(" ")}\n${res.stderr || ""}`);
  }
  return res.stdout;
}

async function copyDirFiltered(srcDir, destDir, ignore = [], repoRoot = null) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  // Resolve repoRoot to handle symlinked paths (e.g., /tmp -> /private/tmp on macOS)
  const resolvedRoot = repoRoot ? await fs.realpath(repoRoot) : null;

  for (const e of entries) {
    // Skip ignored patterns
    if (ignore.includes(e.name)) continue;

    const src = path.join(srcDir, e.name);
    const dest = path.join(destDir, e.name);

    const st = await fs.lstat(src);

    if (st.isSymbolicLink()) {
      // Resolve symlink and copy actual content
      try {
        const realPath = await fs.realpath(src);

        // Security check: ensure resolved path is within repo
        if (resolvedRoot && !realPath.startsWith(resolvedRoot + path.sep) && realPath !== resolvedRoot) {
          console.warn(`  ⚠️  Skipping symlink outside repo: ${e.name}`);
          continue;
        }

        const realStat = await fs.stat(realPath);
        if (realStat.isDirectory()) {
          console.log(`  📁 Resolving symlink dir: ${e.name}`);
          await copyDirFiltered(realPath, dest, ignore, repoRoot);
        } else if (realStat.isFile()) {
          console.log(`  📄 Resolving symlink file: ${e.name}`);
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(realPath, dest);
        }
      } catch (err) {
        console.warn(`  ⚠️  Failed to resolve symlink ${e.name}: ${err.message}`);
      }
      continue;
    }

    if (st.isDirectory()) {
      await copyDirFiltered(src, dest, ignore, repoRoot);
      continue;
    }

    if (!st.isFile()) continue;

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

async function syncSkill(skillId, source, cacheDir) {
  const { repo, path: sourcePath, ref } = source;

  if (!repo || !ref) {
    console.log(`  ⚠️  Skipping ${skillId}: missing source.repo or source.ref`);
    return false;
  }

  const skillCacheDir = path.join(cacheDir, skillId);

  // Check if already cached with same ref
  const cacheMetaPath = path.join(skillCacheDir, ".cache-meta.json");
  if (await pathExists(cacheMetaPath)) {
    try {
      const cacheMeta = JSON.parse(await fs.readFile(cacheMetaPath, "utf8"));
      if (cacheMeta.repo === repo && cacheMeta.ref === ref && cacheMeta.path === sourcePath) {
        console.log(`  ✓ ${skillId} (cached)`);
        return true;
      }
    } catch {
      // Invalid cache, will re-fetch
    }
  }

  console.log(`  ↓ ${skillId} from ${repo}@${ref}`);

  // Clone to temp directory
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `skill-sync-${skillId}-`));
  const repoDir = path.join(tmp, "repo");

  try {
    // Try shallow clone first
    try {
      run("git", ["clone", "--depth", "1", "--branch", ref, repo, repoDir], { stdio: "pipe" });
    } catch {
      // Fallback to full clone + checkout
      run("git", ["clone", repo, repoDir], { stdio: "pipe" });
      run("git", ["-C", repoDir, "checkout", ref], { stdio: "pipe" });
    }

    // Determine source directory
    const srcSkillDir = sourcePath && sourcePath !== "."
      ? path.join(repoDir, sourcePath)
      : repoDir;

    if (!(await pathExists(srcSkillDir))) {
      throw new Error(`Source path not found: ${sourcePath}`);
    }

    // Clean existing cache
    if (await pathExists(skillCacheDir)) {
      await fs.rm(skillCacheDir, { recursive: true });
    }

    // Copy files to cache (pass repoDir as root for symlink resolution)
    await copyDirFiltered(srcSkillDir, skillCacheDir, SKILL_FILE_IGNORE, repoDir);

    // Write cache metadata
    await fs.writeFile(cacheMetaPath, JSON.stringify({
      repo,
      ref,
      path: sourcePath,
      syncedAt: new Date().toISOString()
    }, null, 2));

    console.log(`    ✓ synced`);
    return true;
  } catch (err) {
    console.error(`    ✗ failed: ${err.message}`);
    return false;
  } finally {
    // Clean up temp directory
    try {
      await fs.rm(tmp, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function main() {
  console.log("🔄 Syncing skill files from source repositories...\n");

  // Load config to get cache directory
  const config = await loadConfig();
  const buildConfig = getBuildConfig(config);
  const CACHE_DIR = buildConfig.cacheDir;

  // Find all skill metadata files
  const skillYamlPaths = await fg([SKILL_YAML_GLOB], { onlyFiles: true, dot: true });
  skillYamlPaths.sort((a, b) => a.localeCompare(b));

  if (skillYamlPaths.length === 0) {
    console.log("No skills found to sync.\n");
    return;
  }

  console.log(`Found ${skillYamlPaths.length} skill(s) to sync:\n`);

  // Ensure cache directory exists
  await fs.mkdir(CACHE_DIR, { recursive: true });

  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const yamlPath of skillYamlPaths) {
    try {
      const meta = await readYamlFile(yamlPath);

      if (!meta.source) {
        console.log(`  ⚠️  ${meta.id || yamlPath}: no source info, skipping`);
        skipped++;
        continue;
      }

      const success = await syncSkill(meta.id, meta.source, CACHE_DIR);
      if (success) {
        synced++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${yamlPath}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   Synced: ${synced}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Cache: ${CACHE_DIR}/\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

await main();
