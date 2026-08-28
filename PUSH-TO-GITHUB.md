# Lägg upp Resequiz v2 på GitHub

Packa upp ZIP-filen, öppna PowerShell/terminal i repomappen och kör:

```powershell
git init
git branch -M main
git add .
git commit -m "Resequiz v2 - 2440 questions, online and offline"
gh repo create resequiz-lxc --public --source=. --remote=origin --push
```

Om repot redan finns:

```powershell
git add .
git commit -m "Upgrade to Resequiz v2"
git push origin main
```

Därefter installeras den från Proxmox med:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/install-from-github.sh)"
```
