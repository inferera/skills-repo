# 快速开始

## 浏览 Skills

- 使用静态站点（`site/`）浏览/搜索 skills。
- 在 skill 详情页阅读 `SKILL.md`，并复制安装命令。

## 安装 Skill（CLI）

CLI 可执行文件名为 `aiskill`。

### 方式 A：直接从 GitHub 运行（无需发布到 npm）

```bash
npx github:OWNER/REPO list
npx github:OWNER/REPO add ui-ux-pro-max --agent claude --scope project
npx github:OWNER/REPO remove ui-ux-pro-max --agent claude --scope project
```

### 方式 B：从 npm 运行（发布后）

```bash
npx aiskill list
npx aiskill add ui-ux-pro-max --agent claude --scope project
npx aiskill remove ui-ux-pro-max --agent claude --scope project
```

## Agent 与安装范围

- `--agent`：`claude`、`codex`、`opencode`、`cursor`、`antigravity`
- `--scope`：
  - `project`：安装到 `./.<agent>/skills/<skill-id>/`
  - `global`：安装到 `~/.<agent>/skills/<skill-id>/`

## 使用自定义 Registry（分叉 / 内部部署）

```bash
export SKILL_REGISTRY_URL="https://github.com/your-org/skills-repo"
export SKILL_REGISTRY_REF="main" # 或 tag/branch

npx aiskill list
npx aiskill add your-skill-id --agent codex --scope project
```

更多参数与配置见 `docs/cli.zh-CN.md`。

