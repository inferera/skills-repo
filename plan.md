# Skills Registry 架构改造计划

## 一、改造目标概览

| 目标 | 当前状态 | 改造后 |
|------|---------|--------|
| 目录结构 | 二级分类 `skills/{cat}/{subcat}/{id}/` | 一级分类 `skills/{cat}/{id}/` |
| 存储内容 | 完整文件（SKILL.md、代码等） | 只存 `.x_skill.yaml` |
| 构建方式 | 读取本地文件 | 从 GitHub 拉取后构建 |
| 同步机制 | 手动导入 | 自动增量同步 |
| 分类多语言 | 不支持 | 支持 10 种语言 |
| CI/CD | Push 触发 | Push + 定时(4:00) + 手动 |

---

## 二、全局配置统一

### 2.1 新增全局配置文件

```yaml
# /config/registry.yaml - 全局配置（单一来源）
specVersion: 1

# 支持的语言列表
locales:
  - id: en
    label: English
    default: true
  - id: zh-CN
    label: 简体中文
  - id: zh-TW
    label: 繁體中文
  - id: ja
    label: 日本語
  - id: ko
    label: 한국어
  - id: de
    label: Deutsch
  - id: es
    label: Español
  - id: fr
    label: Français
  - id: pt
    label: Português
  - id: ru
    label: Русский

# 支持的 Agent 列表
agents:
  - id: claude
    label: Claude Code
    projectDir: .claude/skills
    globalDir: ~/.claude/skills
  - id: cursor
    label: Cursor
    projectDir: .cursor/skills
    globalDir: ~/.cursor/skills
  - id: codex
    label: Codex CLI
    projectDir: .codex/skills
    globalDir: ~/.codex/skills
  - id: opencode
    label: OpenCode
    projectDir: .opencode/skills
    globalDir: ~/.opencode/skills
  - id: antigravity
    label: Antigravity
    projectDir: .antigravity/skills
    globalDir: ~/.antigravity/skills

# 同步配置
sync:
  # 定时同步的 cron 表达式 (UTC)
  schedule: "0 20 * * *"  # UTC 20:00 = 北京时间 4:00
  # 并发检测数
  concurrency: 10
  # 导入限制
  limits:
    maxFiles: 2500
    maxBytes: 52428800  # 50MB

# 构建配置
build:
  # 是否在构建时拉取最新内容
  fetchOnBuild: true
  # 缓存目录
  cacheDir: .cache/skills
```

### 2.2 配置加载器

```javascript
// /scripts/lib/config.mjs
import fs from 'node:fs/promises';
import YAML from 'yaml';

let _config = null;

export async function loadConfig() {
  if (_config) return _config;

  const raw = await fs.readFile('config/registry.yaml', 'utf8');
  _config = YAML.parse(raw);
  return _config;
}

export function getDefaultLocale(config) {
  return config.locales.find(l => l.default)?.id || 'en';
}

export function getLocaleIds(config) {
  return config.locales.map(l => l.id);
}
```

---

## 三、Schema 改造

### 3.1 技能 Schema（更新）

