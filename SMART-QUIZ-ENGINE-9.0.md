# Resequiz 9.0 – Smart Quiz Engine

Version 9.0 focuses on quality, recovery and simplicity.

## Implemented
- Question Quality Score now combines play statistics, ratings and structural checks.
- Question Doctor detects low-quality questions, suspicious difficulty, duplicate answer choices and duplicate/near-duplicate wording.
- Smart Difficulty keeps adapting upcoming unforced questions to the group.
- Connection Guardian makes reconnect state explicit.
- Automatic host migration after a disconnected host grace period.
- Active rooms are persisted and can be recovered after a Node/container restart; an interrupted live question is restored paused for safety.
- Quiz DNA visualizes category strengths and weaknesses from real history.
- Simplified start screen with Start Quiz, Join and Solo as the primary actions.
- TV display adds “answers locked” reveal and restrained winner confetti.
- Existing special modes cover Connections, ordering/timeline, progressive image reveal and closest-wins/estimate mechanics.
- Admin Center adds Question Doctor, diagnostics and an opt-in web update control. Web update is disabled unless RESEQUIZ_ALLOW_WEB_UPDATE=1.
- Added Socket.IO E2E test covering room creation, join, game start and Quiet Mode.

## Recovery model
Active room state is written to active-rooms.json with throttled persistence. Questions interrupted by a restart resume in paused state instead of continuing a stale timer.

## Security
Web update remains disabled by default and still requires the normal admin authorization. It must be explicitly enabled through the environment.
