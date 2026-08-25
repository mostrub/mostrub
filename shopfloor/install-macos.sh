#!/usr/bin/env bash
# Floorline one-time install for macOS.
# Double-click install-macos.command, or run: ./install-macos.sh

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS. On Windows 11 double-click install-windows.cmd."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

load_brew() {
  if command -v brew >/dev/null 2>&1; then
    return 0
  fi
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    return 0
  fi
  if [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
    return 0
  fi
  return 1
}

ensure_node() {
  load_brew || true
  if command -v node >/dev/null 2>&1; then
    echo "Node.js $(node -v) already on PATH."
    return 0
  fi

  if ! load_brew; then
    echo "Installing Homebrew (needed once for Node.js)..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    load_brew || true
  fi

  if load_brew; then
    echo "Installing Node.js with Homebrew..."
    brew install node
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is still missing. Install LTS from https://nodejs.org then double-click this installer again."
    exit 1
  fi
}

desktop_dir() {
  local path
  path="$(osascript -e 'POSIX path of (path to desktop folder)' 2>/dev/null | sed 's:/$::' || true)"
  if [[ -n "${path:-}" && -d "$path" ]]; then
    printf '%s\n' "$path"
    return 0
  fi
  if [[ -d "$HOME/Desktop" ]]; then
    printf '%s\n' "$HOME/Desktop"
    return 0
  fi
  return 1
}

ensure_node
echo "node $(node -v)  npm $(npm -v)"
echo "Installing npm packages in $ROOT ..."
npm install

chmod +x "$ROOT/install-macos.sh" "$ROOT/install-macos.command" \
  "$ROOT/start-floorline.command" "$ROOT/stop-floorline.command"
xattr -dr com.apple.quarantine "$ROOT"/*.command "$ROOT"/*.sh 2>/dev/null || true

if DESKTOP="$(desktop_dir)"; then
  cat > "$DESKTOP/Floorline.command" <<EOF
#!/usr/bin/env bash
exec "$ROOT/start-floorline.command"
EOF
  cat > "$DESKTOP/Stop Floorline.command" <<EOF
#!/usr/bin/env bash
exec "$ROOT/stop-floorline.command"
EOF
  chmod +x "$DESKTOP/Floorline.command" "$DESKTOP/Stop Floorline.command"
  xattr -dr com.apple.quarantine "$DESKTOP/Floorline.command" "$DESKTOP/Stop Floorline.command" 2>/dev/null || true
  echo "Desktop shortcuts: Floorline and Stop Floorline"
  echo "If macOS still blocks a shortcut: right-click → Open."
else
  echo "Desktop folder not found. Use start-floorline.command in this folder."
fi

echo
echo "Install finished. Daily use: double-click Floorline on the Desktop."
echo "Other PCs and Macs on the same network can open the Share URLs in the header."
echo

exec "$ROOT/start-floorline.command"
