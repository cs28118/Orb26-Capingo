# Capingo

**Capingo** is a student study companion built around a friendly capybara mascot. It brings your planning, learning, and AI help into one place — sign in once, then move between your timetable, chatbot, and other tools from a single yellow navigation bar.

Repository: [github.com/cs28118/Orb26-Capingo](https://github.com/cs28118/Orb26-Capingo)

---

## What Capingo does

Capingo is meant to help you **organise study time**, **get answers when you're stuck**, and **revise** with AI-generated flashcards. Collaboration features are planned for later.

---

## Features

### Sign in & accounts

When you open Capingo, you land on the **login page**.

- **Create an account** with your name, email, and password
- **Sign in** if you already have an account
- **Continue with Google** as a quick alternative
- After login, you stay signed in until you log out
- Your name appears in the top bar (“Hi, …!”)

You need a Firebase project set up for login to work locally (see **Getting started** below).

---

### Dashboard

Your home screen after login. Right now it’s a simple landing page — a starting point for future widgets like upcoming tasks or recent chats.

---

### Timetable

Plan **when** you’ll study.

**To-do list (left side)**

- Add tasks with a title, notes, hours needed, priority (High / Medium / Low), optional deadline
- Choose whether a task can be **split** into smaller blocks
- Edit or remove tasks from the list

**Weekly grid (main area)**

- See Mon–Sun with hourly slots from 8am–9pm
- Tasks appear as blocks on the grid

**Three ways to fill the timetable**

1. **Add task** — build your to-do list first
2. **Generate timetable** — pick study days, start/end times, and a break window; Capingo schedules tasks by priority
3. **Add to timetable** — place one block manually on a specific day and time

You can click **Details** on a block to edit or delete it.

> **Tip:** Add at least one task before using **Generate timetable**, and fill in all time settings in the popup — otherwise the grid may stay empty.

---

### Chatbot (Capingo AI)

Your **AI study co-pilot**, powered by a language model on your computer via **Ollama** (default model: **mistral**).

**Layout**

- **Left:** recent conversations and **New chat**
- **Middle:** chat thread, quick follow-up buttons (*Why is this important?*, *Give me an example*, *Quiz me on this*), and a message box
- **Right:** suggested questions to get started

**How it works**

- Ask anything study-related — explanations, summaries, quiz help, study plans
- Replies can use **bold text** and lists for readability
- Your chats are **saved in the browser** so they survive a refresh
- **Smart memory:** long conversations are **summarized in the browser** so the AI gets a short memory note plus only the **most recent messages** — not the entire chat log every time. This keeps replies fast and context-aware without overloading the model
- **New chat** starts with a **fresh memory context** (no carry-over from other threads)
- The AI itself doesn’t store your history — your browser keeps the full log for display and manages what gets sent to the model

**Requirements**

- [Ollama](https://ollama.com) installed and running
- `mistral` (or your chosen model) pulled locally
- Backend server running (see below)

---

### Flashcards

Turn your **PDF notes** into study decks using Ollama (same local setup as the chatbot).

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
4. Ollama generates **front** (question/term) and **back** (answer) cards
5. **Edit** cards — change text, add, or delete before studying
6. **Study mode** — flip cards (click or Space), previous/next, shuffle
7. Decks are **saved in your browser** (`localStorage`) — they persist across refresh

**Supported PDFs**

- Lecture notes, exported slides, and **Chrome “Save as PDF”** / Print to PDF
- PDF must contain **selectable text** (scanned image-only PDFs will not work)

**Requirements**

- Ollama running with `mistral` (or your configured model)
- Backend server running (see below)

---

### Collaboration space

Placeholder for shared study with others. Coming soon.

---

## Look & feel

- **Yellow navigation bar** with the Capingo logo (capybara with graduation cap)
- Sections: Dashboard, Timetable, Chatbot, Flashcard, Collaboration
- **Log out** in the top-right when you’re done

---

## Account setup

Capingo needs a **Firebase** project for login. The chatbot and flashcards use **Ollama on your machine** (not a cloud AI API key).

### Firebase (login)

1. Create a project in the [Firebase console](https://console.firebase.google.com/)
2. Enable **Authentication** → sign-in providers: **Email/Password** and **Google**
3. Register a **Web app** and copy the config keys
4. In the `react/` folder, copy `.env.example` to `.env` and paste your Firebase keys

### Backend (chatbot + flashcards)

In the `backend/` folder, copy `.env.example` to `.env`:

```env
PORT=5000
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
MAX_PDF_MB=10
```

Defaults work for local Ollama (`mistral` on port `11434`).

## Getting started (local)

You’ll run three pieces: **Ollama**, the **backend**, and the **website**.

### 1. Ollama (for Chatbot & Flashcards)

Install Ollama, then in a terminal:

```text
ollama pull mistral
ollama list
```

Keep the Ollama app running while you use the chatbot or flashcards.

### 2. Backend

```powershell
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` (defaults are fine for local Ollama).

```powershell
npm run dev
```

Runs on **http://localhost:5000**

### 3. Frontend (website)

```powershell
cd react
npm install
```

Copy `react/.env.example` to `react/.env` and add your **Firebase** keys from the Firebase console.

```powershell
npm run dev
```

Open **http://localhost:5173/** in your browser.

> Use **localhost**, not `127.0.0.1`, if the page doesn’t load.

**Flow:** sign in → explore **Timetable**, **Chatbot**, or **Flashcard**.

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Login fails or blank page | Check `react/.env` has correct Firebase settings |
| Chatbot error | Ensure Ollama is running and `mistral` is in `ollama list` |
| Chatbot slow on long threads | Normal on first summarize pass; later messages use cached summary + recent window |
| Flashcard upload fails | Use a text-based PDF (not scanned images); max 10 MB |
| Flashcard “no selectable text” | PDF is image-only — export from Word/Slides or use OCR first |
| Flashcard generation slow | Normal for long notes — Ollama may take 30–90 seconds |
| Timetable generate does nothing | Add tasks first; set days, study hours, and break times in the popup |
| Logo missing | Hard-refresh: `Ctrl + Shift + R` |
| Slow first AI reply | Normal — the model loads into memory the first time |

---

## Project structure (simple)

```text
Orb26-Capingo/
├── backend/     API server (Ollama chat, summarize, flashcard PDF + generate)
├── react/       Website (login, timetable, chatbot, flashcards, etc.)
└── README.md    You are here
```

**Backend API**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/chat` | Send recent messages + optional memory summary; get AI reply |
| `POST` | `/api/summarize` | Compress older chat messages into a short memory note |
| `POST` | `/api/flashcards/parse-pdf` | Parse PDF — JSON `{ pdfBase64, fileName }` or multipart `file` |
| `POST` | `/api/flashcards/generate` | Generate flashcards from extracted text via Ollama |
| `GET` | `/api/health` | Check Ollama connectivity |

---

## What's next

Ideas for future Capingo versions:

- Collaboration spaces for shared study
- Syncing chats and flashcard decks to the cloud per logged-in user (today: browser-only storage)
- Dashboard with upcoming tasks and recent activity
- Clearer feedback when timetable generation can’t fit all tasks
- Spaced repetition for flashcard study

---

## Team

Built by the Orb26 Capingo team.

Questions or bugs? Open an issue on [GitHub](https://github.com/cs28118/Orb26-Capingo).
