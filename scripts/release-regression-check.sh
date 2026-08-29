#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
fail(){ echo "REGRESSION: $*" >&2; exit 1; }
need(){ [ -f "$ROOT/$1" ] || fail "saknar $1"; }
for f in app/public/index.html app/public/play.html app/public/online.html app/public/duel.html app/public/offline.html app/public/profile.html app/public/results.html app/public/admin.html app/public/help.html app/public/js/online.js app/public/js/duel.js app/public/js/offline.js app/public/sw.js; do need "$f"; done
grep -q '/api/rooms/:code/qr.svg' "$ROOT/app/server.js" || fail 'QR-endpoint saknas'
grep -q "room:display" "$ROOT/app/server.js" || fail 'storbildsläge saknas'
grep -q "room:restart" "$ROOT/app/server.js" || fail 'spela igen med samma grupp saknas'
grep -q "room:kick" "$ROOT/app/server.js" || fail 'värdkontroll kick saknas'
grep -q "room:lock" "$ROOT/app/server.js" || fail 'lobby-lås saknas'
grep -q '/api/daily/status' "$ROOT/app/server.js" || fail 'Daily Quiz 2.0 saknas'
grep -q '/api/training/status' "$ROOT/app/server.js" || fail 'träningsläge saknas'
grep -q '/api/duels' "$ROOT/app/server.js" || fail 'Quiz Duel saknas'
grep -q 'masteryFor' "$ROOT/app/server.js" || fail 'kategori-mastery saknas'
grep -q 'weeklyChallenges' "$ROOT/app/server.js" || fail 'veckoutmaningar saknas'
grep -q '/api/offline-pack' "$ROOT/app/server.js" || fail 'offline-pack saknas'
grep -q '/api/admin/quality/anomalies' "$ROOT/app/server.js" || fail 'Quality 2.0 saknas'
grep -q '/api/admin/backup' "$ROOT/app/server.js" || fail 'admin-backup saknas'
grep -q '/api/users/me' "$ROOT/app/server.js" || fail 'användarprofil saknas'
grep -q 'userToken' "$ROOT/app/public/js/online.js" || fail 'multiplayerkonto saknas'
grep -q 'question-only-screen' "$ROOT/app/public/js/play.js" || fail 'fråga-only UI saknas'
grep -q 'question-only-screen' "$ROOT/app/public/js/online.js" || fail 'multiplayer fråga-only UI saknas'
grep -q 'question-only-screen' "$ROOT/app/public/js/duel.js" || fail 'duel fråga-only UI saknas'
grep -q "quick=1" "$ROOT/app/public/js/home.js" || fail 'Quick Play saknas'
grep -q 'mediaType' "$ROOT/app/server.js" || fail 'mediaarkitektur saknas'
grep -q '/duel.html' "$ROOT/app/public/sw.js" || fail 'duel-sidan cachelagras inte'
grep -q 'SKIP_WAITING' "$ROOT/app/public/sw.js" || fail 'PWA update flow saknas'

grep -q 'i\\s+en\\s+quiz' "$ROOT/app/question-intelligence.js" || fail 'Frågeprefix I en quiz rensas inte i Question Intelligence'
grep -q 'questionText' "$ROOT/app/public/js/common.js" || fail 'Klientrensning av frågeprefix saknas'


grep -q '/api/admin/question-health' "$ROOT/app/server.js" || fail 'Question Health saknas'
grep -q '/api/admin/question-intelligence/migrate' "$ROOT/app/server.js" || fail 'Question Intelligence migration endpoint saknas'
grep -q 'deriveFactKey' "$ROOT/app/question-intelligence.js" || fail 'factKey-motor saknas'
grep -q 'similarity' "$ROOT/app/question-intelligence.js" || fail 'semantisk dubblettkontroll saknas'
grep -q 'adaptiveQuestions' "$ROOT/app/server.js" || fail 'adaptiv repetition saknas'

echo 'Release regression check: OK – Quiz 22.1 core features present'
