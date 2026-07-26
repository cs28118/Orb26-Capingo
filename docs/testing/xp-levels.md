# Testing: XP & levels

**Scope:** Quest XP, streak claim, level-up thresholds (`/api/profile/quest-action`, claim-streak)  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| — | 0 | Logic lives in Express route; exercised by integration |

## Integration tests

| Case | Status |
|------|--------|
| `reviewDeck` awards XP then hits daily cap (limit 2) | Automated |
| Invalid `actionType` → 400 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Toast on quest XP from flashcard study | Manual |
| Level-up toast | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Third reviewDeck same day | Cap message, no extra XP | Automated |
| Streak XP capped at 100 | `min(streak*20, 100)` | Manual / code review |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Unknown user quest-action | 404 | Covered by route (similar patterns tested) |
| Invalid action | 400 | Automated |

## Screenshots / CI / coverage

Evidence: [`evidence/integration/backend-vitest.txt`](./evidence/integration/backend-vitest.txt). Profile route coverage included in backend HTML report (`backend/coverage`).
