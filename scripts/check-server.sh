#!/usr/bin/env bash
# Quick check: /api/* must return JSON via Nginx (or direct backend), not React HTML.
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
  echo "FAIL: /api/* is hitting the React static server (serve on :8080), not Express on :8787."
  echo "Fix:"
  echo "  1. Ensure educore-api runs on 127.0.0.1:8787 (pm2 start ecosystem.config.cjs)"
  echo "  2. Ensure my-react-app runs on 127.0.0.1:8080 with: node_modules/.bin/serve -s dist -l 8080"
  echo "  3. Configure Nginx: /api/ -> 8787, / -> 8080 (see deploy/nginx/educore.conf)"
  echo "  4. Do NOT expose :8080 publicly without Nginx — use port 80/443 only"
  exit 1
fi
echo "Unexpected response:"
echo "$BODY" | head -5
exit 1
