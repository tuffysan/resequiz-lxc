#!/usr/bin/env bash
set -euo pipefail
CTID="${CTID:-135}"
DIR="$(cd "$(dirname "$0")" && pwd)"
tar -C "$DIR/app" -czf /tmp/resequiz-app.tgz .
pct push "$CTID" /tmp/resequiz-app.tgz /tmp/resequiz-app.tgz
pct push "$CTID" "$DIR/resequiz.service" /etc/systemd/system/resequiz.service
pct push "$CTID" "$DIR/resequiz.nginx" /etc/nginx/sites-available/resequiz
rm -f /tmp/resequiz-app.tgz
systemctl daemon-reload
pct exec "$CTID" -- bash -lc 'set -e; systemctl stop resequiz || true; mkdir -p /var/lib/resequiz /var/lib/resequiz/media; chown -R resequiz:resequiz /var/lib/resequiz; if [[ ! -s /etc/resequiz.env ]]; then KEY=$(head -c 48 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 24); echo "RESEQUIZ_ADMIN_KEY=$KEY" > /etc/resequiz.env; chmod 640 /etc/resequiz.env; fi; rm -rf /opt/resequiz/*; tar -xzf /tmp/resequiz-app.tgz -C /opt/resequiz; cd /opt/resequiz; npm install --omit=dev; chown -R resequiz:resequiz /opt/resequiz; rm -f /etc/nginx/sites-enabled/default; ln -sf /etc/nginx/sites-available/resequiz /etc/nginx/sites-enabled/resequiz; nginx -t; systemctl daemon-reload; systemctl enable resequiz nginx; systemctl restart resequiz; systemctl restart nginx; sleep 2; curl -fsS http://127.0.0.1:3000/health; echo; curl -fsS "http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling" | head -c 120; echo'
echo "Resequiz v5.0.0 uppdaterad och health/socket.io kontrollerade i CT $CTID."
echo -n "Adminnyckel: "
pct exec "$CTID" -- bash -lc '. /etc/resequiz.env; echo "$RESEQUIZ_ADMIN_KEY"'
