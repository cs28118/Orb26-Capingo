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

describe('chats API', () => {
  it('creates, lists, updates, and deletes a chat', async () => {
    const created = await request(app)
      .post('/api/chats/u1')
      .send({ title: 'Chem help' });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('Chem help');
    const chatId = created.body.id;

    const listed = await request(app).get('/api/chats/u1');
    expect(listed.status).toBe(200);
    expect(listed.body.chats.some((c) => c.id === chatId)).toBe(true);

    const saved = await request(app)
      .put(`/api/chats/u1/${chatId}`)
      .send({
        title: 'Chem help',
        pinned: true,
        messages: [
          { role: 'user', content: 'What is a mole?' },
          { role: 'assistant', content: 'A unit of amount.' },
        ],
        memorySummary: '',
        memoryUpToIndex: 0,
      });
    expect(saved.status).toBe(200);
    expect(saved.body.pinned).toBe(true);
    expect(saved.body.messages).toHaveLength(2);

    const one = await request(app).get(`/api/chats/u1/${chatId}`);
    expect(one.status).toBe(200);
    expect(one.body.messages[0].content).toMatch(/mole/i);

    const missing = await request(app).get('/api/chats/u1/nope');
    expect(missing.status).toBe(404);

    const badPut = await request(app)
      .put(`/api/chats/u1/${chatId}`)
      .send({ title: 'x' });
    expect(badPut.status).toBe(400);

    const del = await request(app).delete(`/api/chats/u1/${chatId}`);
    expect(del.status).toBe(200);

    const after = await request(app).get(`/api/chats/u1/${chatId}`);
    expect(after.status).toBe(404);
  });
});

describe('profile streak claim', () => {
  it('claims streak once then reports already claimed', async () => {
    await UserProfile.create({
      firebaseUid: 'u1',
      username: 'U1',
      streakDays: 3,
      dailyProgress: {
        streakClaimed: 0,
        decksReviewed: 0,
        chatMessages: 0,
        decksCreated: 0,
      },
    });

    const first = await request(app)
      .post('/api/profile/claim-streak')
      .send({ uid: 'u1' });
    expect(first.status).toBe(200);
    expect(first.body.profile.dailyProgress.streakClaimed).toBeGreaterThanOrEqual(1);

    const second = await request(app)
      .post('/api/profile/claim-streak')
      .send({ uid: 'u1' });
    expect(second.status).toBe(200);
    expect(String(second.body.message || '').toLowerCase()).toMatch(/already|claimed/);
  });
});
