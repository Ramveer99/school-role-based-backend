#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy .env.example to .env and set MONGODB_URI, JWT_SECRET, PORT."
  exit 1
fi

if [[ ! -f dist/index.html ]]; then
  echo "ERROR: dist/index.html missing. Build the frontend and copy it into ./dist first."
  exit 1
fi

# Stop common static-only servers that break /api/* (return HTML instead of JSON).
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete serve 2>/dev/null || true
  pm2 delete static 2>/dev/null || true
fi

export NODE_ENV=production
export SERVE_STATIC=true
export STATIC_DIR="${STATIC_DIR:-$ROOT/dist}"

echo "Starting EduCore API + frontend on PORT=${PORT:-8080}"
echo "Static dir: $STATIC_DIR"
exec node src/server.js
