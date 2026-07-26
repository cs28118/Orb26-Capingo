# Test evidence — summaries

Generated locally on 2026-07-26 (feature E2E expansion).

## Unit (frontend)

- Command: `cd react && npm run test:coverage`
- Result: **18 passed** (`sm2` + achievements)
- Log: [`unit/frontend-vitest.txt`](./unit/frontend-vitest.txt)

## Integration + unit (backend)

- Command: `cd backend && npm run test:coverage`
- Result: **30 passed** (6 files)
- Log: [`integration/backend-vitest.txt`](./integration/backend-vitest.txt)

## E2E

- Command: `cd react && npm run test:e2e`
- Result: **10 passed**, 1 skipped (login form when bypass on)
- Auth: `VITE_E2E_BYPASS_AUTH=1` stub user + Playwright API mocks (no Firebase/Mongo required in CI)
- Screenshots:
  - [`e2e/dashboard.png`](./e2e/dashboard.png)
  - [`e2e/timetable.png`](./e2e/timetable.png)
  - [`e2e/chatbot.png`](./e2e/chatbot.png)
  - [`e2e/flashcards.png`](./e2e/flashcards.png)
  - [`e2e/study-partners.png`](./e2e/study-partners.png)
  - [`e2e/study-rooms.png`](./e2e/study-rooms.png)
  - [`e2e/achievements.png`](./e2e/achievements.png)

## CI pipeline passing

- Screenshot: [`ci/actions-green.png`](./ci/actions-green.png)
- Re-check Actions after each push to `feature-extensions`
