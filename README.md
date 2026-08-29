# Quiz 23.0.0 – Game Experience

Quiz 23 bygger vidare på den stabiliserade 22.1.1-grunden och fokuserar på spelkänsla, personlig repetition och säkrare uppgraderingar utan att ta bort tidigare funktioner.

## Nytt i 23.0

- Ny, mer spelorienterad mobil startsida med nivå, XP, träffsäkerhet och repetitioner som väntar.
- Smart Review med spaced repetition per `factKey` i SQLite. Fel svar återkommer snabbt, rätt svar får successivt längre intervall.
- Ny tabell `review_schedule` och schema 2300, migrerad utan att radera äldre resultat eller frågehistorik.
- `/api/users/insights` och `/api/review/status` för personliga styrkor, svagheter, träffsäkerhet, svarstid och repetitioner.
- Träningsläget prioriterar frågor vars repetition faktiskt är förfallen.
- Streak/combo under soloquiz och tydligare återkoppling om när en fråga kommer tillbaka.
- Resultatsidan visar rätt, träffsäkerhet och bästa streak tillsammans med XP/mastery/utmärkelser.
- PWA-cache uppdaterad till Quiz 23 (`quiz-v2300` / `quiz-media-v2300`).
- QR, Daily Quiz, Duel, Barnquiz, offline, profiler, highscores, admin och Question Intelligence finns kvar.

## Säkrare uppdateringar

Quiz 23 gör en app-backup och SQLite-backup före uppdatering. Innan den riktiga databasen migreras körs schema-migreringen mot en kopia av `quiz.db`. Om nya tjänsten ändå inte blir frisk återställs föregående app och SQLite-backup automatiskt.

## Uppdatera från GitHub

Kör på Proxmox-hosten:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Verifiera sedan:

```bash
pct exec 135 -- curl -fsS http://127.0.0.1:3000/health
```

För Quiz 23 ska svaret innehålla `"version":"23.0.0"` och `"schema":2300`.

## Data

Persistenta data ligger fortsatt i `/var/lib/resequiz`. JSON-filer behålls under övergången för bakåtkompatibilitet medan SQLite används för index, statistik, frågehistorik och Smart Review.
