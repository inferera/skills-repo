# 改造/演进计划（Roadmap）

本计划面向两类人群：

1. 广大社区开发者：想要贡献并共享 skill 的开发者
2. 内部团队：需要分叉、部署、迁移 registry（支持 GitHub Pages + Vercel）

约束：

- 文档只保留“最新版本”（避免 RFC/重复文档）
- 中英文双语（EN + zh-CN）
- 功能必须完整，所有改动需要自测通过

## 阶段 0 —— 统一单一事实来源（Docs + 契约）

产出：

- `docs/x.md` + `docs/x.zh-CN.md` 的成对文档结构
- 删除相互矛盾/过时的文档
- 明确分发契约：
  - skills 的 source of truth 在 `skills/`
  - CLI/站点分发依赖 `registry/*.json`

验收标准：

- 贡献者能在 2 次点击内找到“如何新增 skill”
- 部署文档覆盖 GitHub Pages 与 Vercel

## 阶段 1 —— 修复 P0/P1 功能问题（CLI + Importer）

目标：

- CLI 在 macOS/Linux 上稳定可用（兼容 BSD/GNU tar）
- Importer 在 GitHub Pages `basePath` 下正常工作
- Import Issue 模板与导入脚本解析一致
- 移除/避免不安全行为（路径穿越、跟随 symlink）

验收标准：

- `aiskill add` 至少能成功安装一个示例 skill
- `/import` 在 basePath 下能正确加载分类与 index
- Import workflow 能解析 v2 的 issue block 并生成 PR

## 阶段 2 —— 仓库卫生 + 可配置化

目标：

- 清理被提交的本地产物（`site/.env.local`、`.<agent>/skills/**`、`*.pyc`）
- 默认配置通过环境变量/参数即可迁移，无需改代码

验收标准：

- 本地安装/构建后 `git status` 不会出现脏文件（均被 ignore）
- 分叉迁移只需要改 env，不需要改源码

## 阶段 3 —— 文档重写（EN + zh-CN）

文档要以真实使用场景为中心：

- Quickstart：浏览 + 安装
- Contributing：skill 格式 + 校验 + PR 流程
- CLI：命令 + 参数 + 环境变量
- Importer：UI 流程 + issue 格式 + 安全限制
- Deployment：GitHub Pages + Vercel
- Maintainers：CI、label 门禁、发布
- Troubleshooting：常见问题
- Audit：已知问题与建议

验收标准：

- “安装方式”不在多处重复且互相矛盾
- 示例使用占位符（`OWNER/REPO`），并解释必需 env
- 中英文在结构与信息量上对齐

## 阶段 4 —— 自测/验证清单

在仓库根目录执行：

```bash
npm run validate
npm run build:registry
npm run build:site
```

CLI 冒烟测试（建议在临时目录）：

```bash
mkdir -p /tmp/aiskill-test && cd /tmp/aiskill-test
node /path/to/repo/cli/index.mjs list
node /path/to/repo/cli/index.mjs add ui-ux-pro-max --agent claude --scope project
node /path/to/repo/cli/index.mjs remove ui-ux-pro-max --agent claude --scope project
```

Importer 冒烟测试：

- 使用 `.github/ISSUE_TEMPLATE/import-request.md` 创建 issue
- 给 issue 加上 `import-approved` label
- 验证 workflow 能创建 PR 且 `npm run validate` 通过

## 阶段 5 —— 可选的后续优化

高收益方向：

- 让 `registry/*.json` 可复现，减少无意义 diff（`generatedAt`）
- 为 `_category.yaml` 增加 schema 校验
- CLI 与站点共享 agent 定义，避免漂移
- 增加单元测试：
  - importer issue block 解析
  - CLI registry 拉取与路径校验

