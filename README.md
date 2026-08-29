# Quiz 21.1.0 – Multiplayer & UX

Quiz 21.1 återställer och förbättrar QR-koden för multiplayer och bygger vidare på Quiz 21 utan att ta bort kärnfunktioner.

## Nytt

- Stor lokal QR-kod direkt i multiplayer-lobbyn. QR-koden genereras av Quiz-servern och leder direkt till rätt rum.
- Dela inbjudan, kopiera länk och öppna ett separat storbildsläge.
- Storbildsläget är read-only och räknas inte som spelare. Det visar lobby, fråga, facit och podium.
- Daily Quiz har tydligare placering på startsidan och visar dagens ledare när sådan finns.
- Profilen har tydligare nivå/XP-visualisering, badges, streak och progress.
- Ny Offline-sida där användaren väljer kategorier, antal frågor och Barnquiz, ser senast synk och sparade bilder.
- Adminrapportkö kan öppna den rapporterade frågan direkt för redigering.
- Ny release-regressionskontroll blockerar installation om centrala funktioner saknas: QR, multiplayer, Daily Quiz, offline, profil, admin quality/reports, språk och fråga-only UI.
- PWA-cache uppdaterad till v21.1.0 och inkluderar Offline-sidan.

## Uppdatera

Lägg projektet på GitHub main och kör:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

## Kontroll efter installation

```bash
pct exec 135 -- curl -fsS http://127.0.0.1:3000/health
```

Förväntad version: `21.1.0`.
