# Importer（GitHub 仓库 → Issue → PR）

Importer 用于从公开 GitHub 仓库导入 skills，并且不需要给站点任何后端凭证。

流程：

1. 通过站点 UI（`/import`）生成导入 Issue
2. 维护者给 Issue 加上 `import-approved` 标签
3. GitHub Actions 执行导入脚本并自动开 PR

## 使用 UI

1. 打开 `/import`
2. 粘贴 `https://github.com/owner/repo`
3. 选择检测到的一个或多个 `SKILL.md` 目录
4. 为每个 item 选择目标 `category/subcategory`
5. 点击 “Open import issue”

## Issue 格式（v2）

Issue body 中包含一个机器可读 block：

```text
<!-- skillhub-import:v2
sourceRepo: https://github.com/OWNER/REPO
ref: main
items:
  - sourcePath: path/to/skill-dir
    id: your-skill-id
    title: Human readable title
    targetCategory: development
    targetSubcategory: frontend
    tags: [tag-a, tag-b]
    isUpdate: true
-->
```

规则：

- `items[].id`、`targetCategory`、`targetSubcategory` 必须是 slug
- `items[].sourcePath` 不允许包含 `..`
- `isUpdate: true` 允许替换已有同名 skill（同 id）

模板文件：`.github/ISSUE_TEMPLATE/import-request.md`

## Importer 做了什么

Workflow：`.github/workflows/import.yml`

脚本：`scripts/import-from-issue.mjs`

对每个 item 会：

1. 按 `ref` clone `sourceRepo`
2. 把 `sourcePath` 复制到 `skills/<category>/<subcategory>/<id>/`
3. 生成 `.x_skill.yaml`（并忽略源仓库里的 `.x_skill.yaml`）
4. 运行 `npm run validate`
5. 创建 PR

## 安全与限制

默认限制（降低风险）：

- 单个 issue 最多 20 个 item
- 每个 item 最大复制文件数：2500
- 每个 item 最大复制体积：50MB
- 跳过 symlink（不会跟随）
- 跳过常见无关目录：`.git/`、`node_modules/`、`.next/`、`dist/`、`out/`

## 已知约束

- UI 仅支持公开 GitHub 仓库（浏览器侧 GitHub API 调用不带鉴权）。

