# 常见问题排查

## CLI

### `Skill "x" not found in registry`

常见原因：

- registry 仓库没有更新/提交 `registry/index.json`
- 指向了错误的 registry（`--registry` 或 `SKILL_REGISTRY_URL`）
- 指向了错误的 ref（`--ref` 或 `SKILL_REGISTRY_REF`）

修复：

```bash
npm run validate
npm run build:registry
```

提交并 push `registry/*.json` 后再重试。

### 找不到 `curl` / `tar`

安装器会调用系统的 `curl` 与 `tar`：

- macOS/Linux：一般自带
- Windows：请确保 `curl.exe` 与 `tar.exe` 在 PATH 中

## 站点（GitHub Pages）

### Project Pages 下资源/页面 404

请正确设置 `SITE_BASE_PATH`（一般为仓库名），以便 Next.js 的 `basePath`/`assetPrefix` 正确。

## Importer

### Import workflow 没有触发

- Issue 必须被打上 `import-approved`
- 检查仓库 Actions 权限是否允许创建 PR

### 报错 “Missing SKILL.md”

确保 `items[].sourcePath` 指向的目录下存在 `SKILL.md`。

### 导入后的文件不完整

为了安全，symlink 会被跳过。导入前请把 symlink 替换为真实文件。

