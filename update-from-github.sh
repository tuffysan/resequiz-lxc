#!/usr/bin/env bash
set -Eeuo pipefail
CTID="${CTID:-135}"
REPO="${RESEQUIZ_REPO:-tuffysan/resequiz-lxc}"
BRANCH="${RESEQUIZ_BRANCH:-main}"
TMP="$(mktemp -d /tmp/resequiz-update.XXXXXX)"
cleanup(){ rm -rf "$TMP"; }
trap cleanup EXIT
command -v pct >/dev/null || { echo "Kör updateraren på Proxmox-hosten." >&2; exit 1; }
echo "Hämtar senaste Quiz från ${REPO}..."
curl -fL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" -o "$TMP/repo.tar.gz"
mkdir -p "$TMP/project"
tar -xzf "$TMP/repo.tar.gz" -C "$TMP/project" --strip-components=1
VERSION="$(node -p "require('$TMP/project/app/package.json').version" 2>/dev/null || grep -m1 '"version"' "$TMP/project/app/package.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
echo "Uppdaterar Quiz till v${VERSION} i CT ${CTID}..."
chmod +x "$TMP/project/install-on-proxmox.sh" "$TMP/project/scripts/"*.sh
"$TMP/project/install-on-proxmox.sh" "$CTID"
echo
echo "Verifierar v${VERSION}..."
HEALTH="$(pct exec "$CTID" -- curl -fsS http://127.0.0.1:3000/health)"
META="$(pct exec "$CTID" -- curl -fsS http://127.0.0.1:3000/api/meta)"
printf '%s\n' "$HEALTH"
printf '%s\n' "$META"
INSTALLED="$(pct exec "$CTID" -- node -p "require('/opt/resequiz/package.json').version")"
RUNNING="$(printf '%s' "$HEALTH" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch(e){}})')"
META_VERSION="$(printf '%s' "$META" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{process.stdout.write(JSON.parse(s).version||"")}catch(e){}})')"
[ "$INSTALLED" = "$VERSION" ] || { echo "Fel filversion installerad: ${INSTALLED}, väntade ${VERSION}" >&2; exit 1; }
[ "$RUNNING" = "$VERSION" ] || { echo "Fel körande version: ${RUNNING:-okänd}, väntade ${VERSION}" >&2; exit 1; }
[ "$META_VERSION" = "$VERSION" ] || { echo "Fel API-version: ${META_VERSION:-okänd}, väntade ${VERSION}" >&2; exit 1; }
pct exec "$CTID" -- systemctl is-active --quiet resequiz
printf '\nQuiz v%s är verifierad, installerad och kör i CT %s.\n' "$VERSION" "$CTID"
