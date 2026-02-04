// scripts/sync-fetch.mjs
/**
 * 根据 sync-check 的结果，拉取需要更新的 skill 内容
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { loadConfig, getBuildConfig } from './lib/config.mjs';

/**
 * 递归复制目录
 */
async function copyDir(src, dest, exclude = []) {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    const st = await fs.lstat(srcPath);

    if (st.isSymbolicLink()) {
      // Resolve symlink and copy actual content
      try {
        const realPath = await fs.realpath(srcPath);
        const resolvedSrc = await fs.realpath(src);

        // Security check: ensure resolved path is within source tree
        if (!realPath.startsWith(resolvedSrc + path.sep) && realPath !== resolvedSrc) {
          console.warn(`  ⚠️  Skipping symlink outside source: ${entry.name}`);
          continue;
        }

        const realStat = await fs.stat(realPath);
        if (realStat.isDirectory()) {
          await fs.mkdir(destPath, { recursive: true });
          await copyDir(realPath, destPath, exclude);
        } else if (realStat.isFile()) {
          await fs.copyFile(realPath, destPath);
        }
      } catch (err) {
        console.warn(`  ⚠️  Failed to resolve symlink ${entry.name}: ${err.message}`);
      }
      continue;
    }

    if (st.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath, exclude);
    } else if (st.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('📦 Starting sync fetch...\n');

  const config = await loadConfig();
  const buildConfig = getBuildConfig(config);
  const cacheDir = buildConfig.cacheDir;

  // 读取检测结果
  let syncResult;
  try {
    const raw = await fs.readFile('.sync-result.json', 'utf8');
    syncResult = JSON.parse(raw);
  } catch {
    console.log('❌ No sync result found. Run `npm run sync:check` first.');
    return;
  }

  if (syncResult.skills.length === 0) {
    console.log('✅ No skills to update');
    return;
  }

  console.log(`📥 Fetching ${syncResult.skills.length} skills...\n`);

  // 按仓库分组，避免重复 clone
  const repoMap = new Map();
  for (const skill of syncResult.skills) {
    const key = `${skill.source.repo}@${skill.latestCommit}`;
    if (!repoMap.has(key)) {
      repoMap.set(key, {
        repo: skill.source.repo,
        ref: skill.source.ref,
        commit: skill.latestCommit,
        skills: []
      });
    }
    repoMap.get(key).skills.push(skill);
  }

  // 确保缓存目录存在
  await fs.mkdir(cacheDir, { recursive: true });

  // 克隆并提取内容
  for (const [key, { repo, ref, commit, skills }] of repoMap) {
    console.log(`\n🔄 Cloning ${repo.split('/').pop()}@${ref}...`);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-sync-'));

    try {
      // 浅克隆
      const cloneResult = spawnSync('git', [
        'clone', '--depth', '1', '--branch', ref, repo, tmpDir
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

      if (cloneResult.status !== 0) {
        console.error(`  ❌ Failed to clone ${repo}`);
        console.error(`  Error: ${cloneResult.stderr}`);
        continue;
      }

      console.log(`  ✓ Cloned successfully`);

      // 提取每个 skill 的内容
      for (const skill of skills) {
        const sourcePath = skill.source.path;
        const srcDir = sourcePath === '.' ? tmpDir : path.join(tmpDir, sourcePath);
        const destDir = path.join(cacheDir, skill.id);

        // 检查 SKILL.md 存在
        const skillMdPath = path.join(srcDir, 'SKILL.md');
        try {
          await fs.access(skillMdPath);
        } catch {
          console.warn(`  ⚠️  SKILL.md not found for ${skill.id}`);
          continue;
        }

        // 清理并复制
        await fs.rm(destDir, { recursive: true, force: true });
        await fs.mkdir(destDir, { recursive: true });

        // 复制所有文件（排除 .git 等）
        await copyDir(srcDir, destDir, ['.git', 'node_modules', '.x_skill.yaml', 'skill.yaml']);

        // 更新 .x_skill.yaml 的 syncedCommit
        const metaPath = skill.file;
        const metaRaw = await fs.readFile(metaPath, 'utf8');
        const meta = YAML.parse(metaRaw);
        meta.source.syncedCommit = commit;
        await fs.writeFile(metaPath, YAML.stringify(meta), 'utf8');

        console.log(`  ✓ ${skill.id} synced`);
      }
    } finally {
      // 清理临时目录
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  console.log('\n✅ Sync fetch completed!\n');
  console.log('Next steps:');
  console.log('  1. Review changes: git status');
  console.log('  2. Build registry: npm run build:registry');
  console.log('  3. Commit: git add . && git commit -m "chore: sync upstream changes"');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
