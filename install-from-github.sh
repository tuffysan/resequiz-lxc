#!/usr/bin/env bash
set -euo pipefail

GITHUB_USER="${GITHUB_USER:-tuffysan}"
REPO_NAME="${REPO_NAME:-resequiz-lxc}"
BRANCH="${BRANCH:-main}"

if [[ $EUID -ne 0 ]]; then
  echo "Kör detta som root på Proxmox-värden." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
URL="https://github.com/${GITHUB_USER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.tar.gz"

echo "Hämtar Resequiz från ${GITHUB_USER}/${REPO_NAME} (${BRANCH})..."
curl -fL "$URL" -o "$TMP/repo.tar.gz"
tar -xzf "$TMP/repo.tar.gz" -C "$TMP"
DIR="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
[[ -x "$DIR/install-resequiz-lxc.sh" ]] || chmod +x "$DIR/install-resequiz-lxc.sh"
exec "$DIR/install-resequiz-lxc.sh"
