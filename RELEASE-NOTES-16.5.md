# Resequiz 16.5 – Ligor

## Nytt
- Skapa flera egna ligor från den nya sidan **Ligor**.
- Välj aktiv liga i avancerade spelinställningar innan quizet startas.
- Resultat förs automatiskt in efter avslutad quizkväll.
- Standardpoäng: 3/2/1 ligapoäng för placering 1–3; poängsystemet kan ändras per liga.
- Tabell visar matcher, vinster, pallplatser, ligapoäng, quizpoäng och träffsäkerhet.
- Quizpoäng används som skiljekriterium efter ligapoäng och vinster.
- Ligor kan avslutas, öppnas igen, nollställas eller tas bort.
- Historiska quizresultat finns kvar även om en liga tas bort.
- `leagues.json` ingår i backup/restore.
- Nytt API: `/api/leagues`, `/api/leagues/:id` och skyddade admin-endpoints.
- PWA-cache uppdaterad för ligasidan.

## Kvalitet
- Frågebanken är oförändrad: 8 459 frågor.
- Nytt regressionstest `npm run test:leagues`.
