# Resequiz 18.0.1 — Backend Storage Deadlock Fix

## Varför denna version finns
Diagnostik från Proxmox visade att Node-processen accepterade TCP-anslutningar på port 3000 men inte svarade på ens `/health` eller `/api/admin/status`. Samtidigt hade SQLite en stor WAL-fil och tjänsten behövde SIGKILL vid stopp. Det pekar på att synkrona native SQLite-anrop kan blockera hela Node event loop i den aktuella LXC-miljön.

## Ändrat
- Standardlagring är nu `json-safe` och använder inte `better-sqlite3` på normala request paths.
- `better-sqlite3` har tagits bort som obligatoriskt npm-beroende, vilket också gör uppdateringar snabbare och minskar native build-risk.
- Frågor, historik, admininställningar, ligor och övriga befintliga JSON-filer är fortsatt auktoritativa och överlever uppdateringar.
- No-repeat-data och answer receipts har en lätt JSON-baserad persistent implementation med debounced skrivning.
- Game events skrivs append-only till `game-events.jsonl` i safe mode.
- Om SQLite uttryckligen önskas senare kan `RESEQUIZ_STORAGE=sqlite` användas om modulen finns installerad; standard är medvetet JSON-safe.
- Graceful shutdown stänger Socket.IO och storage samt har en intern 2,5 s fail-safe så uppdateringar inte fastnar i 10–90 sekunder.
- UI/cache/version synkroniserad till 18.0.1.

## Data
Ingen befintlig quizdata tas bort. De JSON-filer som tidigare speglades till SQLite används direkt. Den gamla `resequiz.db` och WAL-filen lämnas orörda som säkerhetskopia men används inte i standardläget.
