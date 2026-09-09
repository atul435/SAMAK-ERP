#!/usr/bin/env bash
# Simple start script (alternative to PM2). Run from the folder that holds .output/
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export NODE_ENV=production
exec node .output/server/index.mjs
