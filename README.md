# Quiz v19.8.0

Mobil-först PWA för soloquiz, Barnquiz, offline-spel och realtime multiplayer.

## Nytt i 19.8.0

### Frågebank
- Ny källbaserad frågebyggare försöker nå **minst 520 verifierade/source-backed frågor per kategori**.
- Byggaren använder Wikidata Query Service för strukturerade fakta och sparar källa på varje genererad fråga.
- Kategorierna omfattar även Hjärngympa och Världen i denna version.
- Hjärngympa verifieras deterministiskt genom beräkning i stället för extern källa.
- Byggaren är idempotent: samma fråga läggs inte till flera gånger.
- Om Wikidata är tillfälligt otillgängligt fortsätter installationen och byggaren kan köras igen senare.
- Rapportverktyg: `node /opt/resequiz/tools/question-bank-report.js /var/lib/resequiz/questions.json`.

### Barnquiz med bilder
- Barnquiz innehåller nu **625 frågor**.
- **Samtliga 625 Barnquiz-frågor har en bild**.
- Bilderna är lokala SVG-filer under `public/media-packs/kids-v1980/` och fungerar därför även utan extern bildserver.
- Barnbilderna precachas för offline-läge.
- Frågorna täcker Blandat, Djur, Disney/barnfilm, Geografi, Fotboll, Natur och Matematik.

### Frivilliga användarkonton och badges
- Det går fortfarande att spela helt som gäst utan konto.
- Frivillig registrering med användarnamn, visningsnamn och lösenord.
- Inloggade resultat kopplas till användaren och ger en personlig statistikprofil.
- Profilen visar spel, bästa resultat, snitt, senaste resultat och badges.
- Badges inkluderar första quizet, 5/10/25 spel, full pott, kategoriutforskare, allround och starkt resultat på svår nivå.
- Befintliga resultatawards för personbästa, Quiz-rekord, kategorirekord och 100 % finns kvar.

## Installation

På Proxmox-hosten:

```bash
chmod +x install-on-proxmox.sh scripts/*.sh
./install-on-proxmox.sh 135
```

Den vanliga GitHub-uppdateraren fungerar när release-filerna ligger på `main`.

## Bygg om verifierad frågebank manuellt

I CT 135, från en release-mapp som innehåller skriptet:

```bash
node /opt/resequiz/tools/expand-source-backed-questions.js /var/lib/resequiz/questions.json 520
node /opt/resequiz/tools/question-bank-report.js /var/lib/resequiz/questions.json
systemctl restart resequiz
```

`verified: true` tillsammans med `verificationLevel: "source-backed"` betyder att frågan är byggd från strukturerade källdata. Det är inte samma sak som manuell redaktionell granskning av varje enskild fråga.
