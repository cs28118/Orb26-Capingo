import { describe, expect, it, vi, beforeEach } from 'vitest';
import { allAchievements } from './achievements';
import type { userData } from '../types/types';

vi.mock('../components/NotiHelper', () => ({
  triggerToast: vi.fn(),
}));

import { triggerToast } from '../components/NotiHelper';
import { checkAndUnlockAchievements } from './achievementCheck';

function baseUser(overrides: Partial<userData> = {}): userData {
  return {
    _id: '1',
    firebaseUid: 'u1',
    username: 'Tester',
    level: 1,
    currentXp: 0,
    xpToNextLevel: 100,
    profilePic: '/assets/profile-placeholder.png',
    lastLoginDate: new Date().toISOString(),
    streakDays: 1,
    dailyProgress: {
      streakClaimed: 0,
      decksReviewed: 0,
      chatMessages: 0,
      decksCreated: 0,
    },
    achievements: [],
    quests: [],
    subjects: [],
    manualSubjects: [],
    partnerCode: 'CAPY-TEST',
    ...overrides,
  };
}

describe('achievement conditions', () => {
  it('Welcome is always true', () => {
    const welcome = allAchievements.find((a) => a.id === 1)!;
    expect(welcome.condition(baseUser())).toBe(true);
  });

  it('streak badges respect thresholds', () => {
    const three = allAchievements.find((a) => a.id === 2)!;
    const five = allAchievements.find((a) => a.id === 7)!;
    expect(three.condition(baseUser({ streakDays: 2 }))).toBe(false);
    expect(three.condition(baseUser({ streakDays: 3 }))).toBe(true);
    expect(five.condition(baseUser({ streakDays: 5 }))).toBe(true);
  });

  it('level badges respect thresholds', () => {
    const level2 = allAchievements.find((a) => a.id === 16)!;
    const level5 = allAchievements.find((a) => a.id === 10)!;
    expect(level2.condition(baseUser({ level: 1 }))).toBe(false);
    expect(level2.condition(baseUser({ level: 2 }))).toBe(true);
    expect(level5.condition(baseUser({ level: 5 }))).toBe(true);
  });

  it('feature flags unlock matching badges', () => {
    const hello = allAchievements.find((a) => a.id === 3)!;
    const scheduler = allAchievements.find((a) => a.id === 4)!;
    const deckBuilder = allAchievements.find((a) => a.id === 5)!;
    const identity = allAchievements.find((a) => a.id === 6)!;
    const auto = allAchievements.find((a) => a.id === 9)!;
    const connected = allAchievements.find((a) => a.id === 14)!;
    const multitask = allAchievements.find((a) => a.id === 17)!;
    const drag = allAchievements.find((a) => a.id === 18)!;

    expect(hello.condition(baseUser())).toBe(false);
    expect(hello.condition(baseUser({ helloCapy: true }))).toBe(true);
    expect(scheduler.condition(baseUser({ masterScheduler: true }))).toBe(true);
    expect(deckBuilder.condition(baseUser({ deckBuilder: true }))).toBe(true);
    expect(identity.condition(baseUser({ instantiatedIndentity: true }))).toBe(true);
    expect(auto.condition(baseUser({ autoAllocating: true }))).toBe(true);
    expect(connected.condition(baseUser({ connectedComponent: true }))).toBe(true);
    expect(multitask.condition(baseUser({ multitask: true }))).toBe(true);
    expect(drag.condition(baseUser({ draggedTask: true }))).toBe(true);
  });

  it('Data miner unlocks at 5 decks created', () => {
    const miner = allAchievements.find((a) => a.id === 15)!;
    expect(miner.condition(baseUser({ decksCreated: 4 }))).toBe(false);
    expect(miner.condition(baseUser({ decksCreated: 5 }))).toBe(true);
  });

  it('Killer Quest badges use quest counters', () => {
    const killerI = allAchievements.find((a) => a.id === 12)!;
    const killerII = allAchievements.find((a) => a.id === 13)!;
    expect(killerI.condition(baseUser({ questsCompleteStreak: 2 }))).toBe(false);
    expect(killerI.condition(baseUser({ questsCompleteStreak: 3 }))).toBe(true);
    expect(killerII.condition(baseUser({ questsCompleted: 9 }))).toBe(false);
    expect(killerII.condition(baseUser({ questsCompleted: 10 }))).toBe(true);
  });
});

describe('checkAndUnlockAchievements', () => {
  beforeEach(() => {
    vi.mocked(triggerToast).mockClear();
  });

  it('returns newly unlocked ids and skips already owned', () => {
    const user = baseUser({
      streakDays: 3,
      achievements: [{ id: 1, title: 'Welcome!', icon: 'x' }],
    });
    const unlocked = checkAndUnlockAchievements(user);
    expect(unlocked).toContain(2);
    expect(unlocked).not.toContain(1);
    expect(triggerToast).toHaveBeenCalled();
  });

  it('returns empty when nothing new qualifies', () => {
    const user = baseUser({
      achievements: allAchievements.map((a) => ({
        id: a.id,
        title: a.title,
        icon: a.icon,
      })),
    });
    expect(checkAndUnlockAchievements(user)).toEqual([]);
  });
});
