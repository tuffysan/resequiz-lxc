#!/usr/bin/env bash
set -euo pipefail
GITHUB_USER="${GITHUB_USER:-tuffysan}"
REPO_NAME="${REPO_NAME:-resequiz-lxc}"
BRANCH="${BRANCH:-main}"
CTID="${CTID:-135}"
if [[ $EUID -ne 0 ]]; then echo "Kör detta som root på Proxmox-värden." >&2; exit 1; fi
if ! pct status "$CTID" >/dev/null 2>&1; then echo "CTID $CTID finns inte." >&2; exit 1; fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
URL="https://github.com/${GITHUB_USER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.tar.gz"
echo "Hämtar senaste Resequiz från ${GITHUB_USER}/${REPO_NAME}..."
curl -fL "$URL" -o "$TMP/repo.tar.gz"
tar -xzf "$TMP/repo.tar.gz" -C "$TMP"
DIR="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
chmod +x "$DIR/update-resequiz.sh"
CTID="$CTID" "$DIR/update-resequiz.sh"
