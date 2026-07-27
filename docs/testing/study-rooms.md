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
| Promote member | Automated |
| Kick member (admin) | Automated |
| Non-admin kick → 403 | Automated |
| Announcement admin-only | Automated |
| Resource http(s) only; member can add | Automated |

## End-to-end testing

| Journey | Status |
|---------|--------|
| Friends + rooms list render | Automated |
| Create room UI | Automated |
| Announcements (Dashboard) tab | Automated |

## Edge cases

| Case | Expected | Status |
|------|----------|--------|
| Already member join | `alreadyMember: true` | Automated |
| Open DM twice | Same `roomId` | Automated |
| Last admin leaves | Another member becomes admin | Automated |

## Failure cases

| Failure | Expected | Status |
|---------|----------|--------|
| Bad join code | `.space-error` in UI | Automated |
| DM non-partner | 403 | Automated |
| Invite non-partner | 403 | Automated |
| Live Socket.IO two-client chat | Manual (out of CI) | Documented |

## Screenshots

[`evidence/features/study-rooms/`](./evidence/features/study-rooms/)  
[`results.txt`](./evidence/features/study-rooms/results.txt)

## Notes

Realtime chat membership is enforced in `chatSocket.js`. Full multi-tab socket E2E stays local until Firebase test users are available.
