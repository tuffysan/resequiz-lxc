# Resequiz v2 – Proxmox LXC, online + offline

Resequiz v2 är ett gruppquiz för resor. Samma installation ger:

- **Online-läge i realtid** med rumskod och flera mobiler/surfplattor/datorer.
- **Offline/PWA-läge** som kan installeras på enheten och spelas utan internet.
- **2 440 frågor** i 14 kategorier.
- Lätt, medel, svår eller blandad svårighetsgrad.
- Kategorival i både online- och offline-läge.
- Anti-repeat: enheten prioriterar frågor den inte sett tidigare; varje online-rum prioriterar nya frågor vid revansch.
- Serverbaserad frågebank i `app/data/questions.json` för online-läget.
- Offlinebanken finns i `app/public/questions.js` och följer med PWA:n.
- Realtid med Socket.IO, Node.js och Nginx.
- Systemd-tjänst och autostart i LXC.

## Kategorier

Allmänbildning, Sverige, Världen, Historia, Sport, Fotboll, Musik, Film & TV, Mat & dryck, Vetenskap & teknik, Djur & natur, 80/90/00-talet, Onödigt vetande och Resor.

## Direktinstallation från GitHub

Efter att repot ligger som `tuffysan/resequiz-lxc` på GitHub kör du detta som root på Proxmox-värden:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/install-from-github.sh)"
```

Exempel med egen CTID och mer minne:

```bash
CTID=140 MEMORY_MB=2048 CORES=2 bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/install-from-github.sh)"
```

Standardvärden: CTID 135, Debian 12, 2 CPU, 1024 MB RAM, 8 GB disk, `vmbr0`, `local-lvm`.

## Efter installation

Installationsscriptet skriver ut containerns IP. Öppna:

- `http://CONTAINER-IP/` – startsida
- `http://CONTAINER-IP/online.html` – live gruppspel
- `http://CONTAINER-IP/offline.html` – offlinequiz
- `http://CONTAINER-IP/health` – serverstatus och frågeantal
- `http://CONTAINER-IP/api/questions/meta` – metadata för frågebanken

För installation som PWA från internet rekommenderas HTTPS via reverse proxy.

## Uppdatera

Efter en ny push till GitHub kan du köra installationspaketets `update-resequiz.sh` enligt kommentaren i scriptet, eller installera om en ny CT. Frågebanken är separerad på servern och kan därför uppdateras utan ändringar i spelprotokollet.

## Frågebank

Online-servern använder `app/data/questions.json`. Klienten får endast frågetext och svarsalternativ för den aktiva frågan; rätt svar hålls på servern tills rundan avslutats.

Offlineversionen behöver facit lokalt och använder därför `app/public/questions.js`. Service worker cachar banken för offlinekörning.

## Säkerhet / drift

Exponera helst tjänsten via HTTPS/reverse proxy om den ska användas från internet. Installationsscriptet skapar en unprivileged Debian 12 LXC och kör quizservern som systemanvändaren `resequiz`.

### Uppdatera direkt från GitHub

När containern redan finns kan du köra detta på Proxmox-värden:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

För annan CTID:

```bash
CTID=140 bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```


## Modernt UI

Versionen använder ett nytt mobil-first gränssnitt med tydligare startflöde, större tryckytor, moderna valkort, fokuserad frågevy och förbättrad live-lobby/resultattavla. Samma design följer med offlinepaketet.

## Nytt i Modern Game Show UI

- Profilavatarer för online- och offlinespelare.
- QR-kod genereras lokalt i LXC:n; skanning öppnar rätt online-rum och fyller i rumskoden.
- Fullskärmsknapp under frågor med ett särskilt game-show-läge för mobil, surfplatta och större skärm.
- Större frågor, svarskort och timer i fullskärmsläge.
- QR-generering kräver inga externa molntjänster; `qrencode` installeras automatiskt i containern.


## v2.2
Fler bildfrågor och Onödigt vetande. Offline-läget visar personliga styrkor, kategorimästare, bildfråge-resultat, bästa streak och lokal highscore-historik.


## v2.3 – permanent online Hall of Fame
Online-spel sparar nu statistik i `/var/lib/resequiz/highscores.json`, separat från appkoden så uppdateringar inte raderar historiken. Hall of Fame visar högsta poäng, flest vinster, bäst träffsäkerhet, längsta streak, bildmästare, Onödigt vetande-kung och kategorimästare.


## v2.3.1 – HTTP/LAN-fix
Online-klienten använder nu en säker UUID-fallback som fungerar även på vanlig HTTP-adress i lokalt nätverk, exempelvis `http://192.168.x.x`. `online.js` cache-bustas för att undvika att webbläsaren återanvänder den äldre klienten.


## v2.3.2 – online diagnostics
Online-vyn renderas även om Socket.IO inte går att nå och visar tydligt serverfel. Uppdateringsscriptet uppdaterar nu även Nginx/systemd och verifierar både /health och Socket.IO efter restart.


## v2.4 – Offline installation
- `/install.html` känner av mobil, surfplatta eller dator och visar rätt installationsmetod.
- PWA-installationen startar direkt i offline-spelet och precachar hela frågebanken.
- iPhone/iPad får instruktioner för **Lägg till på hemskärmen** i Safari.
- Android/Chrome och desktop Chrome/Edge kan installera spelet som app.
- `/downloads/Resequiz-Offline-Standalone.html` är en enda fristående fil med hela spelet.
- `/downloads/Resequiz-Offline.zip` kan kopieras till dator/USB och köras utan server.


## v2.5 – Light Professional UI
Gränssnittet har gjorts om till ett ljusare och mer professionellt uttryck med neutral typografi, diskreta skuggor, blågrön accent, mindre dekorativa emojis och tydligare kontroller. Alla online/offline-funktioner är oförändrade.


## v2.6 – Clear & Readable UI
Ny högkontrastdesign med vit bakgrund, mörk text, större typsnitt, tydliga formulärfält, stora svarsknappar och enklare visuell hierarki. Fokus ligger på läsbarhet och användbarhet på mobil, surfplatta och dator.
