#!/usr/bin/env bash
# Starts Floorline for shopfloor users: background server + full-screen browser.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/package.json" ]]; then
  echo "This launcher must stay next to package.json. Run install-macos.sh once to put shortcuts on the Desktop."
  exit 1
fi

PORT=5173
LOCAL_URL="http://127.0.0.1:${PORT}/"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is missing. Run install-macos.sh once, then use this shortcut."
  exit 1
fi
if [[ ! -d "$ROOT/node_modules" ]]; then
  npm install
fi

if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting Floorline on port $PORT (LAN + this Mac)..."
  nohup npm run dev -- --host 0.0.0.0 --port "$PORT" > /tmp/floorline.log 2>&1 &
  echo $! > /tmp/floorline.pid
fi

ready=0
for _ in $(seq 1 60); do
  if curl -sf "$LOCAL_URL" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo "Floorline did not start. See /tmp/floorline.log"
  exit 1
fi

echo "This Mac: $LOCAL_URL"
if command -v ipconfig >/dev/null 2>&1; then
  for iface in en0 en1 en2; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "${ip:-}" ]]; then
      echo "LAN:     http://${ip}:${PORT}/"
    fi
  done
fi

open_app() {
  local app="$1"
  if [[ -d "/Applications/${app}.app" ]]; then
    open -na "$app" --args --app="$LOCAL_URL" --start-fullscreen
    return 0
  fi
  return 1
}

if ! open_app "Microsoft Edge"; then
  if ! open_app "Google Chrome"; then
    open "$LOCAL_URL"
  fi
fi

echo "Floorline is running. Use Stop Floorline on the Desktop to quit."
