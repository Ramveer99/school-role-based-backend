#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy .env.example to .env and set MONGODB_URI, JWT_SECRET, PORT."
  exit 1
fi

# Stop static file servers (serve dist) — they show directory listings and break /api/*.
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete serve 2>/dev/null || true
  pm2 delete static 2>/dev/null || true
  pm2 delete my-react-app 2>/dev/null || true
fi
pkill -f "serve dist" 2>/dev/null || true
pkill -f "serve -s dist" 2>/dev/null || true

export NODE_ENV=production
export PORT="${PORT:-8080}"

echo "Starting EduCore API + frontend on PORT=$PORT"
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrRestart ecosystem.config.cjs
  pm2 save
else
  exec node src/server.js
fi
