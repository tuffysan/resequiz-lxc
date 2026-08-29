# Resequiz 19.0.0 — Mobile First Complete

Ett komplett, fristående Resequiz-projekt där **mobiltelefonen är huvudplattform**. Tablet och desktop är progressiva förbättringar, inte utgångsläget.

## Ingår

- Soloquiz med kategori, antal frågor, direkt feedback och resultatsparning.
- Realtime multiplayer via Socket.IO med rumskod, värd, spelare, timer, poäng och resultattavla.
- Resultat/Hall of Fame och övergripande statistik.
- Mobilanpassad frågeeditor/admin med skapa, redigera och ta bort.
- PWA/service worker för app-liknande upplevelse och cache av kärnsidor.
- JSON-baserad persistent lagring som är enkel att säkerhetskopiera och migrera.
- Proxmox/LXC-installation, systemd-service och backupscript.
- Test för atomisk JSON-lagring.

## Mobile-first-principer

Bas-CSS är för 320–768 px. Alla huvudflöden är enkolumn, svarsknappar är stora, formulär är fullbredd, navigationen sitter fast i nederkant, viewport använder `viewport-fit=cover` och UI tar hänsyn till safe-area. Först vid `min-width: 769px` introduceras fler kolumner och desktop-layout.

## Lokal körning

```bash
cd app
npm install
npm test
npm start
```

Öppna `http://localhost:3000`.

## Installera på befintlig Proxmox CT 135

Kör från projektets rot på Proxmox-hosten:

```bash
chmod +x install-on-proxmox.sh scripts/*.sh
./install-on-proxmox.sh 135
```

Projektet installeras i `/opt/resequiz`, data i `/var/lib/resequiz` och systemd-tjänsten heter `resequiz.service`.

## Data

Frågor ligger i `/var/lib/resequiz/questions.json` efter installation. Installationsscriptet bevarar en redan migrerad frågebank. Om det hittar den gamla v18-banken i `/opt/resequiz/data/questions.json` konverterar det automatiskt legacy-fälten (`c/q/a/r/f/d`) till v19-formatet (`category/question/answers/correct/explanation/difficulty`) och skriver den till `/var/lib/resequiz/questions.json`. Du kan även köra `node scripts/import-legacy-questions.js <source.json> <dest.json>` manuellt.

## Admin-säkerhet

Som standard är admin öppen för enkel lokal installation. Sätt `RESEQUIZ_ADMIN_TOKEN` och ändra `allowGuestAdmin` till `false` i settings för skyddad API-access. Nästa naturliga produktionssteg är sessionsbaserad login i UI.
