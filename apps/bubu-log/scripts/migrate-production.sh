#!/usr/bin/env bash

set -euo pipefail

# 生产环境数据库迁移脚本
# 使用方法：
# 1. 确保已安装 Vercel CLI: pnpm add -g vercel
# 2. 在 apps/bubu-log 目录运行：bash scripts/migrate-production.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_DIR}/.env.production"

cleanup() {
  rm -f "${ENV_FILE}"
}

read_env_var() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | head -n 1 || true)"
  if [ -z "${line}" ]; then
    return 0
  fi

  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf '%s' "${line}"
}

echo "🚀 开始生产环境数据库迁移..."

if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ 错误: 未找到 Vercel CLI"
  echo "请先安装: pnpm add -g vercel"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ 错误: 未找到 pnpm"
  exit 1
fi

trap cleanup EXIT
cd "${APP_DIR}"

echo "📥 从 Vercel 拉取生产环境变量..."
vercel env pull "${ENV_FILE}" --yes --environment=production

if [ ! -f "${ENV_FILE}" ]; then
  echo "❌ 错误: 无法拉取环境变量"
  echo "请确保已登录 Vercel: vercel login"
  exit 1
fi

echo "🔄 运行数据库迁移..."
DATABASE_URL="$(read_env_var "DATABASE_URL")"
DATABASE_URL_UNPOOLED="$(read_env_var "DATABASE_URL_UNPOOLED")"
PAYLOAD_DATABASE_URL="$(read_env_var "PAYLOAD_DATABASE_URL")"

if [ -z "${PAYLOAD_DATABASE_URL}" ]; then
  PAYLOAD_DATABASE_URL="${DATABASE_URL}"
fi

if [ -z "${DATABASE_URL}" ]; then
  echo "❌ 错误: 未找到 DATABASE_URL"
  exit 1
fi

echo "📦 DATABASE_URL 已配置"
if [ -n "${DATABASE_URL_UNPOOLED}" ]; then
  echo "📦 DATABASE_URL_UNPOOLED 已配置"
fi

export DATABASE_URL
export DATABASE_URL_UNPOOLED
export PAYLOAD_DATABASE_URL
pnpm db:migrate

echo "✅ 数据库迁移完成！"
echo "✨ 完成！"
