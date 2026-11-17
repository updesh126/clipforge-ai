#!/usr/bin/env sh
# ClipForge AI - one-command setup for macOS / Linux:  sh setup.sh
# Installs the npm packages and every engine, then starts ClipForge. Stable Diffusion (ComfyUI) is
# installed by hand on macOS/Linux (see docs/site/stable-diffusion.md) and found automatically in ~/ClipForge/ComfyUI.
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then brew install node
  else echo "Install Node.js 22+ first (https://nodejs.org), then run: sh setup.sh"; exit 1; fi
fi
npm install
npm run setup -- --yes
echo
echo "Setup finished. Starting ClipForge on http://localhost:3000"
( sleep 10; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) || true ) &
npm run dev
