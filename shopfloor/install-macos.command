#!/usr/bin/env bash
# Double-click this once on a Mac. It installs Floorline and Desktop shortcuts.
cd "$(dirname "$0")"
chmod +x ./install-macos.sh ./start-floorline.command ./stop-floorline.command
exec ./install-macos.sh
