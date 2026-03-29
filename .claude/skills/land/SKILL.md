# Land 技能

监控 PR 直到可以合并，然后执行 squash-merge。

## 步骤

1. 获取当前 PR 编号：`gh pr view --json number,state,reviews,statusCheckRollup`
2. 检查 PR 状态：
   - 所有 CI 检查必须通过
   - 至少有一个批准的审查（或用户明确要求合并）
   - 没有合并冲突
3. 如果存在合并冲突：
   - 拉取最新的 main：`git fetch origin main && git merge origin/main`
   - 如果冲突简单直接，则解决冲突
   - 推送解决方案
   - 等待 CI 重新运行
4. 如果 CI 失败：
   - 调查失败原因
   - 如果可以修复则修复，否则向用户报告
5. 一旦所有检查通过且 PR 已批准，先清理该分支关联的 worktree：
   - `git worktree list` 查找该分支的 worktree
   - `git worktree remove <path>` 移除 worktree（如果目录已不存在，用 `git worktree prune` 清理残留引用）
6. 执行 squash merge：
   - `gh pr merge --squash --delete-branch`
   - 确认合并完成：`gh pr view --json state`
7. 报告最终状态和 merge commit SHA

## 规则

- 不要强制合并或绕过必要的检查
- 除非用户明确同意，不要在没有审批的情况下合并
- 如果遇到阻塞，报告状态并向用户请求指导
