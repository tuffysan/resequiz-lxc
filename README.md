# Resequiz 6.2 – På väg

Nytt i 6.2 är upplägget **🚌 På väg**, optimerat för längre resor med tåg, buss, flyg eller bilpassagerare. Det använder 30 varierade frågor i lugnt tempo, 45 sekunders svarstid, frågor på mobilerna utan krav på TV, inga speed-/buzzer-rundor, inga power-ups och naturliga rundpauser. Quizet är avsett för bilens passagerare – aldrig för föraren under körning.

# Resequiz 6.1 – Share & Rese quiz

## Nytt i 6.1
- Separat **Dela kod** för rumskoden.
- Separat **Dela QR** som delar QR-bilden på kompatibla mobiler och annars sparar/öppnar den.
- **Dela inbjudan** delar både kod och direktlänk.
- Nytt upplägg **✈️ Rese quiz** med resor, världen, karta, risk och buzzerfinal.

# Resequiz 6.0 – Game Director

Resequiz 6.0 fokuserar på att vara enklare att starta men smartare under spelet. Originalets mörka design är kvar.

## Nytt i 6.0

- Quick Start med 15/30/60 minuter och tema: Blandat, Fest, Familj, Musik, Fotboll eller Resor.
- Nytt standardupplägg **Klassisk quizkväll** på cirka 30 minuter.
- Game Director väljer tempo och driver spelet automatiskt.
- Smart question selection väger frågekvalitet och kategori-variation istället för ren slump.
- Frågemått lagras persistent i `question-metrics.json`.
- Automatisk nickname collision handling (`Anna`, `Anna 2`, osv.).
- Smart lagbalansering baserad på historisk spelarstyrka.
- Lagkapten och gemensamma lag-power-ups.
- Drama Engine visar även ledarbyten.
- Maps 2.0 visar alla spelares markeringar och rätt position på TV efter frågan.
- Spelaren ser avstånd i km efter kartfrågor och precision efter bildmarkering.
- Admin Dashboard med frågor, spel, profiler, kvalitetsflaggor och granskningslista.
- Backup/Restore av persistent data direkt i Admin.
- Säkerhetsheaders och rate limit på känsliga adminanrop.
- `prefers-reduced-motion` för bättre tillgänglighet.
- Automatiskt smoke-test via `npm test`.
- Uppdateraren tar rollback-kopia och återställer automatiskt om health/version-kontrollen misslyckas.
- LXC-hostname sätts och verifieras som `resequiz`.
- CLI backup/restore via `backup-resequiz.sh` och `restore-resequiz.sh`.

## Installera från GitHub

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/install-from-github.sh)"
```

## Uppdatera

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Efter uppdateringen ska `/health` rapportera `6.2.0`.

## Kontroll

```bash
CTID=135 ./check-resequiz.sh
```

## Tester

```bash
cd app
npm test
```
