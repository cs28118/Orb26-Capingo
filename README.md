# Capingo

**Capingo** is a student study companion built around a friendly capybara mascot. It brings your planning, learning, and AI help into one place — sign in once, then move between your timetable, chatbot, and other tools from a single yellow navigation bar.

Repository: [github.com/cs28118/Orb26-Capingo](https://github.com/cs28118/Orb26-Capingo)

---

## What Capingo does

Capingo is meant to help you **organise study time**, **get answers when you're stuck**, and eventually **revise and collaborate** with classmates. Some areas are fully built; others are placeholders ready for future work.

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
- Each new message sends the **full conversation so far** to the AI so follow-up questions make sense
- The AI itself doesn’t store your history — your browser keeps the log and sends it when needed

**Requirements**

- [Ollama](https://ollama.com) installed and running
- `mistral` (or your chosen model) pulled locally
- Backend server running (see below)

---

### Flashcards

Placeholder for future revision cards. Coming soon.

---

### Collaboration space

Placeholder for shared study with others. Coming soon.

---

## Look & feel

- **Yellow navigation bar** with the Capingo logo (capybara with graduation cap)
- Sections: Dashboard, Timetable, Chatbot, Flashcard, Collaboration
- **Log out** in the top-right when you’re done

---

## Getting started (local)

You’ll run three pieces: **Ollama**, the **backend**, and the **website**.

### 1. Ollama (for Chatbot)

Install Ollama, then in a terminal:

```text
ollama pull mistral
ollama list
```

Keep the Ollama app running while you use the chatbot.

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

**Flow:** sign in → explore **Timetable** or **Chatbot**.

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Login fails or blank page | Check `react/.env` has correct Firebase settings |
| Chatbot error | Ensure Ollama is running and `mistral` is in `ollama list` |
| Timetable generate does nothing | Add tasks first; set days, study hours, and break times in the popup |
| Logo missing | Hard-refresh: `Ctrl + Shift + R` |
| Slow first AI reply | Normal — the model loads into memory the first time |

---

## Project structure (simple)

```text
Orb26-Capingo/
├── backend/     Server that connects the chatbot to Ollama
├── react/         Website (login, timetable, chatbot, etc.)
└── README.md      You are here
```

---

## What's next

Ideas for future Capingo versions:

- Flashcards and collaboration spaces
- Saving chats to the cloud (per user) instead of only in the browser
- Dashboard with upcoming tasks and recent activity
- Clearer feedback when timetable generation can’t fit all tasks

---

## Team

Built by the Orb26 Capingo team.

Questions or bugs? Open an issue on [GitHub](https://github.com/cs28118/Orb26-Capingo).
