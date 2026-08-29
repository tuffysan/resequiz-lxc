# Resequiz 10.0 – The Quiz Platform

## Fokus
10.0 är en kvalitets- och plattformsrelease. Frågebanken utökas inte.

## Nytt
- Confidence Score och full frågebanksrevision via `/api/admin/question-audit`.
- Karantän för frågor med låg tillförlitlighet.
- Smart Quiz Composer via `/api/quiz/compose`.
- Lokal Quiz Rating och gruppigenkänning.
- `.rqbackup` som samlar persistent Resequiz-data, inklusive karantän och gruppminne.
- Test Lab för deterministiska kvalitetskontroller.
- 9.x-funktioner som recovery, host migration, Director, Quiet Mode, profiler och Question Doctor finns kvar.

## Arkitektur
Denna release förbereder fortsatt moduluppdelning. Persistent data är fortfarande filbaserad för bakåtkompatibilitet och enkel Proxmox-drift. En full SQLite-migrering har medvetet inte tvingats in utan live-migrationstest; nästa steg bör migrera bakom ett storage-interface med rollback.

## Säkerhet
Webbuppdatering är fortsatt opt-in. Adminåtgärder kräver samma skydd som tidigare.
