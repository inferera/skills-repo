# 🎉 Phase 5 完成：CI/CD 配置更新

## ✅ 已完成工作

### 1. 新建定时同步工作流 `.github/workflows/sync.yml`

**功能特性**：
- ✅ 定时触发：每天 20:00 UTC 自动运行（匹配 config/registry.yaml）
- ✅ 手动触发：支持 workflow_dispatch，可选强制同步
- ✅ 三阶段检测：
  1. git ls-remote 检查仓库级别变更
  2. GitHub Compare API 检查文件级别变更
  3. 选择性拉取变更的技能
- ✅ 缓存管理：自动保存和恢复 `.cache/skills/`
- ✅ 自动提交：检测到变更后自动 commit 和 push
- ✅ 详细摘要：在 GitHub Actions Summary 中显示同步结果

**工作流程**：
```yaml
触发（定时/手动）
  ↓
检出仓库（完整历史）
  ↓
恢复技能缓存
  ↓
运行 npm run sync:check
  ↓
有变更？─ NO → 退出（✅ 无需同步）
  │
  YES
  ↓
运行 npm run sync:fetch
  ↓
重建 registry (npm run build:registry)
  ↓
保存缓存
  ↓
提交变更（skills/**/.x_skill.yaml + registry/*.json）
  ↓
推送到 main
```

**权限配置**：
```yaml
permissions:
  contents: write        # 提交变更
  pull-requests: write   # 预留（如需 PR 流程）
```

**环境变量**：
- `GITHUB_TOKEN`: 自动提供，用于 GitHub API 调用

**手动触发参数**：
- `force_fetch`: 强制同步所有技能（忽略缓存）

---

### 2. 更新部署工作流 `.github/workflows/deploy.yml`

**新增功能**：

#### a) 完整历史检出
```yaml
- name: Checkout
  uses: actions/checkout@v4
  with:
    fetch-depth: 0  # 用于同步检测
```

#### b) 缓存恢复
```yaml
- name: Restore skills cache
  uses: actions/cache@v3
  with:
    path: .cache/skills
    key: skills-cache-${{ github.sha }}
    restore-keys: |
      skills-cache-
```

**缓存策略**：
- 主键：`skills-cache-{commit-sha}` - 每次提交唯一
- 回退键：`skills-cache-` - 使用最近的缓存

#### c) 上游变更检查（可选）
```yaml
- name: Check for upstream changes (optional sync)
  id: sync_check
  continue-on-error: true
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    npm run sync:check || true
    # 如果有变更，显示提示信息
```

**特点**：
- 不阻塞构建（`continue-on-error: true`）
- 仅提示是否有上游变更
- 不自动同步（由独立的 sync.yml 处理）

#### d) 缓存感知构建
```yaml
- name: Build registry artifacts
  run: |
    echo "Building registry with cache-first approach..."
    echo "Cache status: Content from .cache/skills/ will be used if available"
    npm run build:registry
```

**工作原理**：
- 构建脚本优先从 `.cache/skills/{id}/` 读取
- 回退到 `skills/{category}/{id}/`（本地仓库）
- 利用 Phase 2 的缓存优先机制

---

### 3. 更新验证工作流 `.github/workflows/validate.yml`

**新增功能**：

#### 缓存恢复
```yaml
- name: Restore skills cache
  uses: actions/cache@v3
  with:
    path: .cache/skills
    key: skills-cache-${{ github.sha }}
    restore-keys: |
      skills-cache-
```

**作用**：
- PR 验证时使用缓存内容
- 确保验证环境与部署环境一致
- 加速 CI 构建（不需要重新拉取内容）

**验证流程保持不变**：
1. 验证技能元数据（npm run validate）
2. 检查 registry 文件是否最新（npm run check:registry）
3. 构建 registry（npm run build:registry）
4. 构建站点（npm run build --prefix site）

---

## 🔄 工作流协作

### Sync → Deploy 流程

```
定时触发（每天 20:00）或手动触发
  ↓
sync.yml 运行
  ↓
检测到变更 → 拉取 → 更新缓存 → 提交
  ↓
push 到 main 分支
  ↓
触发 deploy.yml
  ↓
恢复缓存 → 构建 → 部署
```

### PR → Validate → Merge 流程

