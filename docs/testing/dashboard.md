# Testing: Dashboard

**Scope:** `/home` profile card, quests preview, partner code, achievements preview  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| — | 0 | UI + profile API; covered via profile integration |

## Integration tests

| Case | Status |
|------|--------|
| `GET /api/profile/:uid` creates profile + `CAPY-` partner code | Automated (`data.test.js`) |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Dashboard partner code + quests | Automated (bypass auth + API mocks) |
| Claim streak / edit profile toasts | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| First visit creates Welcome achievement | Profile seed includes achievement id 1 | Integration (create path) |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Backend down | Dashboard cannot load profile | Manual |

## Screenshots

See [`evidence/integration/backend-vitest.txt`](./evidence/integration/backend-vitest.txt) for API suite run that includes profile create.

## CI / coverage

Backend profile routes partially covered via quest/profile tests; dashboard UI not in unit coverage.
