/**
 * Chatbot tool catalog (Gemini functionDeclarations).
 * Handlers: read tools return a result; write tools return { summary, args, execute }.
 */
const Timetable = require('../models/timetable');
const FlashcardCollection = require('../models/flashcardDeck');
const UserProfile = require('../models/userProfile');
const { syncSubjectsToProfile } = require('./subjectSync');
const {
  getQuestXpBoost,
  applyQuestXpBoost,
  incrementQuestActionCount,
  getPersonalizedQuestRewards,
} = require('./recommendationEngine');

const ACTION_PENDING_MS = 60 * 60 * 1000; // 1 hour

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isActionExpired(message, now = Date.now()) {
  if (!message || message.role !== 'action') return false;
  if (message.action?.status !== 'pending') return false;
  return now - (message.createdAt || 0) > ACTION_PENDING_MS;
}

function markExpiredIfNeeded(message, now = Date.now()) {
  if (!isActionExpired(message, now)) return message;
  return {
    ...(typeof message.toObject === 'function' ? message.toObject() : message),
    action: {
      ...(message.action || {}),
      status: 'expired',
      result: { error: 'This proposed action expired after 1 hour. Ask Capingo to propose it again.' },
    },
  };
}

function normalizeMessagesWithExpiry(messages, now = Date.now()) {
  return (messages || []).map((m) => markExpiredIfNeeded(m, now));
}

async function ensureTimetable(uid) {
  let doc = await Timetable.findOne({ firebaseUid: uid });
  if (!doc) {
    doc = new Timetable({ firebaseUid: uid, todos: [], events: [] });
    await doc.save();
  }
  return doc;
}

async function ensureDecks(uid) {
  let doc = await FlashcardCollection.findOne({ firebaseUid: uid });
  if (!doc) {
    doc = new FlashcardCollection({ firebaseUid: uid, decks: [], studySessions: [] });
    await doc.save();
  }
  return doc;
}

/**
 * @param {{ generateFlashcards: Function }} deps
 */
