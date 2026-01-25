# 部署与使用手册（GitHub Pages + Next.js 静态站点）

本仓库是一个“Skills Registry”：

- skills 源码：`skills/<category>/<subcategory>/<skill-id>/`
- 每个 skill 必须包含：`SKILL.md` + `skill.yaml`
- 自动生成索引：`registry/*.json`（CI 生成，不需要手动提交）
- 站点：`site/`（Next.js，`output: "export"` 纯静态，SEO 友好）
- 导入器：站点 `/import` 解析 GitHub 仓库 -> 生成“导入 Issue” -> Maintainer 打标签 -> GitHub Action 自动开 PR

以下文档覆盖：

1) 一次性配置（部署需要做什么）
2) 日常使用（添加 skill、导入 skill、发布站点）
3) 功能说明（站点/CI/Importer 的能力与边界）
4) 常见问题排查

---

## 1. 一次性配置（部署到 GitHub Pages）

### 1.1 启用 GitHub Actions

- 确保仓库允许运行 Actions（一般默认开启）

### 1.2 配置 GitHub Pages

路径：GitHub Repo -> Settings -> Pages

- Source：选择 **GitHub Actions**
- 保存后，后续每次 `push main` 会触发 `.github/workflows/deploy.yml` 自动发布

说明：

- 部署产物来自 `site/out/`（Next.js 静态导出）
- Workflow 使用 `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`

### 1.3 配置 Workflow 权限（非常重要）

路径：GitHub Repo -> Settings -> Actions -> General -> Workflow permissions

建议：

- 选择 **Read and write permissions**

原因：

- `import.yml` 需要写入分支并创建 PR（`contents: write`、`pull-requests: write`）
- 如果仓库级默认权限是只读，Importer 工作流会失败

### 1.4 创建必需 Label（Importer gating）

Importer 的触发条件是：**Issue 被打上 `import-approved` 标签**。

路径：GitHub Repo -> Issues -> Labels

- 新建 label：`import-approved`（颜色随意）

安全策略：

- 只有有权限的维护者才能给 issue 加 label，所以这是“纯静态站点 + 无后端”的安全阀

---

## 2. 可选配置（推荐）

### 2.1 Actions Variables（推荐用变量而不是 secrets）

路径：GitHub Repo -> Settings -> Secrets and variables -> Actions -> Variables

可配置项：

- `SITE_URL`（推荐）
  - 站点的公开 URL（不建议以 `/` 结尾）
  - 用于：SEO 的 `metadataBase`、生成 `sitemap.xml`、`robots.txt`

- `SITE_BASE_PATH`（可选）
  - GitHub Pages project site 的 base path，一般等于仓库名
  - 特殊值：`ROOT` 表示 base path 为空（用于 user/org pages 或自定义域名挂根目录）

- `NEXT_PUBLIC_SITE_NAME`（可选）
  - 站点标题（默认 `Skills Registry`）

- `NEXT_PUBLIC_REPO_SLUG`（一般不需要手动配）
  - 形如：`OWNER/REPO`
  - 用于：Importer 生成 “new issue” 链接指向正确的仓库
  - CI 已在 workflow 中自动注入为当前仓库：`${{ github.repository }}`
  - 本地开发时可在 `site/.env.local` 设置（见 4.4）

说明：

- 这些变量会在 `.github/workflows/deploy.yml` 中作为 override 使用
- 如果你不设置，workflow 会自动推导默认值：
  - **Project Pages**：`https://<owner>.github.io/<repo>`
  - **User/Org Pages**（repo 名为 `<owner>.github.io`）：`https://<owner>.github.io`

### 2.2 自定义域名（Custom Domain）

如果你要绑定自定义域名：

1. GitHub Repo -> Settings -> Pages -> Custom domain 填你的域名
2. DNS 按 GitHub Pages 指引配置（A/AAAA 或 CNAME）
3. 在 Actions Variables 设置：
   - `SITE_URL=https://your-domain.com`（或带子路径）
   - 如果你的站点挂在根目录：`SITE_BASE_PATH=ROOT`
   - 如果挂在子路径：`SITE_BASE_PATH=your-path` 且 `SITE_URL=https://your-domain.com/your-path`

---

## 3. 日常发布流程（你只需要做什么）

### 3.1 PR 校验（自动）

触发：每个 PR

Workflow：`.github/workflows/validate.yml`

做的事情：

1. `npm ci`（根目录）安装工具依赖
2. `npm run validate`：校验每个 skill 的目录和 `skill.yaml` schema
3. `npm run build:registry`：生成 `registry/*.json` + `site/public/registry/*.json`
4. `npm ci --prefix site` + `npm run build --prefix site`：构建 Next.js 静态站点（确保能发布）

### 3.2 合并到 main 自动部署（自动）

触发：`push` 到 `main`

Workflow：`.github/workflows/deploy.yml`

做的事情：

