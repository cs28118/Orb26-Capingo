# Testing: Chatbot

**Scope:** Capingo AI chats, Mongo persistence, smart memory  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Notes |
|--------|------:|-------|
| Progress keyword helper (in index) | 0 | Not extracted; Tier C |

## Integration tests

| Case | Status |
|------|--------|
| Chat CRUD Mongo routes | Not yet automated (AI-dependent send path) |

## End-to-end testing

| Journey | Status |
|---------|--------|
| New chat → send → reply | Manual (needs Ollama or Gemini) |
| Memory summarize on long thread | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| New chat fresh memory | No cross-thread carry-over | Manual |
| LocalStorage → Mongo migration | On first signed-in load | Manual |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Backend/AI down | Error in chat UI | Manual |
| Missing GEMINI_API_KEY | Backend error | Manual |

## Screenshots / CI / coverage

No automated chatbot suite yet. CI does not call AI APIs. Documented for report honesty.
