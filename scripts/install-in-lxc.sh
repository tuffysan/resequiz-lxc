#!/usr/bin/env bash
set -Eeuo pipefail
SRC="${1:-$(cd "$(dirname "$0")/../app" && pwd)}"; APP=/opt/resequiz; DATA=/var/lib/resequiz
[ "$(id -u)" = 0 ] || { echo "Kör som root i LXC." >&2; exit 1; }
apt-get update
apt-get install -y ca-certificates curl rsync util-linux
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(`.`)[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
id resequiz >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin resequiz
mkdir -p "$APP" "$DATA"
# Quiz 21: automatic pre-upgrade backup.
mkdir -p /var/backups/resequiz
if [ -d "$DATA" ] && [ "$(find "$DATA" -mindepth 1 -maxdepth 1 2>/dev/null | head -1)" ]; then
  BACKUP="/var/backups/resequiz/pre-upgrade-$(date +%Y%m%d-%H%M%S).tgz"
  tar -czf "$BACKUP" -C /var/lib resequiz || true
  echo "Backup före uppdatering: $BACKUP"
  ls -1t /var/backups/resequiz/pre-upgrade-*.tgz 2>/dev/null | tail -n +6 | xargs -r rm -f
fi
# Preserve legacy media assets before deployment.
rm -rf /tmp/quiz-media-keep
if [ -d "$APP/public/media-packs" ]; then
  mkdir -p /tmp/quiz-media-keep; cp -a "$APP/public/media-packs" /tmp/quiz-media-keep/
else
  MEDIA_SOURCE="$(find /opt /var/backups /root -maxdepth 6 -type d -path '*/public/media-packs' 2>/dev/null | head -1 || true)"
  if [ -n "$MEDIA_SOURCE" ]; then mkdir -p /tmp/quiz-media-keep; cp -a "$MEDIA_SOURCE" /tmp/quiz-media-keep/media-packs; fi
fi
# Preserve an already migrated bank and detect the legacy v18 bank before deployment.
if [ -f "$DATA/questions.json" ]; then cp "$DATA/questions.json" /tmp/rq-questions.keep; fi
if [ -f "$APP/data/questions.json" ]; then cp "$APP/data/questions.json" /tmp/rq-legacy-questions.json; fi
if ! grep -q '"visual"' /tmp/rq-legacy-questions.json 2>/dev/null; then
  LEGACY_SOURCE="$(find /opt /var/backups /root -maxdepth 6 -type f -name questions.json -size +1M 2>/dev/null | while read -r f; do grep -q '"visual"' "$f" 2>/dev/null && { echo "$f"; break; }; done)"
  if [ -n "$LEGACY_SOURCE" ]; then cp "$LEGACY_SOURCE" /tmp/rq-legacy-questions.json; fi
fi
rsync -a --delete --exclude data/ "$SRC/" "$APP/"
mkdir -p "$APP/data" "$APP/tools"
cp "$(dirname "$0")/expand-source-backed-questions.js" "$APP/tools/" 2>/dev/null || true
cp "$(dirname "$0")/question-bank-report.js" "$APP/tools/" 2>/dev/null || true
cp "$(dirname "$0")/sync-question-bank.sh" "$APP/tools/" 2>/dev/null || true
chmod +x "$APP/tools/sync-question-bank.sh" 2>/dev/null || true
cp "$SRC/data/child-questions.json" "$APP/data/child-questions.json"
cd "$APP"
if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
for f in questions.json results.json settings.json users.json question-reports.json; do [ -f "$DATA/$f" ] || cp "$SRC/data/$f" "$DATA/$f"; done
# Migrate old visible product title while preserving the rest of the user's settings.
node - "$DATA/settings.json" <<'NODE'
const fs=require('fs');
const f=process.argv[2];
try {
  const s=JSON.parse(fs.readFileSync(f,'utf8'));
  if (!s.title || /^resequiz$/i.test(String(s.title).trim())) s.title='Quiz';
  fs.writeFileSync(f, JSON.stringify(s,null,2)+'\n');
} catch(e) {
  console.error('Kunde inte migrera settings.json:', e.message);
}
NODE
# Create the first-run admin setup key explicitly so it never depends on service startup timing.
[ -f "$DATA/admin-auth.json" ] || printf '{"passwordHash":"","passwordSalt":"","updatedAt":null}\n' > "$DATA/admin-auth.json"
ADMIN_HAS_PASSWORD="$(node -e 'const fs=require("fs");try{const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(a.passwordHash?"yes":"no")}catch(e){process.stdout.write("no")}' "$DATA/admin-auth.json")"
if [ "$ADMIN_HAS_PASSWORD" = "no" ] && [ ! -s "$DATA/admin-setup-key" ]; then
  umask 077
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16 > "$DATA/admin-setup-key"; else node -e 'process.stdout.write(require("crypto").randomBytes(12).toString("base64url").slice(0,16))' > "$DATA/admin-setup-key"; fi
  echo >> "$DATA/admin-setup-key"
fi
if [ -f /tmp/rq-questions.keep ]; then
  mv /tmp/rq-questions.keep "$DATA/questions.json"
elif [ -f /tmp/rq-legacy-questions.json ]; then
  node "$(dirname "$0")/import-legacy-questions.js" /tmp/rq-legacy-questions.json "$DATA/questions.json"
fi
# Restore legacy question image metadata that v19.0-19.3 importers did not preserve.
if [ -f /tmp/rq-legacy-questions.json ]; then node "$(dirname "$0")/repair-legacy-question-media.js" "$DATA/questions.json" /tmp/rq-legacy-questions.json || true; fi
# Merge the curated verified question pack into an existing persistent bank, idempotently.
if [ -f "$SRC/data/verified-questions.json" ]; then node "$(dirname "$0")/merge-verified-questions.js" "$DATA/questions.json" "$SRC/data/verified-questions.json"; fi
# Quiz 21.0.1: source-backed expansion no longer blocks upgrades.
# A retrying, cached background job continues the bank after the app is healthy.
if [ -d /tmp/quiz-media-keep/media-packs ]; then mkdir -p "$APP/public"; cp -a /tmp/quiz-media-keep/media-packs "$APP/public/"; fi
chown -R resequiz:resequiz "$APP" "$DATA"
cp "$(dirname "$0")/../deploy/resequiz.service" /etc/systemd/system/resequiz.service
cp "$(dirname "$0")/../deploy/quiz-question-sync.service" /etc/systemd/system/quiz-question-sync.service
cp "$(dirname "$0")/../deploy/quiz-question-sync.timer" /etc/systemd/system/quiz-question-sync.timer
systemctl daemon-reload
systemctl enable --now quiz-question-sync.timer >/dev/null
systemctl enable resequiz >/dev/null
# Viktigt: enable --now startar inte om en redan körande tjänst. Starta därför alltid om
# tjänsten så att den nya server.js faktiskt laddas.
systemctl restart resequiz
EXPECTED_VERSION="$(node -p "require('$APP/package.json').version")"
HEALTH=""
for i in $(seq 1 20); do
  HEALTH="$(curl -fsS http://127.0.0.1:3000/health 2>/dev/null || true)"
  RUNNING_VERSION="$(printf '%s' "$HEALTH" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch(e){}})' 2>/dev/null || true)"
  [ "$RUNNING_VERSION" = "$EXPECTED_VERSION" ] && break
  sleep 1
done
if [ "$RUNNING_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "Fel: tjänsten kör version ${RUNNING_VERSION:-okänd}, väntade ${EXPECTED_VERSION}." >&2
  systemctl --no-pager --full status resequiz >&2 || true
  journalctl -u resequiz -n 80 --no-pager >&2 || true
  exit 1
fi
printf '%s\n' "$HEALTH"
ADMIN_CONFIGURED="$(node -e 'const fs=require("fs");try{const a=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(a.passwordHash?"yes":"no")}catch(e){process.stdout.write("no")}' "$DATA/admin-auth.json")"
if [ "$ADMIN_CONFIGURED" = "no" ]; then echo; echo "Admin installationsnyckel: $(cat "$DATA/admin-setup-key")"; fi

# Start one completion pass after a successful upgrade, without delaying deployment.
systemctl start --no-block quiz-question-sync.service || true
echo "Frågebankssynk startad i bakgrunden (daglig timer 03:30 är aktiverad)."
