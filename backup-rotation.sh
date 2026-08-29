#!/usr/bin/env bash
set -euo pipefail
DATA=${RESEQUIZ_DATA_DIR:-/var/lib/resequiz}; OUT=${RESEQUIZ_BACKUP_DIR:-/var/backups/resequiz}; mkdir -p "$OUT"
ts=$(date +%Y%m%d-%H%M%S); f="$OUT/resequiz-$ts.tgz"
tar -czf "$f" -C "$DATA" .
# Keep 24 newest regular generations; daily/weekly snapshots are retained separately by date label.
ls -1t "$OUT"/resequiz-*.tgz 2>/dev/null | tail -n +25 | xargs -r rm -f
[ "${1:-}" = "--quiet" ] || echo "$f"
