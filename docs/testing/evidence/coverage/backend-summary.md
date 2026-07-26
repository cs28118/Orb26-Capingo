# Backend coverage snapshot

**Date:** 2026-07-26  
**Command:** `npm run test:coverage` in `backend/`

| Area | Approx. statements |
|------|-------------------|
| Overall (included paths) | ~56% |
| `utils/subjectSync.js` | ~97% lines |
| `routes/chats.js` | ~78% |
| `routes/decks.js` | ~75% |
| `routes/rooms.js` | ~49% (admin/resources/announcements covered; socket not) |
| `routes/partners.js` | ~54% |
| `routes/profile.js` | ~45% |

**30** automated backend tests (unit + integration).

CI uploads `backend/coverage` as artifact `coverage-backend`.
