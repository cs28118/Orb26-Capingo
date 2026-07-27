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

describe('wired achievement flags', () => {
  it('quest-action chatMessage sets helloCapy', async () => {
    await UserProfile.create({
      firebaseUid: 'u1',
      username: 'U1',
      dailyProgress: { streakClaimed: 0, decksReviewed: 0, chatMessages: 0, decksCreated: 0 },
    });

    const res = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'u1', actionType: 'chatMessage' });
    expect(res.status).toBe(200);
    expect(res.body.profile.helloCapy).toBe(true);
  });

  it('quest-action createDeck sets deckBuilder and increments decksCreated', async () => {
    await UserProfile.create({
      firebaseUid: 'u1',
      username: 'U1',
      decksCreated: 4,
      dailyProgress: { streakClaimed: 0, decksReviewed: 0, chatMessages: 0, decksCreated: 0 },
    });

    const res = await request(app)
      .post('/api/profile/quest-action')
      .send({ uid: 'u1', actionType: 'createDeck' });
    expect(res.status).toBe(200);
    expect(res.body.profile.deckBuilder).toBe(true);
    expect(res.body.profile.decksCreated).toBe(5);
  });

  it('profile update sets instantiatedIndentity', async () => {
    await UserProfile.create({ firebaseUid: 'u1', username: 'Old' });

    const res = await request(app)
      .post('/api/profile/update')
      .send({ uid: 'u1', newUsername: 'New Name', newProfilePic: '/assets/profile1.png' });
    expect(res.status).toBe(200);
    expect(res.body.profile.instantiatedIndentity).toBe(true);
    expect(res.body.profile.username).toBe('New Name');
  });

  it('timetable-achievement sets manual/auto/drag/stack flags idempotently', async () => {
    await UserProfile.create({ firebaseUid: 'u1', username: 'U1' });

    const manual = await request(app)
      .post('/api/profile/timetable-achievement')
      .send({ uid: 'u1', type: 'manual' });
    expect(manual.status).toBe(200);
    expect(manual.body.profile.masterScheduler).toBe(true);

    const auto = await request(app)
      .post('/api/profile/timetable-achievement')
      .send({ uid: 'u1', type: 'auto' });
    expect(auto.body.profile.autoAllocating).toBe(true);

    const drag = await request(app)
      .post('/api/profile/timetable-achievement')
      .send({ uid: 'u1', type: 'drag' });
    expect(drag.body.profile.draggedTask).toBe(true);

    const stack = await request(app)
      .post('/api/profile/timetable-achievement')
      .send({ uid: 'u1', type: 'stack' });
    expect(stack.body.profile.multitask).toBe(true);

    const again = await request(app)
      .post('/api/profile/timetable-achievement')
      .send({ uid: 'u1', type: 'manual' });
    expect(again.status).toBe(200);
    expect(again.body.profile.masterScheduler).toBe(true);
  });

  it('rejects invalid timetable-achievement type', async () => {
    await UserProfile.create({ firebaseUid: 'u1', username: 'U1' });
    const res = await request(app)
      .post('/api/profile/timetable-achievement')
      .send({ uid: 'u1', type: 'nope' });
    expect(res.status).toBe(400);
  });

  it('partner accept sets connectedComponent on both users', async () => {
    await UserProfile.create({
      firebaseUid: 'alice',
      username: 'Alice',
      partnerCode: 'CAPY-ALIC',
      subjects: ['Math'],
    });
    await UserProfile.create({
      firebaseUid: 'bob',
      username: 'Bob',
      partnerCode: 'CAPY-BOB1',
      subjects: ['Math'],
    });

    const req = await request(app)
      .post('/api/partners/request')
      .send({ requesterUid: 'bob', partnerCode: 'CAPY-ALIC' });
    expect(req.status).toBe(201);

    const accept = await request(app)
      .post('/api/partners/accept')
      .send({ uid: 'alice', partnerUid: 'bob' });
    expect(accept.status).toBe(200);
    expect(accept.body.profile.connectedComponent).toBe(true);

    const bob = await UserProfile.findOne({ firebaseUid: 'bob' });
    expect(bob.connectedComponent).toBe(true);
  });

  it('unlock-achievements persists new ids only once', async () => {
    await UserProfile.create({
      firebaseUid: 'u1',
      username: 'U1',
      achievements: [{ id: 1 }],
    });

    const first = await request(app)
      .post('/api/profile/unlock-achievements')
      .send({ uid: 'u1', newAchievementIds: [3, 4] });
    expect(first.status).toBe(200);
    expect(first.body.profile.achievements.map((a) => a.id).sort()).toEqual([1, 3, 4]);

    const second = await request(app)
      .post('/api/profile/unlock-achievements')
      .send({ uid: 'u1', newAchievementIds: [3, 4] });
    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/0 achievements/i);
  });
});
