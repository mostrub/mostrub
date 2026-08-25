#!/usr/bin/env bash
# Floorline-Einmalinstallation für macOS.
# install-macos.command doppelklicken oder: ./install-macos.sh

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Dieser Installer ist für macOS. Unter Windows 11 install-windows.cmd doppelklicken."
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
    echo "Node.js $(node -v) ist schon im PATH."
    return 0
  fi

  if ! load_brew; then
    echo "Installiere Homebrew (einmal für Node.js nötig)..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    load_brew || true
  fi

  if load_brew; then
    echo "Installiere Node.js mit Homebrew..."
    brew install node
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js fehlt weiterhin. LTS von https://nodejs.org installieren und diesen Installer erneut doppelklicken."
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
echo "Installiere npm-Pakete in $ROOT ..."
npm install

chmod +x "$ROOT/install-macos.sh" "$ROOT/install-macos.command" \
  "$ROOT/start-floorline.command" "$ROOT/stop-floorline.command"
xattr -dr com.apple.quarantine "$ROOT"/*.command "$ROOT"/*.sh 2>/dev/null || true

if DESKTOP="$(desktop_dir)"; then
  PACK="$DESKTOP/Floorline"
  mkdir -p "$PACK"
  cp -f "$ROOT/HOW-TO-USE.txt" "$DESKTOP/Floorline - Kurzanleitung.txt"
  cp -f "$ROOT/HOW-TO-USE.txt" "$PACK/Floorline - Kurzanleitung.txt"

  if command -v osacompile >/dev/null 2>&1; then
    osacompile -o "$DESKTOP/Floorline.app" -e "do shell script quoted form of \"$ROOT/start-floorline.command\""
    osacompile -o "$DESKTOP/Floorline beenden.app" -e "do shell script quoted form of \"$ROOT/stop-floorline.command\""
    osacompile -o "$PACK/Floorline starten.app" -e "do shell script quoted form of \"$ROOT/start-floorline.command\""
    osacompile -o "$PACK/Floorline beenden.app" -e "do shell script quoted form of \"$ROOT/stop-floorline.command\""
    echo "Desktop-Symbole: Floorline und Floorline beenden"
  else
    cat > "$DESKTOP/Floorline.command" <<EOF
#!/usr/bin/env bash
exec "$ROOT/start-floorline.command"
EOF
    cat > "$DESKTOP/Floorline beenden.command" <<EOF
#!/usr/bin/env bash
exec "$ROOT/stop-floorline.command"
EOF
    chmod +x "$DESKTOP/Floorline.command" "$DESKTOP/Floorline beenden.command"
    echo "Desktop-Verknüpfungen: Floorline und Floorline beenden"
    echo "Wenn macOS eine Verknüpfung blockiert: Rechtsklick, Öffnen."
  fi
  xattr -dr com.apple.quarantine "$DESKTOP/Floorline.app" "$DESKTOP/Floorline beenden.app" \
    "$DESKTOP/Floorline.command" "$DESKTOP/Floorline beenden.command" 2>/dev/null || true
else
  echo "Desktop-Ordner nicht gefunden. start-floorline.command in diesem Ordner nutzen."
fi

echo
echo "Installation fertig. Alltag: Floorline auf dem Desktop doppelklicken."
echo "Andere Rechner und Macs im selben Netz können die Freigabe-URLs im Kopf öffnen."
echo

exec "$ROOT/start-floorline.command"
