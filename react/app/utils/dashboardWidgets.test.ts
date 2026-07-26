import { describe, expect, it } from 'vitest';
import {
  formatRelativeTime,
  pickRecentChats,
  pickRecentRooms,
  pickUpcomingTodos,
  summarizeDueDecks,
} from './dashboardWidgets';

describe('pickUpcomingTodos', () => {
  it('returns empty for non-arrays or zero limit', () => {
    expect(pickUpcomingTodos(null as never, 5)).toEqual([]);
    expect(pickUpcomingTodos([], 0)).toEqual([]);
  });

  it('sorts by deadline then priority and caps length', () => {
    const todos = [
      { id: '1', title: 'Later', deadline: '2099-12-01', priority: 'High' },
      { id: '2', title: 'Soon low', deadline: '2026-01-02', priority: 'Low' },
      { id: '3', title: 'Soon high', deadline: '2026-01-02', priority: 'High' },
      { id: '4', title: 'No deadline', priority: 'Medium' },
      { id: '5', title: 'Extra', priority: 'Low' },
      { id: '6', title: '   ' },
    ];
    const picked = pickUpcomingTodos(todos, 3);
    expect(picked.map((t) => t.id)).toEqual(['3', '2', '1']);
  });
});

describe('summarizeDueDecks', () => {
  const now = 1_000_000;

  it('totals due cards and returns top decks', () => {
    const result = summarizeDueDecks(
      [
        {
          id: 'a',
          title: 'Bio',
          cards: [{ dueAt: 0 }, { dueAt: now + 99999 }],
        },
        {
          id: 'b',
          title: 'Chem',
          cards: [{ dueAt: 0 }, { dueAt: 0 }, { dueAt: 0 }],
        },
        {
          id: 'c',
          title: 'Caught up',
          cards: [{ dueAt: now + 1 }],
        },
      ],
      2,
      now
    );
    expect(result.totalDue).toBe(4);
    expect(result.decks).toEqual([
      { id: 'b', title: 'Chem', due: 3 },
      { id: 'a', title: 'Bio', due: 1 },
    ]);
  });
});

describe('pickRecentChats', () => {
  it('prefers pinned then newest updatedAt', () => {
    const chats = [
      { id: '1', title: 'Old', updatedAt: 100, pinned: false },
      { id: '2', title: 'Pinned old', updatedAt: 50, pinned: true },
      { id: '3', title: 'New', updatedAt: 200, pinned: false },
    ];
    expect(pickRecentChats(chats, 2).map((c) => c.id)).toEqual(['2', '3']);
  });
});

describe('pickRecentRooms', () => {
  it('sorts by updatedAt descending', () => {
    const rooms = [
      { roomId: 'r1', name: 'A', updatedAt: '2026-01-01T00:00:00.000Z' },
      { roomId: 'r2', name: 'B', updatedAt: '2026-06-01T00:00:00.000Z' },
    ];
    expect(pickRecentRooms(rooms, 1)[0].roomId).toBe('r2');
  });
});

describe('formatRelativeTime', () => {
  it('formats recent timestamps', () => {
    const now = 1_000_000;
    expect(formatRelativeTime(now, now)).toBe('just now');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3h ago');
  });
});
