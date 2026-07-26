# Testing Capingo

This folder documents **unit**, **integration**, and **end-to-end** testing for every Capingo feature, plus edge/failure cases, coverage, and evidence screenshots.

**CI** is documented once in [`docs/ci.md`](../ci.md). Each feature page links back to it.

## How to run

```powershell
# Frontend unit + coverage
cd react
npm test
npm run test:coverage

# Backend unit + integration + coverage
cd backend
npm test
npm run test:coverage

# E2E smoke (starts Vite automatically)
cd react
npm run test:e2e
```

## Feature index

| Feature | Doc |
|---------|-----|
| Sign in & accounts | [auth-accounts.md](./auth-accounts.md) |
| Dashboard | [dashboard.md](./dashboard.md) |
| XP & levels | [xp-levels.md](./xp-levels.md) |
| Achievements | [achievements.md](./achievements.md) |
| Timetable | [timetable.md](./timetable.md) |
| Chatbot | [chatbot.md](./chatbot.md) |
| Flashcards + SRS | [flashcards.md](./flashcards.md) |
| Study Partners | [study-partners.md](./study-partners.md) |
| Study Rooms | [study-rooms.md](./study-rooms.md) |

## Master checklist

| Item | Status |
|------|--------|
| Unit test coverage | Done — frontend `sm2` (12); backend helpers (7) |
| Integration tests | Done — rooms, partners, decks, timetable, profile quests (24 backend tests total) |
| End-to-end testing | Done — Playwright login smoke; fuller journeys manual (see feature docs) |
| Edge cases | Tables in each feature doc |
| Failure cases | Tables in each feature doc |
| Screenshots of test results | [`evidence/`](./evidence/) (logs + `e2e/login-page.png`) |
| CI pipeline passing | Passing — [`evidence/ci/actions-green.png`](./evidence/ci/actions-green.png) (CI #1, `61ff012`) |
| Code coverage reports | Summaries in [`evidence/coverage/`](./evidence/coverage/); HTML via `npm run test:coverage` |

## Evidence layout

```text
evidence/
  ci/            GitHub Actions green-run screenshots
  unit/          Unit test runner screenshots / log summaries
  integration/   Integration test summaries
  e2e/           Playwright report screenshots
  coverage/      Coverage summary screenshots
```
