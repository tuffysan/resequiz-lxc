# Quiz v19.6.0

Quiz är en responsiv PWA för soloquiz och realtidsquiz med flera deltagare.

## Nytt i 19.6.0

- Vid spelstart väljer användaren svårighetsgrad: Blandad, Lätt, Medel eller Svår.
- Vid spelstart väljer användaren upplägg: Snabb (5 frågor), Standard (10), Lång (20) eller Utmaning (15 med kortare tid).
- Samma val finns när man skapar ett multiplayer-rum.
- Svenska, English, Español och Deutsch används genom hela huvudflödet: startsida, spelstart, multiplayer, resultat/highscore, navigation och meddelanden.
- Español har regionala varianter för Spanien, Mexiko, Argentina, Colombia, Chile, Peru, Uruguay och USA/Latino.
- Offline-läge har en tydlig genväg på startsidan och kan startas explicit även när telefonen fortfarande har internet.
- Highscore och rekord har en egen tydlig genväg och förbättrad topplista.
- Awards delas ut när en spelare sätter nytt personbästa, nytt globalt Quiz-rekord, nytt kategorirekord eller får 100%.
- Awards sparas med resultatet och visas i resultatlistan.
- Barnquiz, bildfrågor, tema, admin-login och adminstatistik finns kvar.

## Installation

På Proxmox-hosten:

```bash
chmod +x install-on-proxmox.sh scripts/*.sh
./install-on-proxmox.sh 135
```

Admin-installationsnyckeln finns i:

```bash
cat /var/lib/resequiz/admin-setup-key
```
