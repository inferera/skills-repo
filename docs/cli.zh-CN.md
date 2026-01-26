# CLI（`aiskill`）

CLI 用于把 skill 安装到各类 agent 的 skills 目录，并支持列表与卸载。

## 命令

### 列出技能

```bash
npx aiskill list
npx aiskill list --json
```

常用参数：

- `--registry <url>`：覆盖默认 registry 仓库
- `--ref <ref>` / `--branch <ref>`：指定 Git ref（branch/tag）

### 安装 skill

```bash
npx aiskill add <skill-id> --agent claude --scope project
```

常用参数：

- `--agent <name>`：`claude`、`codex`、`opencode`、`cursor`、`antigravity`
- `--scope <scope>`：`project`（默认）或 `global`
- `--registry <url>`：覆盖默认 registry 仓库
- `--ref <ref>` / `--branch <ref>`：指定 Git ref（branch/tag）

注意：

- 安装时会排除 `.x_skill.yaml`（仅注册表使用的元数据）
- `<skill-id>` 必须是 slug（`^[a-z0-9]+(?:-[a-z0-9]+)*$`）

### 卸载 skill

```bash
npx aiskill remove <skill-id> --agent claude --scope project
```

## 环境变量

- `SKILL_REGISTRY_URL`：默认 registry GitHub URL（例如 `https://github.com/OWNER/REPO`）
- `SKILL_REGISTRY_REF`：默认 Git ref（例如 `main`、`v1.2.3`）

命令行参数优先生效。

## CLI 工作原理

1. 从以下地址拉取 `registry/index.json`：
   - `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/registry/index.json`
2. 找到目标 skill 的 `repoPath`
3. 下载 GitHub tarball，仅解压该子目录到 agent 的 skills 目录

## 运行要求

- Node.js >= 18
- 系统需提供 `curl` 与 `tar`（macOS/Linux 默认具备；Windows 10+ 通常也自带）

