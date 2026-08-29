# Resequiz 13.0 – Game Night

## Fokus
Version 13.0 gör 12.1-banken smartare i användning utan att massgenerera nya frågor.

- Semantic no-repeat med `factKey` och `family` för alla 10 614 frågor.
- Question Families används även inom samma quiz för att minska ämnesrepetition.
- Team Night och Risk Final som nya inbyggda upplägg.
- Year in Review via spelhistoriken.
- Quality Assistant i Studio med kontroll av svarsalternativ och liknande frågor.
- Transparent scoring-data skickas till klienten.
- Diagnostik visar Socket.IO-klienter, anslutna spelare, lagringsmotor och aktiva rum.
- Quiet Mode, Quizmaster, recovery, SQLite, profiler, säsonger och tidigare funktioner behålls.

## Frågekvalitet
Frågebanken är fortfarande 10 614 frågor. Inga frågor har lagts till enbart för att öka antalet. Den automatiska strukturella kontrollen hittar inga fel, men detta ska inte tolkas som extern faktagranskning av varje enskild fråga.

## Databas
SQLite schema version 3 introducerar `player_seen_facts` för semantisk no-repeat. JSON fallback finns kvar.
