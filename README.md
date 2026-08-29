# Quiz 20.0.0

Quiz 20 is the progression and quality release.

## Highlights
- Guest play remains the default: no account required.
- Optional player accounts with XP, levels, streaks, category progress and badges.
- Next-badge progress so players can see what to unlock next.
- Existing awards and records remain.
- Adaptive solo selection for signed-in players reduces recently seen questions.
- Difficulty and game format are selected before play.
- Mobile-first question view still shows only image (when relevant), question and answers while answering.
- Admin Question Quality Engine detects incomplete questions, duplicate answers, invalid answer keys, missing verification metadata, broken local images and exact duplicate question text.
- Question quality score and review list in Admin.
- SQLite analytics foundation at `/var/lib/resequiz/quiz.db` using Node 22 built-in SQLite; existing JSON data remains compatible and is indexed on startup.
- Existing languages, Spanish variants, offline mode, highscores, Barnquiz images, multiplayer and help remain.

## Upgrade
Push this release to the GitHub repository and run the normal updater on the Proxmox host.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Verify:
```bash
pct exec 135 -- curl -fsS http://127.0.0.1:3000/health
```
Expected version: `20.0.0`.