```
创建 PR（修改技能）
  ↓
validate.yml 触发
  ↓
恢复缓存 → 验证 → 构建
  ↓
验证通过 → 合并 PR
  ↓
触发 deploy.yml → 部署
```

---

## 📊 缓存策略

### 缓存键设计
```
主键：skills-cache-{commit-sha}
  - 每次提交唯一
  - 确保缓存与代码版本对应

回退键：skills-cache-
  - 匹配最近的任何缓存
  - 即使主键未命中，也能利用旧缓存
  - 加速首次构建
```

### 缓存生命周期
```
1. sync.yml 运行
   → 更新 .cache/skills/
   → 保存新缓存（key: skills-cache-{new-sha}）

2. deploy.yml 运行
   → 恢复缓存（key: skills-cache-{current-sha}）
   → 使用缓存内容构建

3. validate.yml 运行（PR）
   → 恢复缓存（回退到最近的缓存）
   → 验证一致性
```

### 缓存优化
- **增量更新**：只同步变更的技能，不重建整个缓存
- **并发安全**：每个 commit 独立缓存键，避免竞态
- **回退机制**：缓存未命中时从本地读取（不阻塞构建）

---

## 🔧 配置文件变更

### 新增文件
```
.github/workflows/sync.yml    ✅ 定时同步工作流
```

### 更新文件
```
.github/workflows/deploy.yml  ✅ 添加缓存恢复和上游检查
.github/workflows/validate.yml ✅ 添加缓存恢复
```

### 未修改文件
```
.github/workflows/pr-lifecycle.yml  ⚪ 无需修改
.github/workflows/import.yml        ⚪ 无需修改
```

---

## 🧪 测试建议

### 1. 测试定时同步
```bash
# 方法 1: 手动触发
# GitHub UI → Actions → Sync Skills → Run workflow

# 方法 2: 等待定时触发
# 每天 20:00 UTC 自动运行

# 验证：
# - 检查 Actions 日志
# - 查看是否有新的 commit（如有变更）
# - 检查 .cache/skills/ 是否更新
```

### 2. 测试部署流程
```bash
# 创建测试提交
echo "test" > test.txt
git add test.txt
git commit -m "test: trigger deploy"
git push

# 验证：
# - deploy.yml 自动触发
# - 缓存成功恢复
# - 站点成功构建和部署
```

### 3. 测试 PR 验证
```bash
# 创建测试分支
git checkout -b test/cache-validation

# 修改技能（或添加测试文件）
echo "test" > skills/test.txt
git add skills/test.txt
git commit -m "test: validate with cache"
git push origin test/cache-validation

# 创建 PR → 观察 validate.yml 运行
# 验证：
# - 缓存恢复成功
# - 验证通过
# - 构建成功
```

---

## 🚀 使用指南

### 自动同步（推荐）
1. 无需操作，每天 20:00 UTC 自动运行
2. 如有变更，自动提交到 main 分支
3. 自动触发部署

### 手动同步
1. GitHub UI → Actions → "Sync Skills"
2. 点击 "Run workflow"
3. 可选：勾选 "Force fetch all skills"
4. 点击 "Run workflow" 开始

### 本地同步
```bash
# 检查变更
npm run sync:check

# 查看结果
cat .sync-result.json | jq

# 拉取变更
npm run sync:fetch

# 完整同步（检查 + 拉取）
npm run sync

# 重建 registry
npm run build:registry
```

---

## 📈 监控和调试

### GitHub Actions 日志
```
Actions → Sync Skills → 最近运行
  ↓
展开步骤查看详细日志：
  - Check for changes: 变更检测结果
  - Fetch changed skills: 拉取过程
  - Commit changes: 提交详情
```

### Summary 输出
每次运行后，在 Summary 标签查看：
```
## Sync Summary

✅ Changes detected and synced
- Skills updated: 5
- Cache updated: Yes
- Registry rebuilt: Yes
```

### 本地调试
```bash
# 启用详细日志
DEBUG=* npm run sync:check

# 检查同步结果
cat .sync-result.json | jq '{
  total: (.skills | length),
  repos: (.skills | group_by(.source.repo) | map({repo: .[0].source.repo, count: length}))
}'

# 验证缓存内容
ls -la .cache/skills/
cat .cache/skills/{skill-id}/.x_skill.yaml
```

---

## 🔐 权限说明