```json
// /schemas/skill.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "skill.schema.json",
  "title": "Skill Metadata",
  "type": "object",
  "required": ["specVersion", "id", "title", "description", "category", "source"],
  "additionalProperties": false,
  "properties": {
    "specVersion": { "type": "integer", "const": 2 },
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    },
    "title": { "type": "string", "minLength": 1, "maxLength": 120 },
    "description": { "type": "string", "minLength": 1 },
    "category": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      "description": "一级分类 ID"
    },
    "license": { "type": "string" },
    "authors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name": { "type": "string" },
          "url": { "type": "string" },
          "email": { "type": "string" }
        }
      }
    },
    "tags": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" }
    },
    "agents": {
      "type": "array",
      "items": { "type": "string" }
    },
    "source": {
      "type": "object",
      "required": ["repo", "path", "ref"],
      "properties": {
        "repo": { "type": "string", "format": "uri" },
        "path": { "type": "string" },
        "ref": { "type": "string" },
        "syncedCommit": { "type": "string", "minLength": 7 }
      }
    },
    "related": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### 3.2 分类 Schema（新增，支持多语言）

```json
// /schemas/category.schema.json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "category.schema.json",
  "title": "Category Metadata",
  "type": "object",
  "required": ["id", "title", "description"],
  "additionalProperties": false,
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$"
    },
    "title": { "$ref": "#/$defs/i18nString" },
    "description": { "$ref": "#/$defs/i18nString" },
    "icon": { "type": "string" },
    "order": { "type": "integer", "description": "排序权重，数字越小越靠前" }
  },
  "$defs": {
    "i18nString": {
      "oneOf": [
        { "type": "string" },
        {
          "type": "object",
          "required": ["en"],
          "properties": {
            "en": { "type": "string" },
            "zh-CN": { "type": "string" },
            "zh-TW": { "type": "string" },
            "ja": { "type": "string" },
            "ko": { "type": "string" },
            "de": { "type": "string" },
            "es": { "type": "string" },
            "fr": { "type": "string" },
            "pt": { "type": "string" },
            "ru": { "type": "string" }
          },
          "additionalProperties": false
        }
      ]
    }
  }
}
```

---

## 四、目录结构改造

### 4.1 新目录结构

```
skills-repo/
├── config/
│   └── registry.yaml              # 全局配置
│
├── schemas/
│   ├── skill.schema.json          # 技能 Schema v2
│   └── category.schema.json       # 分类 Schema（新增）
│
├── skills/                        # 一级分类
│   ├── design/
│   │   ├── _category.yaml         # 分类元数据（多语言）
│   │   ├── ui-ux-pro-max/
│   │   │   └── .x_skill.yaml      # 只有元信息
│   │   └── figma-helper/
│   │       └── .x_skill.yaml
│   │
│   ├── development/
│   │   ├── _category.yaml
│   │   ├── skill-creator/
│   │   │   └── .x_skill.yaml
│   │   └── code-reviewer/
│   │       └── .x_skill.yaml
│   │
│   ├── devops/
│   ├── testing/
│   ├── documentation/
│   └── tools/
│
├── scripts/
│   ├── lib/
│   │   ├── config.mjs             # 配置加载
│   │   ├── registry.mjs           # 核心库（更新）
│   │   ├── sync.mjs               # 同步逻辑（新增）
│   │   └── i18n.mjs               # 多语言工具（新增）
│   │
│   ├── build-registry.mjs         # 构建脚本（更新）
│   ├── validate.mjs               # 验证脚本（更新）
│   ├── sync-check.mjs             # 增量检测（新增）
│   ├── sync-fetch.mjs             # 拉取内容（新增）
│   ├── import-from-issue.mjs      # 导入脚本（更新）
│   └── migrate-v1-to-v2.mjs       # 迁移脚本（新增）
│
├── registry/                      # 构建输出
│   ├── index.json
│   ├── categories.json
│   ├── search-index.json
│   └── agents.json
│
├── .cache/                        # 构建缓存（gitignore）
│   └── skills/                    # 拉取的技能内容缓存
│
├── site/                          # 前端（更新）
│   └── ...
│
└── .github/
    └── workflows/
        ├── deploy.yml             # 部署（更新）
        ├── validate.yml           # 验证（更新）
        ├── sync.yml               # 定时同步（新增）
        └── import.yml             # 导入（更新）
```

### 4.2 .x_skill.yaml 示例

```yaml
# skills/design/ui-ux-pro-max/.x_skill.yaml
specVersion: 2
id: ui-ux-pro-max
title: UI/UX Pro Max
description: >
  UI/UX design intelligence with 50 styles, 21 palettes,
  50 font pairings for React, Vue, Svelte, and more.
category: design
tags:
  - ui
  - ux
  - design
  - react
  - tailwind
agents:
  - claude
  - cursor
source:
  repo: https://github.com/anthropics/skills
  path: skills/ui-ux-pro-max
  ref: main
  syncedCommit: abc123def456...
```

### 4.3 _category.yaml 示例

```yaml
# skills/design/_category.yaml
id: design
title:
  en: Design
  zh-CN: 设计
  zh-TW: 設計
  ja: デザイン
  ko: 디자인
  de: Design
  es: Diseño
  fr: Design
  pt: Design
  ru: Дизайн
