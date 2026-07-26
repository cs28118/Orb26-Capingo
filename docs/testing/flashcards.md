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
| Deck library with due deck | Automated |
| Study due → flip → Good | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Legacy cards missing SRS fields | Treated as new/due | Automated (unit) |
| >20 brand-new cards | Queue capped at 20 | Automated (unit) |
| Again | Re-due in ~1 minute; lapses++ | Automated (unit) |
| 0 due in UI | “You’re caught up” + Cram all | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Save to server fails | Local backup message in UI | Automated |
| Invalid decks payload | 400 | Automated |
| Non-PDF / >10MB | Upload error | Manual |

## Screenshots

[`evidence/features/flashcards/`](./evidence/features/flashcards/)  
[`results.txt`](./evidence/features/flashcards/results.txt)
