# Resequiz Deluxe

Mobilvänligt quizspel som fungerar lokalt och offline efter första laddningen.

## Starta på Windows
1. Packa upp ZIP-filen.
2. Dubbelklicka på `START-QUIZ.cmd`.
3. Webbläsaren öppnas på http://localhost:8088 om Python finns installerat.
4. Om Python saknas öppnas `index.html` direkt. De flesta funktioner fungerar ändå; service worker/offline-cache kräver lokal webbserver.

## Innehåll
- 500+ frågor från 8 kategorier.
- Klassisk quiz, lagspel, snabbspel och Party-läge.
- Lätt, medel, svår eller blandad svårighetsgrad.
- Timer: av, 10, 15, 20 eller 30 sekunder.
- Power-ups per spelare/lag: 50/50, dubbla poäng och streak-sköld.
- Streakbonus och tidsbonus i snabbspel.
- Visuella flaggfrågor som fungerar offline.
- 2–10 spelare eller 2–4 lag.
- 10, 20, 30, 50, 100 eller alla tillgängliga frågor.
- Pågående spel sparas i webbläsaren.

## Mobil
Kör spelet från en dator på samma nätverk och öppna datorns IP-adress på mobilen, t.ex. `http://192.168.1.50:8088`. Alternativt publicera mappen på valfri statisk webbserver.

Ingen databas, inloggning eller internetanslutning krävs för själva spelet.
