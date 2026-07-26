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
    expect(hello.condition(baseUser())).toBe(false);
    expect(hello.condition(baseUser({ helloCapy: true }))).toBe(true);
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
