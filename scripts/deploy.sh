#!/usr/bin/env bash
set -euo pipefail

# Ensure Bun is available
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Install dependencies
echo "Installing dependencies..."
(bun install --frozen-lockfile || bun install)

# Run idempotent seed (safe to run every deploy)
echo "Running demo seed (idempotent)..."
: "${SEED_PROFILE:=DEMO_3_USERS}"
: "${SEED_LOCK_KEY:=prod-demo-v1}"
bun run seed:prod:demo || true

# Start the API
echo "Starting LendBloc API..."
exec bun run --watch index.ts
