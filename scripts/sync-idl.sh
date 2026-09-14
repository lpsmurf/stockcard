#!/usr/bin/env bash
# Copies the built IDL and generated types into the app.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p app/src/lib/idl
cp target/idl/stockcard.json app/src/lib/idl/stockcard.json
cp target/types/stockcard.ts app/src/lib/idl/stockcard.ts
echo "Synced IDL + types to app/src/lib/idl/"
