# Capingo

**Capingo** is a student study companion built around a friendly capybara mascot. It brings your planning, learning, and AI help into one place — sign in once, then move between your timetable, chatbot, flashcards, and study partners from a single yellow navigation bar.

Repository: [github.com/cs28118/Orb26-Capingo](https://github.com/cs28118/Orb26-Capingo)

[![CI](https://github.com/cs28118/Orb26-Capingo/actions/workflows/ci.yml/badge.svg)](https://github.com/cs28118/Orb26-Capingo/actions/workflows/ci.yml)

---

## What Capingo does

Capingo helps you **organise study time**, **get answers when you're stuck**, **revise** with AI-generated flashcards, and **find study partners** who share your subjects. When you're signed in, your timetable, decks, chats, profile, and partner connections are stored in **MongoDB** so they persist across sessions.

---

## Features

### Sign in & accounts

When you open Capingo, you land on the **login page**.

- **Create an account** with your name, email, and password
- **Sign in** if you already have an account
- **Continue with Google** as a quick alternative
- After login, you stay signed in until you log out
- Your name appears in the top bar (“Hi, …!”)

You need a Firebase project for login and a MongoDB database for saved data (see **Getting started** below).

---

### Dashboard

Your home screen after login.

**Profile card**

- Shows your profile picture, username, level, and current XP progress
- Edit profile: preset pictures, Gmail photo (if signed in with Google), or custom username
- **Partner code** (`CAPY-XXXX`) — copy and share to connect on Study Partners
- Link to **Find study partners →**

**Achievements**

- Preview of unlocked and locked badges
- **View all** opens the full achievements page

**Quest list**

- Daily quests with progress and XP rewards
- Claim login streak XP (20 XP per streak day, capped at 100 XP)
- Quests for flashcard reviews, chat messages, and deck creation

---

### XP & levels

Earn XP for studying on Capingo. Your level, XP bar, and daily progress are stored in **MongoDB** on your profile.

- **Login streak** — claim from the Dashboard quest list (20 XP per streak day, capped at 100 XP)
- **Daily quests** — review flashcards (up to 2/day, 60 XP each), send chat messages (up to 5/day, 50 XP each), create a deck (1/day, 30 XP)
- **Leveling** — fill the XP bar to level up; the threshold increases each level
- Toast notifications confirm XP gains and level-ups

---

### Achievements

Unlock badges for milestones. The Dashboard shows a preview; **View all** opens the full achievements page (`/home/achievements`).

**Currently unlockable**

- **Welcome!** — awarded on first visit
- **3 / 5 / 10 Days Streak** — login streak milestones

**Shown locked (coming soon)**

- Capy Chatter, Master Scheduler, Flashcard master, DIY master — visible in the grid but not yet wired to unlock actions

---

### Timetable

Plan **when** you'll study. Your timetable is **saved to MongoDB** per account.

**To-do list (left side)**

- Add tasks with a title, optional **subject tag**, notes, hours needed, priority (High / Medium / Low), optional deadline
- Choose whether a task can be **split** into smaller blocks
- Edit or remove tasks from the list
- Subject tags appear as badges on tasks and sync to your profile for partner matching

**Weekly grid (main area)**

- See Mon–Sun with hourly slots from 8am–9pm
- Tasks appear as blocks on the grid (with subject badges when set)

**Three ways to fill the timetable**

1. **Add task** — build your to-do list first
2. **Generate timetable** — pick study days, start/end times, and a break window; Capingo schedules tasks by priority
3. **Add to timetable** — place one block manually on a specific day and time

You can click **Details** on a block to edit or delete it.

> **Tip:** Add at least one task before using **Generate timetable**, and fill in all time settings in the popup — otherwise the grid may stay empty.

---

### Chatbot (Capingo AI)

Your **AI study co-pilot**.

- **Local (Ollama):** language model on your computer via [Ollama](https://ollama.com) (default: **mistral**) — run `node index.js`
- **Local / web (Gemini):** [Google AI Studio](https://aistudio.google.com) API key — run `npm run dev` (`indexGemini.js`)

**Layout**

- **Left:** recent conversations and **New chat**
- **Middle:** chat thread, quick follow-up buttons (*Why is this important?*, *Give me an example*, *Quiz me on this*), and a message box
- **Right:** suggested questions to get started

**How it works**

- Ask anything study-related — explanations, summaries, quiz help, study plans
- Replies can use **bold text** and lists for readability
- Chats are **saved in MongoDB** (one document per conversation) so they survive refresh when signed in
- **Smart memory:** long conversations are summarized so the AI gets a short memory note plus only the **most recent messages**
- **New chat** starts with a **fresh memory context** (no carry-over from other threads)
- Existing browser-only chats migrate to MongoDB automatically on first signed-in load (no manual reset needed)

**Requirements**

- Backend server running (see below)
- Ollama: `mistral` pulled locally, or Gemini: `GEMINI_API_KEY` in `backend/.env`

---

### Flashcards

Turn your **PDF notes** into study decks using Ollama or Gemini. Decks are **saved in MongoDB** per account.

**Layout**

- **Left:** deck library — recent decks, **+ New**, pin decks
- **Main:** upload flow, card editor, or study mode

**How it works**

1. Click **+ New** and **upload a PDF** (max 10 MB)
2. Capingo extracts text from the PDF on the server
3. Choose **deck title**, **card count** (5–50), and **difficulty**:
   - **Basic** — key terms and definitions
   - **Standard** — concepts with short examples
   - **Advanced** — exam-style application questions
4. AI generates **front** (question/term) and **back** (answer) cards
5. **Edit** cards — change text, add, or delete before studying
6. **Study due** — spaced repetition (simplified SM-2): study cards that are due, flip, then rate **Again / Hard / Good / Easy**. Intervals grow with good recall; Again brings the card back soon in the same session
7. **Cram all** — optional full-deck review when you want extra practice (still updates scheduling when you rate)
8. Deck list shows **X due**; finish ~10 ratings or clear the due queue to claim daily review quest XP
9. Decks auto-save to the database (including SRS fields); older decks without schedule data are treated as new/due

**Supported PDFs**

- Lecture notes, exported slides, and **Chrome “Save as PDF”** / Print to PDF
- PDF must contain **selectable text** (scanned image-only PDFs will not work)

---

### Study Partners

Find classmates studying the same subjects.

**Your subjects**

- **Synced from timetable** — subject tags on tasks/events update your profile when you save your timetable
- **Manual subjects** — add extra subjects on the Study Partners page
- Toggle **Show me in partner suggestions** to opt in or out

**Finding partners**

- **Suggested partners** — users with overlapping subjects, ranked by match score
- **Add by code** — enter someone's `CAPY-XXXX` partner code
- **Add by UID** — paste a Firebase user ID

**Connections**

- Send a **partner request** → **accept** or **decline**
- Accepted partners show **shared subjects**; remove a partner anytime
- **Message** opens a 1:1 chat in Study Rooms

---

### Study Rooms (Collaboration Space)

Shared spaces for accepted partners — 1:1 messaging and group study rooms. Live chat uses **Socket.IO**; room data is stored in **MongoDB**.

**Layout** (`/home/space`)

- **Left:** Friends (accepted partners) and Study rooms list
- **Main:** chat thread; for group rooms also **Announcements** and **Resources** tabs

**Partner messaging (1:1)**

- Click a friend (or **Message** from Study Partners) to open a direct room
- Only works with **accepted** partners

**Group study rooms**

- **Create** a room with a name → get a shareable `ROOM-XXXXXX` code
- **Join** with a room code
- **Invite** accepted partners; view members; leave room
- Admins can **kick** members, **promote** admins, and post **announcements**
- Anyone in the room can share **resource links** (http/https)

---

## Look & feel

- **Yellow navigation bar** with the Capingo logo (capybara with graduation cap)
- Sections: Dashboard, Timetable, Chatbot, Flashcard, Study Partners, Study Rooms
- **Log out** in the top-right when you're done

---

## Account setup

### Firebase (login)

1. Create a project in the [Firebase console](https://console.firebase.google.com/)
2. Enable **Authentication** → sign-in providers: **Email/Password** and **Google**
3. Register a **Web app** and copy the config keys
4. In the `react/` folder, copy `.env.example` to `.env` and paste your Firebase keys

### MongoDB (saved data)

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user and get your connection string
3. Add it to `backend/.env` as `MONGODB_URL`

The backend **requires** a valid `MONGODB_URL` to start.

### Backend environment

In the `backend/` folder, copy `.env.example` to `.env`:

```env
PORT=5000
MONGODB_URL=mongodb+srv://<username>:<password>@cluster.mongodb.net/capingo?retryWrites=true&w=majority

# Ollama (use with: node index.js)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Gemini (use with: npm run dev)
# GEMINI_API_KEY=your_key_here
# GEMINI_MODEL=gemini-2.5-flash

MAX_PDF_MB=10
```

| Command | File | AI provider |
|---------|------|-------------|
| `node index.js` | Ollama | Local `mistral` |
| `npm run dev` | `indexGemini.js` | Google Gemini |

---

## Getting started (local)

### 1. MongoDB Atlas

Create a cluster, add `MONGODB_URL` to `backend/.env`, and allow your IP in Atlas network access.

### 2. Ollama (optional — for local AI)

```text
ollama pull mistral
ollama list
```

### 3. Backend

```powershell
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and fill in `MONGODB_URL` (and `GEMINI_API_KEY` if using Gemini).

```powershell
node index.js
# or: npm run dev
```

Runs on **http://localhost:5000**

### 4. Frontend

```powershell
cd react
npm install
```

Copy `react/.env.example` to `react/.env` and add your **Firebase** keys.

```powershell
npm run dev
```

Open **http://localhost:5173/**

> Use **localhost**, not `127.0.0.1`, if the page doesn't load.

**Flow:** sign in → **Timetable** (add subjects) → **Study Partners** → **Study Rooms** → **Chatbot** → **Flashcard**

---

## Deployment (Vercel)

The frontend is configured for Vercel via `@vercel/react-router` (`react/react-router.config.ts`).

**Frontend (Vercel)**

1. Connect the repo and set the root directory to `react/`
2. Add environment variables from `react/.env.example` (Firebase keys + **`VITE_API_URL`**)
3. Set `VITE_API_URL` to your **live backend URL** (not `localhost`) — e.g. `https://your-backend.example.com`

**Backend**

The Express API must be deployed separately (Railway, Render, Fly.io, etc.) with `MONGODB_URL` and either Ollama (local) or `GEMINI_API_KEY` (cloud).

Both frontend and backend env vars are required for chatbot, flashcards, timetable, and profile data to work in production.

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Backend crashes on startup | Set a valid `MONGODB_URL` in `backend/.env` |
| Login fails or blank page | Check `react/.env` has correct Firebase settings |
| Timetable / decks / chats not saving | Backend running, signed in, `VITE_API_URL` points to your backend |
| Flashcard or Chatbot **Application Error** on page load | Redeploy the latest frontend build; confirm `VITE_API_URL` is set in Vercel |
| Vercel app loads but features fail | Set `VITE_API_URL` in Vercel to your deployed backend URL (not `localhost:5000`) |
| Chatbot error (Ollama) | Ollama running, `mistral` in `ollama list`, use `node index.js` |
| Chatbot error (Gemini) | Set `GEMINI_API_KEY` in `backend/.env`, use `npm run dev` |
| Chatbot slow on long threads | Normal on first summarize pass |
| Flashcard upload fails | Text-based PDF only; max 10 MB |
| Timetable generate does nothing | Add tasks first; set days, hours, break times |
| No study partner suggestions | Tag subjects; need another user with overlap |
| Partner code missing | Visit Dashboard or Study Partners once |
| Logo missing | Hard-refresh: `Ctrl + Shift + R` |

---

## Testing & continuous integration

Capingo uses **one shared GitHub Actions pipeline** for the whole repo (not one pipeline per feature). Feature-level matrices, edge/failure cases, and screenshots live under [`docs/testing/`](docs/testing/); CI details are in [`docs/ci.md`](docs/ci.md).

### Checklist

| Item | Status |
|------|--------|
| **Unit test coverage** | Frontend: Vitest for SM-2 spaced repetition (`sm2.ts`, 12 tests). Backend: partner/room codes, subject sync, canonical pair (7 tests) |
| **Integration tests** | Backend Vitest + Supertest + in-memory Mongo — rooms, partners, decks (incl. SRS fields), timetable subject sync, profile quests (24 tests total) |
| **End-to-end testing** | Playwright login-page smoke (CI). Fuller journeys (Partners → Rooms, flashcard study, chatbot) documented as manual / local in feature docs |
| **Edge cases** | Documented per feature (e.g. new-card queue limit, DM find-or-create, last admin leave, quest daily cap) |
| **Failure cases** | Documented + automated where possible (403 non-partner DM, 404 bad room/partner code, 400 invalid payloads) |
| **Screenshots of test results** | [`docs/testing/evidence/`](docs/testing/evidence/) — unit/integration logs, [`e2e/login-page.png`](docs/testing/evidence/e2e/login-page.png) |
| **CI pipeline passing** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — frontend typecheck + unit, backend unit + integration, Playwright E2E. Green Actions screenshot: [`docs/testing/evidence/ci/`](docs/testing/evidence/ci/) (add after first push) |
| **Code coverage reports** | `npm run test:coverage` in `react/` and `backend/` → HTML under `*/coverage` (gitignored). Summaries: [`docs/testing/evidence/coverage/`](docs/testing/evidence/coverage/) |

### Run tests locally

```powershell
# Frontend unit + coverage + E2E smoke
cd react
npm run typecheck
npm run test:coverage
npm run test:e2e

# Backend unit + integration + coverage
cd ../backend
npm run test:coverage
```

### Per-feature testing docs

| Feature | Doc |
|---------|-----|
| Sign in & accounts | [docs/testing/auth-accounts.md](docs/testing/auth-accounts.md) |
| Dashboard | [docs/testing/dashboard.md](docs/testing/dashboard.md) |
| XP & levels | [docs/testing/xp-levels.md](docs/testing/xp-levels.md) |
| Achievements | [docs/testing/achievements.md](docs/testing/achievements.md) |
| Timetable | [docs/testing/timetable.md](docs/testing/timetable.md) |
| Chatbot | [docs/testing/chatbot.md](docs/testing/chatbot.md) |
| Flashcards + SRS | [docs/testing/flashcards.md](docs/testing/flashcards.md) |
| Study Partners | [docs/testing/study-partners.md](docs/testing/study-partners.md) |
| Study Rooms | [docs/testing/study-rooms.md](docs/testing/study-rooms.md) |

### CI jobs

| Job | What it runs |
|-----|----------------|
| **Frontend** | `npm ci` → typecheck → Vitest + coverage artifact |
| **Backend** | `npm ci` → Vitest unit/integration + coverage artifact |
| **E2E** | Playwright Chromium smoke (login page; stub Firebase env for mount) |

Badge at the top of this README reflects the latest workflow run on GitHub.

---

## Project structure

```text
Orb26-Capingo/
├── .github/workflows/  CI pipeline
├── docs/               CI + per-feature testing docs
├── backend/
│   ├── models/       Mongoose schemas
│   ├── routes/       REST API
│   ├── utils/        Subject sync, partner codes
│   ├── tests/        Unit + integration tests
│   ├── index.js      Ollama backend + Socket.IO
│   └── indexGemini.js Gemini backend + Socket.IO
├── react/            Vite + React website (+ Vitest / Playwright)
└── README.md
```

### Backend API

**AI:** `POST /api/chat`, `POST /api/summarize`, `POST /api/flashcards/*`, `GET /api/health`

**Profile:** `GET /api/profile/:uid`, `POST /api/profile/claim-streak`, `POST /api/profile/quest-action`, `POST /api/profile/unlock-achievements`, `POST /api/profile/update`

**Data:** `GET|PUT /api/timetable/:uid`, `GET|PUT /api/decks/:uid`, `GET|POST|PUT|DELETE /api/chats/:uid/...`

**Partners:** `GET /api/partners/suggestions/:uid`, `GET /api/partners/:uid`, `POST /api/partners/request`, `POST /api/partners/accept`, `POST /api/partners/decline`, `PUT /api/partners/subjects/:uid`

**Rooms:** `GET /api/rooms/:uid`, `POST /api/rooms/direct`, `POST /api/rooms/group`, `POST /api/rooms/join`, messages / members / announcements / resources under `/api/rooms/:roomId/...` + Socket.IO realtime chat

---

## What's next

- Firebase token verification on API routes
- Dashboard widgets (upcoming tasks, recent chats)
- Wire remaining achievement unlocks (Capy Chatter, Master Scheduler, etc.)

---

## Team

Built by the Orb26 Capingo team.

Questions or bugs? Open an issue on [GitHub](https://github.com/cs28118/Orb26-Capingo).
