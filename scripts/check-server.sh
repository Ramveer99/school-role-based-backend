#!/usr/bin/env bash
# Quick check: API should return JSON, not HTML.
HOST="${1:-http://13.239.0.175:8080}"
echo "Checking $HOST/api/health ..."
BODY=$(curl -s "$HOST/api/health")
if echo "$BODY" | grep -q '"ok":true'; then
  echo "OK: API is running (Express)"
  echo "$BODY"
  exit 0
fi
if echo "$BODY" | grep -qi '<!doctype html'; then
  echo "FAIL: Static file server is running instead of Express."
  echo "Fix: SSH to server, stop 'serve' / 'npx serve dist', then run:"
  echo "  cd school-role-based-backend && bash scripts/start-production.sh"
  exit 1
fi
echo "Unexpected response:"
echo "$BODY" | head -5
exit 1
