#!/usr/bin/env bash
cd "$(dirname "$0")"
chmod +x ./install-macos.sh ./start-floorline.command ./stop-floorline.command
exec ./install-macos.sh
