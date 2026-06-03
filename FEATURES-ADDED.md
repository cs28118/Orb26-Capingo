# Features Added After GitHub Pull

This document describes **only what was added locally** on top of the original [cs28118/Orb26-Capingo](https://github.com/cs28118/Orb26-Capingo) repository. Existing features from GitHub (login, timetable, dashboard/flashcard/collaboration placeholders, etc.) are not listed here.

---

## 1. Capybara Chatbot UI

**Route:** `/home/chatbot`

Replaced the placeholder *“Capybara Chatbot here!”* with a full chat interface matching the Capingo mockups:

| Area | What it does |
|------|----------------|
| **Left sidebar** | Recent chats, **New chat**, pin icon, “Need help with anything?” CTA |
| **Center** | Empty state (“Ask Capingo AI anything”), message thread, follow-up chips, text input + send |
| **Right sidebar** | Capingo AI profile card and **Try Asking** suggestion buttons |

**Client behaviour**

- Chat threads and messages stored in **localStorage** (`capingo-chats`)
- One-time memory reset marker (`capingo-memory-reset-v2`) to wipe old chats after a fresh restart
- Follow-up chips: *Why is this important?*, *Give me an example*, *Quiz me on this*
- Basic markdown rendering in AI replies (**bold**, lists)

**Files:** `react/app/routes/chatbot.tsx`, `react/app/routes/chatbot.css`

---

## 2. Ollama AI Backend

**Endpoint:** `POST /api/chat`  
**Health check:** `GET /api/health`

The Express backend proxies chat requests to a **local Ollama** instance (default model: `mistral`).

- System prompt: Capingo AI study co-pilot (capybara persona)
- Sends full conversation history per request
- Returns `{ reply: string }`
- Clear errors if Ollama is offline or the model name is wrong

**Config** (`backend/.env` / `backend/.env.example`):

```env
PORT=5000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

**Files:** `backend/index.js`, `backend/.env.example`, `backend/.gitignore`

---

## 3. App Shell & Branding

Updates to the logged-in layout and login screen:

- **Yellow top navigation** (`#F6D96A`) instead of white
- **Capingo logo** (`react/public/capingo-logo.png`) in nav, login, chatbot sidebar, and favicon
- Nav label shortened to **Chatbot** (was “Capybara Chatbot”)
- Nav order aligned with mockups: Dashboard → Timetable → Chatbot → Flashcard → Collaboration
- **Full-height chatbot layout** (no padding on `/home/chatbot`)

**Files:** `react/app/routes/home.tsx`, `react/app/routes/home.css`, `react/app/loginAuth/login.tsx`, `react/app/loginAuth/login.css`, `react/app/root.tsx`, `react/index.html`

---

## 4. Local Development Setup

**Vite proxy** — frontend calls `/api/*` → `http://localhost:5000` in dev:

```ts
// react/vite.config.ts
server: { proxy: { '/api': 'http://localhost:5000' } }
```

**Environment examples**

- `react/.env.example` — Firebase keys + optional `VITE_API_URL`
- `backend/.env.example` — Ollama settings

**Backend entry point** — added `backend/index.js` (repo originally had only `index.js.txt`).

---

## 5. How to Run the New Features

```powershell
# Terminal 1 — ensure Ollama is running with mistral pulled
ollama list

# Terminal 2 — backend
cd backend
npm install
npm run dev

# Terminal 3 — frontend
cd react
npm install
# copy .env.example → .env and add Firebase keys
npm run dev
```

Open **http://localhost:5173/** → log in → **Chatbot**.

---

## Not Changed (from GitHub)

These were already in the repo and were **not** part of this local work:

- Timetable page (`/home/timetable`) — task list, manual events, auto-generate modal
- Firebase authentication (login / register / Google sign-in)
- Dashboard, Flashcards, and Collaboration placeholders
- Core React Router + Vite project structure
