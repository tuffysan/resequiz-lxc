# Resequiz

## 14.0 – Ultimate

Se `ULTIMATE-14.0.md` och `RELEASE-NOTES-14.0.md`. Fokus: Question Health, server-authoritative/idempotent multiplayer, Quizmaster 3, scoring transparency och UX-polish.

## 12.1 Question Quality Overhaul

12.1 reduces the bank from 13,002 to 10,614 questions by removing low-quality generated template series, repeated fact pairs and mechanically generated arithmetic/conversion items. Retained Sweden expansion questions were given plausible distractors. See `QUESTION-QUALITY-OVERHAUL-12.1.md`.

# 9.0 – Smart Quiz Engine

See `SMART-QUIZ-ENGINE-9.0.md` for the quality, recovery, host-migration, Quiz DNA, Admin Center and E2E improvements.

# Resequiz 9.0 – Smart Game Night

**Frågebank från 7.5:** 1 800 ytterligare frågor/frågevarianter har lagts till – 120 i varje kategori utom Världen och Hjärngympa. De två stora kategorierna är helt oförändrade. Quiet Mode, Balance Engine, Solo, På väg, Rese quiz och Game Director finns kvar.

# Resequiz 7.4 – Quiet Mode

**Nytt i 7.4:** Ljudfrågor är av som standard. I lobbyn finns ett tydligt 🔇 Ljudfrågor-val som kan slås på med ett tryck. Valet sparas på enheten. När ljud är av filtrerar servern bort alla frågor med ljud och ersätter dem med ljudlösa frågor även i upplägg. Offline-läget har samma kontroll.

# Resequiz 7.3 – Visual & Music Expansion

Version 7.3 bygger vidare på den balanserade 7.2-banken med **124 nya riktiga mediafrågor**: 100 nya lokala flaggbilder i Bildrunda och 24 nya lokalt syntetiserade melodiklippsfrågor i Musikquiz. Alla media fungerar utan externa tjänster och följer med offlinepaketet. Totalt innehåller banken **11 341 frågor**, varav Bildrunda har 220 och Musikquiz 48. Hjärngympa är oförändrad.

# Tidigare: Resequiz 7.2 – Expanded Balanced Question Bank

7.2 fyller på de mindre kategorierna med nya faktabaserade svenska frågor. Hjärngympa har inte fått några nya frågor i denna expansion. Balance Engine från 7.1 finns kvar.

# Resequiz 7.2 – Balanced Question Bank

Version 7.2 balanserar **spelupplevelsen**, inte genom att fylla banken med tusentals repetitiva mallfrågor utan genom kategori-rättvis frågeuttagning. När flera kategorier är valda plockas frågor round-robin mellan tillgängliga kategorier, så stora banker som Hjärngympa och Världen inte kan dominera ett blandat quiz. Samma princip används online och offline. En vald enskild kategori använder naturligtvis hela sin egen bank.

**Frågebanken är fortsatt 10 500 frågor** och no-repeat, kvalitetspoäng och smart svårighetsgrad fungerar som tidigare. Hjärngympa är fortsatt avmarkerad som standard offline.

# Resequiz 7.2 – Mega Question Bank

**10 500 lokala frågor** med strikt no-repeat, svensk spelupplevelse och full kompatibilitet med Solo, På väg, Rese quiz och Game Director.

# Resequiz 7.2 – Solo Edition

Nytt i 6.3 är ett komplett **🧠 Solo-läge**. Från startsidan kan en spelare välja **Spela själv**, skapa ett rum och starta direkt utan andra deltagare. Samma quizupplägg, Director, statistik, achievements, kartor, bilder och musik fungerar i solo. Moment som kräver motståndare, exempelvis duell och buzzerfinal, anpassas automatiskt till solo-utmaningar. Prediction/reactions döljs när de inte tillför något och slutskärmen visar spelarens eget resultat. Det går fortfarande att bjuda in andra från sololobbyn med kod eller QR innan start.

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

Efter uppdateringen ska `/health` rapportera `7.2.0`.

## Kontroll

```bash
CTID=135 ./check-resequiz.sh
```

## Tester

```bash
cd app
npm test
```
## Resequiz 9.0 – Smart Game Night

Version 8.0 fokuserar på att göra spelet smartare bakom kulisserna och enklare framför spelarna:

