# CI evidence placeholder

After the first green GitHub Actions run:

1. Open the successful **CI** workflow run
2. Screenshot the jobs list (frontend / backend / e2e all green)
3. Save as `actions-green.png` in this folder

Local verification (2026-07-26):

- Frontend Vitest: pass
- Backend Vitest: pass  
- Playwright login smoke: pass

Workflow file: [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
