import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTestApp } = require('../helpers/testApp.js');
const { clearDatabase, connectMemoryMongo, disconnectMemoryMongo } = require('../helpers/mongo.js');
const UserProfile = require('../../models/userProfile.js');
const Timetable = require('../../models/timetable.js');
const FlashcardDecks = require('../../models/flashcardDeck.js');
const {
  getRecommendations,
  accountAgeDays,
  needsOnboarding,
} = require('../../utils/recommendationEngine.js');

const app = createTestApp();

beforeAll(async () => {
  await connectMemoryMongo();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearDatabase();
});

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe('recommendationEngine helpers', () => {
  it('computes account age from createdAt', () => {
    const profile = { createdAt: daysAgo(5) };
    expect(accountAgeDays(profile)).toBeGreaterThanOrEqual(4.9);
    expect(accountAgeDays(profile)).toBeLessThan(6);
  });

  it('needsOnboarding when young or empty data', () => {
    expect(
      needsOnboarding({
        accountAgeDays: 1,
        todos: [],
        events: [],
        decks: [],
        profile: {},
      })
    ).toBe(true);
    expect(
      needsOnboarding({
        accountAgeDays: 10,
        todos: [],
        events: [],
        decks: [],
        profile: {},
      })
    ).toBe(true);
    expect(
      needsOnboarding({
        accountAgeDays: 10,
        todos: [{ id: '1' }],
        events: [],
        decks: [{ id: 'd1' }],
        profile: {},
      })
    ).toBe(false);
  });
});

describe('GET /api/dashboard/recommendations/:uid', () => {
  it('returns onboarding mode for a brand-new empty profile', async () => {
    await UserProfile.create({
      firebaseUid: 'newbie',
      username: 'Newbie',
      createdAt: new Date(),
    });

    const res = await request(app).get('/api/dashboard/recommendations/newbie');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('onboarding');
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations[0]).toHaveProperty('cta.link');
  });

  it('returns subject_gap when a subject is scheduled often without a deck', async () => {
    await UserProfile.create({
      firebaseUid: 'u1',
      username: 'U1',
      createdAt: daysAgo(10),
      masterScheduler: true,
      deckBuilder: true,
      autoAllocating: true,
      instantiatedIndentity: true,
      helloCapy: true,
    });
    await Timetable.create({
      firebaseUid: 'u1',
      todos: [
        { id: 't1', index: 1, title: 'A', hoursNeeded: 1, subject: 'Chemistry', priority: 'High' },
        { id: 't2', index: 2, title: 'B', hoursNeeded: 1, subject: 'Chemistry', priority: 'High' },
        { id: 't3', index: 3, title: 'C', hoursNeeded: 1, subject: 'Chemistry', priority: 'Medium' },
      ],
      events: [],
    });
    await FlashcardDecks.create({ firebaseUid: 'u1', decks: [] });

    const result = await getRecommendations('u1', 5);
    expect(result.mode).toBe('adaptive');
    expect(result.recommendations.some((r) => r.id === 'subject_gap')).toBe(true);
  });

  it('returns stale_deck for an untouched old deck', async () => {
    const created = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await UserProfile.create({
      firebaseUid: 'u2',
      username: 'U2',
      createdAt: daysAgo(10),
      masterScheduler: true,
      deckBuilder: true,
      autoAllocating: true,
      instantiatedIndentity: true,
      helloCapy: true,
    });
    await Timetable.create({
      firebaseUid: 'u2',
      todos: [{ id: 't1', index: 1, title: 'Task', hoursNeeded: 1, subject: 'Math', priority: 'Low' }],
      events: [],
    });
    await FlashcardDecks.create({
      firebaseUid: 'u2',
      decks: [
        {
          id: 'deck_old',
          title: 'Dusty Bio',
          cards: [{ id: 'c1', front: 'Q', back: 'A', createdAt: created, repetitions: 0 }],
          createdAt: created,
          updatedAt: created,
        },
      ],
    });

    const result = await getRecommendations('u2', 5);
    expect(result.recommendations.some((r) => r.id === 'stale_deck')).toBe(true);
  });
});

describe('POST /api/dashboard/recommendations/dismiss', () => {
  it('stores same-day dismissal and hides the tip', async () => {
    await UserProfile.create({
      firebaseUid: 'u3',
      username: 'U3',
      createdAt: new Date(),
    });

    const before = await request(app).get('/api/dashboard/recommendations/u3');
    expect(before.body.recommendations.length).toBeGreaterThan(0);
    const firstId = before.body.recommendations[0].id;

    const dismiss = await request(app)
      .post('/api/dashboard/recommendations/dismiss')
      .send({ uid: 'u3', recommendationId: firstId });
    expect(dismiss.status).toBe(200);

    const after = await request(app).get('/api/dashboard/recommendations/u3');
    expect(after.body.recommendations.every((r) => r.id !== firstId)).toBe(true);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/dashboard/recommendations/dismiss').send({});
    expect(res.status).toBe(400);
  });
});

