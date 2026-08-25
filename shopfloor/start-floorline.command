#!/usr/bin/env bash
# Startet Floorline für die Shopfloor: Hintergrundserver + Vollbildbrowser.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

notify() {
  if command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$1\" with title \"Floorline\"" || true
  fi
}

fail() {
  local message="$1"
  if command -v osascript >/dev/null 2>&1; then
    osascript <<EOF || true
display dialog "$message" buttons {"OK"} default button "OK" with title "Floorline"
EOF
  else
    echo "$message"
  fi
  exit 1
}

if [[ ! -f "$ROOT/package.json" ]]; then
  fail "Dieses Symbol ist defekt. install-macos.command einmal doppelklicken."
fi

PORT=5173
LOCAL_URL="http://127.0.0.1:${PORT}/"

if ! command -v node >/dev/null 2>&1; then
  fail "Floorline ist noch nicht installiert. install-macos.command einmal doppelklicken."
fi
if [[ ! -d "$ROOT/node_modules" ]]; then
  npm install
fi

if ! lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
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
  fail "Floorline ist nicht gestartet. install-macos.command einmal doppelklicken."
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

notify "Floorline ist im Vollbild offen. Floorline beenden doppelklicken, wenn Sie fertig sind."
