# Quiz 24.0.5 – Complete localization hotfix

## 24.0.5 – Complete UI localization
- Fixes remaining Swedish UI text when English, Spanish or German is selected.
- Covers home, solo/training, Daily, results, profile, Duel, multiplayer, admin, PWA update banner and page chrome.
- Localizes category/topic/mastery labels without translating question or answer content.
- Adds a shared dynamic UI translation layer so newly rendered components are translated too.
- Updates PWA caches so clients receive the localization fix immediately after service-worker activation.


Everything from 23.1 Quality & Mastery and 23.2 Multiplayer 2.0, plus weekly Quiz League (Bronze/Silver/Gold/Diamond), social leaderboard, visual polish, answer celebrations and a release gate. Guest play remains fully supported.

## 24.0.5 – Export av produktionsfrågebank
- Admin → Översikt har knappen **Ladda ner questions-production.json.gz**.
- Exporten läser den aktiva persistenta `questions.json` från `RESEQUIZ_DATA_DIR` (normalt `/var/lib/resequiz/questions.json`).
- Filen gzip-komprimeras strömmande på servern och laddas ner som `questions-production.json.gz`.
- Endpointen `/api/admin/questions/export` kräver giltig admin-session och skickas med Bearer-token från admin-gränssnittet.
- Ingen kopia av frågebanken behöver skapas manuellt på Proxmox-värden.


## 24.0.5
Admin question-bank export is now rendered directly in admin.html, so it cannot disappear because of admin.js rendering or stale dynamic markup. Admin login also sets an HttpOnly session cookie, allowing the static download link to authenticate safely.

### 24.0.5 – installer hotfix
Fixar release-regressionstestet så att de sista kontrollerna använder paketets ROOT-sökväg. 24.0.4 kunde därför avbryta uppdateringen på Proxmox med `grep: app/public/admin.html: No such file or directory` trots att filen fanns i paketet.
