#!/usr/bin/env bash
# Browser tests against a throwaway local Convex backend (architecture §11). Needs no
# Convex account: CONVEX_AGENT_MODE=anonymous runs the open-source backend locally.
set -euo pipefail
cd "$(dirname "$0")/.."
export CONVEX_AGENT_MODE=anonymous
LOG=$(mktemp)
npx convex dev --typecheck disable >"$LOG" 2>&1 &
DEV=$!
cleanup() { kill "$DEV" 2>/dev/null || true; pkill -f convex-local-backend 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 180); do grep -q 'Convex functions ready' "$LOG" && break; sleep 1; done
grep -q 'Convex functions ready' "$LOG" || { cat "$LOG"; echo 'local Convex backend did not start'; exit 1; }
node scripts/e2e-auth-env.mjs
npm run build # Vite reads VITE_CONVEX_URL from the .env.local `convex dev` wrote
npx playwright test "$@"
