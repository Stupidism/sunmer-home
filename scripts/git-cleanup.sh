#!/usr/bin/env bash
#
# git-cleanup.sh — 清理已合并的本地分支和对应的 git worktree
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

MAIN_BRANCH="main"

# 确保 remote 信息是最新的
git fetch --prune origin

echo "=== 清理已合并的 worktree ==="

# 先清理已经无效的 worktree（目录已删除等情况）
if [[ "$DRY_RUN" == false ]]; then
  git worktree prune
fi

# 遍历所有 worktree，跳过主 worktree
while IFS= read -r line; do
  wt_path=$(echo "$line" | awk '{print $1}')
  wt_branch=$(echo "$line" | sed -n 's/.*\[\(.*\)\]/\1/p')

  # 跳过主 worktree 和 detached HEAD
  [[ -z "$wt_branch" ]] && continue
  [[ "$wt_branch" == "$MAIN_BRANCH" ]] && continue

  # 检查该分支是否已合并到 main
  if git branch --merged "$MAIN_BRANCH" | grep -qw "$wt_branch"; then
    echo "  worktree: $wt_path (分支: $wt_branch) — 已合并"
    if [[ "$DRY_RUN" == false ]]; then
      git worktree remove "$wt_path" --force
      echo "    ✅ 已移除 worktree"
    fi
  fi
done < <(git worktree list)

echo
echo "=== 清理已合并的本地分支 ==="

# 找出所有已合并到 main 的本地分支（排除 main 本身）
merged_branches=$(git branch --merged "$MAIN_BRANCH" | grep -v "^\*" | grep -v "^[[:space:]]*${MAIN_BRANCH}$" || true)

if [[ -z "$merged_branches" ]]; then
  echo "  没有需要清理的已合并分支"
else
  while IFS= read -r branch; do
    branch=$(echo "$branch" | xargs)  # trim whitespace
    [[ -z "$branch" ]] && continue
    echo "  分支: $branch — 已合并"
    if [[ "$DRY_RUN" == false ]]; then
      git branch -d "$branch"
      echo "    ✅ 已删除"
    fi
  done <<< "$merged_branches"
fi

echo
echo "=== 清理远程已删除的追踪分支 ==="

# 列出本地追踪的远程分支中，远程已不存在的
gone_branches=$(git branch -vv | grep ': gone]' | awk '{print $1}' || true)

if [[ -z "$gone_branches" ]]; then
  echo "  没有需要清理的 gone 分支"
else
  while IFS= read -r branch; do
    [[ -z "$branch" ]] && continue
    echo "  分支: $branch — 远程已删除"
    if [[ "$DRY_RUN" == false ]]; then
      git branch -D "$branch"
      echo "    ✅ 已删除"
    fi
  done <<< "$gone_branches"
fi

echo
echo "🎉 清理完成！"
