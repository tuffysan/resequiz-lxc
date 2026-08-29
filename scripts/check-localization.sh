#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for page in app/public/*.html; do
  grep -q '/js/common.js' "$page" || continue
  grep -q '/js/i18n-ui.js' "$page" || { echo "Missing i18n-ui.js in $page"; exit 1; }
done
for lang in en es de; do
  grep -q "^[[:space:]]*$lang:" app/public/js/i18n-ui.js || { echo "Missing $lang translations"; exit 1; }
done
grep -q "const VERSION='24.1.1'" app/server.js
grep -q "quiz-v2411" app/public/sw.js
echo 'Localization regression: OK – shared UI translation layer loaded on all pages'
