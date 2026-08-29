# Resequiz 17.8.1 — Verified Question Finder

## Nytt
- Admin Center kan nu söka efter nya källstödda frågekandidater via Wikidatas strukturerade data.
- Sökning på ämne, kategori och källspråk (svenska, engelska, tyska, spanska).
- Kandidater jämförs med befintliga frågor och `factKey` så redan kända fakta kan hoppas över.
- Varje kandidat visar rätt svar, beskrivning och direktlänk till källan.
- **Använd som utkast** fyller Quiz-editorn och kan automatiskt föreslå distraktorer från samma kategori.
- När en källkandidat sparas registreras källan automatiskt som `verified` i Question Health.
- Ingen extern API-nyckel krävs.

## Säkerhet och robusthet
- Funktionen kräver inloggad adminsession.
- Rate limit: 30 sökningar per 10 minuter och IP.
- Externa anrop har timeout, svarsstorleksgräns och 10 minuters cache.
- Frågor läggs aldrig till automatiskt; administratören måste granska och spara dem.

## Version
- App/server/UI: 17.8.1
