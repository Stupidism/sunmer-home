#!/usr/bin/env bash
#
# git-cleanup.sh — 清理远端已删除分支对应的本地 worktree 和 branch
#
# 逻辑：远端分支被删 = PR 已关闭/合并 = 可以安全清理
#
# 用法: ./scripts/git-cleanup.sh [--dry-run]
#

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 Dry-run 模式，不会实际删除任何内容"
  echo
fi

# 确保 remote 信息是最新的
git fetch --prune origin

# 清理已经无效的 worktree（目录已删除等情况）
if [[ "$DRY_RUN" == false ]]; then
  git worktree prune
fi

# 找出远端已删除的本地分支（gone branches）
# 注意：worktree 中的分支行首是 "+"，当前分支行首是 "*"，需要跳过这些前缀
gone_branches=$(git branch -vv | grep ': gone]' | sed 's/^[+* ]*//' | awk '{print $1}' || true)

if [[ -z "$gone_branches" ]]; then
  echo "没有需要清理的分支"
  exit 0
fi

# 获取主 worktree 路径（第一行就是主 worktree）
main_wt_path=$(git worktree list | head -1 | awk '{print $1}')

echo "=== 清理远端已删除的分支 ==="

while IFS= read -r branch; do
  [[ -z "$branch" ]] && continue

  # 检查是否有 worktree 在使用这个分支，如果有则一并清理
  wt_path=$(git worktree list | grep "\[$branch\]" | awk '{print $1}' || true)

  if [[ -n "$wt_path" ]]; then
    # 跳过主 worktree，防止误删
    if [[ "$wt_path" == "$main_wt_path" ]]; then
      echo "  [$branch] ⚠️  跳过（主 worktree）"
      continue
    fi

    # 检查 worktree 是否有未提交的修改，有则跳过避免数据丢失
    if [[ -d "$wt_path" ]] && git -C "$wt_path" status --porcelain | grep -q .; then
      echo "  [$branch] ⚠️  跳过（worktree 有未提交的修改: $wt_path）"
      continue
    fi

    echo "  [$branch] worktree: $wt_path"
    if [[ "$DRY_RUN" == false ]]; then
      git worktree remove "$wt_path"
      echo "    ✅ 已移除 worktree"
    fi
  else
    echo "  [$branch]"
  fi

  if [[ "$DRY_RUN" == false ]]; then
    git branch -D "$branch"
    echo "    ✅ 已删除分支"
  fi
done <<< "$gone_branches"

echo
echo "🎉 清理完成！"
