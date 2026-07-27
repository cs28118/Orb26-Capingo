import { countDue } from './sm2';

export type WidgetTodo = {
  id: string;
  title: string;
  subject?: string;
  hoursNeeded?: number;
  priority?: string;
  deadline?: string;
};

export type WidgetDeck = {
  id: string;
  title: string;
  cards: Array<{ dueAt?: number; repetitions?: number }>;
};

export type WidgetChat = {
  id: string;
  title: string;
  pinned?: boolean;
  updatedAt?: number;
  messageCount?: number;
};

export type WidgetRoom = {
  roomId: string;
  name: string;
  type?: string;
  updatedAt?: string;
  lastMessage?: { text?: string; createdAt?: string } | null;
};

export type DueDeckSummary = {
  id: string;
  title: string;
  due: number;
};

/** Pick the next upcoming todos for the Dashboard widget (stable order, capped). */
export function pickUpcomingTodos(todos: WidgetTodo[], limit = 5): WidgetTodo[] {
  if (!Array.isArray(todos) || limit <= 0) return [];
  const withTitle = todos.filter((t) => t && String(t.title || '').trim());
  const priorityRank = (p?: string) => {
    const key = String(p || '').toLowerCase();
    if (key === 'high') return 0;
    if (key === 'medium') return 1;
    if (key === 'low') return 2;
    return 3;
  };
  return [...withTitle]
    .sort((a, b) => {
      const da = a.deadline ? Date.parse(a.deadline) : Number.POSITIVE_INFINITY;
      const db = b.deadline ? Date.parse(b.deadline) : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;
      return String(a.title).localeCompare(String(b.title));
    })
    .slice(0, limit);
}

/** Total due cards + top decks that still have due cards. */
export function summarizeDueDecks(
  decks: WidgetDeck[],
  limit = 2,
  now = Date.now()
): { totalDue: number; decks: DueDeckSummary[] } {
  if (!Array.isArray(decks)) return { totalDue: 0, decks: [] };
  const withDue = decks
    .map((d) => ({
      id: d.id,
      title: d.title || 'Untitled deck',
      due: countDue(d.cards || [], now),
    }))
    .filter((d) => d.due > 0)
    .sort((a, b) => b.due - a.due);
  const totalDue = withDue.reduce((sum, d) => sum + d.due, 0);
  return { totalDue, decks: withDue.slice(0, limit) };
}

/** Most recently updated chats for the Dashboard widget. */
export function pickRecentChats(chats: WidgetChat[], limit = 3): WidgetChat[] {
  if (!Array.isArray(chats) || limit <= 0) return [];
  return [...chats]
    .filter((c) => c && c.id)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    })
    .slice(0, limit);
}

/** Most recently updated study rooms for the peek widget. */
export function pickRecentRooms(rooms: WidgetRoom[], limit = 2): WidgetRoom[] {
  if (!Array.isArray(rooms) || limit <= 0) return [];
  return [...rooms]
    .filter((r) => r && r.roomId)
    .sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!timestamp) return '';
  const diff = Math.max(0, now - timestamp);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
