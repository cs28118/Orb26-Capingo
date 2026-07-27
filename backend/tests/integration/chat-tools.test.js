import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createTestApp } = require('../helpers/testApp.js');
const { clearDatabase, connectMemoryMongo, disconnectMemoryMongo } = require('../helpers/mongo.js');
const Chat = require('../../models/chat.js');
const UserProfile = require('../../models/userProfile.js');
const Timetable = require('../../models/timetable.js');
const {
  createToolCatalog,
  isActionExpired,
  normalizeMessagesWithExpiry,
} = require('../../utils/toolCatalog.js');

const app = createTestApp();
const catalog = createToolCatalog({
  generateFlashcards: async () => [
    { front: 'Q1', back: 'A1' },
    { front: 'Q2', back: 'A2' },
  ],
});

const chatRoutes = require('../../routes/chats.js');
if (typeof chatRoutes.setChatToolCatalog === 'function') {
  chatRoutes.setChatToolCatalog(catalog);
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

describe('toolCatalog write tools', () => {
  it('add_todo propose + execute writes a todo', async () => {
    await UserProfile.create({ firebaseUid: 'u1', username: 'U1' });
    const tool = catalog.find((t) => t.name === 'add_todo');
    const proposal = await tool.handler('u1', {
      title: 'Revise Chem',
      subject: 'Chemistry',
      hoursNeeded: 2,
      priority: 'High',
      deadline: '2026-08-01',
    });
    expect(proposal.summary).toMatch(/Revise Chem/);
    const result = await proposal.execute();
    expect(result.todo.title).toBe('Revise Chem');

    const tt = await Timetable.findOne({ firebaseUid: 'u1' });
    expect(tt.todos).toHaveLength(1);
  });

  it('schedule_block expires when related todo is gone', async () => {
    await UserProfile.create({ firebaseUid: 'u2', username: 'U2' });
    await Timetable.create({
      firebaseUid: 'u2',
      todos: [],
      events: [],
    });
    const tool = catalog.find((t) => t.name === 'schedule_block');
    const proposal = await tool.handler('u2', {
      day: 'Tuesday',
      startHour: '16:00',
      duration: 2,
      title: 'Chem block',
      subject: 'Chemistry',
      relatedTodoId: 'missing_todo',
    });
    await expect(proposal.execute()).rejects.toMatchObject({ code: 'STALE' });
  });

  it('claim_login_streak awards XP once', async () => {
    await UserProfile.create({
      firebaseUid: 'u3',
      username: 'U3',
      streakDays: 3,
      dailyProgress: { streakClaimed: 0, decksReviewed: 0, chatMessages: 0, decksCreated: 0 },
    });
    const tool = catalog.find((t) => t.name === 'claim_login_streak');
    const proposal = await tool.handler('u3', {});
    const result = await proposal.execute();
    expect(result.xpAwarded).toBeGreaterThan(0);

    const again = await tool.handler('u3', {});
    await expect(again.execute()).rejects.toMatchObject({ code: 'CAP' });
  });
});

describe('action expiry + confirm/cancel routes', () => {
  it('marks pending actions older than 1h as expired on read', () => {
    const old = {
      id: 'm1',
      role: 'action',
      content: '',
      createdAt: Date.now() - 2 * 60 * 60 * 1000,
      action: { tool: 'add_todo', status: 'pending', summary: 'Add something' },
    };
    expect(isActionExpired(old)).toBe(true);
    const normalized = normalizeMessagesWithExpiry([old]);
    expect(normalized[0].action.status).toBe('expired');
  });

  it('confirm runs the tool and cancel stops it', async () => {
    await UserProfile.create({ firebaseUid: 'u4', username: 'U4' });
    const pending = {
      id: 'act1',
      role: 'action',
      content: '',
      createdAt: Date.now(),
      action: {
        tool: 'add_todo',
        status: 'pending',
        summary: 'Add Bio essay',
        args: {
          title: 'Bio essay',
          subject: 'Biology',
          hoursNeeded: 1,
          priority: 'Medium',
          deadline: '',
          allowSplit: false,
        },
      },
    };
    await Chat.create({
      firebaseUid: 'u4',
      chatId: 'chat1',
      title: 'Test',
      messages: [pending],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const confirmed = await request(app).post('/api/chats/u4/chat1/actions/act1/confirm');
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.message.action.status).toBe('confirmed');

    const tt = await Timetable.findOne({ firebaseUid: 'u4' });
    expect(tt.todos.some((t) => t.title === 'Bio essay')).toBe(true);

    await Chat.findOneAndUpdate(
      { firebaseUid: 'u4', chatId: 'chat1' },
      {
        $push: {
          messages: {
            id: 'act2',
            role: 'action',
            content: '',
            createdAt: Date.now(),
            action: {
              tool: 'add_todo',
              status: 'pending',
              summary: 'Cancel me',
              args: {
                title: 'Cancel me',
                subject: 'X',
                hoursNeeded: 1,
                priority: 'Low',
              },
            },
          },
        },
      }
    );

    const cancelled = await request(app).post('/api/chats/u4/chat1/actions/act2/cancel');
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.message.action.status).toBe('cancelled');
  });

  it('create_flashcard_deck confirm respects daily cap', async () => {
    await UserProfile.create({
      firebaseUid: 'u5',
      username: 'U5',
      dailyProgress: { streakClaimed: 0, decksReviewed: 0, chatMessages: 0, decksCreated: 1 },
    });
    await Chat.create({
      firebaseUid: 'u5',
      chatId: 'chat5',
      title: 'Deck',
      messages: [
        {
          id: 'deck_act',
          role: 'action',
          content: '',
          createdAt: Date.now(),
          action: {
            tool: 'create_flashcard_deck',
            status: 'pending',
            summary: 'Create deck',
            args: {
              title: 'Cells',
              subject: 'Biology',
              difficulty: 'basic',
              cardCount: 5,
              topicDescription: 'Cell organelles',
            },
          },
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const res = await request(app).post('/api/chats/u5/chat5/actions/deck_act/confirm');
    expect(res.status).toBe(409);
    expect(res.body.message.action.status).toBe('expired');
  });
});
