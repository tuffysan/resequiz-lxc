#!/usr/bin/env bash
set -Eeuo pipefail
APP=/opt/resequiz
DATA=/var/lib/resequiz
TARGET="${QUIZ_SOURCE_TARGET:-520}"
LOCK=/run/quiz-question-sync.lock
exec 9>"$LOCK"
flock -n 9 || { echo "Frågesynk kör redan."; exit 0; }
BEFORE="$(sha256sum "$DATA/questions.json" | awk '{print $1}')"
echo "Quiz frågesynk startar: $(date -Is), mål ${TARGET}/kategori"
set +e
node "$APP/tools/expand-source-backed-questions.js" "$DATA/questions.json" "$TARGET"
RC=$?
set -e
AFTER="$(sha256sum "$DATA/questions.json" | awk '{print $1}')"
node "$APP/tools/question-bank-report.js" "$DATA/questions.json" || true
if [ "$BEFORE" != "$AFTER" ]; then
  chown resequiz:resequiz "$DATA/questions.json"
  systemctl restart resequiz
  echo "Frågebanken ändrades och Quiz startades om."
else
  echo "Ingen förändring i frågebanken."
fi
# RC 3 means partial target: useful work may still have completed, so don't mark systemd failed.
[ "$RC" -eq 0 ] || [ "$RC" -eq 3 ] || exit "$RC"
