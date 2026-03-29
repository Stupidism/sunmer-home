#!/usr/bin/env bash
#
# run-ticket.sh — Run Claude Code on a single Linear ticket
#
# Usage:
#   ./scripts/symphony/run-ticket.sh <ticket-id> <ticket-title> [ticket-description]
#
# Example:
#   ./scripts/symphony/run-ticket.sh SUN-42 "bubu-log: batch import feature" "Add batch import..."

set -euo pipefail

TICKET_ID="${1:?Usage: run-ticket.sh <ticket-id> <title> [description]}"
TICKET_TITLE="${2:?Usage: run-ticket.sh <ticket-id> <title> [description]}"
TICKET_DESC="${3:-No description provided}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SLUG="$(echo "$TICKET_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | head -c 40)"
BRANCH="feat/${TICKET_ID}-${SLUG}"

echo "=== Symphony Runner ==="
echo "Ticket:  ${TICKET_ID}"
echo "Title:   ${TICKET_TITLE}"
echo "Branch:  ${BRANCH}"
echo "========================"

cd "$REPO_ROOT"

# Create branch from latest main
git fetch origin main
git checkout -b "$BRANCH" origin/main 2>/dev/null || git checkout "$BRANCH"

# Build the prompt for Claude Code
PROMPT="$(cat <<EOF
## Linear Ticket: ${TICKET_ID}

**Title:** ${TICKET_TITLE}

**Description:**
${TICKET_DESC}

---

Please work on this ticket following WORKFLOW.md:
1. Read and understand the requirements
2. Plan your approach (present checklist)
3. Implement the changes
4. Run validation (type check, lint, tests)
5. Use /commit to commit and /pr to create a pull request
6. Report the PR URL when done

Branch is already created: ${BRANCH}
EOF
)"

echo ""
echo "Launching Claude Code..."
echo ""

claude --print "$PROMPT"