1. 构建 registry（如果设置了 `SITE_URL`，额外生成 sitemap/robots）
2. `site/` 执行 Next.js build + export
3. 发布到 GitHub Pages

---

## 4. 添加/维护 Skill（贡献者工作流）

### 4.1 目录规则（2 层分类）

必须是：

`skills/<category>/<subcategory>/<skill-id>/`

要求：

- `<category>` / `<subcategory>` / `<skill-id>` 都建议用 slug（小写 + `-`）
- `skill-id` 必须全局唯一，并且要与目录名一致

### 4.2 必需文件

每个 skill 目录必须包含：

- `SKILL.md`
- `skill.yaml`（满足 `schemas/skill.schema.json`）

### 4.3 分类元数据（可选）

为了让站点展示更友好，可以加：

- `skills/<category>/_category.yaml`
- `skills/<category>/<subcategory>/_category.yaml`

用于定义标题、描述等（示例已在 `skills/design/_category.yaml`）

### 4.4 本地验证与构建（推荐）

从仓库根目录：

```bash
npm install
npm run validate
npm run build:registry
```

站点本地运行：

```bash
npm install --prefix site
npm run dev --prefix site
```

---

## 5. 站点功能说明（SEO + 浏览 + 搜索）

站点路由（静态导出）：

- `/`：主页（搜索 + 快速入口）
- `/categories`：分类列表（2 层）
- `/c/<category>/<subcategory>`：分类下技能列表（支持关键字过滤）
- `/s/<skill-id>`：技能详情（渲染 `SKILL.md` + 展示 metadata + 文件树）
- `/import`：导入器（默认 noindex，不收录）

SEO 相关：

- 每个 skill / category 页面是预渲染 HTML（对搜索引擎友好）
- `SITE_URL` 设置后会生成：
  - `sitemap.xml`
  - `robots.txt`

---

## 6. Importer（从 GitHub 导入 skill -> 自动 PR）

### 6.1 使用方式（站点 UI）

1) 打开站点：`/import`
2) 输入：`https://github.com/owner/repo`
3) 点击 Parse repo
4) 勾选要导入的 skill，并选择目标分类 `<category>/<subcategory>`
5) 点击 “Open import issue”
6) Maintainer 在 issue 上加标签 `import-approved`
7) 等待 Action 完成并在 issue 下评论 PR 链接

### 6.2 Issue 模板（不走 UI 也可以）

你也可以直接用模板创建 issue：

`.github/ISSUE_TEMPLATE/import-request.md`

其中会包含一个 machine-readable block：

```txt
<!-- skillhub-import:v1
sourceRepo: https://github.com/OWNER/REPO
ref: main
items:
  - sourcePath: path/to/skill-dir
    targetCategory: design
    targetSubcategory: ui-ux
-->
```

### 6.3 Importer 的安全与限制

Importer 工作流只在 **issue 被维护者加上 `import-approved` label** 后运行。

导入脚本：`scripts/import-from-issue.mjs`

限制（默认）：

- 单次最多导入 20 个 item（issue block 解析层限制）
- 每个 skill 目录复制有硬限制：
  - 最大文件数：2500
  - 最大体积：50MB
- 拒绝 symlink
- 跳过常见无关目录：`.git/`、`node_modules/`、`.next/`、`dist/`、`out/`

### 6.4 常见失败原因

- 没有创建 `import-approved` label：维护者无法加标签
- Workflow 权限是只读：无法创建分支/PR
- sourceRepo/ref 不存在：`git clone` 或 `checkout` 失败
- sourcePath 下缺少 `skill.yaml` / `SKILL.md`
- 导入目标目录已存在（skill id 冲突）

---

## 7. FAQ / Troubleshooting

### 7.1 Pages 打开后样式/资源 404

通常是 basePath 不匹配：

- Project Pages：URL 形如 `https://<owner>.github.io/<repo>/`
  - 默认无需配置
- User/Org Pages（repo 叫 `<owner>.github.io`）：
  - workflow 已自动识别并设置空 basePath
- 自定义域名：
  - 设置 `SITE_URL`
  - 如果挂根目录：`SITE_BASE_PATH=ROOT`

### 7.2 站点页面没有 skill / 报 Missing registry

说明 registry 没生成：

- 本地：先跑 `npm run build:registry`
- CI：检查 `deploy.yml` / `validate.yml` 是否跑成功

### 7.3 Importer UI 提示 GitHub API rate limit

Importer 使用匿名 API（默认 60 req/hour）。

建议：

- 尽量一次解析后完成勾选
- 后续可加“可选 token 输入框”来提升额度（TODO）

---

## 8. 相关文件入口（改配置/看实现）

- 部署：`.github/workflows/deploy.yml`
- PR 校验：`.github/workflows/validate.yml`
- Importer workflow：`.github/workflows/import.yml`
- Importer 脚本：`scripts/import-from-issue.mjs`
- registry 生成：`scripts/build-registry.mjs`
- skill schema：`schemas/skill.schema.json`
- 站点：`site/`
