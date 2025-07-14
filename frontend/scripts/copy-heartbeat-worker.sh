#!/bin/sh
# Copy Coinbase HeartbeatWorker.js to public/ for Next.js build workaround
set -e

COINBASE_WORKER="./node_modules/.pnpm/@coinbase+wallet-sdk@4.3.3/node_modules/@coinbase/wallet-sdk/dist/sign/walletlink/relay/connection/HeartbeatWorker.js"
PUBLIC_WORKER="./public/HeartbeatWorker.js"

if [ -f "$COINBASE_WORKER" ]; then
  # Copy and strip 'export {};' from the end of the file
  grep -v '^export {};\?$' "$COINBASE_WORKER" > "$PUBLIC_WORKER"
  echo "Copied and sanitized HeartbeatWorker.js to public/"
else
  echo "Coinbase HeartbeatWorker.js not found!"
  exit 1
fi
