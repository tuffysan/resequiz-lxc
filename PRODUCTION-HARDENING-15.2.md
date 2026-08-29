# Resequiz 15.2 – Production Hardening

Resequiz har idempotenta answer receipts, question-id-kontroll, aktiv-rum persistence, reconnect/recovery, SQLite WAL med JSON fallback och Chaos Lab.

## Rekommenderat acceptanstest på Debian 12 LXC

```bash
cd /opt/resequiz/app
npm ci
CHAOS_GAMES=500 CHAOS_PLAYERS=50 npm run test:chaos
npm run test:e2e
npm run test:stress
```

Mål: 0 duplicate scoring, 0 corrupt games, 0 wrong-question answers och 0 score mismatch. Live 500×50-testet måste köras på mål-LXC för att räknas som verifierat.
