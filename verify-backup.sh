#!/usr/bin/env bash
set -euo pipefail
f=${1:?Usage: verify-backup.sh backup.tgz}; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
tar -tzf "$f" >/dev/null; tar -xzf "$f" -C "$tmp"
if [ -f "$tmp/resequiz.db" ] && command -v sqlite3 >/dev/null; then sqlite3 "$tmp/resequiz.db" 'PRAGMA integrity_check;' | grep -qx ok; fi
find "$tmp" -type f | head -1 >/dev/null
echo "Backup verified: $f"
