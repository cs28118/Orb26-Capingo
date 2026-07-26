# Backend coverage snapshot

**Date:** 2026-07-26  
**Command:** `npm run test:coverage` in `backend/`

Approximate from last local run:

| Area | Statements |
|------|------------|
| Overall (included paths) | ~45% |
| `utils/subjectSync.js` | ~97% lines |
| `utils/partnerCode.js` | ~78% |
| `routes/decks.js` | ~75% |
| `routes/partners.js` | ~54% |
| `routes/rooms.js` | ~31% (many admin/resource paths untested) |

CI uploads `backend/coverage` as artifact `coverage-backend`.

Honest note: UI-heavy and Socket.IO paths lower overall %. Feature-critical helpers and core room/partner flows are the meaningful signal.
