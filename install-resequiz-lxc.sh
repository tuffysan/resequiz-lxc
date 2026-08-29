#!/usr/bin/env bash
set -euo pipefail

CTID="${CTID:-135}"
HOSTNAME="resequiz"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
DISK_GB="${DISK_GB:-8}"
MEMORY_MB="${MEMORY_MB:-1024}"
CORES="${CORES:-2}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
TEMPLATE="${TEMPLATE:-debian-12-standard_12.12-1_amd64.tar.zst}"
NET="${NET:-name=eth0,bridge=${BRIDGE},ip=dhcp,type=veth}"
PASSWORD="${PASSWORD:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(tr -d '[:space:]' < "$SCRIPT_DIR/VERSION")"

if [[ $EUID -ne 0 ]]; then echo "Kör scriptet som root på Proxmox-värden." >&2; exit 1; fi
if ! command -v pct >/dev/null 2>&1; then echo "pct saknas. Scriptet ska köras på en Proxmox VE-värd." >&2; exit 1; fi
if pct status "$CTID" >/dev/null 2>&1; then echo "CTID $CTID används redan. Ange t.ex. CTID=140 ./install-resequiz-lxc.sh" >&2; exit 1; fi

TEMPLATE_PATH="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}"
TEMPLATE_FILE="$(pvesm path "$TEMPLATE_PATH" 2>/dev/null || true)"
if [[ -z "$TEMPLATE_FILE" || ! -f "$TEMPLATE_FILE" ]]; then
  echo "Debian 12-template saknas. Hämtar template..."
  pveam update
  FOUND="$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | tail -1)"
  [[ -n "$FOUND" ]] || { echo "Kunde inte hitta Debian 12-template." >&2; exit 1; }
  pveam download "$TEMPLATE_STORAGE" "$FOUND"
  TEMPLATE_PATH="${TEMPLATE_STORAGE}:vztmpl/${FOUND}"
fi

ARGS=(create "$CTID" "$TEMPLATE_PATH" --hostname "$HOSTNAME" --cores "$CORES" --memory "$MEMORY_MB" --swap 512 --rootfs "${STORAGE}:${DISK_GB}" --net0 "$NET" --unprivileged 1 --features nesting=1 --onboot 1 --start 1)
if [[ -n "$PASSWORD" ]]; then ARGS+=(--password "$PASSWORD"); fi
pct "${ARGS[@]}"

echo "Väntar på nätverk..."
for _ in {1..30}; do
  if pct exec "$CTID" -- bash -lc 'getent hosts deb.debian.org >/dev/null 2>&1'; then break; fi
  sleep 2
done

pct exec "$CTID" -- env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -lc '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 LC_ALL=C.UTF-8
printf "LANG=C.UTF-8\nLC_ALL=C.UTF-8\n" > /etc/default/locale
apt-get update
apt-get install -y nodejs npm nginx ca-certificates curl qrencode
useradd --system --home /opt/resequiz --shell /usr/sbin/nologin resequiz 2>/dev/null || true
mkdir -p /opt/resequiz /var/lib/resequiz /var/lib/resequiz/media
chown -R resequiz:resequiz /var/lib/resequiz
KEY=$(od -An -N24 -tx1 /dev/urandom | tr -d " \n")
printf "RESEQUIZ_ADMIN_KEY=%s\n" "$KEY" > /etc/resequiz.env
chmod 640 /etc/resequiz.env
printf "%s\n" "$KEY" > /root/resequiz-admin-key.txt
chmod 600 /root/resequiz-admin-key.txt
'

TMP_TGZ="$(mktemp /tmp/resequiz-app.XXXXXX.tgz)"
trap 'rm -f "$TMP_TGZ"' EXIT
tar -C "$SCRIPT_DIR/app" -czf "$TMP_TGZ" .
pct push "$CTID" "$TMP_TGZ" /tmp/resequiz-app.tgz
pct push "$CTID" "$SCRIPT_DIR/resequiz.service" /etc/systemd/system/resequiz.service
pct push "$CTID" "$SCRIPT_DIR/resequiz.nginx" /etc/nginx/sites-available/resequiz

pct exec "$CTID" -- env EXPECTED_VERSION="$VERSION" LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -lc '
set -euo pipefail
export LANG=C.UTF-8 LC_ALL=C.UTF-8
rm -rf /opt/resequiz/*
tar -xzf /tmp/resequiz-app.tgz -C /opt/resequiz
rm -f /tmp/resequiz-app.tgz
cd /opt/resequiz
npm install --omit=dev --no-audit --no-fund --loglevel=error
chown -R resequiz:resequiz /opt/resequiz
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/resequiz /etc/nginx/sites-enabled/resequiz
nginx -t
systemctl daemon-reload
systemctl enable resequiz nginx >/dev/null
systemctl restart resequiz nginx
for _ in $(seq 1 20); do
  H=$(curl -fsS http://127.1.0.1:3000/health 2>/dev/null || true)
  [[ "$H" == *"\"version\":\"${EXPECTED_VERSION}\""* ]] && exit 0
  sleep 1
done
echo "Resequiz startade inte med förväntad version ${EXPECTED_VERSION}." >&2
journalctl -u resequiz -n 80 --no-pager >&2 || true
exit 1
'

IP="$(pct exec "$CTID" -- hostname -I | awk '{print $1}')"
echo
echo "============================================================"
echo " Resequiz v${VERSION} installerad"
echo "============================================================"
echo " CTID:        $CTID"
echo " Hostname:    $HOSTNAME"
echo " IP:          ${IP:-okänd}"
echo " Webb:        http://${IP:-CONTAINER-IP}/"
echo " Online:      http://${IP:-CONTAINER-IP}/online.html"
echo " Offline/PWA: http://${IP:-CONTAINER-IP}/offline.html"
echo " Health:      http://${IP:-CONTAINER-IP}/health"
echo " Admin:       http://${IP:-CONTAINER-IP}/admin.html"
echo " Adminnyckeln lagras säkert i containern och skrivs inte ut automatiskt."
echo " Visa vid behov: pct exec $CTID -- cat /root/resequiz-admin-key.txt"
echo "============================================================"
