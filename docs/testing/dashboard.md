# Testing: Dashboard

**Scope:** `/home` profile card, quests preview, partner code, achievements preview, study snapshot widgets, For you recommendations  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| `dashboardWidgets.ts` | 7 | Upcoming todos sort/cap, due decks summary, recent chats/rooms, relative time |
| `recommendationEngine` helpers | via integration | account age, onboarding gate |

## Integration tests

| Case | Status |
|------|--------|
| `GET /api/profile/:uid` creates profile + `CAPY-` partner code | Automated (`data.test.js`) |
| Timetable / decks / chats / rooms GET (widget sources) | Covered in feature integration suites |
| `GET /api/dashboard/recommendations/:uid` onboarding + adaptive | Automated (`recommendations.test.js`) |
| `POST /api/dashboard/recommendations/dismiss` same-day hide | Automated (`recommendations.test.js`) |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Partner code + quests + XP | Automated |
| Study snapshot widgets (tasks, due cards, chats, rooms) | Automated |
| For you / Get started tip + CTA | Automated (mocked recommendations) |
| Claim streak → ✓ Claimed | Automated |
| Nav to Timetable / Flashcard / Partners / Rooms | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| First visit creates Welcome achievement | Profile seed includes achievement id 1 | Integration |
| Empty todos / zero due / no chats | Widget empty-state copy | Unit helpers + E2E mocks |
| Widget API fails | That widget shows error; profile/quests still work | Soft-fail in UI |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Backend / profile down | `Error:` on dashboard | Automated |
| Single widget fetch fails | Isolated empty/error in that panel | Soft-fail (code) |

## Screenshots

[`evidence/features/dashboard/`](./evidence/features/dashboard/) — happy, widgets, claim-streak, backend-down, nav end  
[`results.txt`](./evidence/features/dashboard/results.txt)

## CI / coverage

Backend profile routes covered via quest/profile tests; dashboard UI + widgets via Playwright and `dashboardWidgets` unit tests.
