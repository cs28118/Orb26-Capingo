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
| Claim streak once, then already-claimed message | Automated |
| Streak XP capped at 100 (`min(streak*20, 100)`) | Automated |
| Unknown user claim-streak → 404 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Dashboard shows Level / XP under bypass | Automated |
| Claim streak from Dashboard | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Third reviewDeck same day | Cap message, no extra XP | Automated |
| Streak XP capped at 100 | `+100 XP` for streak ≥ 5 | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Unknown user quest-action / claim | 404 | Automated (claim-streak) |
| Invalid action | 400 | Automated |

## Screenshots

[`evidence/features/xp-levels/`](./evidence/features/xp-levels/)  
[`results.txt`](./evidence/features/xp-levels/results.txt)
