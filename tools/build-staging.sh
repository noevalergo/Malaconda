#!/usr/bin/env bash
# Builds the staging archive for Hostinger from a commit (default HEAD): api/ + client/ + a root package.json.
# Checks that no secret or forbidden file is inside. Output: dist/malaconda-staging-<sha>.zip
# Usage: tools/build-staging.sh [commit]
set -euo pipefail
cd "$(dirname "$0")/.."
COMMIT="${1:-HEAD}"; SHA=$(git rev-parse --short "$COMMIT")
[ -n "$(git status --porcelain --untracked-files=no)" ] && echo "WARNING: uncommitted changes are NOT in the archive (only commit $SHA is)."
OUT="dist/malaconda-staging-$SHA.zip"; T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p dist
git archive "$COMMIT" api client | tar -x -C "$T"
rm -rf "$T/api/test" "$T/api/node_modules"
python3 - "$T" <<'PY'
import json, sys
t = sys.argv[1]
pkg = json.load(open(f"{t}/api/package.json"))
root = {"name": "malaconda-staging", "version": pkg["version"], "private": True, "engines": pkg["engines"],
        "scripts": {"start": "node api/server.js"}, "dependencies": pkg["dependencies"]}
json.dump(root, open(f"{t}/package.json", "w"), indent=2)
PY
cp api/package-lock.json "$T/package-lock.json"
printf 'require("./api/server.js");\n' > "$T/server.js"   # Passenger starts server.js at the root
# safety checks
if grep -rIEl "sk_(test|live)_[0-9A-Za-z]{10,}|whsec_[0-9A-Za-z]{10,}|xkeysib-[0-9a-f]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[0-9A-Za-z]{20,}" "$T"; then echo "FAILED: a secret pattern is in the archive"; exit 1; fi
if find "$T" -name ".env*" ! -name ".env.example" -o -name "node_modules" -o -name "*.pem" -o -name "*.key" | grep -q .; then echo "FAILED: forbidden file in the archive"; exit 1; fi
rm -f "$OUT"; (cd "$T" && zip -qr "$OLDPWD/$OUT" .)
echo "OK: $OUT ($(unzip -l "$OUT" | tail -1 | awk '{print $2}') files, $(du -h "$OUT" | cut -f1)), built from $SHA, no secret, no .env"
