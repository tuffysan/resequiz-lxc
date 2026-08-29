# Resequiz 17.6.3 – Admin Login Fix

- Rebuilt admin authentication around a dedicated POST `/api/admin/login`.
- Successful login creates an HttpOnly, SameSite=Strict 12-hour admin session cookie.
- Admin key is no longer kept in localStorage or appended to normal admin API URLs.
- Clear errors for wrong/missing admin key.
- Login rate limiting and timing-safe key comparison.
- Existing key-query authentication remains server-compatible for maintenance scripts.
- Version/cache bumped to 17.6.3.

Recovery inside the LXC:
`cat /root/resequiz-admin-key.txt`
If needed, rotate with `/opt/resequiz/rotate-admin-key.sh` (or the installed copy of that script) and restart the service.
