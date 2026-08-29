#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"
if [[ $EUID -ne 0 ]]; then echo "Kör detta som root på Proxmox-värden." >&2; exit 1; fi
if ! pct status "$CTID" >/dev/null 2>&1; then echo "CTID $CTID finns inte." >&2; exit 1; fi
pct exec "$CTID" -- env LANG=C.UTF-8 LC_ALL=C.UTF-8 bash -lc '
set -e
cd /opt/resequiz
echo "Kör npm audit för production dependencies. Inga paket ändras automatiskt."
npm audit --omit=dev || true
'
echo
echo "Ingen npm audit fix --force har körts. Granska rapporten innan beroenden uppgraderas."
