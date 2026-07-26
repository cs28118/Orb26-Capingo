import type { Page } from '@playwright/test';

const E2E_UID = 'e2e-tester';

export type MockMode = {
  /** Profile GET fails (dashboard failure) */
  profileDown?: boolean;
  /** Empty due cards → caught-up study UI */
  flashcardsCaughtUp?: boolean;
  /** Deck save fails */
  decksSaveFail?: boolean;
  /** No partner suggestions */
  emptySuggestions?: boolean;
  /** Chat AI endpoint fails */
  chatAiDown?: boolean;
  /** Chat list empty */
  emptyChats?: boolean;
  /** Join room fails with 404 */
  badJoinCode?: boolean;
  /** Rooms list empty */
  emptyRooms?: boolean;
};

const baseProfile = {
  firebaseUid: E2E_UID,
  username: 'E2E Tester',
  email: 'e2e@capingo.test',
  level: 2,
  currentXp: 40,
  xpToNextLevel: 150,
  profilePic: '/assets/profile-placeholder.png',
  streakDays: 3,
  partnerCode: 'CAPY-E2E1',
  subjects: ['Math'],
  manualSubjects: [],
  openToPartners: true,
  achievements: [{ id: 1 }, { id: 3 }, { id: 16 }],
  helloCapy: true,
  // level 2 already unlocks One small step
  quests: [
    { id: 1, action: 'Login Streak', reward: 10 },
    { id: 2, action: 'Review Flashcards (0/2)', reward: 60 },
  ],
  dailyProgress: {
    streakClaimed: 0,
    decksReviewed: 0,
    chatMessages: 0,
    decksCreated: 0,
  },
};

const dueCard = {
  id: 'c1',
  front: 'What is a cell?',
  back: 'Basic unit of life',
  createdAt: Date.now(),
  dueAt: 0,
  ease: 2.5,
  interval: 0,
  repetitions: 0,
};

const futureCard = {
  ...dueCard,
  id: 'c2',
  front: 'Not due yet',
  back: 'Later',
  dueAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  repetitions: 1,
  interval: 1,
};