- **Starta bästa quizet** ger en enkel rekommenderad väg in i spelet.
- **Game Director 2.0** kombinerar automatisk pacing, dramatik och adaptiv svårighetsgrad.
- **Smart frågeurval** balanserar kategorier, kvalitet, nyligen spelade frågor och liknande formuleringar.
- **Question Health** samlar speldata och frivilliga 👍/👎-omdömen för kvalitetsgranskning.
- **Spelarprofiler, rivaliteter och säsonger** bygger historik utan obligatoriskt konto.
- **Maps 3.0** visar alla spelares markeringar, rätt plats och ranking efter kartfrågor.
- **Bildreveal** stöder zoom, pixel/blur och silhuett-effekter.
- **Miljöval** Hemma/Fest/Bland folk/På väg anpassar upplevelsen; ljud stängs automatiskt av i offentliga miljöer och på väg.
- **Förladdning av media** för kommande frågor gör korta nätverksstörningar mindre märkbara utan att exponera svar.
- **Resultatkort** kan exporteras som PNG, och profiler kan exporteras som JSON-backup.
- **Diagnostik** finns på `/api/diagnostics` för snabb kontroll av version, uptime, minne och datakatalog.

Målet är att fler funktioner ska skötas automatiskt, medan huvudflödet för användaren hålls så enkelt som möjligt.

## Resequiz 11.0 – The Quiz Platform
10.0 fokuserar på kvalitet och långsiktig drift: Confidence Score, full frågerevision, karantän, Smart Quiz Composer, Quiz Rating, gruppminne och `.rqbackup`. Se `QUIZ-PLATFORM-10.0.md`.

## 11.0 – Product Hardening

11.0 lägger till SQLite/WAL med migrering och JSON-fallback, Quizmaster Console, `.rqpack`, tolerant fritext, förbättrad tillgänglighet/haptik, stress-test samt en konkret frågebanksrenovering. Se `PRODUCT-HARDENING-11.0.md`.

## 12.0 – Ultimate Experience
See `ULTIMATE-EXPERIENCE-12.0.md`. Highlights: persistent global no-repeat, Quizmaster Console 2.0, final-show hidden standings, semantic audit, and backup verification.


## 13.0 Game Night
Se `GAME-NIGHT-13.0.md` för semantic no-repeat, Question Families, Team Night, Risk Final, Year in Review och Quality Assistant.

## 14.1 – Verified Core

14.1 rensar 1 469 lågkvalitativa mallfrågor och inför reproducerbar faktaverifiering. 7 234 av 9 187 aktiva frågor är verifierade; resterande 1 953 visas som `Needs review` tills de kontrollerats på riktigt. Historia och Fotboll har fått 42 nya källkontrollerade ersättningsfrågor. Se `FACT-VERIFICATION-14.1.md`.


## 14.2 Verified Active Bank
Only verified questions are active: **7601**. **1586** unresolved questions are quarantined rather than presented as verified. See `VERIFIED-ACTIVE-BANK-14.2.md`.


## 14.3 Source Verification
171 additional sourced questions restored; 1415 remain quarantined. See `SOURCE-VERIFICATION-14.3.md`.


## 14.4 Media Verified
Se `MEDIA-VERIFICATION-14.4.md` och `RELEASE-NOTES-14.4.md`.


## 14.5 – Verified & Curated
Final quarantine pass: 8459 active questions, 0 in quarantine. See `FINAL-CURATION-14.5.md`.

## 15.2 – Adaptive Game Show + Hardening

15.x bygger vidare på den verifierade 14.5-banken med Auto-Pilot, adaptiv svårighet, Question Health/feedback, kollaborativ Team Night med roterande kapten, specialrundor och production-hardening. Se `ADAPTIVE-GAME-ENGINE-15.0.md`, `GAME-SHOW-15.1.md` och `PRODUCTION-HARDENING-15.2.md`.

## 16.3 – Effortless / Intelligence / Game Show / Resilience

16.x gör standardvägen enklare: **Starta quizkväll** öppnar Auto-Pilot, förstagångsanvändaren får en kort onboarding och avancerade val ligger kvar under fler alternativ. Question Health har utökats med discrimination/distraktor-signaler. Team Night, Estimate, Risk Final, awards, Year in Review, backup/restore och recovery behålls och hårdtestas via 16.x-testsviten.

Se `EFFORTLESS-16.0.md`, `QUESTION-INTELLIGENCE-16.1.md`, `GAME-SHOW-16.2.md` och `RESILIENCE-16.3.md`.
