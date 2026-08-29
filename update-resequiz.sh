#!/usr/bin/env bash
set -euo pipefail

CTID="${CTID:-135}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(tr -d '[:space:]' < "$DIR/VERSION")"
ROTATE_ADMIN_KEY="${ROTATE_ADMIN_KEY:-0}"

if [[ $EUID -ne 0 ]]; then
  echo "Kör detta som root på Proxmox-värden." >&2
  exit 1
fi
if ! command -v pct >/dev/null 2>&1; then
  echo "pct saknas. Kör skriptet på Proxmox VE-värden." >&2
  exit 1
fi
if ! pct status "$CTID" >/dev/null 2>&1; then
  echo "CTID $CTID finns inte." >&2
  exit 1
fi
if [[ "$(pct status "$CTID" | awk '{print $2}')" != "running" ]]; then
  echo "Startar CT $CTID..."
  pct start "$CTID"
  sleep 2
fi

echo "Uppdaterar Resequiz till v${VERSION} i CT ${CTID}..."
pct set "$CTID" --hostname resequiz >/dev/null
TMP_TGZ="$(mktemp /tmp/resequiz-app.XXXXXX.tgz)"
trap 'rm -f "$TMP_TGZ"' EXIT

tar -C "$DIR/app" -czf "$TMP_TGZ" .
pct push "$CTID" "$TMP_TGZ" /tmp/resequiz-app.tgz
pct push "$CTID" "$DIR/resequiz.service" /etc/systemd/system/resequiz.service
pct push "$CTID" "$DIR/resequiz.nginx" /etc/nginx/sites-available/resequiz

# All service reload/restart operations must happen inside the LXC, because
# resequiz.service belongs to the container, not to the Proxmox host.
pct exec "$CTID" -- env EXPECTED_VERSION="$VERSION" ROTATE_ADMIN_KEY="$ROTATE_ADMIN_KEY" LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -lc '
set -euo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8
printf "LANG=C.UTF-8\nLC_ALL=C.UTF-8\n" > /etc/default/locale

BACKUP=/opt/resequiz.rollback
rm -rf "$BACKUP"
if [[ -d /opt/resequiz && -n "$(ls -A /opt/resequiz 2>/dev/null)" ]]; then cp -a /opt/resequiz "$BACKUP"; fi
systemctl stop resequiz 2>/dev/null || true
mkdir -p /opt/resequiz /var/lib/resequiz /var/lib/resequiz/media
id resequiz >/dev/null 2>&1 || useradd --system --home /opt/resequiz --shell /usr/sbin/nologin resequiz
chown -R resequiz:resequiz /var/lib/resequiz

# Preserve the existing admin key unless explicit rotation was requested.
NEED_KEY=0
if [[ ! -s /etc/resequiz.env ]] || ! grep -q "^RESEQUIZ_ADMIN_KEY=" /etc/resequiz.env; then NEED_KEY=1; fi
if [[ "$ROTATE_ADMIN_KEY" == "1" ]]; then NEED_KEY=1; fi
if [[ "$NEED_KEY" == "1" ]]; then
  KEY=$(od -An -N24 -tx1 /dev/urandom | tr -d " \n")
  touch /etc/resequiz.env
  grep -v "^RESEQUIZ_ADMIN_KEY=" /etc/resequiz.env > /tmp/resequiz.env.$$ || true
  printf "RESEQUIZ_ADMIN_KEY=%s\n" "$KEY" >> /tmp/resequiz.env.$$
  install -m 640 -o root -g root /tmp/resequiz.env.$$ /etc/resequiz.env
  rm -f /tmp/resequiz.env.$$
fi
chmod 640 /etc/resequiz.env
# Keep a root-only recovery copy without exposing it in normal command output.
KEY=$(sed -n "s/^RESEQUIZ_ADMIN_KEY=//p" /etc/resequiz.env | head -n1)
[[ -n "$KEY" ]] || { echo "Adminnyckel saknas efter uppdatering." >&2; exit 1; }
printf "%s\n" "$KEY" > /root/resequiz-admin-key.txt
chmod 600 /root/resequiz-admin-key.txt
unset KEY

rm -rf /opt/resequiz/*
tar -xzf /tmp/resequiz-app.tgz -C /opt/resequiz
rm -f /tmp/resequiz-app.tgz
cd /opt/resequiz

# Controlled production install. Avoid audit --force / automatic breaking upgrades.
npm install --omit=dev --no-audit --no-fund --loglevel=error
chown -R resequiz:resequiz /opt/resequiz

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/resequiz /etc/nginx/sites-enabled/resequiz
nginx -t

# Reload unit definitions before enable/restart.
systemctl daemon-reload
systemctl enable resequiz nginx >/dev/null
systemctl restart resequiz
systemctl restart nginx

# Wait for application startup and verify exact expected version.
HEALTH=""
for _ in $(seq 1 20); do
  HEALTH=$(curl -fsS http://127.1.0.1:3000/health 2>/dev/null || true)
  if [[ "$HEALTH" == *"\"ok\":true"* ]]; then break; fi
  sleep 1
done
if [[ "$HEALTH" != *"\"ok\":true"* ]]; then
  echo "Health check misslyckades. Försöker rollback..." >&2
  if [[ -d /opt/resequiz.rollback ]]; then rm -rf /opt/resequiz/*; cp -a /opt/resequiz.rollback/. /opt/resequiz/; chown -R resequiz:resequiz /opt/resequiz; systemctl restart resequiz; fi
  systemctl --no-pager --full status resequiz >&2 || true
  journalctl -u resequiz -n 80 --no-pager >&2 || true
  exit 1
fi
if [[ "$HEALTH" != *"\"version\":\"${EXPECTED_VERSION}\""* ]]; then
  echo "Versionskontroll misslyckades. Förväntade ${EXPECTED_VERSION}. Försöker rollback..." >&2
  if [[ -d /opt/resequiz.rollback ]]; then rm -rf /opt/resequiz/*; cp -a /opt/resequiz.rollback/. /opt/resequiz/; chown -R resequiz:resequiz /opt/resequiz; systemctl restart resequiz; fi
  echo "$HEALTH" >&2
  exit 1
fi

SOCKET=$(curl -fsS "http://127.1.0.1:3000/socket.io/?EIO=4&transport=polling" 2>/dev/null || true)
if [[ "$SOCKET" != 0\{* ]]; then
  echo "Socket.IO-kontrollen misslyckades." >&2
  exit 1
fi

rm -rf /opt/resequiz.rollback
echo "$HEALTH"
echo "Socket.IO: OK"
'

echo
echo "Resequiz v${VERSION} uppdaterad och verifierad i CT ${CTID}."
if [[ "$ROTATE_ADMIN_KEY" == "1" ]]; then
  echo "Adminnyckeln roterades säkert och skrevs inte ut."
else
  echo "Adminnyckeln bevarades och skrivs inte ut av uppdateraren."
fi
echo "Visa den endast vid behov: pct exec ${CTID} -- cat /root/resequiz-admin-key.txt"
