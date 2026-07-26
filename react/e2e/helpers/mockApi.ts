import type { Page } from '@playwright/test';

const E2E_UID = 'e2e-tester';

const profile = {
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
  achievements: [{ id: 1 }],
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

/** Mock Capingo REST APIs so signed-in feature pages can render without a live backend. */
export async function installApiMocks(page: Page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path.includes('/api/profile/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profile),
      });
    }

    if (path.includes('/api/profile/claim-streak') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Streak claimed!',
          profile: { ...profile, dailyProgress: { ...profile.dailyProgress, streakClaimed: 1 } },
        }),
      });
    }

    if (path.includes('/api/timetable/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          todos: [{ id: 't1', title: 'Revise Math', subject: 'Math', hoursNeeded: 2, priority: 'High' }],
          events: [],
        }),
      });
    }

    if (path.includes('/api/timetable/') && method === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ todos: [], events: [], syncedSubjects: ['Math'] }),
      });
    }

    if (path.includes('/api/decks/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decks: [
            {
              id: 'deck_e2e',
              title: 'E2E Biology',
              cards: [
                {
                  id: 'c1',
                  front: 'What is a cell?',
                  back: 'Basic unit of life',
                  createdAt: Date.now(),
                  dueAt: 0,
                  ease: 2.5,
                  interval: 0,
                  repetitions: 0,
                },
              ],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }),
      });
    }

    if (path.includes('/api/decks/') && method === 'PUT') {
      const body = req.postDataJSON?.() || { decks: [] };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    }

    if (path.includes('/api/partners/suggestions/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [
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

    if (path.match(/\/api\/partners\/[^/]+$/) && method === 'GET' && !path.includes('suggestions') && !path.includes('code') && !path.includes('subjects')) {
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

    if (path.includes('/api/partners/subjects/') && method === 'PUT') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ manualSubjects: ['Math'], openToPartners: true }),
      });
    }

    if (path.includes('/api/rooms/') && method === 'GET' && path.split('/').length <= 5) {
      // GET /api/rooms/:uid
      if (!path.includes('/messages') && !path.includes('/members') && !path.includes('/announcements') && !path.includes('/resources')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            rooms: [
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
            ],
          }),
        });
      }
    }

    if (path.includes('/api/chats/') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          chats: [{ id: 'chat_e2e', title: 'E2E chat', pinned: false, updatedAt: Date.now(), messageCount: 0 }],
        }),
      });
    }

    if (path.includes('/api/chats/') && method === 'POST') {
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

    // Default OK stub for other profile/quest calls
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, profile }),
    });
  });
}
