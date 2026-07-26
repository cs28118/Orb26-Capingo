# Testing: Achievements

**Scope:** Achievement unlocks + `/home/achievements` grid  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Status |
|--------|------:|--------|
| `achievements.ts` conditions | 4 | Automated (streak/level/flags/Welcome) |
| `achievementCheck.ts` | 2 | Automated (new unlocks + skip owned; toast mocked) |

## Integration tests

| Case | Status |
|------|--------|
| New profile includes Welcome achievement | Automated (profile create) |
| Quest actions set feature flags (e.g. helloCapy) | Partial via quest-action |

## End-to-end testing

| Journey | Status |
|---------|--------|
| View all achievements page | Manual (needs auth) |
| Streak milestone unlock | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Already-owned badges skipped | Not re-toasted | Automated |
| Locked badges visible but not unlockable yet | UI shows locked | Manual |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Unlock without criteria | Condition false → not unlocked | Automated (unit) |

## Screenshots / CI / coverage

[`evidence/unit/frontend-vitest.txt`](./evidence/unit/frontend-vitest.txt). `achievementCheck.ts` at high coverage in frontend report.
