# Resequiz 11.0 – Product Hardening

Resequiz 11.0 fokuserar på kvalitet, driftsäkerhet och professionell användning snarare än fler funktioner för funktionernas egen skull.

## Nytt

- SQLite-baserad persistent lagring via `better-sqlite3`, WAL och versionsstyrd schema-migration. Befintliga JSON-filer migreras automatiskt vid första läsning och behålls som portabel spegel/fallback.
- Eventlogg för viktiga quizmaster-åtgärder och spelstarter/slut.
- Quizmaster Console (`/quizmaster.html`) för paus, frågebyte, poängjustering, nästa fråga och TV-länk.
- `.rqpack` export/import för egna frågor, paket och upplägg.
- Tolerant fritextmatchning med normalisering, accepterade alias och försiktig typo-tolerans.
- Tillgänglighetsläge: större text, högre kontrast, reduced motion, tydliga focus states och större touchytor.
- Diskret haptisk feedback på mobil för låst svar och rätt/fel.
- Förbättrad TV-polish med mjuk leaderboard-rörelse och reduced-motion-stöd.
- Nytt stress-test med 21 virtuella Socket.IO-klienter och simulerade disconnects.
- Ny automatisk frågebanksrevision som även genererar `app/data/question-quality-audit.json`.
- 139 faktiska dubbletter (med hänsyn till bild/ljud/specialdata) har tagits bort. Frågebanken innehåller nu 13 002 unika frågor.
- 24 grammatikfel av typen “1 timmar” har rättats till “1 timme”.
- Offline ZIP och Offline Standalone är ombyggda med samma 13 002 frågor.

## Lagring och migration

`/var/lib/resequiz/resequiz.db` är den primära lagringen när SQLite-modulen är tillgänglig. Databasen använder WAL och en `schema_migrations`-tabell. JSON-spegeln finns kvar för backup, felsökning och bakåtkompatibilitet. Om SQLite av någon anledning inte kan laddas fortsätter appen i JSON-fallback-läge och detta syns i Admin Center → Lagring.

## Säkerhet

`.rqpack` import är begränsad i storlek/antal frågor, normaliseras genom samma frågevalidator som vanliga egna frågor och kräver adminnyckel. Host-kommandon kräver giltig host token. Webbuppdatering är fortsatt opt-in.
