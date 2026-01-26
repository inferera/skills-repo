# 代码审计（问题清单 + 优化建议）

本文用于总结仓库在做什么、当前设计意图是什么，以及 review 过程中发现的高优先级问题（含具体文件位置与建议方案）。

## 这个仓库在做什么

本仓库是一个 **Skills Registry（技能注册表）**，包含三条“分发面”：

1. **源数据（source of truth）**：`skills/<category>/<subcategory>/<skill-id>/`
   - 必需：`SKILL.md` + `.x_skill.yaml`
2. **生成的 registry**：`registry/*.json`（由 `skills/` 生成）
   - CLI 与站点都会消费这些文件
3. **静态站点**：`site/`（Next.js 静态导出）
   - 浏览/搜索
   - Importer UI（`/import`）生成导入 Issue，触发自动 PR

配套自动化：

- `scripts/build-registry.mjs` 生成 `registry/*.json` 并复制到 `site/public/registry/*.json`
- `scripts/validate.mjs` 用 `schemas/skill.schema.json` 校验 `.x_skill.yaml`
- `.github/workflows/import.yml` 在 Issue 标签门禁通过后运行 `scripts/import-from-issue.mjs` 导入外部仓库并创建 PR

## P0 / P1 问题与风险（以及对应位置）

### 1）CLI 安装路径/压缩包根目录计算错误（已修复）

位置：

- `cli/commands/add.mjs`
- 旧文档/UI 中也有类似错误的 tar 解压逻辑（例如旧版 `INSTALL.md`、站点安装片段）。

为什么是 bug：

- GitHub tarball 顶层总会有一个根目录（例如 `<repo>-<ref>`）。如果根目录计算错误，`tar` 解压会报 “Not found in archive”。
- macOS 的 BSD `tar` 对参数顺序更敏感，把选项放在文件列表后面可能会导致解压失败。

已做修复：

- `cli/commands/add.mjs` 改为使用：
  - `https://codeload.github.com/<owner>/<repo>/tar.gz/<ref>`
  - 正确的 archive root + `--strip-components` 计算
  - 兼容 BSD/GNU tar 的参数顺序
- 新增 `cli/lib/` 下的共享工具，避免在多个命令里重复实现 GitHub/tar 逻辑。

### 2）Importer UI 在 GitHub Pages 的 `basePath` 下失效（已修复）

位置：

- 之前：`site/app/import/page.tsx` 使用了 `fetch("/registry/index.json")` 这类绝对路径请求。

为什么是 bug：

- GitHub Pages 的 project site 通常部署在 `/<repo-name>/...` 下。绝对路径 `/registry/*` 会绕过 basePath，导致 404。

已做修复：

- 拆分 Importer 为：
  - 服务端页面：`site/app/import/page.tsx`（通过 `site/lib/registry.ts` 读取 registry）
  - 客户端 UI：`site/app/import/ImportClient.tsx`（通过 props 接收 registry 数据）

### 3）导入 Issue 模板与导入脚本不兼容（已修复）

位置：

- `.github/ISSUE_TEMPLATE/import-request.md`
- `scripts/import-from-issue.mjs`

为什么是 bug：

- 模板仍为 `skillhub-import:v1`，缺少导入脚本必需字段 `items[].id`。
- `scripts/import-from-issue.mjs` 需要 `items[].id` 等字段用于生成 `.x_skill.yaml`。

已做修复：

- 将 `.github/ISSUE_TEMPLATE/import-request.md` 升级为 `skillhub-import:v2`，并补齐必需字段。

### 4）Importer 跟随 symlink（安全风险）（已修复）

位置：

- `scripts/import-from-issue.mjs`（`copyDirChecked`）

为什么危险：

- 导入过程中如果跟随 symlink，可能把 checkout 目录之外的文件复制进 PR（典型的供应链/秘密泄露风险）。

已做修复：

- Importer 现在会 **跳过 symlink**（打印警告，不跟随）。