function createToolCatalog(deps = {}) {
  const generateFlashcards = deps.generateFlashcards;

  return [
    {
      name: 'add_todo',
      description:
        'Add a study to-do to the student timetable. Resolve relative deadlines (e.g. "Friday", "in 3 days") into an ISO date string YYYY-MM-DD before calling. Priority must be High, Medium, or Low.',
      isWrite: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short task title' },
          subject: { type: 'string', description: 'Subject name' },
          hoursNeeded: { type: 'number', description: 'Estimated hours needed' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
          deadline: { type: 'string', description: 'Deadline as YYYY-MM-DD (empty if none)' },
          allowSplit: { type: 'boolean', description: 'Whether the task can be split across slots' },
        },
        required: ['title', 'subject', 'hoursNeeded', 'priority'],
      },
      handler: async (uid, args) => {
        const title = String(args.title || '').trim();
        const subject = String(args.subject || '').trim();
        const hoursNeeded = Math.max(0.5, Number(args.hoursNeeded) || 1);
        const priority = ['High', 'Medium', 'Low'].includes(args.priority) ? args.priority : 'Low';
        const deadline = String(args.deadline || '').trim();
        const allowSplit = Boolean(args.allowSplit);
        if (!title) throw new Error('title is required');

        const normalized = { title, subject, hoursNeeded, priority, deadline, allowSplit };
        const summary = `Add to-do “${title}”${subject ? ` [${subject}]` : ''} — ${hoursNeeded}h, ${priority}${
          deadline ? `, due ${deadline}` : ''
        }`;

        return {
          summary,
          args: normalized,
          execute: async () => {
            const timetable = await ensureTimetable(uid);
            const todos = [...(timetable.todos || [])];
            const todo = {
              id: newId('todo'),
              index: todos.length + 1,
              title,
              remarks: '',
              hoursNeeded,
              priority,
              allowSplit,
              deadline,
              subject,
            };
            todos.push(todo);
            timetable.todos = todos;
            timetable.updatedAt = new Date();
            await timetable.save();
            await syncSubjectsToProfile(uid, todos, timetable.events || []);
            return { todo };
          },
        };
      },
    },
    {
      name: 'schedule_block',
      description:
        'Schedule a concrete study block on the weekly timetable. You MUST resolve relative times yourself into a weekday name (Mon–Sun or Monday–Sunday) and a startHour like "16:00" or "4pm", plus duration in hours. Never pass vague times like "afternoon".',
      isWrite: true,
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'Weekday, e.g. Tuesday' },
          startHour: { type: 'string', description: 'Start time, e.g. 16:00' },
          duration: { type: 'number', description: 'Duration in hours' },
          title: { type: 'string' },
          subject: { type: 'string' },
          relatedTodoId: {
            type: 'string',
            description: 'Optional existing todo id this block relates to (for confirm-time revalidation)',
          },
        },
        required: ['day', 'startHour', 'duration', 'title'],
      },
      handler: async (uid, args) => {
        const day = String(args.day || '').trim();
        const startHour = String(args.startHour || '').trim();
        const duration = Math.max(0.5, Number(args.duration) || 1);
        const title = String(args.title || '').trim();
        const subject = String(args.subject || '').trim();
        const relatedTodoId = args.relatedTodoId ? String(args.relatedTodoId) : '';
        if (!day || !startHour || !title) throw new Error('day, startHour, and title are required');

        const normalized = { day, startHour, duration, title, subject, relatedTodoId };
        const summary = `Schedule “${title}” — ${day} ${startHour} (${duration}h)${
          subject ? ` [${subject}]` : ''
        }`;

        return {
          summary,
          args: normalized,
          execute: async () => {
            const timetable = await ensureTimetable(uid);
            if (relatedTodoId) {
              const stillThere = (timetable.todos || []).some((t) => t.id === relatedTodoId);
              if (!stillThere) {
                const err = new Error(
                  'The related to-do no longer exists. Ask Capingo to propose a new block.'
                );
                err.code = 'STALE';
                throw err;
              }
            }
            const events = [...(timetable.events || [])];
            const event = {
              id: newId('evt'),
              title,
              remarks: '',
              day,
              startHour,
              duration,
              subject,
            };
            events.push(event);
            timetable.events = events;
            timetable.updatedAt = new Date();
            await timetable.save();
            await syncSubjectsToProfile(uid, timetable.todos || [], events);
            return { event };
          },
        };
      },
    },
    {
      name: 'create_flashcard_deck',
      description:
        'Generate a new flashcard deck from a topic description the student typed in chat (not a PDF). Prefer concrete cardCount (5–50) and difficulty basic|standard|advanced. Include subject in the title when relevant.',
      isWrite: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          subject: { type: 'string' },
          difficulty: { type: 'string', enum: ['basic', 'standard', 'advanced'] },
          cardCount: { type: 'number' },
          topicDescription: {
            type: 'string',
            description: 'Study content / topic notes to turn into flashcards',
          },
        },
        required: ['title', 'topicDescription'],
      },
      handler: async (uid, args) => {
        if (typeof generateFlashcards !== 'function') {
          throw new Error('Flashcard generation is not available');
        }
        const title = String(args.title || '').trim() || 'New deck';
        const subject = String(args.subject || '').trim();
        const difficulty = ['basic', 'standard', 'advanced'].includes(args.difficulty)
          ? args.difficulty
          : 'standard';
        const cardCount = Math.min(50, Math.max(5, Number(args.cardCount) || 15));
        const topicDescription = String(args.topicDescription || '').trim();
        if (!topicDescription) throw new Error('topicDescription is required');

        const normalized = { title, subject, difficulty, cardCount, topicDescription };
        const summary = `Create deck “${title}” — ${cardCount} ${difficulty} cards${
          subject ? ` [${subject}]` : ''
        }`;

        return {
          summary,
          args: normalized,
          execute: async () => {
            const profile = await UserProfile.findOne({ firebaseUid: uid });
            if (!profile) throw new Error('User not found');
            if ((profile.dailyProgress?.decksCreated || 0) >= 1) {
              const err = new Error('Daily deck-creation quest cap reached. Try again tomorrow.');
              err.code = 'CAP';
              throw err;
            }

            const cardsRaw = await generateFlashcards(topicDescription, cardCount, difficulty);
            if (!cardsRaw.length) throw new Error('Could not generate flashcards from that topic.');

            const now = Date.now();
            const cards = cardsRaw.map((c, i) => ({
              id: newId(`card${i}`),
              front: c.front,
              back: c.back,
              createdAt: now,
              updatedAt: now,
              ease: 2.5,
              interval: 0,
              repetitions: 0,
              dueAt: 0,
              lapses: 0,
            }));

            const deckTitle = subject && !title.toLowerCase().includes(subject.toLowerCase())
              ? `${title} (${subject})`
              : title;

            const deck = {
              id: newId('deck'),
              title: deckTitle,
              pinned: false,
              cards,
              createdAt: now,
              updatedAt: now,
            };

            const collection = await ensureDecks(uid);
            collection.decks = [...(collection.decks || []), deck];
            collection.updatedAt = new Date();
            await collection.save();

            // Same dailyProgress counting as manual createDeck quest-action
            profile.dailyProgress.decksCreated = (profile.dailyProgress.decksCreated || 0) + 1;
            profile.decksCreated = (profile.decksCreated || 0) + 1;
            if (!profile.deckBuilder) profile.deckBuilder = true;
            profile.questsCompleted = (profile.questsCompleted || 0) + 1;
            profile.questsToday = (profile.questsToday || 0) + 1;

            const boost = await getQuestXpBoost(uid, 'createDeck');
            const { xp, multiplier, boosted } = applyQuestXpBoost(30, boost);
            incrementQuestActionCount(profile, 'createDeck');
            profile.currentXp += xp;
            while (profile.currentXp >= profile.xpToNextLevel) {
              profile.currentXp -= profile.xpToNextLevel;
              profile.level += 1;
              profile.xpToNextLevel = Math.floor(profile.level * 150);
            }
            await profile.save();

            return {
              deck: { id: deck.id, title: deck.title, cardCount: cards.length },
              xpAwarded: xp,
              xpBoost: boosted ? { multiplier } : null,
            };
          },
        };
      },
    },
    {
      name: 'claim_login_streak',
      description:
        'Claim the student daily login-streak XP reward if it has not been claimed yet today. No parameters.',
      isWrite: true,
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async (uid) => {
        const summary = 'Claim today’s login streak XP';
        return {
          summary,
          args: {},
          execute: async () => {
            const profile = await UserProfile.findOne({ firebaseUid: uid });
            if (!profile) throw new Error('User not found');
            if ((profile.dailyProgress?.streakClaimed || 0) >= 1) {
              const err = new Error('Login streak already claimed today.');
              err.code = 'CAP';
              throw err;
            }
            const currentStreak = profile.streakDays || 1;
            const baseXp = Math.min(currentStreak * 20, 100);
            const boost = await getQuestXpBoost(uid, 'loginStreak');
            const { xp, multiplier, boosted } = applyQuestXpBoost(baseXp, boost);
            profile.dailyProgress.streakClaimed = (profile.dailyProgress.streakClaimed || 0) + 1;
            incrementQuestActionCount(profile, 'loginStreak');
            profile.currentXp += xp;
            let leveledUp = false;
            while (profile.currentXp >= profile.xpToNextLevel) {
              profile.currentXp -= profile.xpToNextLevel;
              profile.level += 1;
              profile.xpToNextLevel = Math.floor(profile.level * 150);
              leveledUp = true;
            }
            await profile.save();
            return {
              xpAwarded: xp,
              streakDays: currentStreak,
              leveledUp,
              xpBoost: boosted ? { multiplier } : null,
              personalizedQuestRewards: getPersonalizedQuestRewards(profile),
            };
          },
        };
      },
    },
  ];
}

function toGeminiFunctionDeclarations(catalog) {
  return catalog.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

function findTool(catalog, name) {
  return catalog.find((t) => t.name === name) || null;
}

module.exports = {
  createToolCatalog,
  toGeminiFunctionDeclarations,
  findTool,
  ACTION_PENDING_MS,
  isActionExpired,
  markExpiredIfNeeded,
  normalizeMessagesWithExpiry,
};
