#!/usr/bin/env bash
# Deploys a commit to the Malaconda staging app on Hostinger over SSH (same method as the other sites):
# build the checked archive, send it with the staging .env, install, restart Passenger, check health.
# Needs: ~/.ssh/id_ed25519_malaconda (public part added in hPanel > SSH), SSH enabled on the plan, .env.staging next to this repo.
# Usage: tools/deploy-staging.sh [commit]
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$HOME/.ssh/id_ed25519_malaconda"; HOST="u542675792@147.79.103.228"; PORT=65002
DOMAIN="darkgrey-woodpecker-421178.hostingersite.com"
APP="/home/u542675792/domains/$DOMAIN/hbuilds/current/nodejs"       # the folder Passenger runs (see public_html/.htaccess)
[ -f .env.staging ] || { echo "Missing .env.staging"; exit 1; }
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -p "$PORT")

bash tools/build-staging.sh "${1:-HEAD}" | tee /tmp/mlc-build.txt
ZIP=$(grep -o 'dist/malaconda-staging-[0-9a-f]*\.zip' /tmp/mlc-build.txt | head -1)
[ -f "$ZIP" ] || { echo "No archive built"; exit 1; }

echo "== Sending =="
"${SSH[@]}" "$HOST" "mkdir -p ~/malaconda-deploy-tmp"
scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -P "$PORT" "$ZIP" .env.staging "$HOST:malaconda-deploy-tmp/"

echo "== Installing and restarting =="
"${SSH[@]}" "$HOST" bash -s -- "$APP" "$(basename "$ZIP")" <<'REMOTE'
set -euo pipefail
APP="$1"; ZIP="$2"
export PATH=/opt/alt/alt-nodejs22/root/bin:$PATH
cd "$APP"
python3 - "$HOME/malaconda-deploy-tmp/$ZIP" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall('.')
PY
cp "$HOME/malaconda-deploy-tmp/.env.staging" .env && chmod 600 .env
npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -3
mkdir -p tmp && touch tmp/restart.txt
echo "node $(node -v), app folder: $APP"
REMOTE

echo "== Health =="
sleep 6
curl -s -m 30 "https://$DOMAIN/api/health" -o /dev/null -w "health (no login needed): HTTP %{http_code}\n"
