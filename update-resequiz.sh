#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"
DIR="$(cd "$(dirname "$0")" && pwd)"
tar -C "$DIR/app" -czf /tmp/resequiz-app.tgz .
pct push "$CTID" /tmp/resequiz-app.tgz /tmp/resequiz-app.tgz
pct push "$CTID" "$DIR/resequiz.service" /etc/systemd/system/resequiz.service
pct push "$CTID" "$DIR/resequiz.nginx" /etc/nginx/sites-available/resequiz
rm -f /tmp/resequiz-app.tgz
pct exec "$CTID" -- bash -lc 'set -e; systemctl stop resequiz || true; mkdir -p /var/lib/resequiz; chown resequiz:resequiz /var/lib/resequiz; rm -rf /opt/resequiz/*; tar -xzf /tmp/resequiz-app.tgz -C /opt/resequiz; cd /opt/resequiz; npm install --omit=dev; chown -R resequiz:resequiz /opt/resequiz; rm -f /etc/nginx/sites-enabled/default; ln -sf /etc/nginx/sites-available/resequiz /etc/nginx/sites-enabled/resequiz; nginx -t; systemctl daemon-reload; systemctl enable resequiz nginx; systemctl restart resequiz; systemctl restart nginx; sleep 2; curl -fsS http://127.0.0.1:3000/health; echo; curl -fsS "http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling" | head -c 120; echo'
echo "Resequiz v2.3.2 uppdaterad och health/socket.io kontrollerade i CT $CTID."
