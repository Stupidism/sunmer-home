#!/usr/bin/env bash

set -euo pipefail

if [[ "${RUN_DB_BOOTSTRAP_ON_BUILD:-}" == "1" ]]; then
  echo "🔧 Running DB bootstrap before build..."
  node scripts/bootstrap-db.mjs
else
  echo "ℹ️ Skipping DB bootstrap (set RUN_DB_BOOTSTRAP_ON_BUILD=1 to enable)."
fi

next build
