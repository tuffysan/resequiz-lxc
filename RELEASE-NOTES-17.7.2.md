# Resequiz 17.7.2 – Admin API & Update Integrity Fix

## Fixat

- Admin-klienten känner nu igen HTML-svar från servern och visar ett tydligt versions-/API-fel i stället för `Unexpected token '<'`.
- Alla okända `/api/*`-anrop returnerar JSON med `API_ROUTE_NOT_FOUND` och aktuell serverversion.
- Uppdateraren verifierar `/health`, `/api/admin/status` och Socket.IO innan en uppdatering godkänns.
- Om Admin-API saknas eller serverversionen inte matchar distributionsversionen gör uppdateraren rollback i stället för att lämna en blandad installation.
- Uppdateraren visar nu 8 tydliga steg så längre `npm install` och backup-steg inte ser ut som att uppdateringen har hängt sig.
- Cache-/UI-version uppdaterad till 17.7.2.

## Orsak till felet

`Unexpected token '<'` betyder att webbläsaren förväntade JSON från Admin-API:t men fick en HTML-sida, normalt Express standard-404. Det kan uppstå när nytt admin-JavaScript körs mot en äldre serverprocess där `/api/admin/setup` ännu inte finns. 17.7.2 gör detta både tydligt och automatiskt verifierat vid uppdatering.
