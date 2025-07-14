#!/bin/sh
# Patch Coinbase HeartbeatWorker.js in node_modules to remove 'export {};' line
set -e

COINBASE_WORKER="./node_modules/.pnpm/@coinbase+wallet-sdk@4.3.3/node_modules/@coinbase/wallet-sdk/dist/sign/walletlink/relay/connection/HeartbeatWorker.js"

if [ -f "$COINBASE_WORKER" ]; then
  grep -v '^export {};\?$' "$COINBASE_WORKER" > "$COINBASE_WORKER.tmp" && mv "$COINBASE_WORKER.tmp" "$COINBASE_WORKER"
  echo "Patched HeartbeatWorker.js in node_modules."
else
  echo "Coinbase HeartbeatWorker.js not found!"
fi
