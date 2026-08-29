# Quiz v19.4.0

Quiz är en responsiv PWA för soloquiz och realtidsquiz med flera deltagare.

## Nytt i 19.4.0

- Frågevyn visar endast själva frågan, eventuell bild och svarsalternativen.
- Bildfrågor visar fältet `visual` och uppgraderingen försöker återställa både bildmetadata och äldre `media-packs`.
- Administration kräver inloggning. Första gången används installationsnyckeln för att skapa ett lösenord.
- Admin har en statistiköversikt med spel, spelare, frågebank, barnfrågor, bildfrågor, träffsäkerhet, 30-dagarstrend, spellägen och aktiva spelare.
- Språk kan växlas mellan svenska och engelska.
- Tema kan växlas mellan system, ljust och mörkt.
- Offline-spel för soloquiz använder en lokalt sparad frågebank.
- Barnquiz har åldersanpassning och temaval.
- Appikonen används för PWA, Apple Touch Icon och favicon.

## Installation

På Proxmox-hosten:

```bash
chmod +x install-on-proxmox.sh scripts/*.sh
./install-on-proxmox.sh 135
```

Efter första starten skrivs admin-installationsnyckeln ut av installeraren. Den kan även läsas i containern med:

```bash
cat /var/lib/resequiz/admin-setup-key
```

Tekniska sökvägar och tjänstenamnet behålls som `/opt/resequiz`, `/var/lib/resequiz` och `resequiz.service` för att befintliga installationer ska kunna uppgraderas utan datamigrering av systemnivån.

## Uppdatering från GitHub

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Den persistenta frågebanken och resultatdata bevaras vid uppdatering.
