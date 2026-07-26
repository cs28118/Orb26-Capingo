const UserProfile = require('../models/userProfile');
const Timetable = require('../models/timetable');
const FlashcardDecks = require('../models/flashcardDeck');

/** Hour (local server time) after which streak_at_risk can fire. */
const STREAK_RISK_HOUR = Number(process.env.STREAK_RISK_HOUR || 18);

const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function normalizeSubject(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function accountCreatedAt(profile) {
  if (profile?.createdAt) return new Date(profile.createdAt);
  if (profile?._id?.getTimestamp) return profile._id.getTimestamp();
  if (profile?.lastLoginDate) return new Date(profile.lastLoginDate);
  return new Date();
}

function accountAgeDays(profile, now = new Date()) {
  const created = accountCreatedAt(profile);
  return Math.max(0, (now.getTime() - created.getTime()) / DAY_MS);
}

function isDismissedToday(profile, recommendationId, now = new Date()) {
  const key = todayKey(now);
  return (profile.dismissedRecommendations || []).some(
    (d) => d.id === recommendationId && d.date === key
  );
}

function deckMatchesSubject(deck, subject) {
  const title = String(deck.title || '').toLowerCase();
  const sub = normalizeSubject(subject).toLowerCase();
  return sub && title.includes(sub);
}

function deckLastReviewedAt(deck) {
  let latest = 0;
  for (const card of deck.cards || []) {
    if (typeof card.lastReviewedAt === 'number' && card.lastReviewedAt > latest) {
      latest = card.lastReviewedAt;
    }
  }
  return latest || null;
}

function deckHasBeenStudied(deck) {
  return (deck.cards || []).some(
    (c) => (typeof c.lastReviewedAt === 'number' && c.lastReviewedAt > 0) || (c.repetitions || 0) > 0
  );
}

function subjectCounts(todos, events) {
  const counts = new Map();
  for (const item of [...(todos || []), ...(events || [])]) {
    const normalized = normalizeSubject(item.subject);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    const prev = counts.get(key) || { subject: normalized, count: 0 };
    prev.count += 1;
    counts.set(key, prev);
  }
  return [...counts.values()];
}

function wasLoggedInYesterday(lastLoginDate, now = new Date()) {
  if (!lastLoginDate) return false;
  const last = new Date(lastLoginDate);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return (
    last.getFullYear() === y.getFullYear() &&
    last.getMonth() === y.getMonth() &&
    last.getDate() === y.getDate()
  );
}

function isTodayDate(date, now = new Date()) {
  if (!date) return false;
  const d = new Date(date);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function hasQuestProgressToday(dailyProgress) {
  const dp = dailyProgress || {};
  return (
    (dp.streakClaimed || 0) >= 1 ||
    (dp.decksReviewed || 0) > 0 ||
    (dp.chatMessages || 0) > 0 ||
    (dp.decksCreated || 0) > 0
  );
}

function questsIncomplete(dailyProgress) {
  const dp = dailyProgress || {};
  return (
    (dp.streakClaimed || 0) < 1 ||
    (dp.decksReviewed || 0) < 2 ||
    (dp.chatMessages || 0) < 5 ||
    (dp.decksCreated || 0) < 1
  );
}

/** XP multiplier when a quest action matches an active Smart Recommendation. */
const QUEST_XP_MULTIPLIER = Number(process.env.QUEST_XP_MULTIPLIER || 1.25);

/** Chatbot only opens with a tip at or above this priority (stricter than Dashboard). */
const CHAT_PROACTIVE_PRIORITY = Number(process.env.CHAT_PROACTIVE_PRIORITY || 70);

const QUEST_BASE_REWARDS = {
  reviewDeck: 60,
  chatMessage: 50,
  createDeck: 30,
};

/**
 * Adaptive recommendations — same catalog spirit as ACHIEVEMENT_CATALOG in indexGemini.js.
 * Consumers: Dashboard For You, Chatbot opening nudge, Quest reward weighting, Flashcard adaptive defaults.
 */
const RECOMMENDATION_CATALOG = [
  {
    id: 'deadline_no_review',
    minAccountAgeDays: 3,
    condition: async (ctx) => {
      const now = ctx.now.getTime();
      const threeDays = 3 * DAY_MS;
      const sixDays = 6 * DAY_MS;
      for (const todo of ctx.todos) {
        const subject = normalizeSubject(todo.subject);
        if (!subject || !todo.deadline) continue;
        const due = Date.parse(todo.deadline);
        if (Number.isNaN(due) || due < now || due - now > threeDays) continue;
        const matchingDecks = ctx.decks.filter((d) => deckMatchesSubject(d, subject));
        if (matchingDecks.length === 0) continue;
        const recentlyReviewed = matchingDecks.some((d) => {
          const last = deckLastReviewedAt(d);
          return last && now - last <= sixDays;
        });
        if (!recentlyReviewed) {
          ctx._deadlineHit = { subject, todo, deck: matchingDecks[0] };
          return true;
        }
      }
      return false;
    },
    priority: (ctx) => {
      const due = ctx._deadlineHit?.todo?.deadline
        ? Date.parse(ctx._deadlineHit.todo.deadline)
        : ctx.now.getTime() + 3 * DAY_MS;
      const hoursLeft = Math.max(0, (due - ctx.now.getTime()) / (60 * 60 * 1000));
      return 100 - Math.min(90, hoursLeft);
    },
    build: (ctx) => {
      const hit = ctx._deadlineHit || {};
      const subject = hit.subject || 'your subject';
      const deck = hit.deck;
      return {
        id: 'deadline_no_review',
        message: `${subject} has a deadline soon, but you haven't reviewed related flashcards lately.`,
        cta: {
          label: deck ? `Review ${deck.title}` : 'Open Flashcards',
          link: deck
            ? `/home/flashcard?deck=${encodeURIComponent(deck.id)}&study=1`
            : '/home/flashcard',
        },
      };
    },
  },
  {
    id: 'subject_gap',
    minAccountAgeDays: 3,
    condition: async (ctx) => {
      const counts = subjectCounts(ctx.todos, ctx.events);
      for (const { subject, count } of counts) {
        if (count < 3) continue;
        const hasDeck = ctx.decks.some((d) => deckMatchesSubject(d, subject));
        if (!hasDeck) {
          ctx._gapSubject = subject;
          return true;
        }
      }
      return false;
    },
    priority: () => 70,
    build: (ctx) => ({
      id: 'subject_gap',
      message: `You schedule ${ctx._gapSubject || 'a subject'} often, but you don't have a flashcard deck for it yet.`,
      cta: { label: 'Create a deck', link: '/home/flashcard' },
    }),
  },
  {
    id: 'streak_at_risk',
    minAccountAgeDays: 3,
    condition: async (ctx) => {
      const hour = ctx.now.getHours();
      if (hour < STREAK_RISK_HOUR) return false;
      if ((ctx.profile.streakDays || 0) < 1) return false;
      // Active streak: logged in yesterday or already today, but no quest progress yet today
      const active =
        wasLoggedInYesterday(ctx.profile.lastLoginDate, ctx.now) ||
        isTodayDate(ctx.profile.lastLoginDate, ctx.now);
      if (!active) return false;
      return !hasQuestProgressToday(ctx.profile.dailyProgress);
    },
    priority: (ctx) => 60 + Math.min(20, ctx.profile.streakDays || 0),
    build: (ctx) => ({
      id: 'streak_at_risk',
      message: `Your ${ctx.profile.streakDays || 1}-day streak is at risk — claim a quest before the day ends.`,
      cta: { label: 'Open Dashboard quests', link: '/home' },
    }),
  },
  {
    id: 'stale_deck',
    minAccountAgeDays: 3,
    condition: async (ctx) => {
      const now = ctx.now.getTime();
      const fiveDays = 5 * DAY_MS;
      for (const deck of ctx.decks) {
        const created = typeof deck.createdAt === 'number' ? deck.createdAt : 0;
        if (!created || now - created < fiveDays) continue;
        if (!deckHasBeenStudied(deck)) {
          ctx._staleDeck = deck;
          return true;
        }
      }
      return false;
    },
    priority: () => 55,
    build: (ctx) => {
      const deck = ctx._staleDeck;
      return {
        id: 'stale_deck',
        message: deck
          ? `"${deck.title}" has been sitting untouched for over 5 days.`
          : 'You have a flashcard deck that still needs a first study session.',
        cta: {
          label: deck ? `Study ${deck.title}` : 'Open Flashcards',
          link: deck
            ? `/home/flashcard?deck=${encodeURIComponent(deck.id)}&study=1`
            : '/home/flashcard',
        },
      };
    },
  },
  {
    id: 'quest_incomplete_eod',
    minAccountAgeDays: 7,
    condition: async (ctx) => questsIncomplete(ctx.profile.dailyProgress),
    priority: () => 40,
    build: () => ({
      id: 'quest_incomplete_eod',
      message: 'You still have daily quests left — a quick review or chat keeps your XP moving.',
      cta: { label: 'See quest list', link: '/home' },
    }),
  },
];

/**
 * Cold-start / onboarding nudges — same response shape as adaptive recommendations.
 * Mapped to existing starter achievement flags (keep typo instantiatedIndentity).
 */
const ONBOARDING_CATALOG = [
  {
    id: 'onboard_timetable',
    condition: (ctx) => !ctx.profile.masterScheduler && (ctx.todos.length === 0 && ctx.events.length === 0),
    priority: () => 100,
    build: () => ({
      id: 'onboard_timetable',
      message: 'Add your first subject or task to the timetable so Capingo can plan with you.',
      cta: { label: 'Open Timetable', link: '/home/timetable' },
    }),
  },
  {
    id: 'onboard_generate',
    condition: (ctx) => !ctx.profile.autoAllocating && ctx.todos.length > 0,
    priority: () => 90,
    build: () => ({
      id: 'onboard_generate',
      message: 'Try Generate timetable to turn your to-dos into a weekly plan.',
      cta: { label: 'Generate timetable', link: '/home/timetable' },
    }),
  },
  {
    id: 'onboard_deck',
    condition: (ctx) => !ctx.profile.deckBuilder && ctx.decks.length === 0,
    priority: () => 85,
    build: () => ({
      id: 'onboard_deck',
      message: 'Create your first flashcard deck — upload notes or add cards manually.',
      cta: { label: 'Create a deck', link: '/home/flashcard' },
    }),
  },
  {
    id: 'onboard_profile',
    condition: (ctx) => !ctx.profile.instantiatedIndentity,
    priority: () => 70,
    build: () => ({
      id: 'onboard_profile',
      message: 'Personalize your profile card with a name and picture.',
      cta: { label: 'Edit profile', link: '/home' },
    }),
  },
  {
    id: 'onboard_chat',
    condition: (ctx) => !ctx.profile.helloCapy,
    priority: () => 60,
    build: () => ({
      id: 'onboard_chat',
      message: 'Say hi to Capingo AI — ask anything about your subjects.',
      cta: { label: 'Open Chatbot', link: '/home/chatbot' },
    }),
  },
];

function needsOnboarding(ctx) {
  if (ctx.accountAgeDays < 3) return true;
  const noTimetable = ctx.todos.length === 0 && ctx.events.length === 0;
  const noDecks = ctx.decks.length === 0;
  return noTimetable && noDecks;
}

async function buildContext(firebaseUid, now = new Date()) {
  const [profile, timetable, flashcards] = await Promise.all([
    UserProfile.findOne({ firebaseUid }),
    Timetable.findOne({ firebaseUid }),
    FlashcardDecks.findOne({ firebaseUid }),
  ]);

  if (!profile) return null;

  const todos = timetable?.todos || [];
  const events = timetable?.events || [];
  const decks = flashcards?.decks || [];

  return {
    profile,
    todos,
    events,
    decks,
    now,
    accountAgeDays: accountAgeDays(profile, now),
  };
}

async function evaluateOnboarding(ctx, limit) {
  const items = [];
  for (const entry of ONBOARDING_CATALOG) {
    if (isDismissedToday(ctx.profile, entry.id, ctx.now)) continue;
    if (!entry.condition(ctx)) continue;
    items.push({
      ...entry.build(ctx),
      _priority: entry.priority(ctx),
    });
  }
  items.sort((a, b) => b._priority - a._priority);
  return items.slice(0, limit).map(({ _priority, ...rest }) => ({
    ...rest,
    priority: _priority,
  }));
}

async function evaluateAdaptive(ctx, limit) {
  const items = [];
  for (const entry of RECOMMENDATION_CATALOG) {
    if (ctx.accountAgeDays < (entry.minAccountAgeDays || 0)) continue;
    if (isDismissedToday(ctx.profile, entry.id, ctx.now)) continue;
    const ok = await entry.condition(ctx);
    if (!ok) continue;
    items.push({
      ...entry.build(ctx),
      _priority: entry.priority(ctx),
    });
  }
  items.sort((a, b) => b._priority - a._priority);
  return items.slice(0, limit).map(({ _priority, ...rest }) => ({
    ...rest,
    priority: _priority,
  }));
}

/**
 * @returns {{ recommendations: Array, mode: 'adaptive'|'onboarding' }}
 */
async function getRecommendations(firebaseUid, limit = 3, now = new Date()) {
  const ctx = await buildContext(firebaseUid, now);
  if (!ctx) {
    return { recommendations: [], mode: 'onboarding' };
  }

  if (needsOnboarding(ctx)) {
    const recommendations = await evaluateOnboarding(ctx, limit);
    return { recommendations, mode: 'onboarding' };
  }

  const recommendations = await evaluateAdaptive(ctx, limit);
  // If adaptive produced nothing useful, gently fall back to leftover onboarding tips
  if (recommendations.length === 0) {
    const fallback = await evaluateOnboarding(ctx, limit);
    if (fallback.length > 0) {
      return { recommendations: fallback, mode: 'onboarding' };
    }
  }
  return { recommendations, mode: 'adaptive' };
}

/**
 * Chatbot consumer — opening line for a new session when priority is high enough.
 * At most one proactive opening per calendar day (claim: true persists the lock).
 * @returns {{ recommendation: object|null, openingMessage: string, systemText: string }}
 */
async function getChatNudge(firebaseUid, { claim = false, now = new Date() } = {}) {
  const empty = { recommendation: null, openingMessage: '', systemText: '' };
  const ctx = await buildContext(firebaseUid, now);
  if (!ctx) return empty;

  const key = todayKey(now);
  if (ctx.profile.lastProactiveChatNudgeDate === key) return empty;

  const { recommendations } = await getRecommendations(firebaseUid, 3, now);
  const recommendation =
    recommendations.find((r) => (r.priority || 0) >= CHAT_PROACTIVE_PRIORITY) || null;
  if (!recommendation) return empty;

  const openingMessage =
    `Hey — quick thought when you have a minute: ${recommendation.message} ` +
    `If you want, we can tackle that together (${recommendation.cta?.label || 'open Capingo'}), ` +
    `or ask me about anything else.`;

  if (claim) {
    ctx.profile.lastProactiveChatNudgeDate = key;
    const list = ctx.profile.dismissedRecommendations || [];
    if (!list.some((d) => d.id === recommendation.id && d.date === key)) {
      list.push({ id: recommendation.id, date: key });
      ctx.profile.dismissedRecommendations = list;
    }
    await ctx.profile.save();
  }

  return { recommendation, openingMessage, systemText: '' };
}

/**
 * Quest consumer — boost XP for the user's most-neglected quest action (same list for everyone).
 * Uses lifetime questActionCounts normalized by daily capacity.
 */
function getNeglectedQuestAction(profile) {
  const counts = profile?.questActionCounts || {};
  const candidates = [
    { actionType: 'reviewDeck', count: counts.reviewDeck || 0, capacity: 2 },
    { actionType: 'chatMessage', count: counts.chatMessage || 0, capacity: 5 },
    { actionType: 'createDeck', count: counts.createDeck || 0, capacity: 1 },
    { actionType: 'loginStreak', count: counts.loginStreak || 0, capacity: 1 },
  ];
  candidates.sort((a, b) => a.count / a.capacity - b.count / b.capacity);
  return candidates[0].actionType;
}

function getPersonalizedQuestRewards(profile) {
  const neglected = getNeglectedQuestAction(profile);
  const out = { neglectedAction: neglected };
  for (const [actionType, baseXp] of Object.entries(QUEST_BASE_REWARDS)) {
    const boosted = actionType === neglected;
    const xp = boosted ? Math.round(baseXp * QUEST_XP_MULTIPLIER) : baseXp;
    out[actionType] = { xp, baseXp, boosted };
  }
  return out;
}

/**
 * @returns {{ multiplier: number, recommendationId: string|null, neglectedAction: string|null, boosted: boolean }}
 */
async function getQuestXpBoost(firebaseUid, actionType) {
  const profile = await UserProfile.findOne({ firebaseUid });
  if (!profile) {
    return { multiplier: 1, recommendationId: null, neglectedAction: null, boosted: false };
  }
  const neglected = getNeglectedQuestAction(profile);
  if (actionType !== neglected) {
    return { multiplier: 1, recommendationId: null, neglectedAction: neglected, boosted: false };
  }
  return {
    multiplier: QUEST_XP_MULTIPLIER,
    recommendationId: null,
    neglectedAction: neglected,
    boosted: true,
  };
}

function applyQuestXpBoost(baseXp, boost) {
  const multiplier = boost?.multiplier && boost.multiplier > 1 ? boost.multiplier : 1;
  const xp = Math.round(Number(baseXp) * multiplier);
  return { xp, multiplier, boosted: multiplier > 1 };
}

function incrementQuestActionCount(profile, actionType) {
  if (!profile.questActionCounts) {
    profile.questActionCounts = {
      reviewDeck: 0,
      chatMessage: 0,
      createDeck: 0,
      loginStreak: 0,
    };
  }
  const key = actionType;
  if (typeof profile.questActionCounts[key] !== 'number') {
    profile.questActionCounts[key] = 0;
  }
  profile.questActionCounts[key] += 1;
  profile.markModified?.('questActionCounts');
}

module.exports = {
  getRecommendations,
  getChatNudge,
  getQuestXpBoost,
  applyQuestXpBoost,
  getPersonalizedQuestRewards,
  getNeglectedQuestAction,
  incrementQuestActionCount,
  RECOMMENDATION_CATALOG,
  ONBOARDING_CATALOG,
  QUEST_BASE_REWARDS,
  QUEST_XP_MULTIPLIER,
  CHAT_PROACTIVE_PRIORITY,
  // exported for unit tests
  accountAgeDays,
  needsOnboarding,
  todayKey,
  STREAK_RISK_HOUR,
};
