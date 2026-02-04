// scripts/sync-check.mjs
/**
 * 三阶段增量检测脚本
 * Stage 1: git ls-remote 检测仓库级变动
 * Stage 2: GitHub Compare API 检测文件级变动
 * Stage 3: 输出需要更新的 skill 列表
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fg from 'fast-glob';
import YAML from 'yaml';
import { loadConfig, getSyncConfig } from './lib/config.mjs';

/**
 * Stage 1: 获取远程最新 commit
 */
async function getLatestCommit(repo, ref) {
  // Try branches first, then tags, then direct ref match
  const refCandidates = ref.startsWith('refs/')
    ? [ref]
    : [`refs/heads/${ref}`, `refs/tags/${ref}`, ref];

  for (const refPath of refCandidates) {
    const result = spawnSync('git', ['ls-remote', repo, refPath], {
      encoding: 'utf8',
      timeout: 30000
    });

    if (result.status !== 0) {
      console.warn(`⚠️  ls-remote failed for ${repo}`);
      return null;
    }

    const sha = result.stdout.split(/\s+/)[0];
    if (sha) return sha;
  }

  return null;
}

/**
 * Stage 2: 获取变更文件列表 (GitHub Compare API)
 */
async function getChangedFiles(owner, repo, base, head) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'skills-registry-sync'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`;

  try {
    const res = await fetch(url, { headers });

    if (!res.ok) {
      console.warn(`⚠️  Compare API failed for ${owner}/${repo}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.files?.map(f => f.filename) || [];
  } catch (error) {
    console.warn(`⚠️  Compare API error for ${owner}/${repo}:`, error.message);
    return null;
  }
}

/**
 * 解析 GitHub URL
 */
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 Starting sync check...\n');

  const config = await loadConfig();
  const syncConfig = getSyncConfig(config);
  const concurrency = syncConfig.concurrency;

  // 加载所有 skill (v2: skills/{category}/{skill-id}/.x_skill.yaml)
  const skillFiles = await fg(['skills/*/*/.x_skill.yaml'], { dot: true });
  const skills = [];

  for (const file of skillFiles) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const meta = YAML.parse(raw);
      skills.push({ file, meta });
    } catch (error) {
      console.warn(`⚠️  Failed to read ${file}:`, error.message);
    }
  }

  console.log(`📦 Found ${skills.length} skills\n`);

  if (skills.length === 0) {
    console.log('ℹ️  No skills to check');
    await fs.writeFile('.sync-result.json', JSON.stringify({ skills: [] }, null, 2));
    return;
  }

  // Stage 1: 按仓库分组，并行检测
  const repoMap = new Map();
  for (const skill of skills) {
    const { repo, ref } = skill.meta.source || {};
    if (!repo || !ref) {
      console.warn(`⚠️  Skill ${skill.meta.id} missing source.repo or source.ref`);
      continue;
    }

    const key = `${repo}@${ref}`;
    if (!repoMap.has(key)) {
      repoMap.set(key, { repo, ref, skills: [] });
    }
    repoMap.get(key).skills.push(skill);
  }

  console.log(`🔎 Stage 1: Checking ${repoMap.size} unique repos...\n`);

  // 并行执行 ls-remote
  const repoEntries = [...repoMap.entries()];
  const reposWithChanges = [];

  for (let i = 0; i < repoEntries.length; i += concurrency) {
    const batch = repoEntries.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async ([key, { repo, ref, skills }]) => {
        const latestCommit = await getLatestCommit(repo, ref);
        return { key, repo, ref, skills, latestCommit };
      })
    );

    for (const { repo, ref, skills, latestCommit } of results) {
      if (!latestCommit) continue;

      // 检查是否有任何 skill 的 syncedCommit 不同
      const needsCheck = skills.some(s =>
        s.meta.source?.syncedCommit !== latestCommit
      );

      if (needsCheck) {
        reposWithChanges.push({ repo, ref, skills, latestCommit });
        console.log(`  ✓ ${repo.split('/').pop()} has new commits`);
      }
    }
  }

  console.log(`\n📊 ${reposWithChanges.length} repos have new commits\n`);

  if (reposWithChanges.length === 0) {
    console.log('✅ All skills are up to date!');
    await fs.writeFile('.sync-result.json', JSON.stringify({ skills: [] }, null, 2));
    return;
  }

  // Stage 2: 检测文件级变动
  console.log('🔬 Stage 2: Checking file-level changes...\n');

  const skillsToUpdate = [];

  for (const { repo, ref, skills, latestCommit } of reposWithChanges) {
    const parsed = parseGitHubUrl(repo);
    if (!parsed) {
      console.warn(`⚠️  Invalid GitHub URL: ${repo}`);
      continue;
    }

    for (const skill of skills) {
      const { syncedCommit } = skill.meta.source || {};

      if (!syncedCommit) {
        // 首次同步，需要拉取
        skillsToUpdate.push({
          ...skill,
          latestCommit,
          reason: 'initial'
        });
        console.log(`  📥 ${skill.meta.id}: initial sync`);
        continue;
      }

      if (syncedCommit === latestCommit) {
        continue;
      }

      // 调用 Compare API
      const changedFiles = await getChangedFiles(
        parsed.owner,
        parsed.repo,
        syncedCommit,
        latestCommit
      );

      if (!changedFiles) {
        // API 失败，保守处理，标记为需要更新
        skillsToUpdate.push({
          ...skill,
          latestCommit,
          reason: 'api-fallback'
        });
        console.log(`  ⚠️  ${skill.meta.id}: API failed, will update`);
        continue;
      }

      // 检查 source.path 下是否有文件变动
      const sourcePath = skill.meta.source.path;
      const prefix = sourcePath === '.' ? '' : `${sourcePath}/`;
      const hasChanges = changedFiles.some(f =>
        f.startsWith(prefix) || f === sourcePath
      );

      if (hasChanges) {
        skillsToUpdate.push({
          ...skill,
          latestCommit,
          changedFiles: changedFiles.filter(f => f.startsWith(prefix)),
          reason: 'files-changed'
        });
        console.log(`  ✓ ${skill.meta.id}: files changed`);
      } else {
        console.log(`  ⊘ ${skill.meta.id}: repo changed but skill files unchanged`);
      }
    }
  }

  console.log(`\n📝 Summary: ${skillsToUpdate.length} skills need update\n`);

  if (skillsToUpdate.length > 0) {
    for (const s of skillsToUpdate) {
      console.log(`  - ${s.meta.id} (${s.reason})`);
    }
  }

  // 输出结果供下一步使用
  await fs.writeFile('.sync-result.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    skills: skillsToUpdate.map(s => ({
      id: s.meta.id,
      file: s.file,
      source: s.meta.source,
      latestCommit: s.latestCommit,
      reason: s.reason
    }))
  }, null, 2));

  console.log('\n✅ Sync check complete! Results saved to .sync-result.json\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
