# Resequiz 16.3 – Resilience

- Aktiv room-state persistens och recovery.
- Idempotenta svar och skydd mot gamla question IDs.
- SQLite/WAL med JSON fallback.
- Admin Backup/Restore för persistent Resequiz-data.
- Diagnostics och Chaos Lab.

## Produktionsacceptans på Debian 12 LXC

```bash
cd /opt/resequiz/app
npm ci
npm run test:16
npm run test:hardening
CHAOS_GAMES=500 CHAOS_PLAYERS=50 npm run test:chaos
npm run test:e2e
npm run test:stress
```

500×50 ska inte påstås vara godkänt förrän detta faktiskt körts på målmiljön.
