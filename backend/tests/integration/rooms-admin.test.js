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

async function seedProfile(uid) {
  return UserProfile.create({
    firebaseUid: uid,
    username: uid,
    email: `${uid}@test.com`,
  });
}

async function acceptPartners(a, b) {
  const [userA, userB] = canonicalPair(a, b);
  await StudyPartnership.create({
    userA,
    userB,
    requestedBy: a,
    status: 'accepted',
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

describe('rooms admin + resources + announcements', () => {
  async function createGroupWithPartner() {
    await seedProfile('admin');
    await seedProfile('member');
    await acceptPartners('admin', 'member');
    const create = await request(app)
      .post('/api/rooms/group')
      .send({ uid: 'admin', name: 'Study hall' });
    await request(app)
      .post(`/api/rooms/${create.body.roomId}/invite`)
      .send({ uid: 'admin', targetUid: 'member' });
    return create.body.roomId;
  }

  it('promotes a member then kicks a non-admin attempt fails', async () => {
    const roomId = await createGroupWithPartner();

    const promote = await request(app)
      .post(`/api/rooms/${roomId}/promote`)
      .send({ uid: 'admin', targetUid: 'member' });
    expect(promote.status).toBe(200);

    const members = await request(app).get(`/api/rooms/${roomId}/members?uid=admin`);
    expect(members.body.members.find((m) => m.uid === 'member').role).toBe('admin');

    await seedProfile('outsider');
    const kickFail = await request(app)
      .post(`/api/rooms/${roomId}/kick`)
      .send({ uid: 'outsider', targetUid: 'member' });
    expect(kickFail.status).toBe(403);
  });

  it('admin can kick a member', async () => {
    const roomId = await createGroupWithPartner();
    const kick = await request(app)
      .post(`/api/rooms/${roomId}/kick`)
      .send({ uid: 'admin', targetUid: 'member' });
    expect(kick.status).toBe(200);

    const members = await request(app).get(`/api/rooms/${roomId}/members?uid=admin`);
    expect(members.body.members.some((m) => m.uid === 'member')).toBe(false);
  });

  it('admin posts announcement; non-admin cannot', async () => {
    const roomId = await createGroupWithPartner();

    const denied = await request(app)
      .post(`/api/rooms/${roomId}/announcements`)
      .send({ uid: 'member', text: 'Hello' });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post(`/api/rooms/${roomId}/announcements`)
      .send({ uid: 'admin', text: 'Exam Friday' });
    expect(ok.status).toBe(201);

    const list = await request(app).get(`/api/rooms/${roomId}/announcements?uid=member`);
    expect(list.status).toBe(200);
    expect(list.body.announcements[0].text).toBe('Exam Friday');
  });

  it('members can add http resources; rejects non-http', async () => {
    const roomId = await createGroupWithPartner();

    const bad = await request(app)
      .post(`/api/rooms/${roomId}/resources`)
      .send({ uid: 'member', title: 'Bad', url: 'ftp://example.com/x' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post(`/api/rooms/${roomId}/resources`)
      .send({
        uid: 'member',
        title: 'Notes',
        url: 'https://example.com/notes',
        description: 'Week 1',
      });
    expect(ok.status).toBe(201);

    const list = await request(app).get(`/api/rooms/${roomId}/resources?uid=admin`);
    expect(list.body.resources).toHaveLength(1);
  });
});
