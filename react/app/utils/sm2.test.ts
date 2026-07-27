import { describe, expect, it } from 'vitest';
import {
  buildStudyQueue,
  countDue,
  isDue,
  isNew,
  reviewCard,
  withSrsDefaults,
} from './sm2';

describe('withSrsDefaults', () => {
  it('fills missing SRS fields for legacy cards', () => {
    const card = withSrsDefaults({ id: 'c1', front: 'Q', back: 'A' } as { id: string });
    expect(card.ease).toBe(2.5);
    expect(card.interval).toBe(0);
    expect(card.repetitions).toBe(0);
    expect(card.dueAt).toBe(0);
    expect(card.lapses).toBe(0);
  });

  it('preserves existing SRS fields', () => {
    const card = withSrsDefaults({
      id: 'c1',
      ease: 2.8,
      interval: 6,
      repetitions: 2,
      dueAt: 123,
      lapses: 1,
    });
    expect(card.ease).toBe(2.8);
    expect(card.interval).toBe(6);
    expect(card.repetitions).toBe(2);
    expect(card.dueAt).toBe(123);
    expect(card.lapses).toBe(1);
  });
});

describe('isDue / isNew / countDue', () => {
  const now = 1_000_000;

  it('treats dueAt 0 as due', () => {
    expect(isDue({ dueAt: 0 }, now)).toBe(true);
  });

  it('treats future dueAt as not due', () => {
    expect(isDue({ dueAt: now + 1 }, now)).toBe(false);
  });

  it('marks never-reviewed cards as new', () => {
    expect(isNew({ repetitions: 0 })).toBe(true);
    expect(isNew({ repetitions: 0, lastReviewedAt: now })).toBe(false);
  });

  it('counts due cards', () => {
    expect(
      countDue(
        [
          { dueAt: 0 },
          { dueAt: now - 1 },
          { dueAt: now + 10_000 },
        ],
        now
      )
    ).toBe(2);
  });
});

describe('buildStudyQueue', () => {
  const now = 1_000_000;

  it('limits brand-new cards to newLimit', () => {
    const cards = Array.from({ length: 25 }, (_, i) => ({
      id: `n${i}`,
      dueAt: 0,
      repetitions: 0,
    }));
    const queue = buildStudyQueue(cards, { newLimit: 20, now });
    expect(queue).toHaveLength(20);
  });

  it('puts reviewed-due cards before new cards', () => {
    const cards = [
      { id: 'new1', dueAt: 0, repetitions: 0 },
      { id: 'due1', dueAt: now - 100, repetitions: 2, lastReviewedAt: now - 1000 },
      { id: 'later', dueAt: now + 5000, repetitions: 1, lastReviewedAt: now - 2000 },
    ];
    expect(buildStudyQueue(cards, { now })).toEqual(['due1', 'new1']);
  });
});

describe('reviewCard', () => {
  const now = 1_000_000;
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('Again resets repetitions and schedules soon', () => {
    const result = reviewCard(
      { ease: 2.5, interval: 6, repetitions: 3, dueAt: 0, lapses: 0 },
      'again',
      now
    );
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(0);
    expect(result.dueAt).toBe(now + 60_000);
    expect(result.lapses).toBe(1);
    expect(result.ease).toBeLessThan(2.5);
  });

  it('Good on a new card schedules 1 day', () => {
    const result = reviewCard({ ease: 2.5, interval: 0, repetitions: 0, dueAt: 0 }, 'good', now);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.dueAt).toBe(now + DAY_MS);
  });

  it('Easy on a new card schedules 4 days', () => {
    const result = reviewCard({ ease: 2.5, interval: 0, repetitions: 0, dueAt: 0 }, 'easy', now);
    expect(result.interval).toBe(4);
    expect(result.ease).toBeGreaterThan(2.5);
  });

  it('Hard lowers ease', () => {
    const result = reviewCard(
      { ease: 2.5, interval: 6, repetitions: 2, dueAt: 0, lastReviewedAt: 1 },
      'hard',
      now
    );
    expect(result.ease).toBeLessThan(2.5);
    expect(result.ease).toBeGreaterThanOrEqual(1.3);
  });
});
