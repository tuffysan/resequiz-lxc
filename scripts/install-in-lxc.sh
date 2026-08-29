#!/usr/bin/env bash
set -Eeuo pipefail
SRC="${1:-$(cd "$(dirname "$0")/../app" && pwd)}"; APP=/opt/resequiz; DATA=/var/lib/resequiz
[ "$(id -u)" = 0 ] || { echo "Kör som root i LXC." >&2; exit 1; }
apt-get update
apt-get install -y ca-certificates curl rsync
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(`.`)[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
id resequiz >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin resequiz
mkdir -p "$APP" "$DATA"
# Preserve an already migrated bank and detect the legacy v18 bank before deployment.
if [ -f "$DATA/questions.json" ]; then cp "$DATA/questions.json" /tmp/rq-questions.keep; fi
if [ -f "$APP/data/questions.json" ]; then cp "$APP/data/questions.json" /tmp/rq-legacy-questions.json; fi
rsync -a --delete --exclude data/ "$SRC/" "$APP/"
cd "$APP"
if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
for f in questions.json results.json settings.json; do [ -f "$DATA/$f" ] || cp "$SRC/data/$f" "$DATA/$f"; done
if [ -f /tmp/rq-questions.keep ]; then
  mv /tmp/rq-questions.keep "$DATA/questions.json"
elif [ -f /tmp/rq-legacy-questions.json ]; then
  node "$(dirname "$0")/import-legacy-questions.js" /tmp/rq-legacy-questions.json "$DATA/questions.json"
fi
chown -R resequiz:resequiz "$APP" "$DATA"
cp "$(dirname "$0")/../deploy/resequiz.service" /etc/systemd/system/resequiz.service
systemctl daemon-reload; systemctl enable --now resequizz
sleep 2
curl -fsS http://127.0.0.1:3000/health; echo
