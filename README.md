# Quiz 24.1.1 – Fullständigt Git/LXC-paket med faktagranskad produktionsbank

Denna release innehåller hela Quiz-applikationen plus den faktagranskade produktionsbanken med 30 629 frågor. Vid uppgradering gör installern backup och mergar den granskade snapshoten mot den aktuella `/var/lib/resequiz/questions.json`. Frågor som tillkommit efter snapshoten bevaras och markeras/analyseras av Verification Center. 113 tvetydiga eller felgenererade frågor är karantänsatta och används inte i spel.

Installera från GitHub på Proxmox-hosten:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Efter installation: `/health` och `/api/meta` ska rapportera version 24.1.1. Installern skapar både ordinarie pre-upgrade-backup och en särskild `questions.json.pre-factreview-24.1.1-*.bak` innan frågebanken ändras.


## Quiz 24.1.1 – Verification Center

- Ny Admin-flik **Verifiering** med status: Källverifierad, Deterministisk, Äldre verifierad, Behöver granskas och Karantän.
- Säker server-side audit av hela persistenta frågebanken.
- Strukturellt trasiga frågor sätts automatiskt i karantän efter backup.
- Deterministiska Hjärngympa-frågor kan verifieras lokalt när uttrycket kan räknas om.
- Källverifiering i Admin kräver uttrycklig källa; en fråga märks aldrig source-backed bara för att den ser rimlig ut.
- Karantänfrågor tas bort från Solo, Multiplayer, Duel och offline-paket men finns kvar i banken för granskning/återställning.
- Audit kan laddas ner som CSV och produktionsbanken som gzip.

# Quiz 24.1.1 – Verification Center – Complete localization hotfix

## 24.1.1 – Complete UI localization
- Fixes remaining Swedish UI text when English, Spanish or German is selected.
- Covers home, solo/training, Daily, results, profile, Duel, multiplayer, admin, PWA update banner and page chrome.
- Localizes category/topic/mastery labels without translating question or answer content.
- Adds a shared dynamic UI translation layer so newly rendered components are translated too.
- Updates PWA caches so clients receive the localization fix immediately after service-worker activation.


Everything from 23.1 Quality & Mastery and 23.2 Multiplayer 2.0, plus weekly Quiz League (Bronze/Silver/Gold/Diamond), social leaderboard, visual polish, answer celebrations and a release gate. Guest play remains fully supported.

## 24.1.1 – Export av produktionsfrågebank
- Admin → Översikt har knappen **Ladda ner questions-production.json.gz**.
- Exporten läser den aktiva persistenta `questions.json` från `RESEQUIZ_DATA_DIR` (normalt `/var/lib/resequiz/questions.json`).
- Filen gzip-komprimeras strömmande på servern och laddas ner som `questions-production.json.gz`.
- Endpointen `/api/admin/questions/export` kräver giltig admin-session och skickas med Bearer-token från admin-gränssnittet.
- Ingen kopia av frågebanken behöver skapas manuellt på Proxmox-värden.


## 24.1.1
Admin question-bank export is now rendered directly in admin.html, so it cannot disappear because of admin.js rendering or stale dynamic markup. Admin login also sets an HttpOnly session cookie, allowing the static download link to authenticate safely.

### 24.1.1 – installer hotfix
Fixar release-regressionstestet så att de sista kontrollerna använder paketets ROOT-sökväg. 24.0.4 kunde därför avbryta uppdateringen på Proxmox med `grep: app/public/admin.html: No such file or directory` trots att filen fanns i paketet.
