#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install the LTS version from https://nodejs.org, then run this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing Vitanaut for the first time. This can take a few minutes..."
  npm install
fi

echo "Starting Vitanaut at http://localhost:3000"
echo "Keep this window open while you use the app. Press Ctrl+C to stop."
( sleep 4; xdg-open http://localhost:3000 >/dev/null 2>&1 || true ) &
npm run dev
