# Quiz 21.0.0

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

Båda ska svara utan fel och `/health` ska visa version `21.0.0`.
