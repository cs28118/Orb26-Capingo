import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTestApp } = require('../helpers/testApp.js');
const { clearDatabase, connectMemoryMongo, disconnectMemoryMongo } = require('../helpers/mongo.js');
const UserProfile = require('../../models/userProfile.js');
const StudyPartnership = require('../../models/studyPartnership.js');
const { canonicalPair } = require('../../models/studyPartnership.js');

const app = createTestApp();

async function seedProfile(uid, overrides = {}) {
  return UserProfile.create({
    firebaseUid: uid,
    username: overrides.username || uid,
    email: `${uid}@test.com`,
    subjects: overrides.subjects || [],
    manualSubjects: overrides.manualSubjects || [],
    partnerCode: overrides.partnerCode,
    openToPartners: overrides.openToPartners !== false,
  });
}

async function acceptPartners(a, b) {
  const [userA, userB] = canonicalPair(a, b);
  await StudyPartnership.create({
    userA,
    userB,
    requestedBy: a,
    status: 'accepted',
    sharedSubjects: ['Math'],
  });
}

beforeAll(async () => {
  await connectMemoryMongo();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/rooms/group + join', () => {
  it('creates a group room and allows join by code', async () => {
    await seedProfile('user1');
    await seedProfile('user2');

    const create = await request(app)
      .post('/api/rooms/group')
      .send({ uid: 'user1', name: 'Calc study' });

    expect(create.status).toBe(201);
    expect(create.body.roomCode).toMatch(/^ROOM-/);

    const join = await request(app)
      .post('/api/rooms/join')
      .send({ uid: 'user2', roomCode: create.body.roomCode });

    expect(join.status).toBe(200);
    expect(String(join.body.roomId)).toBe(String(create.body.roomId));

    const again = await request(app)
      .post('/api/rooms/join')
      .send({ uid: 'user2', roomCode: create.body.roomCode });

    expect(again.status).toBe(200);
    expect(again.body.alreadyMember).toBe(true);
  });

  it('returns 404 for unknown room code', async () => {
    const res = await request(app)
      .post('/api/rooms/join')
      .send({ uid: 'user1', roomCode: 'ROOM-NOPE12' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/rooms/direct', () => {
  it('rejects non-partners with 403', async () => {
    await seedProfile('user1');
    await seedProfile('user2');

    const res = await request(app)
      .post('/api/rooms/direct')
      .send({ uid: 'user1', partnerUid: 'user2' });

    expect(res.status).toBe(403);
  });

  it('find-or-creates a direct room for accepted partners', async () => {
    await seedProfile('user1', { username: 'Alice' });
    await seedProfile('user2', { username: 'Bob' });
    await acceptPartners('user1', 'user2');

    const first = await request(app)
      .post('/api/rooms/direct')
      .send({ uid: 'user1', partnerUid: 'user2' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/rooms/direct')
      .send({ uid: 'user2', partnerUid: 'user1' });
    expect(second.status).toBe(200);
    expect(String(second.body.roomId)).toBe(String(first.body.roomId));
  });

  it('rejects chatting with yourself', async () => {
    const res = await request(app)
      .post('/api/rooms/direct')
      .send({ uid: 'user1', partnerUid: 'user1' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/rooms/:roomId/invite', () => {
  it('allows inviting an accepted partner into a group', async () => {
    await seedProfile('user1');
    await seedProfile('user2');
    await acceptPartners('user1', 'user2');

    const create = await request(app)
      .post('/api/rooms/group')
      .send({ uid: 'user1', name: 'Group' });

    const invite = await request(app)
      .post(`/api/rooms/${create.body.roomId}/invite`)
      .send({ uid: 'user1', targetUid: 'user2' });

    expect(invite.status).toBe(200);
  });

  it('rejects inviting a non-partner', async () => {
    await seedProfile('user1');
    await seedProfile('stranger');

    const create = await request(app)
      .post('/api/rooms/group')
      .send({ uid: 'user1', name: 'Group' });

    const invite = await request(app)
      .post(`/api/rooms/${create.body.roomId}/invite`)
      .send({ uid: 'user1', targetUid: 'stranger' });

    expect(invite.status).toBe(403);
  });
});

describe('leave promotes another admin', () => {
  it('promotes remaining member when last admin leaves', async () => {
    await seedProfile('user1');
    await seedProfile('user2');
    await acceptPartners('user1', 'user2');

    const create = await request(app)
      .post('/api/rooms/group')
      .send({ uid: 'user1', name: 'Group' });

    await request(app)
      .post(`/api/rooms/${create.body.roomId}/invite`)
      .send({ uid: 'user1', targetUid: 'user2' });

    const leave = await request(app)
      .post(`/api/rooms/${create.body.roomId}/leave`)
      .send({ uid: 'user1' });
    expect(leave.status).toBe(200);

    const members = await request(app).get(
      `/api/rooms/${create.body.roomId}/members?uid=user2`
    );
    expect(members.status).toBe(200);
    const admin = members.body.members.find((m) => m.uid === 'user2');
    expect(admin.role).toBe('admin');
  });
});