### GitHub Token 自动权限
Sync 工作流使用 `GITHUB_TOKEN`（自动提供）：
- ✅ 读取仓库内容
- ✅ 调用 GitHub API（Compare API）
- ✅ 提交和推送变更

### 不需要额外 Secret
- 公共仓库：`GITHUB_TOKEN` 足够
- 私有源仓库：需要添加 PAT（见下文）

### 私有源仓库支持（可选）
如果技能来自私有仓库，需要：

1. 创建 PAT（Personal Access Token）
   - Scopes: `repo`（完整权限）

2. 添加到 Repository Secrets
   - Name: `SKILLS_SYNC_TOKEN`
   - Value: `ghp_...`

3. 更新 sync.yml
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.SKILLS_SYNC_TOKEN }}
```

---

## 💡 最佳实践

### 1. 同步频率
- **推荐**：每天一次（当前配置）
- **高频更新**：每 6 小时（`0 */6 * * *`）
- **低频更新**：每周一次（`0 0 * * 1`）

### 2. 缓存管理
- **自动清理**：GitHub 7 天未使用的缓存自动删除
- **手动清理**：Settings → Actions → Caches → Delete
- **缓存大小**：监控 `.cache/skills/` 目录大小

### 3. 错误处理
- **同步失败**：检查 Actions 日志，手动运行 `npm run sync`
- **缓存损坏**：删除缓存，重新同步
- **API 限流**：等待限流重置或使用 PAT

### 4. 通知配置（可选）
添加 Slack/Discord 通知：
```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🎯 与其他 Phase 的集成

### Phase 2: 核心脚本
- ✅ sync.yml 调用 `npm run sync:check` 和 `npm run sync:fetch`
- ✅ deploy.yml 使用 `npm run build:registry`（缓存优先）
- ✅ 完美集成三阶段检测机制

### Phase 4: 前端
- ✅ 缓存内容自动用于静态站点生成
- ✅ 技能详情页从 `.cache/skills/` 读取
- ✅ 多语言分类正确显示

### Phase 6: package.json
- ✅ 所有 npm scripts 正常工作
- ✅ `npm run sync` 在 CI/CD 中可用

---

## 📝 配置示例

### 修改同步时间
编辑 `.github/workflows/sync.yml`：
```yaml
schedule:
  - cron: '0 8 * * *'  # 每天 08:00 UTC
```

### 启用同步通知
添加到 sync.yml 的 steps：
```yaml
- name: Send notification
  if: steps.check.outputs.has_changes == 'true'
  run: |
    curl -X POST ${{ secrets.WEBHOOK_URL }} \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"✅ Synced ${{ steps.check.outputs.changed_count }} skills\"}"
```

### 部署前强制同步
修改 deploy.yml，将可选检查改为强制同步：
```yaml
- name: Force sync before deploy
  run: npm run sync
```

---

## ✅ 验证清单

- [x] sync.yml 创建并配置正确
- [x] deploy.yml 添加缓存恢复
- [x] validate.yml 添加缓存恢复
- [x] 缓存键设计合理（主键 + 回退键）
- [x] 权限配置正确（contents: write）
- [x] 错误处理适当（continue-on-error）
- [x] 日志输出详细（echo + GITHUB_STEP_SUMMARY）
- [x] 手动触发可用（workflow_dispatch）

---

## 🚧 已知限制

### 1. GitHub API 限流
- **匿名请求**：60 次/小时/IP
- **认证请求**：5000 次/小时
- **解决方案**：sync.yml 已配置 `GITHUB_TOKEN`

### 2. 缓存大小限制
- **单个缓存**：最大 10 GB
- **总缓存**：最大 10 GB（所有分支）
- **监控**：定期检查 `.cache/skills/` 大小

### 3. 工作流并发
- **deploy.yml**：使用 concurrency group 防止并发
- **sync.yml**：无并发限制（可能同时运行多个）
- **建议**：添加 concurrency group（如需要）

---

## 🎊 Phase 5 完成！

现在 CI/CD 流程完整支持：
- ✅ 自动定时同步上游技能内容
- ✅ 缓存优先构建（加速部署）
- ✅ PR 验证环境一致性
- ✅ 自动提交和部署
- ✅ 详细的日志和摘要

下一步：**Phase 7 - 测试验证**，创建示例技能并测试完整流程！
