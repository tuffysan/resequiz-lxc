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
VERSION="$(grep -m1 '"version"' "$TMP/project/app/package.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
[ -n "$VERSION" ] || { echo "Kunde inte läsa versionsnummer." >&2; exit 1; }
echo "Uppdaterar Quiz till v${VERSION} i CT ${CTID}..."
chmod +x "$TMP/project/install-on-proxmox.sh" "$TMP/project/scripts/"*.sh
"$TMP/project/install-on-proxmox.sh" "$CTID"
echo
echo "Verifierar v${VERSION}..."
HEALTH="$(pct exec "$CTID" -- curl -fsS http://127.0.0.1:3000/health)"
META="$(pct exec "$CTID" -- curl -fsS http://127.0.0.1:3000/api/meta)"
printf '%s\n' "$HEALTH"
printf '%s\n' "$META"
# All Node execution happens inside CT 135. The Proxmox host does not need Node.js.
INSTALLED="$(pct exec "$CTID" -- node -p "require('/opt/resequiz/package.json').version")"
RUNNING="$(printf '%s' "$HEALTH" | sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -1)"
META_VERSION="$(printf '%s' "$META" | sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -1)"
[ "$INSTALLED" = "$VERSION" ] || { echo "Fel filversion installerad: ${INSTALLED}, väntade ${VERSION}" >&2; exit 1; }
[ "$RUNNING" = "$VERSION" ] || { echo "Fel körande version: ${RUNNING:-okänd}, väntade ${VERSION}" >&2; exit 1; }
[ "$META_VERSION" = "$VERSION" ] || { echo "Fel API-version: ${META_VERSION:-okänd}, väntade ${VERSION}" >&2; exit 1; }
pct exec "$CTID" -- systemctl is-active --quiet resequiz
printf '\nQuiz v%s är verifierad, installerad och kör i CT %s.\n' "$VERSION" "$CTID"
echo "Frågebanken kompletteras separat i bakgrunden och blockerar inte uppdateringen."
