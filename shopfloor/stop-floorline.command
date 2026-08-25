#!/usr/bin/env bash
# Stops the local Floorline server started by the Desktop shortcut.
set -euo pipefail
PORT=5173

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
  echo "Floorline stopped."
else
  echo "Floorline is not running."
fi
