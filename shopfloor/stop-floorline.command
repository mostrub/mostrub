#!/usr/bin/env bash
# Beendet den lokalen Floorline-Server vom Desktop-Symbol.
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
  tell "Floorline ist beendet. Sie können diesen Mac anders nutzen."
else
  tell "Floorline ist bereits beendet."
fi
