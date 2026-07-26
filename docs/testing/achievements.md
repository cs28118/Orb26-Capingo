# Testing: Achievements

**Scope:** Achievement unlocks + `/home/achievements` grid  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| `achievementCheck.ts` / `achievements.ts` | 0 | Planned; currently not wired fully |

## Integration tests

| Case | Status |
|------|--------|
| New profile includes Welcome achievement | Automated (profile create) |
| Quest actions set feature flags (e.g. helloCapy) | Partial via quest-action |

## End-to-end testing

| Journey | Status |
|---------|--------|
| View all achievements page | Manual |
| Streak milestone unlock | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Locked badges visible but not unlockable yet | UI shows locked | Manual |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Unlock without criteria | Should no-op / reject | Not fully automated |

## Screenshots / CI / coverage

Documented as Tier C (smoke + manual). See testing README depth tiers.
