#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"; FILE="${1:-}"
[[ $EUID -eq 0 ]] || { echo "Kör som root på Proxmox." >&2; exit 1; }
[[ -f "$FILE" ]] || { echo "Användning: $0 backup.tgz" >&2; exit 1; }
pct push "$CTID" "$FILE" /tmp/resequiz-data.tgz
pct exec "$CTID" -- bash -lc 'set -e; systemctl stop resequiz; cp -a /var/lib/resequiz /var/lib/resequiz.pre-restore; tar -C /var/lib -xzf /tmp/resequiz-data.tgz; chown -R resequiz:resequiz /var/lib/resequiz; rm -f /tmp/resequiz-data.tgz; systemctl start resequiz'
echo "Återställning klar."
