#!/usr/bin/env bash
# Atlan Scan — start locally. Checks the environment first, then runs.
set -e
cd "$(dirname "$0")"

need=22.6.0
have="$(node -v 2>/dev/null | sed 's/^v//')" || true

if [ -z "$have" ]; then
  echo "✗ Node is not installed."
  echo "  Install Node 22 or newer:  brew install node   (or https://nodejs.org)"
  exit 1
fi

# numeric compare major.minor.patch
ver() { printf "%03d%03d%03d" $(echo "$1" | tr '.' ' '); }
if [ "$(ver "$have")" -lt "$(ver "$need")" ]; then
  echo "✗ Node $have is too old — Atlan Scan needs $need or newer (it runs TypeScript directly)."
  echo "  Upgrade:  brew upgrade node   (or https://nodejs.org)"
  exit 1
fi
echo "✓ Node $have"

if [ ! -d node_modules ]; then
  echo "· Installing dev dependencies (typescript only, ~10s)…"
  npm install --silent --no-fund --no-audit
fi
echo "✓ Dependencies"

# node --watch insists on watching the env file, so make sure one exists.
if [ ! -f .env ]; then
  cp .env.example .env
  echo "· Created .env from .env.example — add your Google credentials there when you have them"
fi

mkdir -p data
echo "✓ Database at ./data/scan.db"
echo ""
echo "  Opening on http://localhost:8787"
echo "  Watching for changes — edits apply without restarting."
echo "  Stop with Ctrl-C."
echo ""
# --watch restarts the process whenever a source file changes, so edits land live.
exec node --env-file-if-exists=.env --watch --experimental-strip-types --no-warnings src/web/server.ts