description:
  en: UI/UX, visual design, and prototyping skills
  zh-CN: UI/UX、视觉设计和原型制作技能
  zh-TW: UI/UX、視覺設計和原型製作技能
  ja: UI/UX、ビジュアルデザイン、プロトタイピングスキル
  ko: UI/UX, 시각 디자인 및 프로토타이핑 스킬
  de: UI/UX, visuelles Design und Prototyping-Fähigkeiten
  es: Habilidades de UI/UX, diseño visual y prototipado
  fr: Compétences UI/UX, design visuel et prototypage
  pt: Habilidades de UI/UX, design visual e prototipagem
  ru: Навыки UI/UX, визуального дизайна и прототипирования
icon: palette
order: 1
```

---

## 五、核心脚本实现

### 5.1 同步检测脚本

```javascript
// /scripts/sync-check.mjs
/**
 * 三阶段增量检测：
 * Stage 1: git ls-remote 检测仓库级变动
 * Stage 2: GitHub Compare API 检测文件级变动
 * Stage 3: 输出需要更新的 skill 列表
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import YAML from 'yaml';
import { loadConfig } from './lib/config.mjs';

// Stage 1: 获取远程最新 commit
async function getLatestCommit(repo, ref) {
  const refPath = ref.startsWith('refs/') ? ref : `refs/heads/${ref}`;
  const result = spawnSync('git', ['ls-remote', repo, refPath], {
    encoding: 'utf8',
    timeout: 30000
  });

  if (result.status !== 0) {
    console.warn(`Warning: ls-remote failed for ${repo}`);
    return null;
  }

  const sha = result.stdout.split(/\s+/)[0];
  return sha || null;
}

// Stage 2: 获取变更文件列表 (GitHub Compare API)
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
  const res = await fetch(url, { headers });

  if (!res.ok) {
    console.warn(`Warning: Compare API failed for ${owner}/${repo}: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.files?.map(f => f.filename) || [];
}

// 解析 GitHub URL
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// 主函数
async function main() {
  const config = await loadConfig();
  const concurrency = config.sync?.concurrency || 10;

  // 加载所有 skill
  const skillFiles = await fg(['skills/*/.x_skill.yaml'], { dot: true });
  const skills = [];

  for (const file of skillFiles) {
    const raw = await fs.readFile(file, 'utf8');
    const meta = YAML.parse(raw);
    skills.push({ file, meta });
  }

  console.log(`Found ${skills.length} skills`);

  // Stage 1: 按仓库分组，并行检测
  const repoMap = new Map();
  for (const skill of skills) {
    const { repo, ref } = skill.meta.source || {};
    if (!repo || !ref) continue;

    const key = `${repo}@${ref}`;
    if (!repoMap.has(key)) {
      repoMap.set(key, { repo, ref, skills: [] });
    }
    repoMap.get(key).skills.push(skill);
  }

  console.log(`Checking ${repoMap.size} unique repos...`);

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
      }
    }
  }

  console.log(`${reposWithChanges.length} repos have new commits`);

  if (reposWithChanges.length === 0) {
    console.log('No changes detected');
    await fs.writeFile('.sync-result.json', JSON.stringify({ skills: [] }));
    return;
  }

  // Stage 2: 检测文件级变动
  const skillsToUpdate = [];

  for (const { repo, ref, skills, latestCommit } of reposWithChanges) {
    const parsed = parseGitHubUrl(repo);
    if (!parsed) continue;

    for (const skill of skills) {
      const { syncedCommit } = skill.meta.source || {};

      if (!syncedCommit) {
        // 首次同步，需要拉取
        skillsToUpdate.push({
          ...skill,
          latestCommit,
          reason: 'initial'
        });
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
      } else {
        console.log(`${skill.meta.id}: repo changed but skill files unchanged, skipping`);
      }
    }
  }

  console.log(`\n${skillsToUpdate.length} skills need update:`);
  for (const s of skillsToUpdate) {
    console.log(`  - ${s.meta.id} (${s.reason})`);
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
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### 5.2 同步拉取脚本

```javascript
// /scripts/sync-fetch.mjs
/**
 * 根据 sync-check 的结果，拉取需要更新的 skill 内容
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import { loadConfig } from './lib/config.mjs';

async function main() {
  const config = await loadConfig();
  const cacheDir = config.build?.cacheDir || '.cache/skills';

  // 读取检测结果
  let syncResult;
  try {
    const raw = await fs.readFile('.sync-result.json', 'utf8');
    syncResult = JSON.parse(raw);
  } catch {
    console.log('No sync result found, run sync-check first');
    return;
  }

  if (syncResult.skills.length === 0) {
    console.log('No skills to update');
    return;
  }

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
    console.log(`\nCloning ${repo}@${ref}...`);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-sync-'));

    try {
      // 浅克隆
      const cloneResult = spawnSync('git', [
        'clone', '--depth', '1', '--branch', ref, repo, tmpDir
      ], { encoding: 'utf8', stdio: 'inherit' });

      if (cloneResult.status !== 0) {
        console.error(`Failed to clone ${repo}`);
        continue;
      }

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
          console.warn(`Warning: SKILL.md not found for ${skill.id}`);
          continue;
        }

        // 清理并复制
        await fs.rm(destDir, { recursive: true, force: true });
        await fs.mkdir(destDir, { recursive: true });

        // 复制所有文件（排除 .git 等）
        await copyDir(srcDir, destDir, ['.git', 'node_modules', '.x_skill.yaml']);

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

  console.log('\nSync completed');
}

async function copyDir(src, dest, exclude = []) {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath, exclude);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

### 5.3 构建脚本（更新）

```javascript
// /scripts/build-registry.mjs (关键更新部分)

import { loadConfig } from './lib/config.mjs';

async function main() {
  const config = await loadConfig();
  const cacheDir = config.build?.cacheDir || '.cache/skills';

  // 1. 扫描所有 .x_skill.yaml
  const skillFiles = await fg(['skills/*/.x_skill.yaml'], { dot: true });

  const skills = [];
  const errors = [];

  for (const file of skillFiles) {
    const raw = await fs.readFile(file, 'utf8');
    const meta = YAML.parse(raw);

    // 验证 schema
    const valid = validateSkill(meta);
    if (!valid) {
      errors.push({ file, errors: validateSkill.errors });
      continue;
    }

    // 从缓存读取内容
    const skillCacheDir = path.join(cacheDir, meta.id);
    const skillMdPath = path.join(skillCacheDir, 'SKILL.md');

    let summary = meta.description;
    let files = [];

    try {
      // 读取 SKILL.md 提取摘要
      const skillMd = await fs.readFile(skillMdPath, 'utf8');
      summary = extractSummary(skillMd) || summary;

      // 获取文件列表
      files = await getFileList(skillCacheDir);
    } catch {
      console.warn(`Warning: No cached content for ${meta.id}`);
    }

    skills.push({
      ...meta,
      repoPath: path.dirname(file),
      summary,
      files
    });
  }

  // 2. 加载分类（支持多语言）
  const categories = await loadCategories();

  // 3. 生成输出
  const output = {
    specVersion: 2,
    generatedAt: new Date().toISOString(),
    skills: skills.sort((a, b) => a.id.localeCompare(b.id))
  };

  await fs.writeFile('registry/index.json', JSON.stringify(output, null, 2));

  // 4. 生成分类索引
  const categoryOutput = {
    specVersion: 2,
    generatedAt: new Date().toISOString(),
    categories: categories.map(c => ({
      ...c,
      count: skills.filter(s => s.category === c.id).length
    }))
  };

  await fs.writeFile('registry/categories.json', JSON.stringify(categoryOutput, null, 2));

  // 5. 复制到 site/public
  await fs.cp('registry', 'site/public/registry', { recursive: true });

  // 6. 复制缓存内容到 site 用于构建
  for (const skill of skills) {
    const src = path.join(cacheDir, skill.id);
    const dest = path.join('site/.cache/skills', skill.id);
    try {
      await fs.cp(src, dest, { recursive: true });
    } catch {
      // 忽略不存在的缓存
    }
  }

  console.log(`Built registry: ${skills.length} skills, ${categories.length} categories`);
}
```

---

## 六、CI/CD 配置

### 6.1 定时同步工作流（新增）

```yaml
# /.github/workflows/sync.yml
name: Sync Upstream

on:
  schedule:
    # UTC 20:00 = 北京时间 4:00
    - cron: '0 20 * * *'
  workflow_dispatch:
    inputs:
      force:
        description: 'Force sync all skills'
        required: false
        default: 'false'

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check for updates
        id: check
        run: |
          npm run sync:check
          if [ -f .sync-result.json ]; then
            count=$(jq '.skills | length' .sync-result.json)
            echo "count=$count" >> $GITHUB_OUTPUT
          else
            echo "count=0" >> $GITHUB_OUTPUT
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Fetch updated content
        if: steps.check.outputs.count != '0'
        run: npm run sync:fetch
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build registry
        if: steps.check.outputs.count != '0'
        run: npm run build:registry

      - name: Create Pull Request
        if: steps.check.outputs.count != '0'
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: 'chore: sync upstream changes'
          title: '[Auto] Sync upstream changes'
          body: |
            Automated sync from upstream repositories.

            Updated skills: ${{ steps.check.outputs.count }}

            Triggered by: ${{ github.event_name }}
          branch: auto-sync
          delete-branch: true
          labels: |
            auto-sync
            bot
```

### 6.2 部署工作流（更新）

```yaml
# /.github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          npm ci --prefix site

      - name: Restore skill cache
        uses: actions/cache@v4
        with:
          path: .cache/skills
          key: skills-cache-${{ hashFiles('skills/**/.x_skill.yaml') }}
          restore-keys: |
            skills-cache-

      - name: Fetch skill content (if needed)
        run: |
          npm run sync:check
          npm run sync:fetch
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build registry
        run: npm run build:registry
        env:
          SITE_URL: ${{ vars.SITE_URL }}

      - name: Build site
        run: npm run build --prefix site
        env:
          SITE_URL: ${{ vars.SITE_URL }}
          SITE_BASE_PATH: ${{ vars.SITE_BASE_PATH }}
          NEXT_PUBLIC_REPO_SLUG: ${{ github.repository }}

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: site/out

      - name: Deploy to Pages
        uses: actions/deploy-pages@v4
```

### 6.3 验证工作流（更新）

```yaml
# /.github/workflows/validate.yml
name: Validate

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Validate skills
        run: npm run validate

      - name: Check registry
        run: npm run check:registry
```

---

## 七、前端改造

### 7.1 更新路由结构

```
site/app/
├── page.tsx                    # 首页（保持）
├── categories/
│   └── page.tsx                # 分类列表（保持）
├── c/
│   └── [category]/
│       └── page.tsx            # 分类详情（简化，移除 [subcategory]）
├── s/
│   └── [skillId]/
│       └── page.tsx            # 技能详情（更新读取路径）
└── import/
    └── page.tsx                # 导入页面（更新）
```

### 7.2 分类页面更新

```tsx
// site/app/c/[category]/page.tsx
import { loadRegistryCategories, loadRegistryIndex } from '@/lib/registry';
import { getLocalizedText } from '@/lib/i18n';

export async function generateStaticParams() {
  const { categories } = await loadRegistryCategories();
  return categories.map(c => ({ category: c.id }));
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params;
  const { categories } = await loadRegistryCategories();
  const { skills } = await loadRegistryIndex();

  const cat = categories.find(c => c.id === category);
  if (!cat) notFound();

  const categorySkills = skills.filter(s => s.category === category);

  return (
    <div>
      {/* 分类标题使用多语言 */}
      <CategoryHeader category={cat} />

      {/* 技能列表 */}
      <SkillGrid skills={categorySkills} />
    </div>
  );
}
```

### 7.3 多语言分类组件

```tsx
// site/components/CategoryHeader.tsx
'use client';

import { useLocale } from '@/lib/i18n-client';

interface Category {
  id: string;
  title: string | Record<string, string>;
  description: string | Record<string, string>;
  icon?: string;
}

function getLocalizedText(
  value: string | Record<string, string>,
  locale: string
): string {
  if (typeof value === 'string') return value;
  return value[locale] || value.en || Object.values(value)[0] || '';
}

export function CategoryHeader({ category }: { category: Category }) {
  const locale = useLocale();

  const title = getLocalizedText(category.title, locale);
  const description = getLocalizedText(category.description, locale);

  return (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
```

### 7.4 技能页面更新（读取缓存）

```tsx
// site/app/s/[skillId]/page.tsx (关键更新)

export default async function SkillPage({
  params
}: {
  params: Promise<{ skillId: string }>
}) {
  const { skillId } = await params;
  const skill = await getSkillById(skillId);
  if (!skill) notFound();

  // 从缓存目录读取 SKILL.md
  const cacheDir = path.resolve(process.cwd(), '.cache/skills', skillId);
  const skillMdPath = path.join(cacheDir, 'SKILL.md');

  let markdown = '';
  try {
    markdown = await fs.readFile(skillMdPath, 'utf8');
  } catch {
    // 缓存不存在，显示提示
    markdown = '> Content not available. Please wait for sync.';
  }

  // ... 其余渲染逻辑
}
```

---

## 八、迁移脚本

```javascript
// /scripts/migrate-v1-to-v2.mjs
/**
 * 将现有的二级分类结构迁移到一级分类
 * 将完整文件存储迁移到只存元信息
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import YAML from 'yaml';

async function main() {
  console.log('Starting migration v1 -> v2...\n');

  // 1. 查找所有现有技能
  const oldSkillFiles = await fg(['skills/*/*/*/.x_skill.yaml'], { dot: true });

  console.log(`Found ${oldSkillFiles.length} skills to migrate\n`);

  for (const oldPath of oldSkillFiles) {
    // 解析路径: skills/{category}/{subcategory}/{id}/.x_skill.yaml
    const parts = oldPath.split('/');
    const category = parts[1];
    const subcategory = parts[2];
    const skillId = parts[3];

    console.log(`Migrating: ${skillId}`);
    console.log(`  From: ${category}/${subcategory}/${skillId}`);
    console.log(`  To:   ${category}/${skillId}`);

    // 读取旧元数据
    const oldMeta = YAML.parse(await fs.readFile(oldPath, 'utf8'));

    // 创建新元数据
    const newMeta = {
      specVersion: 2,
      id: oldMeta.id,
      title: oldMeta.title,
      description: oldMeta.description,
      category: category,  // 只保留一级分类
      license: oldMeta.license,
      authors: oldMeta.authors,
      tags: oldMeta.tags || [],
      agents: oldMeta.agents,
      source: {
        repo: oldMeta.source?.repo || '',
        path: oldMeta.source?.path || '.',
        ref: oldMeta.source?.ref || 'main',
        syncedCommit: oldMeta.source?.commit || ''
      },
      related: oldMeta.related
    };

    // 清理 undefined 字段
    Object.keys(newMeta).forEach(k => {
      if (newMeta[k] === undefined) delete newMeta[k];
    });

    // 新目录路径
    const newDir = `skills/${category}/${skillId}`;
    const newPath = `${newDir}/.x_skill.yaml`;

    // 创建新目录
    await fs.mkdir(newDir, { recursive: true });

    // 写入新元数据
    await fs.writeFile(newPath, YAML.stringify(newMeta), 'utf8');

    // 复制 SKILL.md 和其他文件到缓存（用于首次构建）
    const oldDir = path.dirname(oldPath);
    const cacheDir = `.cache/skills/${skillId}`;
    await fs.mkdir(cacheDir, { recursive: true });

    const files = await fs.readdir(oldDir);
    for (const file of files) {
      if (file === '.x_skill.yaml') continue;
      await fs.copyFile(
        path.join(oldDir, file),
        path.join(cacheDir, file)
      );
    }

    console.log(`  ✓ Migrated\n`);
  }

  // 2. 迁移分类元数据
  console.log('\nMigrating categories...\n');

  const oldCategoryFiles = await fg(['skills/*/_category.yaml', 'skills/*/*/_category.yaml']);

  // 合并分类（取顶级分类）
  const categories = new Map();

  for (const file of oldCategoryFiles) {
    const parts = file.split('/');
    const isTopLevel = parts.length === 3;  // skills/{cat}/_category.yaml

    if (isTopLevel) {
      const catId = parts[1];
      const meta = YAML.parse(await fs.readFile(file, 'utf8'));

      // 转换为多语言格式
      categories.set(catId, {
        id: catId,
        title: { en: meta.title },
        description: { en: meta.description || '' },
        icon: meta.icon
      });
    }
  }

  // 写入新的分类文件
  for (const [catId, meta] of categories) {
    const catDir = `skills/${catId}`;
    await fs.mkdir(catDir, { recursive: true });
    await fs.writeFile(
      `${catDir}/_category.yaml`,
      YAML.stringify(meta),
      'utf8'
    );
    console.log(`  ✓ ${catId}`);
  }

  // 3. 清理旧目录结构
  console.log('\n⚠️  Please manually review and delete old directories:');
  console.log('   rm -rf skills/*/*/* (subcategory level)');

  console.log('\n✅ Migration complete!');
  console.log('   Run `npm run build:registry` to rebuild');
}

main().catch(console.error);
```

---

## 九、package.json 脚本更新

```json
{
  "scripts": {
    "validate": "node scripts/validate.mjs",
    "build:registry": "node scripts/build-registry.mjs",
    "check:registry": "node scripts/check-registry-up-to-date.mjs",
    "sync:check": "node scripts/sync-check.mjs",
    "sync:fetch": "node scripts/sync-fetch.mjs",
    "sync": "npm run sync:check && npm run sync:fetch",
    "migrate": "node scripts/migrate-v1-to-v2.mjs",
    "dev:site": "npm run build:registry && npm run dev --prefix site",
    "build:site": "npm run build --prefix site"
  }
}
```

---

## 十、执行步骤清单

### Phase 1: 准备工作

- [ ] 1.1 创建 `config/registry.yaml` 全局配置文件
- [ ] 1.2 创建 `schemas/category.schema.json` 分类 Schema
- [ ] 1.3 更新 `schemas/skill.schema.json` 到 v2
- [ ] 1.4 创建 `scripts/lib/config.mjs` 配置加载器

### Phase 2: 核心脚本

- [ ] 2.1 创建 `scripts/sync-check.mjs` 增量检测脚本
- [ ] 2.2 创建 `scripts/sync-fetch.mjs` 内容拉取脚本
- [ ] 2.3 更新 `scripts/build-registry.mjs` 支持缓存读取
- [ ] 2.4 更新 `scripts/validate.mjs` 支持新 Schema
- [ ] 2.5 更新 `scripts/lib/registry.mjs` 支持一级分类

### Phase 3: 数据迁移

- [ ] 3.1 创建 `scripts/migrate-v1-to-v2.mjs` 迁移脚本
- [ ] 3.2 备份现有 `skills/` 目录
- [ ] 3.3 执行迁移脚本
- [ ] 3.4 验证迁移结果
- [ ] 3.5 清理旧目录结构

### Phase 4: 前端更新

- [ ] 4.1 更新 `site/lib/registry.ts` 适配新数据结构
- [ ] 4.2 删除 `site/app/c/[category]/[subcategory]/` 目录
- [ ] 4.3 更新 `site/app/c/[category]/page.tsx` 支持多语言
- [ ] 4.4 更新 `site/app/s/[skillId]/page.tsx` 读取缓存
- [ ] 4.5 创建 `site/lib/i18n-utils.ts` 多语言工具函数
- [ ] 4.6 更新导入页面移除二级分类选择

### Phase 5: CI/CD 配置

- [ ] 5.1 创建 `.github/workflows/sync.yml` 定时同步
- [ ] 5.2 更新 `.github/workflows/deploy.yml` 添加缓存和拉取
- [ ] 5.3 更新 `.github/workflows/validate.yml`
- [ ] 5.4 更新 `.github/workflows/import.yml` 适配新结构

### Phase 6: 测试验证

- [ ] 6.1 本地运行完整构建流程
- [ ] 6.2 验证同步检测功能
- [ ] 6.3 验证内容拉取功能
- [ ] 6.4 验证静态页面生成
- [ ] 6.5 验证多语言显示
- [ ] 6.6 验证导入功能

### Phase 7: 部署上线

- [ ] 7.1 创建功能分支
- [ ] 7.2 提交所有更改
- [ ] 7.3 创建 PR 并测试
- [ ] 7.4 合并到 main
- [ ] 7.5 验证自动部署
- [ ] 7.6 验证定时同步（等待下一个 4:00）

---

## 十一、回滚计划

如果出现问题，可以快速回滚：

```bash
# 1. 恢复备份
git checkout main~1 -- skills/
git checkout main~1 -- scripts/
git checkout main~1 -- site/

# 2. 重新构建
npm run build:registry
npm run build:site

# 3. 手动部署
git push origin main
```

---

## 十二、自测检查清单

### 功能测试

- [ ] `npm run validate` 通过
- [ ] `npm run sync:check` 正确检测变动
- [ ] `npm run sync:fetch` 正确拉取内容
- [ ] `npm run build:registry` 生成正确的 JSON
- [ ] `npm run build:site` 无错误
- [ ] 首页正常显示
- [ ] 分类页显示正确的多语言标题
- [ ] 技能详情页显示 SKILL.md 内容
- [ ] 搜索功能正常

### 边界情况

- [ ] 新技能（无 syncedCommit）首次同步
- [ ] 仓库变动但 skill 文件未变
- [ ] GitHub API 失败时的降级处理
- [ ] 缓存不存在时的页面显示
- [ ] 空分类的处理

### 多语言测试

- [ ] 英文显示正确
- [ ] 中文显示正确
- [ ] 切换语言后分类标题更新
- [ ] 缺少翻译时 fallback 到英文

---

## 十三、管理操作指南

### 增加分类

```bash
# 1. 创建分类目录
mkdir skills/new-category

# 2. 创建分类元数据（多语言）
cat > skills/new-category/_category.yaml << 'EOF'
id: new-category
title:
  en: New Category
  zh-CN: 新分类
description:
  en: Description of this category
  zh-CN: 这个分类的描述
EOF

# 3. 提交
git add skills/new-category/
git commit -m "feat: add new-category"
git push
```

### 删除分类

```bash
# 1. 确认分类下没有 skill
ls skills/old-category/

# 2. 删除整个分类目录
rm -rf skills/old-category/

# 3. 提交
git add -A
git commit -m "feat: remove old-category"
git push
```

### 删除技能

```bash
# 1. 删除技能目录
rm -rf skills/design/ui-ux-pro-max/

# 2. 提交
git add -A
git commit -m "feat: remove skill ui-ux-pro-max"
git push
```

### 迁移技能到其他分类

```bash
# 1. 移动目录
mv skills/design/some-skill/ skills/development/some-skill/

# 2. 更新元数据中的 category
# 修改 skills/development/some-skill/.x_skill.yaml
# category: design → category: development

# 3. 提交
git add -A
git commit -m "feat: move some-skill from design to development"
git push
```

### 添加新技能

```bash
# 1. 创建目录
mkdir -p skills/development/my-new-skill

# 2. 创建元数据
cat > skills/development/my-new-skill/.x_skill.yaml << 'EOF'
specVersion: 2
id: my-new-skill
title: My New Skill
description: What this skill does...
category: development
source:
  repo: https://github.com/username/repo
  path: path/to/skill
  ref: main
  syncedCommit: ""  # 留空，CI 会自动填充
EOF

# 3. 提交
git add skills/development/my-new-skill/
git commit -m "feat: add my-new-skill"
git push
```

---

## 十四、技术要点总结

### 三阶段增量检测

```
Stage 1: git ls-remote (无 API 限制)
    ↓ 筛选出有新 commit 的仓库
Stage 2: GitHub Compare API (少量调用)
    ↓ 筛选出特定路径有变动的 skill
Stage 3: git clone + 复制
    ↓ 只拉取真正需要更新的内容
```

### 数据流向

```
skills/
├── {category}/
│   ├── _category.yaml     # 分类元数据（多语言）
│   └── {skill-id}/
│       └── .x_skill.yaml  # 只存元信息
            ↓
      [CI: sync-check + sync-fetch]
            ↓
.cache/skills/{skill-id}/   # 拉取的完整内容
├── SKILL.md
├── 其他文件...
            ↓
      [CI: build-registry]
            ↓
registry/
├── index.json              # 技能索引
├── categories.json         # 分类索引（多语言）
└── search-index.json       # 搜索索引
            ↓
      [CI: build site]
            ↓
site/out/                   # 完整静态 HTML
├── index.html
├── c/{category}/index.html
└── s/{skill-id}/index.html
            ↓
      [Deploy: GitHub Pages]
            ↓
用户访问: 纯静态，不依赖 GitHub
```

### 关键优势

1. **源码仓库瘦身**: 只存元信息，减少 99% 存储
2. **自动同步**: 定时检测上游变化，自动更新
3. **增量构建**: 只处理变动的 skill，构建快速
4. **SEO 完整**: 静态 HTML 包含所有内容
5. **多语言支持**: 分类标题/描述支持 10 种语言
6. **访问不依赖外部**: 部署后完全独立运行
