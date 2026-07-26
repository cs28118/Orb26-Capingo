# Continuous integration

Capingo uses **one shared CI pipeline** for the whole repository (not one pipeline per feature). Feature-level quality is tracked in [docs/testing/](./testing/) via grouped tests and coverage.

## Workflow

- **File:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- **Triggers:** `push` and `pull_request` to `main` and `feature-extensions`
- **Concurrency:** newer runs cancel in-progress runs on the same branch

## Jobs

| Job | What it runs |
|-----|----------------|
| **Frontend** | `npm ci` → typecheck → Vitest unit tests + coverage |
| **Backend** | `npm ci` → Vitest unit + integration tests + coverage |
| **E2E** | Playwright feature journeys (auth bypass + API mocks) after frontend job |

Coverage HTML and the Playwright report are uploaded as **Actions artifacts** (14-day retention).

## Badge

Add this to the README once the workflow has run on GitHub:

```markdown
[![CI](https://github.com/cs28118/Orb26-Capingo/actions/workflows/ci.yml/badge.svg)](https://github.com/cs28118/Orb26-Capingo/actions/workflows/ci.yml)
```

## Local equivalent

```powershell
# Frontend
cd react
npm run typecheck
npm run test:coverage

# Backend
cd backend
npm run test:coverage

# E2E smoke
cd react
npm run test:e2e
```

## Secrets

Current CI does **not** require MongoDB Atlas, Firebase, or Gemini keys:

- Backend integration tests use **mongodb-memory-server**
- E2E uses `VITE_E2E_BYPASS_AUTH=1` (stub user) + Playwright route mocks for `/api/**`

Full multi-user E2E (Partners → Rooms → live Socket.IO chat) remains a **local / optional** suite until test accounts are added as GitHub Actions secrets.

## Evidence

Screenshots of green runs belong in [`docs/testing/evidence/ci/`](./testing/evidence/ci/). Capture them from the Actions tab after the first push that includes this workflow.
