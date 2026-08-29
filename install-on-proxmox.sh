#!/usr/bin/env bash
set -Eeuo pipefail
CTID="${1:-135}"; ROOT="$(cd "$(dirname "$0")" && pwd)"; TMP="/tmp/resequizz-v19"
command -v pct >/dev/null || { echo "Kör på Proxmox-hosten." >&2; exit 1; }
pct status "$CTID" >/dev/null
pct exec "$CTID" -- mkdir -p "$TMP"
pct push "$CTID" "$ROOT/app/package.json" "$TMP/package.json"
tar -C "$ROOT" -czf /tmp/resequizz-project.tgz app deploy scripts
pct push "$CTID" /tmp/resequizz-project.tgz "$TMP/project.tgz"
pct exec "$CTID" -- bash -lc "rm -rf '$TMP/project' && mkdir -p '$TMP/project' && tar -xzf '$TMP/project.tgz' -C '$TMP/project' && '$TMP/project/scripts/install-in-lxc.sh' '$TMP/project/app'"
IP="$(pct exec "$CTID" -- hostname -I | awk '{print $1}')"
echo "Resequiz installerad: http://${IP}:3000/"
