#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy .env.example to .env and set MONGODB_URI, JWT_SECRET, PORT."
  exit 1
fi

export NODE_ENV=production
export PORT="${PORT:-8080}"

echo "Starting EduCore API on PORT=$PORT"
if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrRestart ecosystem.config.cjs
  pm2 save
else
  exec node src/server.js
fi
