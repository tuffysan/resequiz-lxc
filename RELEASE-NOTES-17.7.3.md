# Resequiz 17.7.3 – Backend Responsiveness Fix

## Fixat
- `/health` är nu en mycket billig liveness-endpoint och bygger inte om hela frågekatalogen.
- Katalogmetadata cachas i 30 sekunder för att undvika onödig CPU-belastning.
- Admin-auth cachelagras i minnet efter första läsningen.
- Lösenordshashning använder asynkron `crypto.scrypt` i stället för `scryptSync`, så Node.js event loop blockeras inte under setup/login/recovery/lösenordsbyte.
- Slow-request-loggning för anrop över 2 sekunder.
- Event-loop-lag watchdog loggar om servertråden blockeras.
- systemd stop timeout sänkt till 10 sekunder och `KillMode=mixed` för att undvika 90 sekunders stopp vid uppdatering.
- Version uppdaterad till 17.7.3 och cachebusting uppdaterad.

## Diagnos
17.7.0–17.7.2 kunde hamna i ett läge där Node-processen konsumerade en CPU-kärna och accepterade TCP-anslutningar men inte hann svara på HTTP. Detta syntes som timeouts på både `/health` och `/api/admin/status` och som långsam/fastnad admin-sida.
