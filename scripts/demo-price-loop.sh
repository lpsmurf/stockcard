#!/usr/bin/env bash
# Keep signed prices fresh during the demo. Equity `SignedPrice` goes stale after
# 180 s while the market is open; run this on the demo machine so borrows never
# hit StalePrice. Stop with Ctrl-C.
#
# Usage: ./scripts/demo-price-loop.sh
set -euo pipefail

cd "$(dirname "$0")/.."
APP_URL="https://stockcard-app.vercel.app"
CRON_SECRET=$(grep '^CRON_SECRET=' app/.env.local | cut -d= -f2-)

if [ -z "$CRON_SECRET" ]; then
  echo "CRON_SECRET not found in app/.env.local" >&2
  exit 1
fi

tick=0
while true; do
  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/prices/sync" >/dev/null && echo "$(date +%H:%M:%S) price sync ok" || echo "$(date +%H:%M:%S) price sync failed"
  if (( tick % 5 == 0 )); then
    curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/alerts/check" >/dev/null && echo "$(date +%H:%M:%S) alerts ok" || echo "$(date +%H:%M:%S) alerts failed"
  fi
  tick=$((tick + 1))
  sleep 60
done
