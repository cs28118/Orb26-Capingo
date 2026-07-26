# Testing: Flashcards + spaced repetition

**Scope:** PDF decks, editor, SM-2 study (`sm2.ts`, decks API, `flashcard.tsx`)  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Coverage focus |
|--------|------:|----------------|
| `react/app/utils/sm2.ts` | 12 | Defaults, due/new, queue limit, Again/Hard/Good/Easy |

Command: `cd react && npm run test:coverage`  
Evidence: [`evidence/unit/frontend-vitest.txt`](./evidence/unit/frontend-vitest.txt)

## Integration tests

| Case | Status |
|------|--------|
| PUT/GET decks with SRS fields | Automated |
| Non-array decks body → 400 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Study due → flip → rate | Manual |
| Cram all | Manual |
| PDF generate | Manual (AI) |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Legacy cards missing SRS fields | Treated as new/due | Automated (unit) |
| >20 brand-new cards | Queue capped at 20 | Automated (unit) |
| Again | Re-due in ~1 minute; lapses++ | Automated (unit) |
| 0 due in UI | “You’re caught up” | Manual |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Non-PDF / >10MB | Upload error | Manual |
| Save to server fails | Local backup message | Manual |
| Invalid decks payload | 400 | Automated |

## Screenshots

- Unit log: [`evidence/unit/frontend-vitest.txt`](./evidence/unit/frontend-vitest.txt)
- Coverage HTML: `react/coverage/index.html` (generate locally; summary in [`evidence/coverage/`](./evidence/coverage/))

## CI pipeline

Frontend job runs Vitest coverage for `sm2.ts`.

## Code coverage reports

`sm2.ts` targeted at high coverage (~80%+ statements). Open `react/coverage/index.html` after `npm run test:coverage`.
