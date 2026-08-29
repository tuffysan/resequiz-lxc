# Resequiz 14.0 – Ultimate

Version 14.0 samlar Question Health, Game Engine Hardening och Ultimate UX ovanpå 13.0.

## Question Health
- Verifieringsstatus per fråga: Verified, Needs review och Unverified.
- Källa, verifieringsdatum och valfritt giltighetsdatum kan sparas.
- Faktisk svårighetsgrad lärs från minst 30 registrerade svar.
- Svarsfördelning, skip rate, responstid och discrimination sparas i question metrics.
- Statistiska anomalier flaggas: mycket låg/hög träffsäkerhet, dominerande felalternativ, hög skip rate och dåliga spelarbetyg.
- Automatisk karantän är konservativ och kräver starka signaler samt tillräckligt med data.

## Question Intelligence 2.0
- Huvudstadsfrågor som testar samma fakta delar nu factKey/family även när frågan är inverterad.
- Flaggfrågor har landsspecifika fact families i stället för en enda global flaggfamilj.
- Semantic No-Repeat kan därför undvika samma kunskap utan att blockera en hel frågetyp.

## Game Engine Hardening
- Servern är auktoritativ för poäng.
- Varje svar skickar questionId + submissionId. Stale answers ignoreras.
- SQLite-schema 4 lägger till idempotenta answer receipts.
- Saknad player_seen_questions-tabell från tidigare schema har korrigerats.
- Receipt-data städas automatiskt.
- Recovery pausar återställda aktiva frågor för säker återstart.
- Ny hardening-testsvit och konfigurerbart Chaos Lab.

## Scoring 2.0
- Resultatet innehåller grundpoäng, typbonus, snabbhetsbonus, streakbonus, multiplikator, power-up och slutlig poäng.
- Final-risk kan använda upp till 1000 poäng i insats.
- Familjeläge får ingen streakbonus.

## Quizmaster 3.0
- Visar vem som har svarat utan att exponera individuella svar innan låsning.
- Efter låsning kan fritextsvar visas privat för quizmaster.
- Quizmaster kan manuellt godkänna ett fritextsvar.
- Meddelanden kan skickas direkt till TV-skärmen.

## TV / controller UX
- Rankingrörelser visas med upp/ner-indikatorer.
- Quizmaster-meddelanden visas som overlay.
- Mobilens poängförklaring är uppdelad i tydliga komponenter.
- Reduced-motion CSS är korrigerad.

## Testning
Följande kan köras utan live-server: `npm test`, `npm run test:bank`, `npm run test:semantic`, `npm run test:quality`, `npm run test:hardening`.

`npm run test:chaos` kräver installerade npm-beroenden. Standard är 10 spel, men `CHAOS_GAMES=500 CHAOS_PLAYERS=50 npm run test:chaos` kör den hårda varianten.
