# Testing: Chatbot

**Scope:** Capingo AI chats, Mongo persistence, smart memory  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| Progress keyword helper (in index) | 0 | Not extracted; AI path mocked in E2E |

## Integration tests

| Case | Status |
|------|--------|
| Create / list / get / update / delete chat | Automated (`chats-profile.test.js`) |
| PUT without messages array → 400 | Automated |
| Missing chat → 404 | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Capingo AI shell renders | Automated |
| Send message → mocked AI reply | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Create with existing chatId | Returns existing | Code path |
| Pin chat on save | `pinned: true` persisted | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| AI service down | `.chat-error-banner` | Automated |
| Invalid save body | 400 | Automated |

## Screenshots

[`evidence/features/chatbot/`](./evidence/features/chatbot/)  
[`results.txt`](./evidence/features/chatbot/results.txt)
