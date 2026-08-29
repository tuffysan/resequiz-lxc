# Resequiz 18.0.3

## Mobile usability
- Mobile-first responsive layout for phones.
- Larger text, buttons and form controls.
- Full-width primary actions on small screens.
- Single-column question answers and setup cards on phones.
- Improved room code, QR, score and result layouts.
- Safe-area handling for modern phones.
- New frontend cache key `1803-mobile1`.

## Included fixes
- Keeps the 18.0.2 admin dashboard deadlock fix.
- Keeps the new-game state fix so an old finished solo room is not reopened when starting a new game.
- Canonical application version is 18.0.3 in VERSION, package.json, server health and visible UI.
