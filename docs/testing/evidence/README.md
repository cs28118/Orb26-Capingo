# Test evidence — summaries

Generated locally on 2026-07-26. PNG screenshots of CI Actions will be added after the workflow runs on GitHub (`evidence/ci/`).

## Unit (frontend)

- Command: `cd react && npm run test:coverage`
- Result: **12 passed** (`sm2.test.ts`)
- Log: [`unit/frontend-vitest.txt`](./unit/frontend-vitest.txt)
- HTML coverage: `react/coverage/index.html` (gitignored; regenerate anytime)

## Integration + unit (backend)

- Command: `cd backend && npm run test:coverage`
- Result: **24 passed** (4 files)
- Log: [`integration/backend-vitest.txt`](./integration/backend-vitest.txt)
- HTML coverage: `backend/coverage/index.html`

## E2E

- Command: `cd react && npm run test:e2e`
- Result: **1 passed** (login smoke)
- Screenshot: [`e2e/login-page.png`](./e2e/login-page.png) (written by Playwright on pass)

## CI pipeline passing

1. Push this branch to GitHub
2. Open Actions → **CI** workflow
3. Save a screenshot of the green run into `evidence/ci/actions-green.png`
4. Confirm the README badge turns green

Until pushed, local runs above are the source of truth.
