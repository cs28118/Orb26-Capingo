# Testing: Study Rooms

**Scope:** Direct DMs, group rooms, join codes, invite/kick/leave, Socket.IO chat  
**CI:** [`docs/ci.md`](../ci.md)

## Unit test coverage

| Module | Tests | Status |
|--------|------:|--------|
| `generateRoomCode` | 1 | Automated (`ROOM-XXXXXX`) |

## Integration tests

| Case | Status |
|------|--------|
| Create group + join by code | Automated |
| Join when already member | Automated |
| Unknown code → 404 | Automated |
| DM requires accepted partnership (403) | Automated |
| DM find-or-create same room | Automated |
| DM with self → 400 | Automated |
| Invite accepted partner | Automated |
| Invite non-partner → 403 | Automated |
| Last admin leave → promote remaining member | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Create room UI → see code | Manual |
| Live Socket.IO message | Manual (needs two clients) |
| Announcements / resources tabs | Manual |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Already member join | `alreadyMember: true` | Automated |
| Open DM twice | Same `roomId` | Automated |
| Last admin leaves | Another member becomes admin | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| DM non-partner | 403 | Automated |
| Bad join code | 404 | Automated |
| Invite non-partner | 403 | Automated |
| Empty chat message | Socket/API reject | Manual / code review |

## Screenshots / CI / coverage

[`evidence/integration/backend-vitest.txt`](./evidence/integration/backend-vitest.txt). Rooms routes partially covered; socket handlers not in HTTP suite.

## Notes

Realtime chat membership is enforced in `chatSocket.js` (uid + room member check). Full multi-tab socket E2E is out of CI scope until Firebase test users are available.
