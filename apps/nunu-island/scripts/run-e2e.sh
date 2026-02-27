#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CONTAINER_NAME="nunu-island-e2e-db"
DB_PORT="5436"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="nunu_island_e2e"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
DATABASE_URL_UNPOOLED="${DATABASE_URL}"
PAYLOAD_DATABASE_URL="${DATABASE_URL}"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run nunu-island e2e tests."
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

echo "Waiting for nunu-island e2e database..."
db_ready=0
for _ in $(seq 1 60); do
  if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Database container exited unexpectedly."
    docker logs "${CONTAINER_NAME}" || true
    exit 1
  fi

  if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
    sleep 1
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      db_ready=1
      break
    fi
  fi
  sleep 1
done

if [ "${db_ready}" -ne 1 ]; then
  echo "Database failed to start."
  docker logs "${CONTAINER_NAME}" || true
  exit 1
fi

cd "${APP_DIR}"

DATABASE_URL="${DATABASE_URL}" DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED}" PAYLOAD_DATABASE_URL="${PAYLOAD_DATABASE_URL}" pnpm db:migrate

PAYLOAD_DB_PUSH=true \
PAYLOAD_ALLOW_DESTRUCTIVE_PUSH=true \
DATABASE_URL="${DATABASE_URL}" \
DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED}" \
PAYLOAD_DATABASE_URL="${PAYLOAD_DATABASE_URL}" \
pnpm exec playwright test "$@"
