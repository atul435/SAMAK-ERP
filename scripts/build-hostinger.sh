#!/usr/bin/env bash
# Builds a self-hostable Node.js bundle of the app and packages it as
# dist-hostinger.zip, ready to upload to a Hostinger VPS.
#
#   bash scripts/build-hostinger.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

RUNNER="npm run"
command -v bun >/dev/null 2>&1 && RUNNER="bun run"

echo "==> Building for a standard Node.js server..."
rm -rf .output
env -u DEV_SERVER__PROJECT_PATH -u LOVABLE_SANDBOX -u LOVABLE_NITRO_PRESET \
  NITRO_PRESET=node-server $RUNNER build

if [ ! -f .output/server/index.mjs ]; then
  echo "Build failed: .output/server/index.mjs not found" >&2
  exit 1
fi

echo "==> Packaging dist-hostinger.zip..."
STAGE="$(mktemp -d)"
mkdir -p "$STAGE/pkg"
cp -R .output "$STAGE/pkg/.output"
cp deploy/.env.example deploy/ecosystem.config.cjs deploy/start.sh "$STAGE/pkg/"
cp deploy/README-HOSTINGER.md "$STAGE/pkg/README.md"
chmod +x "$STAGE/pkg/start.sh"

rm -f dist-hostinger.zip
(cd "$STAGE/pkg" && zip -qr "$OLDPWD/dist-hostinger.zip" . -x '*.DS_Store')
rm -rf "$STAGE"

echo "==> Done: $(pwd)/dist-hostinger.zip"
echo "    Next steps are in deploy/README-HOSTINGER.md"
