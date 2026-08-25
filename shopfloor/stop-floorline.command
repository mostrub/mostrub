#!/usr/bin/env bash
# Stops the local Floorline server started by the Desktop shortcut.
set -euo pipefail
PORT=5173

tell() {
  local message="$1"
  if command -v osascript >/dev/null 2>&1; then
    osascript <<EOF || true
display dialog "$message" buttons {"OK"} default button "OK" with title "Floorline"
EOF
  else
    echo "$message"
  fi
}

if [[ -f /tmp/floorline.pid ]]; then
  pid="$(cat /tmp/floorline.pid || true)"
  if [[ -n "${pid:-}" ]]; then
    kill "$pid" 2>/dev/null || true
  fi
  rm -f /tmp/floorline.pid
fi

pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${pids:-}" ]]; then
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  tell "Floorline is closed. You can use this Mac for something else."
else
  tell "Floorline is already closed."
fi
