# Quiz 22.1.1 – Question Intelligence

Quiz 22.1 fokuserar på frågekvalitet, dubbletter, factKey, adaptiv repetition och ett bättre administrativt hälsoläge för frågebanken.

## Nyheter

- Permanent migrering av frågetext: kända presentationsprefix tas bort ur den persistenta frågebanken, inte bara vid rendering.
- Extra språkfixar för äldre genererade frågor, t.ex. `Vad är rätt svar: betyder ...` → `Vad betyder ...` och `Hur lyder rätt svar på detta: många ...` → `Hur många ...`.
- `factKey` skapas automatiskt för frågor som saknar det. Befintliga factKey/family bevaras.
- Lokal semantisk dubblettanalys med tokenlikhet inom kategori. Inga frågor raderas automatiskt.
- Question Quality analyserar även dåliga svarsalternativ, tomma/dubbla alternativ, rätt svar som avslöjas i frågan, längdavvikelser och generiska quizformuleringar.
- SQLite `question_metrics` sparar svarsfördelning per alternativ (A–F), rättprocent, rapporter och svarstid.
- Statistikvarningar fortsätter flagga extrema rättprocenter och rapporterade frågor.
- Adaptivt solo använder riktig frågehistorik: felaktiga svar blir aktuella igen tidigare, korrekt besvarade frågor får längre intervall, osedda frågor prioriteras.
- Träningsläget använder spaced-repetition-liknande intervall och prioriterar frågor där användaren haft problem.
- Admin → Frågebank · Hälsokontroll visar totalt, godkända, behöver granskas, möjliga dubbletter, statistikvarningar och rapporterade frågor.
- Admin kan köra “Rensa frågor & skapa factKey” manuellt.
- Admin-frågeredigering visar `factKey`.
- Rapporter-vyn visar möjliga semantiska dubbletter.
- Cacheversion uppdaterad till 22.1 för att undvika gammal klientkod.
- Release-regressionstest utökat med Question Intelligence, factKey, semantisk dubblettkontroll och adaptiv repetition.

## Säker migrering

Vid installation gör updateraren först den vanliga pre-upgrade-backupen. Därefter körs `migrate-question-intelligence.js` på `/var/lib/resequiz/questions.json`. Migreringsskriptet skapar dessutom en egen tidsstämplad `.bak` av frågebanken innan den ändrar något.

Migreringen raderar inte frågor och ändrar inte facit eller svarsalternativ. Den rensar kända presentationstexter och fyller i saknade factKey.

## Manuell analys/migrering

```bash
pct exec 135 -- bash -lc '
node /opt/resequiz/scripts/migrate-question-intelligence.js \
  /var/lib/resequiz/questions.json --dry-run
'
```

Kör permanent:

```bash
pct exec 135 -- bash -lc '
node /opt/resequiz/scripts/migrate-question-intelligence.js \
  /var/lib/resequiz/questions.json
systemctl restart resequiz
'
```

## Installera via GitHub

När filerna ligger på `main`:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Verifiera:

```bash
pct exec 135 -- curl -fsS http://127.0.0.1:3000/health
```

Förväntad version: `22.1.1`.

## Viktigt om “semantiska dubbletter”

22.1 använder en lokal, deterministisk likhetsanalys och factKey – inte en extern AI-tjänst. Resultatet är därför en granskningskö, inte automatisk borttagning. Det är avsiktligt för att inte riskera att olika fakta raderas bara för att frågorna råkar vara språkligt lika.

## 22.1.1 hotfix – SQLite startup

22.1.1 fixes the startup regression seen on upgraded installations where an older `result_index` table did not yet contain `mode`. 22.0/22.1 created the `ix_result_mode` index before adding the missing column, causing `ERR_SQLITE_ERROR: no such column: mode` and a systemd restart loop.

The migration now creates base tables first, adds all missing legacy columns, and only then creates indexes. Existing result and analytics data is preserved. The installer stops the service before backup, takes a dedicated consistent SQLite snapshot (`quiz.db`, WAL and SHM when present), and then starts and health-verifies the new version.

A migration regression test creates a legacy database schema and verifies that it can be upgraded to 22.1.1 while preserving existing rows.
