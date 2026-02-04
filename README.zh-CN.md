# Skills Registry

[English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Deutsch](./README.de.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md)

一个开放的、由社区维护的 AI 编程代理技能注册表。支持浏览、安装和分享可复用的技能，兼容 [Claude Code](https://claude.ai)、[Cursor](https://cursor.com)、[Codex](https://openai.com/codex)、[OpenCode](https://opencode.ai) 和 [Antigravity](https://antigravity.ai)。

## 提交技能

1. 将你的技能托管在公开的 GitHub 仓库中，确保包含 `SKILL.md` 文件。
2. 访问注册表网站，使用 **Import** 页面提交。
3. 维护者审核通过后将自动导入。

## 仓库结构

```
skills/          技能元数据 (.x_skill.yaml) 和分类定义
schemas/         用于校验的 JSON Schema
scripts/         构建、同步和校验脚本
cli/             CLI 工具 (aiskill)
site/            Next.js 网站 (静态导出)
config/          全局配置 (registry.yaml)
registry/        生成的注册表索引 (请勿手动编辑)
.github/         CI/CD 工作流 (校验、部署、同步)
```

## 开发

```bash
npm install                  # 安装依赖
npm run validate             # 校验所有技能元数据
npm run build:registry       # 同步技能文件并构建注册表
npm run dev:site             # 构建注册表并启动开发服务器
npm run check:registry       # 验证注册表是否为最新
```

## 许可证

[MIT](./LICENSE)
