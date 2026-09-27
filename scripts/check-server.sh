#!/usr/bin/env bash
# Quick check: /api/* must return JSON from Express.
HOST="${1:-http://127.0.0.1}"
API_URL="${HOST%/}/api/health"
echo "Checking $API_URL ..."
BODY=$(curl -s "$API_URL")
if echo "$BODY" | grep -q '"ok":true'; then
  echo "OK: API routed to Express (JSON)"
  echo "$BODY"
  exit 0
fi
if echo "$BODY" | grep -qi '<!doctype html'; then
  echo "FAIL: /api/* returned HTML instead of JSON."
  echo "Fix:"
  echo "  1. Ensure educore-api runs (pm2 start ecosystem.config.cjs)"
  echo "  2. Configure your reverse proxy so /api/ routes to the Express backend"
  exit 1
fi
echo "Unexpected response:"
echo "$BODY" | head -5
exit 1
