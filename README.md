# Resequiz 5.2 – Director Edition

Resequiz 5.2 är byggd för en princip: **värden ska kunna spela med i stället för att administrera spelet**.

## Nytt i 5.2

### 🎬 Resequiz Director
Director är på som standard. Efter att en fråga är avgjord visar spelet resultatet och fortsätter automatiskt. Vid rundpaus presenterar TV-vyn ställningen och nästa runda startar automatiskt. Värden kan fortfarande trycka **Nästa nu**, pausa, hoppa över eller stänga av Director under avancerade inställningar.

### 🎭 Drama Engine
Spelet känner igen och presenterar speciella ögonblick automatiskt, till exempel:
- ingen klarade frågan
- exakt en spelare svarade rätt
- alla svarade rätt
- bara 100 poäng eller mindre skiljer toppen
- en spelare har minst fem rätt i rad

Dramat visas som en kort overlay på både spelarenheter och TV-skärmen.

### 🧠 Smart Quizmaster
Den befintliga adaptiva frågemotorn är fortsatt aktiverad som standard och kan välja lättare eller svårare kommande standardfrågor efter gruppens faktiska resultat.

### 👥 Bättre lagspel
När automatisk lagbalansering används fördelas deltagarna jämnt över lagen vid spelstart. Varje lag får också en kapten. Lagpoäng kan fortfarande räknas som genomsnitt eller summa.

### 📱 Enklare spelare
Efter ett svar visas nu tydligt **✓ SVAR LÅST**. Spelaren behöver inte navigera mellan vyer under spelet. Återanslutning använder samma session, namn, lag och poäng.

### 🏆 Profiler och achievements
Profiler, rivaliteter, liga, turneringar och spelhistorik finns kvar. Achievements har utökats med bland annat Fotbollsnörden och Musikgurun.

### 🛠️ Korrigering
Poängberäkningen för Prickskytten/bildmarkering använder nu avståndet till den faktiska markeringen i bilden, separat från geografiska kartfrågor.

## Ultimate Quiz Show
1. Opening Round
2. Bildzoom
3. Music Live
4. Mystery Round
5. Connections
6. Sortera!
7. Var i världen?
8. Prickskytten
9. Jackpot
10. Duellen
11. Buzzerfinal

## Viktiga vyer
- `/` – enkel startsida
- `/online.html` – värd och spelare
- `/display.html?room=1234` – TV/Game Screen
- `/remote.html` – Quizmaster Remote
- `/history.html` – profiler, rivaliteter, liga och spelhistorik
- `/studio.html` – Quiz Studio
- `/admin.html` – frågeeditor
- `/offline.html` – klassiskt offlinequiz

## Uppdatering

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Efter uppdateringen ska `/health` rapportera `5.2.0`.

Persistenta data under `/var/lib/resequiz` bevaras vid uppdatering.
