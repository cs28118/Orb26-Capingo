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
| Page loads with Add task / Generate | Automated |
| Add task with subject → appears on list | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Generate modal shows day/time/break settings | Visible | Automated |
| Duplicate subjects different casing | Deduped case-insensitively | Automated (unit) |
| Empty subject ignored | Not synced | Automated (unit) |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Body without events | 400 | Automated |

## Screenshots

[`evidence/features/timetable/`](./evidence/features/timetable/)  
[`results.txt`](./evidence/features/timetable/results.txt)
