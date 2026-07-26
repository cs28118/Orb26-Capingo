import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTestApp } = require('../helpers/testApp.js');
const { clearDatabase, connectMemoryMongo, disconnectMemoryMongo } = require('../helpers/mongo.js');
const UserProfile = require('../../models/userProfile.js');

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

describe('decks API', () => {
  it('rejects non-array decks body', async () => {
    const res = await request(app).put('/api/decks/u1').send({ decks: null });
    expect(res.status).toBe(400);
  });

  it('saves and loads decks including SRS fields', async () => {
    const decks = [
      {
        id: 'deck1',
        title: 'Biology',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cards: [
          {
            id: 'c1',
            front: 'Q',
            back: 'A',
            createdAt: Date.now(),
            ease: 2.6,
            interval: 1,
            repetitions: 1,
            dueAt: Date.now() + 86400000,
            lastReviewedAt: Date.now(),
            lapses: 0,
          },
        ],
      },
    ];

    const save = await request(app).put('/api/decks/u1').send({ decks });
    expect(save.status).toBe(200);
    expect(save.body.decks[0].cards[0].ease).toBe(2.6);

    const load = await request(app).get('/api/decks/u1');
    expect(load.status).toBe(200);
    expect(load.body.decks).toHaveLength(1);
    expect(load.body.decks[0].cards[0].interval).toBe(1);
  });
});

describe('timetable API', () => {
  it('syncs subjects to profile on save', async () => {
    await UserProfile.create({ firebaseUid: 'u1', username: 'U1' });

    const res = await request(app)
      .put('/api/timetable/u1')
      .send({
        todos: [{ id: 't1', title: 'Revise', subject: 'Chemistry' }],
        events: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.syncedSubjects).toContain('Chemistry');

    const profile = await UserProfile.findOne({ firebaseUid: 'u1' });
    expect(profile.subjects).toContain('Chemistry');
  });

  it('rejects missing todos/events arrays', async () => {
    const res = await request(app).put('/api/timetable/u1').send({ todos: [] });
    expect(res.status).toBe(400);
  });
});

describe('profile quests', () => {
  it('creates a profile with partner code and caps reviewDeck quests', async () => {
    const created = await request(app).get('/api/profile/u1?username=Tester');
    expect(created.status).toBe(200);
    expect(created.body.partnerCode).toMatch(/^CAPY-/);

    const first = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'u1', actionType: 'reviewDeck' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'u1', actionType: 'reviewDeck' });
    expect(second.status).toBe(200);

    const third = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'u1', actionType: 'reviewDeck' });
    expect(third.status).toBe(200);
    expect(String(third.body.message || '').toLowerCase()).toMatch(/cap|limit|already|max/);
  });

  it('rejects invalid quest actionType', async () => {
    await UserProfile.create({ firebaseUid: 'u2' });
    const res = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'u2', actionType: 'notReal' });
    expect(res.status).toBe(400);
  });
});
