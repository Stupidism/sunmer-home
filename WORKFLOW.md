# 工作流程：Claude Code + Linear

本文件定义了 Claude Code 代理如何在本 monorepo 中处理 Linear 工单。

## Linear 看板状态

```
Todo → In Progress → Human Review → Merging → Done
                         ↓
                      Rework → In Progress
```

| 状态 | 操作者 | 具体行为 |
|------|--------|----------|
| **Todo** | 代理认领 | 代理认领工单、创建分支、开始工作 |
| **In Progress** | 代理工作中 | 代理进行开发、测试、创建 PR |
| **Human Review** | 人工审查 | 代理暂停；如果需要修改 → Rework |
| **Rework** | 代理返工 | 代理处理反馈、重新推送 |
| **Merging** | 代理合并 | PR 已批准，执行 squash-merge |
| **Done** | 终态 | PR 已合并，工单关闭 |

## 代理工作流程（每个工单）

### 1. 认领与规划

- 阅读工单描述，理解范围
- 从 main 创建功能分支：`feat/<linear-id>-<short-slug>`
- 始终使用 git worktree 进行隔离，不在用户工作目录中操作
- 在 Linear 工单上发布工作记录评论：
  ```
  ## Claude Workpad
  - [ ] Step 1
  - [ ] Step 2
  ...
  ```
- 将工单移至 **In Progress**

### 2. 实现

- 严格遵循 CLAUDE.md 约定
- 保持改动范围精确——不做无关的重构
- 添加 `data-testid` 属性用于 e2e 测试选择器
- 完成后勾选工作记录中的对应项

### 3. 编写 E2E 测试

- 编写 Playwright 测试覆盖主要流程
- 启用视频录制：`video: 'on'`
- 测试必须使用 `data-testid` 选择器

### 4. 创建 PR 并等待预览

- 使用 conventional commit 风格提交（包含 `Closes SUN-XX`）
- 推送分支，通过 `gh pr create` 创建 PR
- PR 正文必须包含：
  - `## Summary` — 修改内容及原因
  - `## Linear ticket` — 工单链接
  - `## Test plan` — 如何验证改动
- 等待 Vercel 预览部署就绪

### 5. 在 Vercel 预览环境运行 E2E 测试

这是**必须**执行的步骤。测试必须在预览环境运行，而非 localhost。

- 从 PR 评论中获取 Vercel 预览 URL
- 预览环境使用 Neon 数据库分支——可以安全地填充测试数据
- 创建 `playwright.preview.config.ts`（不配置 webServer，baseURL 设为预览 URL，`video: 'on'`）
- 运行测试：`npx playwright test tests/<file>.spec.ts --config=playwright.preview.config.ts --workers=1`
- 从 `test-results/` 收集视频录制

### 6. 在 Linear 工单上发布证据

在请求审查之前，工单必须包含：

1. **工作记录评论**，包括：
   - 实现计划清单（全部 ✅）
   - 验证结果（测试通过数量）
   - PR 链接
   - 修改文件列表

2. **视频证据评论**，包括：
   - 每个测试的视频上传到 Linear（通过 `fileUpload` mutation）
   - 视频链接以编号列表形式展示，附带测试描述
   - 测试环境信息（预览 URL、浏览器、耗时）

### 7. 移至人工审查

仅在以下条件全部满足后：
- [ ] 所有 e2e 测试在 Vercel 预览环境通过
- [ ] 视频已上传到 Linear 工单
- [ ] 工作记录评论已发布，包含 PR 链接和测试结果
- [ ] PR 上的 CI 检查全部通过
- 将工单移至 **Human Review**

### 8. 审查循环

- 如果审查者要求修改 → 工单移至 **Rework**
- 处理所有审查意见
- 如果代码有改动，重新验证、重新运行测试
- 推送更新，移回 **Human Review**

### 9. 合并

- 一旦通过审批，先清理该分支关联的 worktree（避免分支删除失败）：
  1. 查找 worktree：`git worktree list`
  2. 移除对应 worktree：`git worktree remove <path>`（如果目录已不存在，用 `git worktree prune` 清理残留引用）
- 然后 squash-merge PR：`gh pr merge --squash --delete-branch`
- 将工单移至 **Done**

## 工单格式

```markdown
## Context
<为什么需要这项工作>

## Requirements
- [ ] 需求 1
- [ ] 需求 2

## Acceptance Criteria
- [ ] AC 1: <具体的、可测试的条件>
- [ ] AC 2: <具体的、可测试的条件>

## Scope
App: <bubu-log | nunu-island | wedding-invite | weekly-menu>
Priority: <P0 | P1 | P2>
```

## 约定

- **分支命名**：`feat/SUN-XX-slug`、`fix/SUN-XX-slug`、`chore/SUN-XX-slug`
- **提交风格**：conventional commits，例如 `feat(bubu-log): add batch import`
- **一个工单 = 一个 PR**：不要捆绑无关的工作
- **超出范围的事项**：创建新的 Linear 工单
- **测试**：每个功能工单都必须有带视频证明的 e2e 测试
