#!/usr/bin/env bash
set -Eeuo pipefail
DEST="${1:-/var/backups/resequiz}"; mkdir -p "$DEST"; OUT="$DEST/resequiz-data-$(date +%Y%m%d-%H%M%S).tgz"; tar -czf "$OUT" -C /var/lib resequiz; echo "$OUT"
