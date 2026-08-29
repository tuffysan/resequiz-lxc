# Resequiz 18.0.2 – Admin Dashboard Deadlock Fix

## Fixat

- Hittade den faktiska orsaken till att Admin och även `/health` kunde sluta svara efter adminbesök.
- Admin-dashboarden läste/parsa­de `question-ratings.json` en gång per fråga via ett default-argument. Med 22 192 frågor innebar det över 22 000 synkrona filinläsningar.
- Samma dashboard läste/parsa­de hela verifieringsregistret en gång per fråga, ytterligare över 22 000 synkrona filinläsningar.
- Dashboarden läser nu metrics, ratings och verifieringar exakt en gång per request och återanvänder objekten för alla frågor.
- Återanvänder redan laddad `qs` i stället för att bygga frågekatalogen igen.
- Versions-/PWA-cache bump till 18.0.2.

Detta eliminerar den O(N × filstorlek)-kodväg som blockerade Node event loop och gjorde att även billiga endpoints som `/health` och `/api/admin/status` timeoutade medan dashboarden byggdes.

## State/navigation and UI version hotfix

- Starting a new Solo, Best Quiz or Join flow now clears any stale saved room before Socket.IO reconnect logic runs.
- After creating or joining a room, the launch query string is removed so a page refresh can safely rejoin the active room.
- Corrected stale visible version labels in generated result cards to 18.0.2.
- HTML is served with no-cache/no-store while versioned static assets remain cacheable.
- Bumped the PWA/service-worker cache namespace and frontend cache-buster to `1802-statefix1`.
