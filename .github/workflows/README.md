# CI/CD 工作流使用指南

本仓库包含 3 个主要的 GitHub Actions 工作流，用于自动化技能同步、验证和部署。

## 🔄 自动同步工作流 (sync.yml)

### 触发方式
- **自动**: 每天 20:00 UTC
- **手动**: Actions → "Sync Skills" → Run workflow

### 功能
- 检查上游技能仓库的变更（使用三阶段检测）
- 自动拉取变更的技能内容到 `.cache/skills/`
- 更新技能元数据中的 `syncedCommit`
- 重建 registry 文件
- 自动提交和推送变更

### 手动触发参数
- **force_fetch**: 强制同步所有技能（忽略缓存）

### 使用场景
- 定期保持技能内容最新
- 手动触发紧急同步
- 强制重新同步所有技能

---

## ✅ 验证工作流 (validate.yml)

### 触发方式
- PR 创建或更新时
- Push 到 `import/**` 分支时

### 功能
- 验证技能元数据格式
- 检查 registry 文件是否最新
- 构建 registry 和站点（测试构建）
- 使用缓存加速验证

### 使用场景
- PR 代码审查前的自动验证
- 确保变更不会破坏构建
- 导入新技能的自动检查

---

## 🚀 部署工作流 (deploy.yml)

### 触发方式
- Push 到 `main` 分支时

### 功能
- 恢复技能内容缓存
- 检查上游变更（可选，仅提示）
- 构建 registry（缓存优先）
- 构建静态站点
- 部署到 GitHub Pages

### 使用场景
- 主分支更新后自动部署
- 同步工作流提交后自动部署
- 手动合并 PR 后自动部署

---

## 📊 工作流协作

```
┌─────────────────┐
│  定时触发/手动   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   sync.yml      │ ← 检测变更 → 拉取内容 → 提交
└────────┬────────┘
         │ (push to main)
         ▼
┌─────────────────┐
│   deploy.yml    │ ← 恢复缓存 → 构建 → 部署
└─────────────────┘


┌─────────────────┐
│   创建 PR       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  validate.yml   │ ← 验证 → 构建测试
└────────┬────────┘
         │ (merge)
         ▼
┌─────────────────┐
│   deploy.yml    │ ← 部署
└─────────────────┘
```

---

## 💾 缓存机制

所有工作流共享技能内容缓存：

- **位置**: `.cache/skills/`
- **键格式**: `skills-cache-{commit-sha}`
- **回退键**: `skills-cache-` (使用最近的缓存)
- **自动清理**: GitHub 7 天未使用自动删除

### 缓存流程
1. **sync.yml** 更新缓存并保存
2. **deploy.yml** 恢复缓存用于构建
3. **validate.yml** 恢复缓存用于验证

---

## 🛠️ 本地开发命令

```bash
# 检查上游变更
npm run sync:check

# 拉取变更的技能
npm run sync:fetch

# 完整同步（检查 + 拉取）
npm run sync

# 重建 registry
npm run build:registry

# 验证技能
npm run validate

# 检查 registry 是否最新
npm run check:registry
```

---

## 📋 常见任务

### 手动同步技能
```bash
# GitHub UI
Actions → Sync Skills → Run workflow → Run workflow

# 或本地运行
npm run sync
git add .
git commit -m "sync: Update skills"
git push
```

### 查看同步结果
```bash
# 查看最近的 sync 运行
Actions → Sync Skills → 最近运行

# 查看 Summary
点击运行 → Summary 标签

# 查看详细日志
点击运行 → 展开各个步骤
```

### 调试部署问题
```bash
# 检查部署状态
Actions → Deploy (GitHub Pages) → 最近运行

# 查看缓存
Settings → Actions → Caches

# 清除缓存重新构建
Settings → Actions → Caches → Delete all → 触发新的部署
```

---

## ⚙️ 配置修改

### 修改同步时间
编辑 `.github/workflows/sync.yml`:
```yaml
schedule:
  - cron: '0 8 * * *'  # 改为 08:00 UTC
```

### 禁用自动同步
```yaml
on:
  # schedule:  # 注释掉
  #   - cron: '0 20 * * *'
  workflow_dispatch:  # 仅保留手动触发
```

### 部署前强制同步
编辑 `.github/workflows/deploy.yml`，将可选检查改为强制：
```yaml
- name: Sync before deploy
  run: npm run sync
```

---

## 🔐 权限说明

所有工作流使用 `GITHUB_TOKEN`（自动提供），具有以下权限：

- **sync.yml**: `contents: write` (提交变更)
- **deploy.yml**: `contents: read`, `pages: write` (部署)
- **validate.yml**: `contents: read` (只读验证)

不需要额外配置 Secret（除非访问私有源仓库）。

---

## 📊 监控建议

### 日常监控
- 每周检查一次 sync.yml 运行状态
- 有 PR 时关注 validate.yml 结果
- 部署后验证 GitHub Pages 更新

### 问题排查
1. **同步失败**: 查看 Actions 日志，检查网络/API 限流
2. **部署失败**: 检查构建日志，验证缓存状态
3. **缓存问题**: 清除缓存，手动触发同步

---

## 📚 更多文档

- [PHASE5_COMPLETE.md](./PHASE5_COMPLETE.md) - 详细的技术文档
- [plan.md](./plan.md) - 完整的实施计划

---

## 🎯 快速参考

| 任务 | 命令/操作 |
|------|----------|
| 手动同步 | Actions → Sync Skills → Run workflow |
| 查看同步结果 | Actions → Sync Skills → 最近运行 → Summary |
| 触发部署 | 推送到 main 分支 |
| 验证 PR | 自动触发（创建 PR 时） |
| 清除缓存 | Settings → Actions → Caches → Delete |
| 本地同步 | `npm run sync` |
| 本地构建 | `npm run build:registry` |

---

需要帮助？查看 [GitHub Actions 文档](https://docs.github.com/en/actions) 或检查仓库的 Issues。