### 5）重复且损坏的安装脚本（已通过删除修复）

位置：

- `scripts/install-skill.mjs`

为什么是 bug：

- 文件启动即报错（`node:stream` 中不存在 `Extract`）。
- 逻辑与真正的 CLI（`cli/`）重复，容易漂移。

已做修复：

- 删除 `scripts/install-skill.mjs`，减少维护面。

### 6）本地产物被提交进仓库（已修复）

位置：

- `site/.env.local` 被提交。
- 安装后的 skill 副本被提交到：
  - `.codex/skills/**`
  - `.claude/skills/**`
- `.codex/skills/**` 里还包含二进制的 `__pycache__/*.pyc`。

为什么有问题：

- 模糊了“source of truth”（skills 应该在 `skills/`，而不是 `.codex/skills/`）。
- 增大 GitHub tarball 体积，影响安装与构建速度。
- `.env.local` 通常应为本地私有配置，不应纳入版本控制。

已做修复：

- 删除这些已提交的本地产物，并补齐忽略规则：
  - `.gitignore`：`site/.env.local` + `.<agent>/skills/`
  - `.npmignore`：忽略 agent 目录，避免 npm 包膨胀
- `site/.env.example` 补充 `NEXT_PUBLIC_REPO_REF`。

## 可维护性 / 设计问题（建议）

### A）“registry 文件必须提交”与“CI 生成无需提交”的矛盾

位置：

- 旧文档之间存在互相矛盾（例如旧中文部署文档声称 registry 不需要手动提交）。

为什么重要：

- CLI 会通过 GitHub raw URL 拉取 `registry/index.json`。
- 如果 `registry/*.json` 不提交，CLI 很难在 GitHub 分发场景下稳定工作。

建议：

- 统一为一个单一策略（并在文档里固定为 SSOT）：
  - 要么坚持提交 `registry/*.json`（当前分发契约），要么
  - 改造 CLI 改为拉取一个“必然存在”的发布物（GitHub Releases / npm 资源 / 托管 endpoint）。

### B）Agent 列表在 CLI 与站点重复维护

位置：

- CLI：`cli/lib/agents.mjs`
- 站点：`site/components/QuickInstallClient.tsx`

建议：

- 抽到单一共享文件（例如 `shared/agents.json`），两端共同引用，减少漂移。

### C）registry 输出的 `generatedAt` 会导致无意义的 diff

位置：

- `scripts/build-registry.mjs` 将 `generatedAt = new Date().toISOString()` 写入输出。

影响：

- 只要重新构建就会变动，即使 skills 未改变，也会产生 noisy diff。
- CI 很难用 `git diff --exit-code` 判断“registry 是否最新”。

建议：

- 将 `generatedAt` 改为可复现（例如基于 `git rev-parse HEAD`），或提供 CI 下的 deterministic 模式。

### D）Importer UI 的 GitHub API rate limit 与鲁棒性

位置：

- `site/app/import/ImportClient.tsx` 在浏览器侧直接调用 GitHub REST API（无鉴权）。

风险：

- 无鉴权 rate limit 可能导致高频使用时导入失败。

建议：

- OSS 场景下保持现状即可，但在文档里明确限制；必要时可考虑允许用户输入 token（客户端侧）作为可选增强。

### E）`_category.yaml` 缺少 schema 校验

位置：

- `scripts/lib/registry.mjs` 会读取 `_category.yaml`，但只做了有限的 id mismatch 检查。

建议：

- 增加 `_category.yaml` 的 schema，并纳入 `scripts/validate.mjs` 校验。

### F）站点性能 lint 提示（可选）

位置：

- `site/components/SkillCard.tsx`、`site/components/SkillMiniCard.tsx` 使用 `<img>`（Next 推荐 `<Image />`）。

建议：

- 若追求极致 LCP 可迁移到 `next/image`；考虑到本项目是纯静态导出，也可以接受 `<img>` 并忽略该 warning。

