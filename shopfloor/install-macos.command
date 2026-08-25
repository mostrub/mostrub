#!/usr/bin/env bash
# Auf einem Mac einmal doppelklicken. Installiert Floorline und Desktop-Symbole.
cd "$(dirname "$0")"
chmod +x ./install-macos.sh ./start-floorline.command ./stop-floorline.command
exec ./install-macos.sh
