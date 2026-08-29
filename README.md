# Quiz 22.0.1 – Play & Progress

Quiz 22 bygger vidare på Quiz 21.1 utan att ta bort kärnfunktioner. Fokus är snabbare spelstart, personlig utveckling, återkommande spel, bättre multiplayer och högre frågekvalitet.

## Nytt i Quiz 22

- Ny mobil-först startsida med **Spela nu / Quick Play** och senaste spelinställningar.
- **Daily Quiz 2.0**: samma frågor för alla, första registrerade försöket räknas på dagens topplista, placering, percentil och Daily-streak.
- **Träningsläge** som prioriterar tidigare felbesvarade frågor och bygger frågehistorik i SQLite.
- **Kategori-mastery**: Nybörjare, Brons, Silver, Guld, Expert och Mästare.
- Ny resultatskärm med XP/nivå, mastery, awards och tydliga nästa steg.
- **Quiz Duel**: asynkron utmaning med delningslänk och exakt samma frågor för deltagarna.
- **Veckoutmaningar** med synlig progression.
- Utökat badge-system med fler spel-, nivå-, streak-, XP-, Daily-, multiplayer-, duel- och kategoriutmärkelser.
- Multiplayer-konton följer nu med via user token så multiplayer kan ge progression till rätt användare.
- Multiplayer-värden kan låsa lobby, ta bort spelare och spela igen med samma grupp.
- Party/Storbild finns kvar tillsammans med QR-kod, delning och direktlänk till rummet.
- **Question Quality 2.0**: rättprocent, svarstid, rapporter och automatisk flaggning av statistiska avvikelser.
- Frågor har förberedd mediaarkitektur för `image`, `audio` och `video`.
- Admin visar system/SQLite-status och kan skapa/ladda ned backup.
- PWA visar uppdateringsbanner och stöder enkel haptisk feedback på enheter som kan vibrera.
- Offline, Barnquiz, språk, highscore, profil, admin och befintlig frågebank är bevarade.
- Utökad release-regressionskontroll samt runtime smoke/E2E-testskript.

## Data och SQLite

Quiz 22 utökar SQLite med resultatindex, frågemätvärden, frågehistorik, achievements-grund, Daily-attempts och duel-index. Befintliga JSON-filer behålls under övergången för kompatibilitet, import/export, felsäkerhet och för att inte riskera den befintliga installationen vid uppgradering.

## Installation via GitHub

När innehållet i denna release finns i `main`:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Verifiera:

```bash
pct exec 135 -- curl -fsS http://127.0.0.1:3000/health
```

Förväntad version: `22.0.1`.

## Releasekontroller

```bash
./scripts/release-regression-check.sh .
cd app
npm test
npm run smoke
```

`npm run smoke` startar en tillfällig lokal Quiz-process och testar health, meta, Daily Quiz, solo start/check och Quiz Duel via riktiga HTTP-anrop.


## 22.0.1
- Rensar legacy-prefixet “I en quiz:” och närliggande varianter så endast själva frågan visas.
- Rensningen sker både server-side och i klienten, inklusive redan cachelagrade offlinefrågor.
- Regressionstest stoppar release om rensningen saknas.
