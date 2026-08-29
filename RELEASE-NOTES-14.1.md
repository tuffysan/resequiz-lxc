# Release notes – Resequiz 14.1.0

**Verified Core** gör faktaverifiering till en förstaklassfunktion.

- 1 469 lågkvalitativa mallfrågor borttagna.
- 48 tvetydiga Amerika-svar korrigerade till Nordamerika/Sydamerika.
- 42 källkontrollerade ersättningsfrågor till Historia och Fotboll.
- 7 234 av 9 187 frågor får reproducerbar `Verified`-status.
- 1 953 frågor är ärligt markerade `Needs review`.
- Seed-fil gör status synlig i Question Health på ny installation.
- Ny rapport `app/data/fact-verification-report.json`.
- Ny testsvit `npm run test:fact-report`.
- Ny admin-endpoint `/api/admin/fact-verification-report`.
