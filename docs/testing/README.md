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
| Unit test coverage | Done — frontend SM-2 + achievements + dashboard widgets; backend helpers 7 |
| Integration tests | Done — rooms/partners/decks/timetable/chats/profile/wired achievements |
| End-to-end testing | Done — Playwright **22 passed** (feature matrix + login-form project) |
| Edge cases | Automated tables + screenshots under [`evidence/features/`](./evidence/features/) |
| Failure cases | Automated tables + screenshots under [`evidence/features/`](./evidence/features/) |
| Screenshots of test results | Per-feature PNGs + [`evidence/features/results-board.png`](./evidence/features/results-board.png) |
| CI pipeline passing | Passing — [`evidence/ci/actions-green.png`](./evidence/ci/actions-green.png) |
| Code coverage reports | Summaries in [`evidence/coverage/`](./evidence/coverage/); HTML via `npm run test:coverage` |

**Detailed per-feature narratives** (what each unit/integration/edge/failure test does, and what each screenshot means) live in each folder’s [`results.txt`](./evidence/features/) — start at [`evidence/features/README.md`](./evidence/features/README.md).


## Evidence layout

```text
evidence/
  ci/            GitHub Actions green-run screenshots
  unit/          Unit test runner log summaries
  integration/   Integration test summaries
  e2e/           Playwright log + legacy feature shots
  features/      Per-feature E2E / edge / failure screenshots + results.txt
  coverage/      Coverage summary screenshots
```
