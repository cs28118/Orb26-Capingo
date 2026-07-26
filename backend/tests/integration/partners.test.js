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

describe('partners API', () => {
  it('resolves partner code and rejects self-request', async () => {
    await UserProfile.create({
      firebaseUid: 'alice',
      username: 'Alice',
      partnerCode: 'CAPY-TEST',
      subjects: ['Math'],
    });
    await UserProfile.create({
      firebaseUid: 'bob',
      username: 'Bob',
      partnerCode: 'CAPY-BOB1',
      subjects: ['Math', 'CS'],
    });

    const lookup = await request(app).get('/api/partners/code/capy-test');
    expect(lookup.status).toBe(200);
    expect(lookup.body.uid).toBe('alice');

    const self = await request(app)
      .post('/api/partners/request')
      .send({ requesterUid: 'alice', partnerCode: 'CAPY-TEST' });
    expect(self.status).toBe(400);

    const req = await request(app)
      .post('/api/partners/request')
      .send({ requesterUid: 'bob', partnerCode: 'CAPY-TEST' });
    expect(req.status).toBe(201);

    const accept = await request(app)
      .post('/api/partners/accept')
      .send({ uid: 'alice', partnerUid: 'bob' });
    expect(accept.status).toBe(200);

    const list = await request(app).get('/api/partners/alice');
    expect(list.status).toBe(200);
    expect(list.body.accepted.some((p) => p.uid === 'bob')).toBe(true);
  });

  it('returns ranked suggestions for overlapping subjects', async () => {
    await UserProfile.create({
      firebaseUid: 'me',
      subjects: ['Math', 'Physics'],
      openToPartners: true,
    });
    await UserProfile.create({
      firebaseUid: 'match',
      username: 'Match',
      subjects: ['Math'],
      openToPartners: true,
    });
    await UserProfile.create({
      firebaseUid: 'other',
      subjects: ['Art'],
      openToPartners: true,
    });

    const res = await request(app).get('/api/partners/suggestions/me');
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0].uid).toBe('match');
    expect(res.body.suggestions[0].matchScore).toBeGreaterThan(0);
  });

  it('returns 404 for unknown partner code', async () => {
    const res = await request(app).get('/api/partners/code/CAPY-ZZZZ');
    expect(res.status).toBe(404);
  });
});
