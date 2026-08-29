# Resequiz 17.7.4 – High Score & Hall of Fame Fix

- Hall of Fame visar nu high score direkt på historiksidan.
- `/api/highscores` återbygger automatiskt statistik från `games.json` om äldre `highscores.json` saknas eller är ofullständig.
- High score blir kompatibel med tidigare sparade Game Nights efter uppdateringar.
- Historiksidan laddar API-delar oberoende; ett fel i en sekundär endpoint gör inte längre hela sidan tom.
- 7 sekunders timeout och tydliga tomlägesmeddelanden har lagts till.
- Version/cache bump till 17.7.4.
