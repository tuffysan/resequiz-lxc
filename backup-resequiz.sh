#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"; OUT="${OUT:-resequiz-data-$(date +%F-%H%M%S).tgz}"
[[ $EUID -eq 0 ]] || { echo "Kör som root på Proxmox." >&2; exit 1; }
pct exec "$CTID" -- tar -C /var/lib -czf /tmp/resequiz-data.tgz resequiz
pct pull "$CTID" /tmp/resequiz-data.tgz "$OUT"
pct exec "$CTID" -- rm -f /tmp/resequiz-data.tgz
echo "Backup skapad: $OUT"
