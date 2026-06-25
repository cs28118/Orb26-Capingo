# Capingo

**Capingo** is a student study companion built around a friendly capybara mascot. It brings your planning, learning, and AI help into one place — sign in once, then move between your timetable, chatbot, flashcards, and study partners from a single yellow navigation bar.

Repository: [github.com/cs28118/Orb26-Capingo](https://github.com/cs28118/Orb26-Capingo)

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

### XP Level system

A system that are implemented to **motivate** the users to engage in studying on Capingo.

- Gain XP through daily login streak and completing quest
- Login streak XP claim button and quest list are shown in dashboard
- Everytime you completed a quest, a toast message will pop out to notify you

---

### Achievement system

A system that are implemented to **motivate** the users to engage in studying on Capingo.

- Gain achievement through completing specified actions
- Currently implemented (Welcome! achievement and login streak achievement)

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
- Existing browser chats may migrate to the database on first signed-in load

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
6. **Study mode** — flip cards (click or Space), previous/next, shuffle; finish a deck to claim daily quest XP
7. Decks auto-save to the database; older browser-only decks migrate on first signed-in load

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

---

## Look & feel

- **Yellow navigation bar** with the Capingo logo (capybara with graduation cap)
- Sections: Dashboard, Timetable, Chatbot, Flashcard, Study Partners
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

**Flow:** sign in → **Timetable** (add subjects) → **Chatbot** → **Flashcard** → **Study Partners**

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Backend crashes on startup | Set a valid `MONGODB_URL` in `backend/.env` |
| Login fails or blank page | Check `react/.env` has correct Firebase settings |
| Timetable / decks / chats not saving | Backend running, signed in, `VITE_API_URL=http://localhost:5000` |
| Chatbot error (Ollama) | Ollama running, `mistral` in `ollama list`, use `node index.js` |
| Chatbot error (Gemini) | Set `GEMINI_API_KEY` in `backend/.env`, use `npm run dev` |
| Chatbot slow on long threads | Normal on first summarize pass |
| Flashcard upload fails | Text-based PDF only; max 10 MB |
| Timetable generate does nothing | Add tasks first; set days, hours, break times |
| No study partner suggestions | Tag subjects; need another user with overlap |
| Partner code missing | Visit Dashboard or Study Partners once |
| Logo missing | Hard-refresh: `Ctrl + Shift + R` |

---

## Project structure

```text
Orb26-Capingo/
├── backend/
│   ├── models/       Mongoose schemas
│   ├── routes/       REST API
│   ├── utils/        Subject sync, partner codes
│   ├── index.js      Ollama backend
│   └── indexGemini.js Gemini backend
├── react/            Vite + React website
└── README.md
```

### Backend API

**AI:** `POST /api/chat`, `POST /api/summarize`, `POST /api/flashcards/*`, `GET /api/health`

**Profile:** `GET /api/profile/:uid`, `POST /api/profile/quest-action`, `POST /api/profile/update`

**Data:** `GET|PUT /api/timetable/:uid`, `GET|PUT /api/decks/:uid`, `GET|POST|PUT|DELETE /api/chats/:uid/...`

**Partners:** `GET /api/partners/suggestions/:uid`, `GET /api/partners/:uid`, `POST /api/partners/request`, `POST /api/partners/accept`, `POST /api/partners/decline`, `PUT /api/partners/subjects/:uid`

---

## What's next

- Partner messaging or shared study rooms
- Firebase token verification on API routes
- Dashboard widgets (upcoming tasks, recent chats)
- Spaced repetition for flashcard study

---

## Team

Built by the Orb26 Capingo team.

Questions or bugs? Open an issue on [GitHub](https://github.com/cs28118/Orb26-Capingo).
