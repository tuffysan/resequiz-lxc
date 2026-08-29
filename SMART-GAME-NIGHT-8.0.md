# Resequiz 8.0 – Smart Game Night

## Implementerat

1. **Starta bästa quizet** – ny huvudväg från startsidan som minimerar val innan ett rum skapas.
2. **Game Director 2.0** – automatisk pacing, Drama Engine och adaptiv svårighetsgrad arbetar tillsammans.
3. **Intelligent frågeurval** – kategoribalansering, Question Health, 7-dagars recency-penalty och kontroll mot flera nyligen valda liknande frågeformuleringar.
4. **Question Health + omdömen** – statistik används för kvalitetsvärde och spelare får ibland 👍/👎. Data lagras separat i `question-ratings.json`.
5. **Spelarprofiler** – lokal sessionsidentitet, historisk profilstatistik och export av en enkel profilbackup som JSON.
6. **Rivaliteter** – head-to-head-historik fortsätter användas och visas i Resultat & profiler.
7. **Maps 3.0** – efter kartfrågor visas alla spelares markeringar, rätt mål och avståndsranking.
8. **Bildreveal** – zoom-, pixel/blur- och silhuett-reveal för bildfrågor.
9. **Miljöval** – Hemma, Fest, Bland folk och På väg. Bland folk/På väg stänger av ljudfrågor vid start; På väg väljer reseanpassat upplägg.
10. **Nättålighet** – klienten förladdar endast media för upp till fem kommande frågor. Svar exponeras aldrig i förladdningen. Socket.IO reconnect/rejoin finns kvar.
11. **TV-show-polish** – befintliga round breaks, Director, Drama Engine och displayläge kombineras med de nya reveal- och kartresultaten.
12. **Slutpresentation** – vinnare, slutställning, comeback, snabbast, streak, bildmästare, kategoriexpert och svåraste fråga.
13. **Resultatkort** – PNG-resultatkort kan skapas direkt efter ett onlinespel och från historiken.
14. **Säsonger** – aktuell halvårssäsong (Vår/Höst + år) räknas separat utöver all-time-ligan.
15. **Spela igen** – återanvänder rum, spelare och inställningar men väljer nya osedda frågor.
16. **Teknisk kvalitet** – utökade smoke tests, JS/shell-syntaxkontroll, health endpoint, diagnostik-endpoint, backup/restore-stöd för nya datafiler och updater-rollback från tidigare versioner.

## Integritets- och säkerhetsprinciper

Profiler kräver inget konto. Förladdning skickar bara publika media-URL:er och aldrig framtida rätt svar. Question ratings är aggregerade per fråga och innehåller inte spelarnas namn.