/** Mock Capingo REST APIs so signed-in feature pages can render without a live backend. */
export async function installApiMocks(page: Page, mode: MockMode = {}) {
  let rooms = mode.emptyRooms
    ? []
    : [
        {
          roomId: 'room1',
          roomCode: 'ROOM-E2E001',
          type: 'group',
          name: 'E2E Study Hall',
          avatar: null,
          memberCount: 2,
          isAdmin: true,
          lastMessage: null,
          updatedAt: new Date().toISOString(),
        },
      ];

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathName = url.pathname;
    const method = req.method();

    if (pathName.includes('/api/profile/') && method === 'GET') {
      if (mode.profileDown) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Backend unavailable' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(baseProfile),
      });
    }

    if (pathName.includes('/api/profile/claim-streak') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: '+60 XP for Day 3 Streak!',
          leveledUp: false,
          profile: {
            ...baseProfile,
            currentXp: 100,
            dailyProgress: { ...baseProfile.dailyProgress, streakClaimed: 1 },
          },
        }),
      });
    }

    if (pathName.includes('/api/timetable/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          todos: [
            {
              id: 't1',
              title: 'Revise Math',
              subject: 'Math',
              hoursNeeded: 2,
              priority: 'High',
            },
          ],
          events: [],
        }),
      });
    }

    if (pathName.includes('/api/timetable/') && method === 'PUT') {
      const body = req.postDataJSON?.() || { todos: [], events: [] };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...body, syncedSubjects: ['Math'] }),
      });
    }

    if (pathName.includes('/api/decks/') && method === 'GET') {
      const cards = mode.flashcardsCaughtUp ? [futureCard] : [dueCard];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [
            {
              id: 'deck_e2e',
              title: 'E2E Biology',
              cards,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }),
      });
    }

    if (pathName.includes('/api/decks/') && method === 'PUT') {
      if (mode.decksSaveFail) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Save failed' }),
        });
      }
      const body = req.postDataJSON?.() || { decks: [] };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    }

    if (pathName.includes('/api/partners/suggestions/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: mode.emptySuggestions
            ? []
            : [
                {
                  uid: 'partner1',
                  username: 'StudyBuddy',
                  profilePic: '/assets/profile-placeholder.png',
                  sharedSubjects: ['Math'],
                  matchScore: 50,
                },
              ],
        }),
      });
    }

    if (
      pathName.match(/\/api\/partners\/[^/]+$/) &&
      method === 'GET' &&
      !pathName.includes('suggestions') &&
      !pathName.includes('code') &&
      !pathName.includes('subjects')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accepted: [
            {
              uid: 'partner1',
              username: 'StudyBuddy',
              profilePic: '/assets/profile-placeholder.png',
              sharedSubjects: ['Math'],
            },
          ],
          incoming: [],
          outgoing: [],
        }),
      });
    }

    if (pathName.includes('/api/partners/subjects/') && method === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ manualSubjects: ['Math'], openToPartners: true }),
      });
    }

    if (pathName.includes('/api/rooms/group') && method === 'POST') {
      const body = req.postDataJSON?.() || {};
      const created = {
        roomId: 'room_new',
        roomCode: 'ROOM-NEW01',
        name: body.name || 'New room',
      };
      rooms = [
        {
          roomId: created.roomId,
          roomCode: created.roomCode,
          type: 'group',
          name: created.name,
          avatar: null,
          memberCount: 1,
          isAdmin: true,
          lastMessage: null,
          updatedAt: new Date().toISOString(),
        },
        ...rooms,
      ];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    }

    if (pathName.includes('/api/rooms/join') && method === 'POST') {
      if (mode.badJoinCode) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Room not found' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roomId: 'room1', alreadyMember: false }),
      });
    }

    if (pathName.includes('/api/rooms/') && pathName.includes('/dm') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ roomId: 'dm1', name: 'StudyBuddy' }),
      });
    }

    if (
      pathName.includes('/api/rooms/') &&
      method === 'GET' &&
      !pathName.includes('/messages') &&
      !pathName.includes('/members') &&
      !pathName.includes('/announcements') &&
      !pathName.includes('/resources')
    ) {
      const parts = pathName.split('/').filter(Boolean);
      // GET /api/rooms/:uid
      if (parts.length === 3) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ rooms }),
        });
      }
    }

    if (pathName.includes('/announcements') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ announcements: [] }),
      });
    }

    if (pathName.includes('/resources') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ resources: [] }),
      });
    }

    if (pathName.includes('/members') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          members: [
            { uid: E2E_UID, username: 'E2E Tester', role: 'admin' },
            { uid: 'partner1', username: 'StudyBuddy', role: 'member' },
          ],
        }),
      });
    }

    if (pathName.includes('/messages') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    }

    if (pathName.includes('/api/chat') && !pathName.includes('/chats') && method === 'POST') {
      if (mode.chatAiDown) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'AI service unavailable' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'Hello from Capingo AI (E2E mock).' }),
      });
    }

    if (pathName.includes('/api/chats/') && method === 'GET') {
      const parts = pathName.split('/').filter(Boolean);
      if (parts.length >= 4) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: parts[3],
            title: 'E2E chat',
            pinned: false,
            messages: [],
            updatedAt: Date.now(),
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          chats: mode.emptyChats
            ? []
            : [{ id: 'chat_e2e', title: 'E2E chat', pinned: false, updatedAt: Date.now(), messageCount: 0 }],
        }),
      });
    }

    if (pathName.includes('/api/chats/') && method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'chat_e2e',
          title: 'New chat',
          pinned: false,
          messages: [],
          updatedAt: Date.now(),
        }),
      });
    }

    if (pathName.includes('/api/chats/') && method === 'PUT') {
      const body = req.postDataJSON?.() || {};
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...body, id: 'chat_e2e', updatedAt: Date.now() }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, profile: baseProfile }),
    });
  });
}
