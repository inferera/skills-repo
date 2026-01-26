# 维护者指南

## CI 工作流

- `validate`：`.github/workflows/validate.yml`
  - `npm ci`
  - `npm run validate`
  - 构建 registry + 构建站点，保证仓库可发布
- `deploy`：`.github/workflows/deploy.yml`
  - `main` 分支自动发布静态站点到 GitHub Pages
- `import`：`.github/workflows/import.yml`
  - 通过 Issue 标签 `import-approved` 作为触发门禁
  - 运行 `scripts/import-from-issue.mjs` 并自动开 PR

## 合并 Skill PR 的检查清单

1. 目录符合：`skills/<category>/<subcategory>/<skill-id>/`
2. `SKILL.md` 与 `.x_skill.yaml` 完整
3. `npm run validate` 通过
4. PR 中包含最新的 `registry/*.json`（由 `npm run build:registry` 生成）

为什么必须带上 `registry/*.json`：

- CLI 会通过 GitHub raw URL 拉取 `registry/index.json`
- 静态站点构建也依赖 registry 输出

## Importer 运营

1. 确保仓库存在 label：`import-approved`
2. 确保 Actions 权限允许创建 PR（`contents: write`、`pull-requests: write`）
3. 像审查普通贡献一样审查 Importer 自动生成的 PR

安全策略：

- 只有维护者加了 `import-approved` 才会运行
- 导入脚本会跳过 symlink，并限制文件数/体积

## 发布 CLI 到 npm（可选）

仓库通过 `package.json#bin` 暴露 `aiskill` 可执行文件。

建议步骤：

```bash
npm version patch|minor|major
npm publish
```

发布后用户可使用：

```bash
npx aiskill list
```

## 仓库卫生

不要提交：

- `site/.env.local`
- 安装产物目录：`./.claude/skills/`、`./.codex/skills/` 等

