#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
fail(){ echo "REGRESSION: $*" >&2; exit 1; }
need(){ [ -f "$ROOT/$1" ] || fail "saknar $1"; }
for f in app/public/index.html app/public/play.html app/public/online.html app/public/offline.html app/public/profile.html app/public/results.html app/public/admin.html app/public/help.html app/public/js/online.js app/public/js/offline.js app/public/sw.js; do need "$f"; done
grep -q '/api/rooms/:code/qr.svg' "$ROOT/app/server.js" || fail 'QR-endpoint saknas'
grep -q "room:display" "$ROOT/app/server.js" || fail 'storbildsläge saknas'
grep -q '/api/daily' "$ROOT/app/server.js" || fail 'Daily Quiz saknas'
grep -q '/api/offline-pack' "$ROOT/app/server.js" || fail 'offline-pack saknas'
grep -q '/api/admin/quality' "$ROOT/app/server.js" || fail 'Question Quality saknas'
grep -q '/api/admin/reports' "$ROOT/app/server.js" || fail 'rapportkö saknas'
grep -q '/api/users/me' "$ROOT/app/server.js" || fail 'användarprofil saknas'
grep -q 'question-only-screen' "$ROOT/app/public/js/play.js" || fail 'fråga-only UI saknas'
grep -q 'question-only-screen' "$ROOT/app/public/js/online.js" || fail 'multiplayer fråga-only UI saknas'
grep -q 'Español' "$ROOT/app/public/js/common.js" || fail 'spanska språkval saknas'
grep -q 'Deutsch' "$ROOT/app/public/js/common.js" || fail 'tyska språkval saknas'
grep -q '/offline.html' "$ROOT/app/public/sw.js" || fail 'offline-sidan cachelagras inte'
echo 'Release regression check: OK'
