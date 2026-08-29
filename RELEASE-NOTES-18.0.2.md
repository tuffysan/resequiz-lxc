# Resequiz 18.0.2 – Admin Dashboard Deadlock Fix

## Fixat

- Hittade den faktiska orsaken till att Admin och även `/health` kunde sluta svara efter adminbesök.
- Admin-dashboarden läste/parsa­de `question-ratings.json` en gång per fråga via ett default-argument. Med 22 192 frågor innebar det över 22 000 synkrona filinläsningar.
- Samma dashboard läste/parsa­de hela verifieringsregistret en gång per fråga, ytterligare över 22 000 synkrona filinläsningar.
- Dashboarden läser nu metrics, ratings och verifieringar exakt en gång per request och återanvänder objekten för alla frågor.
- Återanvänder redan laddad `qs` i stället för att bygga frågekatalogen igen.
- Versions-/PWA-cache bump till 18.0.2.

Detta eliminerar den O(N × filstorlek)-kodväg som blockerade Node event loop och gjorde att även billiga endpoints som `/health` och `/api/admin/status` timeoutade medan dashboarden byggdes.
