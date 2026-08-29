# Resequiz 12.0 – Ultimate Experience

Version 12.0 focuses on question quality, long-term no-repeat, final-show presentation, Quizmaster control, backup verification and reliability testing.

## Implemented
- Global per-player no-repeat history in SQLite (default 180 days, configurable 30 days–10 years).
- Schema migration 2 adds `player_seen_questions` with WAL-safe persistence.
- Quizmaster Console 2.0: live answered count, lock answers, private answer/explanation, next-question preview, pause, replace, skip and score adjustment.
- Final Experience: optional hidden leaderboard during the final round; TV reveals standings only at the end.
- Director level 3 is the new default.
- Semantic question-bank audit with language/structure/time-sensitive and near-duplicate review candidates.
- Rotating backup helper plus backup integrity verification, including SQLite integrity check when sqlite3 CLI is available.
- Diagnostics expose storage engine and 12.0 feature capabilities.
- Existing recovery, host migration, Quiet Mode, Question Doctor, `.rqpack`, accessibility, haptics, SQLite fallback and stress/E2E labs remain intact.

## Safety and fairness
The Director may alter presentation and difficulty mix but never gives a specific player easier questions or manipulates the winner. Quizmaster answer data is only returned after host-token authorization.

## Tests
Run `npm test`, `npm run test:bank`, `npm run test:semantic`, `npm run test:e2e`, and `npm run test:stress`. E2E/stress require installed npm dependencies and a runnable local server.
