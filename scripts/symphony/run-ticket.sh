#!/usr/bin/env bash
#
# run-ticket.sh — 对单个 Linear 工单运行 Claude Code
#
# 用法：
#   ./scripts/symphony/run-ticket.sh <ticket-id> <ticket-title> [ticket-description]
#
# 示例：
#   ./scripts/symphony/run-ticket.sh SUN-42 "bubu-log: batch import feature" "Add batch import..."

set -euo pipefail

TICKET_ID="${1:?用法: run-ticket.sh <ticket-id> <title> [description]}"
TICKET_TITLE="${2:?用法: run-ticket.sh <ticket-id> <title> [description]}"
TICKET_DESC="${3:-未提供描述}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SLUG="$(echo "$TICKET_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 40)"
BRANCH="feat/${TICKET_ID}-${SLUG}"

echo "=== Symphony 运行器 ==="
echo "工单：  ${TICKET_ID}"
echo "标题：  ${TICKET_TITLE}"
echo "分支：  ${BRANCH}"
echo "========================"

cd "$REPO_ROOT"

# 从最新的 main 创建分支
git fetch origin main
git checkout -b "$BRANCH" origin/main 2>/dev/null || git checkout "$BRANCH"

# 构建发送给 Claude Code 的提示
PROMPT="$(cat <<EOF
## Linear Ticket: ${TICKET_ID}

**Title:** ${TICKET_TITLE}

**Description:**
${TICKET_DESC}

---

请按照 WORKFLOW.md 处理此工单：
1. 阅读并理解需求
2. 规划实现方案（展示清单）
3. 实现改动
4. 运行验证（类型检查、lint、测试）
5. 使用 /commit 提交，使用 /pr 创建 pull request
6. 完成后报告 PR URL

分支已创建：${BRANCH}
EOF
)"

echo ""
echo "正在启动 Claude Code..."
echo ""

claude --print "$PROMPT"
