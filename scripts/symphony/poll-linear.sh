#!/usr/bin/env bash
#
# poll-linear.sh — 轮询 Linear 获取 Todo 状态的工单，并对每个工单运行 Claude Code
#
# 前置条件：
#   - 设置 LINEAR_API_KEY 环境变量
#   - 设置 LINEAR_TEAM_ID 环境变量（你的 Linear 团队 ID）
#   - 已安装 claude CLI
#
# 用法：
#   LINEAR_API_KEY=lin_api_xxx LINEAR_TEAM_ID=xxx ./scripts/symphony/poll-linear.sh

set -euo pipefail

LINEAR_API_KEY="${LINEAR_API_KEY:?请设置 LINEAR_API_KEY}"
LINEAR_TEAM_ID="${LINEAR_TEAM_ID:?请设置 LINEAR_TEAM_ID}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MAX_CONCURRENT="${MAX_CONCURRENT:-2}"

declare -A RUNNING_PIDS

cleanup() {
  echo "正在关闭..."
  for pid in "${RUNNING_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 0
}
trap cleanup SIGINT SIGTERM

fetch_todo_tickets() {
  curl -s 'https://api.linear.app/graphql' \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d "{\"query\": \"query { team(id: \\\"${LINEAR_TEAM_ID}\\\") { issues(filter: { state: { name: { eq: \\\"Todo\\\" } } }, first: 10) { nodes { id identifier title description } } } }\"}"
}

move_to_in_progress() {
  local issue_id="$1"
  local state_id
  state_id=$(curl -s 'https://api.linear.app/graphql' \
    -H "Authorization: ${LINEAR_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d "{\"query\": \"query { team(id: \\\"${LINEAR_TEAM_ID}\\\") { states { nodes { id name } } } }\"}" \
    | python3 -c "import sys,json; states=json.load(sys.stdin)['data']['team']['states']['nodes']; print(next(s['id'] for s in states if s['name']=='In Progress'))" 2>/dev/null || echo "")

  if [ -n "$state_id" ]; then
    curl -s 'https://api.linear.app/graphql' \
      -H "Authorization: ${LINEAR_API_KEY}" \
      -H 'Content-Type: application/json' \
      -d "{\"query\": \"mutation { issueUpdate(id: \\\"${issue_id}\\\", input: { stateId: \\\"${state_id}\\\" }) { success } }\"}" \
      > /dev/null
  fi
}

echo "=== Symphony 轮询器 ==="
echo "团队：          ${LINEAR_TEAM_ID}"
echo "最大并发数：    ${MAX_CONCURRENT}"
echo "轮询间隔：      30秒"
echo "========================"

while true; do
  # 清理已完成的代理进程
  for ticket_id in "${!RUNNING_PIDS[@]}"; do
    if ! kill -0 "${RUNNING_PIDS[$ticket_id]}" 2>/dev/null; then
      echo "[$(date '+%H:%M:%S')] 代理已完成：${ticket_id}"
      unset "RUNNING_PIDS[$ticket_id]"
    fi
  done

  running_count=${#RUNNING_PIDS[@]}

  if [ "$running_count" -lt "$MAX_CONCURRENT" ]; then
    response=$(fetch_todo_tickets)
    tickets=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
nodes = data.get('data', {}).get('team', {}).get('issues', {}).get('nodes', [])
for n in nodes:
    print(f\"{n['id']}|{n['identifier']}|{n['title']}|{n.get('description', '')}\")
" 2>/dev/null || echo "")

    while IFS='|' read -r issue_id identifier title desc; do
      [ -z "$identifier" ] && continue
      if [ -n "${RUNNING_PIDS[$identifier]+x}" ]; then continue; fi
      if [ "${#RUNNING_PIDS[@]}" -ge "$MAX_CONCURRENT" ]; then break; fi

      echo "[$(date '+%H:%M:%S')] 认领工单：${identifier} — ${title}"
      move_to_in_progress "$issue_id"

      "$REPO_ROOT/scripts/symphony/run-ticket.sh" "$identifier" "$title" "$desc" &
      RUNNING_PIDS[$identifier]=$!
    done <<< "$tickets"
  fi

  sleep 30
done
