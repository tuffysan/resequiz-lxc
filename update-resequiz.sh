#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"
DIR="$(cd "$(dirname "$0")" && pwd)"
tar -C "$DIR/app" -czf /tmp/resequiz-app.tgz .
pct push "$CTID" /tmp/resequiz-app.tgz /tmp/resequiz-app.tgz
rm -f /tmp/resequiz-app.tgz
pct exec "$CTID" -- bash -lc 'set -e; systemctl stop resequiz; mkdir -p /var/lib/resequiz; chown resequiz:resequiz /var/lib/resequiz; rm -rf /opt/resequiz/*; tar -xzf /tmp/resequiz-app.tgz -C /opt/resequiz; cd /opt/resequiz; npm install --omit=dev; chown -R resequiz:resequiz /opt/resequiz; systemctl start resequiz'
echo "Resequiz uppdaterad i CT $CTID."
