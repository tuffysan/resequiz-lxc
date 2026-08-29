#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"
if [[ $EUID -ne 0 ]]; then echo "Kör detta som root på Proxmox-värden." >&2; exit 1; fi
if ! pct status "$CTID" >/dev/null 2>&1; then echo "❌ CTID $CTID finns inte."; exit 1; fi
STATE="$(pct status "$CTID" | awk '{print $2}')"
echo "CT $CTID: $STATE"
[[ "$STATE" == "running" ]] || exit 1
pct exec "$CTID" -- env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -lc '
set -e
printf "Resequiz service: "; systemctl is-active resequiz
printf "Nginx service:    "; systemctl is-active nginx
printf "Health:           "; curl -fsS http://127.0.0.1:3000/health; echo
printf "Socket.IO:        "; S=$(curl -fsS "http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling"); [[ "$S" == 0\{* ]] && echo OK || { echo FEL; exit 1; }
printf "Admin key file:   "; [[ -s /root/resequiz-admin-key.txt || -s /etc/resequiz.env ]] && echo OK || { echo SAKNAS; exit 1; }
'