describe('quest XP boost + chat nudge consumers', () => {
  const {
    getQuestXpBoost,
    getChatNudge,
    applyQuestXpBoost,
    getPersonalizedQuestRewards,
  } = require('../../utils/recommendationEngine.js');

  it('applyQuestXpBoost multiplies and rounds', () => {
    expect(applyQuestXpBoost(60, { multiplier: 1.25 }).xp).toBe(75);
    expect(applyQuestXpBoost(50, { multiplier: 1 }).xp).toBe(50);
  });

  it('boosts createDeck XP when that action is most neglected', async () => {
    await UserProfile.create({
      firebaseUid: 'boost1',
      username: 'Boost',
      createdAt: daysAgo(10),
      questActionCounts: {
        reviewDeck: 20,
        chatMessage: 40,
        createDeck: 0,
        loginStreak: 15,
      },
    });

    const boost = await getQuestXpBoost('boost1', 'createDeck');
    expect(boost.multiplier).toBeGreaterThan(1);
    expect(boost.neglectedAction).toBe('createDeck');

    const rewards = getPersonalizedQuestRewards({
      questActionCounts: {
        reviewDeck: 20,
        chatMessage: 40,
        createDeck: 0,
        loginStreak: 15,
      },
    });
    expect(rewards.createDeck.boosted).toBe(true);
    expect(rewards.createDeck.xp).toBe(38);

    const res = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'boost1', actionType: 'createDeck' });
    expect(res.status).toBe(200);
    expect(res.body.xpBoost).toBeTruthy();
    expect(res.body.xpBoost.multiplier).toBe(1.25);
    expect(res.body.message).toMatch(/neglected-quest bonus/);
    expect(res.body.message).toMatch(/\+38 XP/);
  });

  it('getChatNudge returns a collaborative openingMessage above priority threshold', async () => {
    await UserProfile.create({
      firebaseUid: 'nudge1',
      username: 'Nudge',
      createdAt: new Date(),
    });
    const nudge = await getChatNudge('nudge1', { claim: false });
    expect(nudge.recommendation).toBeTruthy();
    expect((nudge.recommendation.priority || 0) >= 70).toBe(true);
    expect(nudge.openingMessage).toMatch(/Hey — quick thought/);
  });

  it('GET chat-nudge claims once per day', async () => {
    await UserProfile.create({
      firebaseUid: 'nudge2',
      username: 'Nudge2',
      createdAt: new Date(),
    });
    const first = await request(app).get(
      '/api/dashboard/recommendations/nudge2/chat-nudge?claim=1'
    );
    expect(first.status).toBe(200);
    expect(first.body.openingMessage).toBeTruthy();

    const second = await request(app).get(
      '/api/dashboard/recommendations/nudge2/chat-nudge?claim=1'
    );
    expect(second.body.openingMessage).toBe('');
  });
});

describe('flashcard adaptive defaults consumer', () => {
  const { computeAdaptiveDeckDefaults } = require('../../utils/adaptiveDeckDefaults.js');

  it('warns when large decks are often abandoned', () => {
    const sessions = [
      {
        deckTitle: 'Chemistry midterm',
        queueSize: 30,
        reviewedCount: 8,
        completed: false,
        deckCardCount: 30,
      },
      {
        deckTitle: 'Chemistry chapter 2',
        queueSize: 28,
        reviewedCount: 10,
        completed: false,
        deckCardCount: 28,
      },
      {
        deckTitle: 'Chemistry review',
        queueSize: 12,
        reviewedCount: 12,
        completed: true,
        deckCardCount: 12,
      },
    ];
    const result = computeAdaptiveDeckDefaults(sessions, 'Chemistry');
    expect(result.sampleSize).toBeGreaterThanOrEqual(2);
    expect(result.cardCount).toBeLessThanOrEqual(20);
    expect(result.warning).toMatch(/unfinished/);
  });

  it('POST /api/decks/:uid/sessions stores completion signal', async () => {
    await FlashcardDecks.create({ firebaseUid: 'sess1', decks: [] });
    const res = await request(app)
      .post('/api/decks/sess1/sessions')
      .send({
        deckId: 'd1',
        deckTitle: 'Biology',
        deckCardCount: 25,
        queueSize: 20,
        reviewedCount: 5,
        completed: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.session.completed).toBe(false);

    const defaults = await request(app).get(
      '/api/decks/sess1/adaptive-defaults?title=Biology'
    );
    expect(defaults.status).toBe(200);
    expect(defaults.body).toHaveProperty('cardCount');
  });
});
