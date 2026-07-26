# Testing: Timetable

**Scope:** Todos/events, generate UI, subject tags → profile sync  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Status |
|--------|------:|--------|
| `subjectSync` normalize/extract/intersect/jaccard | 4 | Automated |

## Integration tests

| Case | Status |
|------|--------|
| PUT timetable syncs subjects to profile | Automated |
| Missing todos/events arrays → 400 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Timetable page loads with Add task / Generate | Automated (bypass auth + API mocks) |
| Add task with subject → appears on list | Manual |
| Generate timetable with empty tasks | Manual (edge) |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Duplicate subjects different casing | Deduped case-insensitively | Automated (unit) |
| Empty subject ignored | Not synced | Automated (unit) |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Body without events | 400 | Automated |
| Generate without time settings | Empty grid tip in README | Manual |

## Screenshots / coverage

Unit helpers + integration in [`evidence/integration/backend-vitest.txt`](./evidence/integration/backend-vitest.txt). `subjectSync.js` ~97% line coverage in backend report.
