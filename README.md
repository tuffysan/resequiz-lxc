# Quiz 21.0.1

Quiz 21 bygger vidare på Quiz 20 med tre fokus: **PLAY, PROGRESS, QUALITY**.

## Nytt i Quiz 21

- **Daily Quiz**: samma 10 källbaserade/verifierade frågor för alla varje UTC-dag, egen dagsstatus och topplista.
- **Personlig startsida**: inloggade ser XP, level, streak och nästa badge direkt. Gästspel är fortfarande förstklassigt och kräver inget konto.
- **Progression**: XP, levels, kategoriutveckling, streaks, badges, awards och personliga rekord från Quiz 20 finns kvar och lyfts tydligare.
- **Highscore 2.0**: filtrera Alla tider/Idag/7 dagar/30 dagar, kategori, svårighet och upplägg.
- **Rapportera fråga** direkt efter ett svar. Admin får en rapportkö och kan markera rapporter lösta.
- **Frågestatistik** i SQLite: antal svar, rättprocent, rapporter och senaste visning byggs upp per fråga.
- **Question Quality Engine** fortsätter kontrollera ofullständiga frågor, dubbletter, svarsfel, verifieringsmetadata och trasiga bilder.
- **Offline**: befintligt offlinepaket och Barnquiz-bilder behålls; startsidan visar offline tydligt.
- **Säkrare uppdatering**: installationsskriptet tar automatisk backup av `/var/lib/resequiz` före uppdatering och behåller fem senaste pre-upgrade-backuper.
- Mobil-first, multiplayer, Barnquiz, bildfrågor, språk/tema, admin-login och hjälp finns kvar.

## Installation på Proxmox

```bash
chmod +x install-on-proxmox.sh scripts/*.sh
./install-on-proxmox.sh 135
```

Efter installation:

```bash
pct exec 135 -- curl -fsS http://127.0.0.1:3000/health
pct exec 135 -- curl -fsS http://127.0.0.1:3000/api/daily/status
```

Båda ska svara utan fel och `/health` ska visa version `21.0.1`.

## 21.0.1 – robust uppdatering och frågesynk

- Uppdateraren kräver inte längre Node.js på Proxmox-hosten. All Node-verifiering sker i CT 135.
- Frågegeneratorn blockerar inte längre installationen. Quiz verifieras och startas först; frågebanken kompletteras därefter i bakgrunden.
- Wikidata-anrop har 45 s timeout, upp till 4 försök med exponentiell backoff och paus mellan anrop.
- Hämtade källdata cachelagras i `/var/lib/resequiz/source-cache` och återanvänds vid nätverksfel.
- En systemd-timer kör komplettering dagligen cirka 03:30 och fortsätter idempotent mot målet 520 verifierade/källbaserade frågor per kategori.
- Manuell synk: `systemctl start quiz-question-sync.service`.
- Status/logg: `systemctl status quiz-question-sync.service` och `journalctl -u quiz-question-sync.service -n 100 --no-pager`.
