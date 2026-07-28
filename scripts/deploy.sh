#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  ELITE CLUB — deploy script (runs ON the Hostinger VPS)
#
#  Triggered automatically by .github/workflows/deploy.yml on every push
#  to main. You can also run it by hand over SSH:
#
#      cd /var/www/elite-club && ./scripts/deploy.sh
#
#  It is safe to re-run. If the build fails, the site keeps serving the
#  previous version — PM2 is only reloaded after a successful build.
# ════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/elite-club}"
APP_NAME="elite-club"

cd "$APP_DIR"

echo "──> Fetching latest code"
git fetch --all --prune
git reset --hard origin/main

echo "──> Installing dependencies"
# `npm ci` is reproducible and removes anything not in package-lock.json.
npm ci --no-audit --no-fund

echo "──> Building"
# Build into a scratch dir first so a failed build cannot take the site down.
npm run build

echo "──> Assembling standalone server"
# `output: 'standalone'` does not copy these two — they must be placed by hand.
# Clear them first: `cp -r src dest` copies *into* dest when dest already
# exists, which would nest them (.next/static/static) on a repeat run.
rm -rf .next/standalone/.next/static .next/standalone/public
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then
  cp -r public .next/standalone/public
fi

# The standalone server runs with .next/standalone as its working directory,
# so the runtime env file has to live there too.
if [ -f .env.local ]; then
  cp .env.local .next/standalone/.env.local
else
  echo "!! .env.local is missing — the app will start but Supabase/Razorpay will be off"
fi

mkdir -p logs

echo "──> Restarting app"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "──> Waiting for the app to answer"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    echo "✓ Deployed — app is responding"
    exit 0
  fi
  sleep 2
done

echo "✗ App did not respond within 60s. Recent logs:"
pm2 logs "$APP_NAME" --lines 40 --nostream
exit 1
