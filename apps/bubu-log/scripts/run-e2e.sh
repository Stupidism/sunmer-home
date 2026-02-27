#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CONTAINER_NAME="bubu-log-e2e-db"
DB_PORT="5434"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="bubu_log_e2e"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?schema=public"
DATABASE_URL_UNPOOLED="${DATABASE_URL}"
NEXT_DEV_PATTERN="${APP_DIR}/node_modules/.bin/../next/dist/bin/next dev"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

stop_existing_bubu_dev() {
  # Playwright will start its own isolated web server.
  # Stop existing bubu-log dev processes to avoid Next.js lock conflicts.
  if pgrep -f "${NEXT_DEV_PATTERN}" >/dev/null 2>&1; then
    echo "🔄 Stopping existing bubu-log dev server..."
    pkill -f "${NEXT_DEV_PATTERN}" >/dev/null 2>&1 || true
    sleep 1
  fi

  rm -f "${APP_DIR}/.next/dev/lock" >/dev/null 2>&1 || true
}

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker is required to run e2e tests."
  exit 1
fi

trap cleanup EXIT

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

docker run \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
  -e POSTGRES_DB="${DB_NAME}" \
  -p "${DB_PORT}:5432" \
  -d postgres:16-alpine >/dev/null

echo "⏳ Waiting for test database to be ready..."
db_ready=0
for _ in $(seq 1 60); do
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Test database container exited unexpectedly."
    docker logs "${CONTAINER_NAME}" || true
    exit 1
  fi

  if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
    # During first boot, Postgres can briefly accept connections and then restart.
    # Require two consecutive successful probes to avoid false readiness.
    sleep 1
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      db_ready=1
      break
    fi
  fi
  sleep 1
done

if [ "${db_ready}" -ne 1 ]; then
  echo "❌ Test database failed to start."
  docker logs "${CONTAINER_NAME}" || true
  exit 1
fi

cd "${APP_DIR}"

DATABASE_URL="${DATABASE_URL}" DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED}" PAYLOAD_DATABASE_URL="${DATABASE_URL}" pnpm db:reset
DATABASE_URL="${DATABASE_URL}" DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED}" PAYLOAD_DATABASE_URL="${DATABASE_URL}" pnpm db:migrate
DATABASE_URL="${DATABASE_URL}" DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED}" PAYLOAD_DATABASE_URL="${DATABASE_URL}" pnpm db:seed:test
stop_existing_bubu_dev
DATABASE_URL="${DATABASE_URL}" DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED}" pnpm exec playwright test "$@"
