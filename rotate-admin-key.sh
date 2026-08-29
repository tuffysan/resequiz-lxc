#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"
if [[ $EUID -ne 0 ]]; then echo "Kör detta som root på Proxmox-värden." >&2; exit 1; fi
if ! pct status "$CTID" >/dev/null 2>&1; then echo "CTID $CTID finns inte." >&2; exit 1; fi
pct exec "$CTID" -- env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -lc '
set -euo pipefail
KEY=$(od -An -N24 -tx1 /dev/urandom | tr -d " \n")
touch /etc/resequiz.env
grep -v "^RESEQUIZ_ADMIN_KEY=" /etc/resequiz.env > /tmp/resequiz.env.$$ || true
printf "RESEQUIZ_ADMIN_KEY=%s\n" "$KEY" >> /tmp/resequiz.env.$$
install -m 640 -o root -g root /tmp/resequiz.env.$$ /etc/resequiz.env
rm -f /tmp/resequiz.env.$$
printf "%s\n" "$KEY" > /root/resequiz-admin-key.txt
chmod 600 /root/resequiz-admin-key.txt
systemctl restart resequiz
'
echo "Adminnyckeln har roterats i CT $CTID och Resequiz har startats om."
echo "Den nya nyckeln skrivs inte ut. Visa den endast när du behöver den:"
echo "  pct exec $CTID -- cat /root/resequiz-admin-key.txt"
