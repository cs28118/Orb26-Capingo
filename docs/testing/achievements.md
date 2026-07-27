# Testing: Achievements

**Scope:** Achievement unlocks + `/home/achievements` grid + wired feature flags  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Status |
|--------|------:|--------|
| `achievements.ts` conditions | streak/level/flags/Welcome/Data miner/Killer Quest | Automated |
| `achievementCheck.ts` | new unlocks + skip owned; toast mocked | Automated |

## Integration tests

| Case | Status |
|------|--------|
| New profile includes Welcome achievement | Automated |
| `chatMessage` → `helloCapy` | Automated |
| `createDeck` → `deckBuilder` + `decksCreated++` | Automated |
| Profile update → `instantiatedIndentity` | Automated |
| Timetable achievement types → scheduler/auto/drag/stack | Automated |
| Partner accept → `connectedComponent` both users | Automated |
| Unlock-achievements idempotent | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Achievements badge grid renders | Automated |
| Locked + unlocked badges together | Automated |
| Toast on first unlock after action | Manual / covered via unit toast mock |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Already-owned badges skipped | Not re-toasted | Automated |
| Locked badges visible | UI shows locked | Automated |
| Flag already true | Idempotent server write | Automated |
| Data miner at exactly 5 decks | Unlocks (`>= 5`) | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Unlock without criteria | Condition false → not unlocked | Automated (unit) |
| Invalid timetable-achievement type | 400 | Automated |

## Screenshots

[`evidence/features/achievements/`](./evidence/features/achievements/)  
[`results.txt`](./evidence/features/achievements/results.txt)
