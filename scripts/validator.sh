#!/usr/bin/env bash
# Local test validator with the ledger OUTSIDE the repo and a size cap.
# Writing the ledger into ./test-ledger grew to 9.4 GB (a 5.2 GB log) and made
# VS Code, Kimi and Claude index it, which is what kept crashing the machine.
#
# Usage:
#   scripts/validator.sh          # start (fresh ledger each time)
#   scripts/validator.sh --keep   # start without --reset
# Then run tests with:  anchor test --skip-local-validator --arch v2
set -euo pipefail

LEDGER="${STOCKCARD_LEDGER:-/tmp/stockcard-ledger}"
RESET="--reset"
[ "${1:-}" = "--keep" ] && RESET=""

if pgrep -f solana-test-validator >/dev/null; then
  echo "A solana-test-validator is already running. Stop it with: pkill -f solana-test-validator"
  exit 1
fi

echo "Ledger: $LEDGER (capped at ~50 MB of shreds, logs to $LEDGER/validator.log)"
exec solana-test-validator \
  $RESET --quiet \
  --ledger "$LEDGER" \
  --limit-ledger-size 50000000
