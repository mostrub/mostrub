#!/usr/bin/env bash
# Floorline one-time install for macOS.
# Double-click install-macos.command, or:
#   chmod +x install-macos.sh && ./install-macos.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing Node.js with Homebrew..."
    brew install node
  else
    echo "Node.js is missing. Install it from https://nodejs.org (LTS), then re-run this script."
    exit 1
  fi
fi

echo "node $(node -v)  npm $(npm -v)"
echo "Installing npm packages in $ROOT ..."
npm install

chmod +x "$ROOT/install-macos.sh" "$ROOT/start-floorline.command" "$ROOT/stop-floorline.command" || true

DESKTOP="$HOME/Desktop"
if [[ -d "$DESKTOP" ]]; then
  cat > "$DESKTOP/Floorline.command" <<EOF
#!/usr/bin/env bash
exec "$ROOT/start-floorline.command"
EOF
  cat > "$DESKTOP/Stop Floorline.command" <<EOF
#!/usr/bin/env bash
exec "$ROOT/stop-floorline.command"
EOF
  chmod +x "$DESKTOP/Floorline.command" "$DESKTOP/Stop Floorline.command"
  echo "Desktop shortcuts: Floorline and Stop Floorline"
  echo "If macOS blocks them: right-click → Open."
fi

echo
echo "Install finished. Daily use: double-click Floorline on the Desktop."
echo "Other PCs and Macs on the same network can open the Share URLs in the header."
echo

exec "$ROOT/start-floorline.command"
