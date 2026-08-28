# Publicera Resequiz 5.2 – Director Edition

Packa upp ZIP-filen och ersätt innehållet i roten på GitHub-repot.

Uppdatera sedan LXC:n:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/tuffysan/resequiz-lxc/main/update-from-github.sh)"
```

Kontrollera därefter `/health`; versionen ska vara `5.2.0`.

Data i `/var/lib/resequiz` bevaras.
