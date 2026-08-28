#!/usr/bin/env bash
set -euo pipefail

CTID="${CTID:-135}"
HOSTNAME="${HOSTNAME:-resequiz}"
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

pct exec "$CTID" -- bash -lc 'export DEBIAN_FRONTEND=noninteractive; apt-get update; apt-get install -y nodejs npm nginx ca-certificates curl qrencode; useradd --system --home /opt/resequiz --shell /usr/sbin/nologin resequiz 2>/dev/null || true; mkdir -p /opt/resequiz /var/lib/resequiz; chown resequiz:resequiz /var/lib/resequiz'

tar -C "$SCRIPT_DIR/app" -czf /tmp/resequiz-app.tgz .
pct push "$CTID" /tmp/resequiz-app.tgz /tmp/resequiz-app.tgz
pct push "$CTID" "$SCRIPT_DIR/resequiz.service" /etc/systemd/system/resequiz.service
pct push "$CTID" "$SCRIPT_DIR/resequiz.nginx" /etc/nginx/sites-available/resequiz
rm -f /tmp/resequiz-app.tgz

pct exec "$CTID" -- bash -lc 'set -e; rm -rf /opt/resequiz/*; tar -xzf /tmp/resequiz-app.tgz -C /opt/resequiz; cd /opt/resequiz; npm install --omit=dev; chown -R resequiz:resequiz /opt/resequiz; rm -f /etc/nginx/sites-enabled/default; ln -sf /etc/nginx/sites-available/resequiz /etc/nginx/sites-enabled/resequiz; nginx -t; systemctl daemon-reload; systemctl enable --now resequiz nginx; systemctl restart nginx'

IP="$(pct exec "$CTID" -- hostname -I | awk '{print $1}')"
echo
echo "============================================================"
echo " Resequiz LXC installerad"
echo "============================================================"
echo " CTID:        $CTID"
echo " Hostname:    $HOSTNAME"
echo " IP:          ${IP:-okänd}"
echo " Webb:        http://${IP:-CONTAINER-IP}/"
echo " Online:      http://${IP:-CONTAINER-IP}/online.html"
echo " Offline/PWA: http://${IP:-CONTAINER-IP}/offline.html"
echo " Health:      http://${IP:-CONTAINER-IP}/health"
echo "============================================================"
echo "Tips: För PWA-installation över Internet bör du lägga HTTPS framför"
echo "tjänsten, t.ex. via din befintliga reverse proxy. På lokalt nätverk"
echo "kan quizet användas i webbläsaren direkt."
