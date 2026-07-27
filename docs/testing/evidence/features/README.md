# Per-feature test evidence

Each feature folder contains:

- **`results.txt`** — detailed write-up of unit tests, integration tests, E2E journeys, **edge cases**, **failure cases**, and what every screenshot means
- **`e2e-*.png`** — happy-path UI evidence
- **`edge-*.png`** — edge-case UI evidence
- **`failure-*.png`** — failure-case UI evidence

**All-features results board:** [results-board.png](./results-board.png)

| Feature | Path |
|---------|------|
| Sign in & accounts | [auth-accounts/results.txt](./auth-accounts/results.txt) |
| Dashboard | [dashboard/results.txt](./dashboard/results.txt) |
| XP & levels | [xp-levels/results.txt](./xp-levels/results.txt) |
| Achievements | [achievements/results.txt](./achievements/results.txt) |
| Timetable | [timetable/results.txt](./timetable/results.txt) |
| Chatbot | [chatbot/results.txt](./chatbot/results.txt) |
| Flashcards | [flashcards/results.txt](./flashcards/results.txt) |
| Study Partners | [study-partners/results.txt](./study-partners/results.txt) |
| Study Rooms | [study-rooms/results.txt](./study-rooms/results.txt) |

`node scripts/write-feature-evidence.mjs` refreshes the results board screenshot only — it does **not** overwrite these `results.txt` files.
