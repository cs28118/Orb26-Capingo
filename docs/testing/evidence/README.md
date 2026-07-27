# Test evidence — summaries

Generated locally on 2026-07-26 (full per-feature E2E / edge / failure matrix).

## Suite totals

| Suite | Result |
|-------|--------|
| Frontend unit | **18 passed** |
| Backend unit + integration | **33 passed** |
| Playwright E2E | **22 passed** |

## Per-feature screenshots + results

Browse [`features/`](./features/) — each feature folder has a detailed **`results.txt`** (unit, integration, E2E, edge cases, failure cases, and what every PNG means) plus happy/edge/failure screenshots.

| Feature | Folder |
|---------|--------|
| Sign in & accounts | [`features/auth-accounts/`](./features/auth-accounts/) |
| Dashboard | [`features/dashboard/`](./features/dashboard/) |
| XP & levels | [`features/xp-levels/`](./features/xp-levels/) |
| Achievements | [`features/achievements/`](./features/achievements/) |
| Timetable | [`features/timetable/`](./features/timetable/) |
| Chatbot | [`features/chatbot/`](./features/chatbot/) |
| Flashcards | [`features/flashcards/`](./features/flashcards/) |
| Study Partners | [`features/study-partners/`](./features/study-partners/) |
| Study Rooms | [`features/study-rooms/`](./features/study-rooms/) |

**Results board (all features):** [`features/results-board.png`](./features/results-board.png)

Regenerate board: `node scripts/write-feature-evidence.mjs`

## Unit / integration logs

- [`unit/frontend-vitest.txt`](./unit/frontend-vitest.txt)
- [`integration/backend-vitest.txt`](./integration/backend-vitest.txt)
- [`e2e/playwright-log.txt`](./e2e/playwright-log.txt)

## CI pipeline passing

- Screenshot: [`ci/actions-green.png`](./ci/actions-green.png)
