#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${LEDGER_PG_URL:=postgres://ledger:ledger@127.0.0.1:5432/ledger}"
: "${LEDGER_LAKE_PATH:=./data/lake}"
: "${LEDGER_INGEST_TOKEN:=dev-ingest}"
: "${LEDGER_OPERATOR_TOKEN:=dev-operator}"
export LEDGER_PG_URL LEDGER_LAKE_PATH LEDGER_INGEST_TOKEN LEDGER_OPERATOR_TOKEN

if [[ "${1:-}" == "--seed" ]]; then
  npm run seed -- "${2:-2026-08-24}"
fi

npm run dev:api &
api_pid=$!
npm run dev:web &
web_pid=$!

trap 'kill "$api_pid" "$web_pid" 2>/dev/null || true' EXIT INT TERM
echo "API http://127.0.0.1:5757  UI http://127.0.0.1:5759"
wait
