# 文档索引

本仓库是一个社区化的 **Skills Registry（技能注册表）**：

- 技能源文件在 `skills/<category>/<subcategory>/<skill-id>/`
- 每个 skill 需要 `SKILL.md`（人类可读说明）+ `.x_skill.yaml`（注册表元数据）
- `scripts/build-registry.mjs` 生成 `registry/*.json`（CLI 与站点都会用到）
- `site/` 是 Next.js 静态导出站点（浏览/搜索 + Importer 导入器）
- `aiskill` 是 `npx` CLI，用于把 skill 安装到各类 agent 工具目录

English docs: `docs/index.md`

## 文档导航

- `docs/quickstart.zh-CN.md` — 安装 skill、浏览站点
- `docs/contributing.zh-CN.md` — 如何提交 skill（优先走前端）
- `docs/cli.zh-CN.md` — `aiskill` CLI 使用与配置
- `docs/importer.zh-CN.md` — Importer 导入器 + Issue 格式 + 安全约束
- `docs/deployment.zh-CN.md` — GitHub Pages + Vercel 部署（适用于内部/分叉仓库）
- `docs/maintainers.zh-CN.md` — 维护者工作流、CI、发布
- `docs/troubleshooting.zh-CN.md` — 常见问题与排查
- `docs/audit.zh-CN.md` — 代码审计：问题清单 + 优化建议
- `docs/plan.zh-CN.md` — 详细改造/演进计划
