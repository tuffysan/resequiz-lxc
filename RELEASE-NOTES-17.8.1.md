# Resequiz 17.8.1 — Admin responsiveness fix

- Caches the 22k+ question catalogue instead of rebuilding and normalising it on every room/socket update.
- Room metadata now uses the cached catalogue summary.
- Caches Hall of Fame aggregation briefly to avoid repeated full-history work.
- Keeps `/health` and `/api/admin/status` lightweight so admin login remains responsive.
- Bumps browser/PWA asset cache to 17.8.1.
- Preserves the Verified Question Finder introduced in 17.8.
