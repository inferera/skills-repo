# 贡献一个 Skill

贡献者应 **优先使用前端提交流程（Importer UI）**，这样能保证注册表结构一致，减少“目录乱七八糟的 PR”。

## 推荐方式：通过 Importer 前端提交

1）在你自己的公开 GitHub 仓库（或分支）准备 skill

- 一个 skill 放在一个目录里，目录内包含 `SKILL.md`（必需）。
- 可以包含任意辅助文件（scripts/assets/templates 等）。
- 不需要提供 `.x_skill.yaml`（Importer 会自动生成）。

2）通过注册表站点提交

- 打开 `/import`
- 填入仓库 URL（例如 `https://github.com/owner/repo`）
- 选择检测到的 skills（包含 `SKILL.md` 的目录）
- 选择目标 `category/subcategory`
- 点击 **Open Import Issue**

3）维护者审批

- 维护者给 issue 加 `import-approved`
- GitHub Actions 会把文件导入到 `skills/<category>/<subcategory>/<skill-id>/` 并自动开 PR

详情见：`docs/importer.zh-CN.md`

## 高阶方式：直接提 PR（维护者/熟练贡献者）

确有需要直接修改本仓库时，请遵守目录规范：

`skills/<category>/<subcategory>/<skill-id>/`

规则：

- `<category>`、`<subcategory>`、`<skill-id>` 必须是 slug：`^[a-z0-9]+(?:-[a-z0-9]+)*$`
- 必需文件：`SKILL.md` + `.x_skill.yaml`
- 在仓库根目录运行：

```bash
npm install
npm run validate
npm run build:registry
```

提交 skill 目录与更新后的 `registry/*.json`，然后发起 PR。
