# Testing: Study Partners

**Scope:** Suggestions, CAPY codes, request/accept/decline (`partners` API, `collaboration.tsx`)  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Status |
|--------|------:|--------|
| `generatePartnerCode` | 1 | Automated |
| `canonicalPair` | 1 | Automated |
| `jaccardScore` / subject intersect | 2 | Automated |

## Integration tests

| Case | Status |
|------|--------|
| Lookup code (case-insensitive) | Automated |
| Self-request → 400 | Automated |
| Request → accept → appears in accepted list | Automated |
| Suggestions ranked by overlap | Automated |
| Unknown code → 404 | Automated |
| Duplicate pending request → 409 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Subjects + suggestions list render | Automated |
| Message → `/home/space` DM | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Shared subjects case-insensitive | Match | Automated |
| No overlapping subjects / empty list | “No suggestions yet” | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Request to self | 400 | Automated |
| Unknown CAPY code | 404 | Automated |
| Duplicate pending request | 409 | Automated |

## Screenshots

[`evidence/features/study-partners/`](./evidence/features/study-partners/)  
[`results.txt`](./evidence/features/study-partners/results.txt)
