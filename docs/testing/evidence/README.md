# Test evidence — summaries

Generated locally on 2026-07-26 (expanded Phase 2–8 run).

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
- Result: **3 passed**
- Screenshots: [`e2e/login-page.png`](./e2e/login-page.png), [`e2e/login-register.png`](./e2e/login-register.png)

## CI pipeline passing

- Screenshot: [`ci/actions-green.png`](./ci/actions-green.png) (CI #1 on earlier push)
- Re-check Actions after each push to `feature-extensions`
