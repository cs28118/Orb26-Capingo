# Testing: Chatbot

**Scope:** Capingo AI chats, Mongo persistence, smart memory  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| Progress keyword helper (in index) | 0 | Not extracted; AI path not unit-tested |

## Integration tests

| Case | Status |
|------|--------|
| Create / list / get / update / delete chat | Automated (`chats-profile.test.js`) |
| PUT without messages array → 400 | Automated |
| Missing chat → 404 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| New chat → send → AI reply | Manual (needs Ollama or Gemini) |
| Memory summarize on long thread | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Create with existing chatId | Returns existing | Code path |
| Pin chat on save | `pinned: true` persisted | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Backend/AI down | Error in chat UI | Manual |
| Invalid save body | 400 | Automated |

## Screenshots / CI / coverage

[`evidence/integration/backend-vitest.txt`](./evidence/integration/backend-vitest.txt). `routes/chats.js` ~78% statements in backend coverage.
