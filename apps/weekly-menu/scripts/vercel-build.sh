#!/usr/bin/env bash

set -euo pipefail

if [[ "${RUN_DB_BOOTSTRAP_ON_BUILD:-}" == "1" ]]; then
  echo "Running DB bootstrap before build..."
  PAYLOAD_DB_PUSH=true PAYLOAD_ALLOW_DESTRUCTIVE_PUSH=true pnpm payload migrate
else
  echo "Skipping DB bootstrap (set RUN_DB_BOOTSTRAP_ON_BUILD=1 to force)."
fi

next build
