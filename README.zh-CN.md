# Skills Registry（技能注册表）

一个社区维护的 AI Agent skills 注册表：

- 技能源文件：`skills/<category>/<subcategory>/<skill-id>/`
- 每个 skill：`.x_skill.yaml`（可校验元数据）+ `SKILL.md`（使用说明）
- 静态站点（`site/`）：浏览/搜索 + Importer 导入器
- `aiskill` CLI（通过 `npx`）：把 skill 安装到各类 agent 的 skills 目录

文档入口：

- English：`docs/index.md`
- 中文：`docs/index.zh-CN.md`

## 快速开始

```bash
# 直接从 GitHub 运行（无需发布到 npm）
npx github:OWNER/REPO list
npx github:OWNER/REPO add ui-ux-pro-max --agent claude --scope project

# 发布到 npm 之后
npx aiskill list
npx aiskill add ui-ux-pro-max --agent claude --scope project
```

## 贡献

推荐贡献方式：

- 将你的 skill 放到公开 GitHub 仓库中（目录内必须包含 `SKILL.md`）
- 使用站点的 `/import` 页面生成导入 issue

详见 `docs/contributing.zh-CN.md` 与 `docs/importer.zh-CN.md`。

## 仓库结构

```txt
skills/      # source of truth: community skills
schemas/     # JSON Schema（.x_skill.yaml）
scripts/     # build/validate 工具脚本
cli/         # CLI 工具（aiskill）
site/        # Next.js 静态站点
docs/        # 文档（EN + zh-CN）
registry/    # 生成的索引（供站点/工具消费）
```

贡献流程见 `docs/contributing.zh-CN.md`，部署见 `docs/deployment.zh-CN.md`。
