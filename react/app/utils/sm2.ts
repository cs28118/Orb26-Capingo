/** Simplified SM-2 spaced-repetition helpers for Capingo flashcards. */

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export type SrsFields = {
  ease: number;
  interval: number;
  repetitions: number;
  dueAt: number;
  lastReviewedAt?: number;
  lapses?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_MS = 60 * 1000; // show again after ~1 minute in-session

export function withSrsDefaults<T extends { id: string }>(card: T & Partial<SrsFields>): T & SrsFields {
  return {
    ...card,
    ease: typeof card.ease === 'number' ? card.ease : 2.5,
    interval: typeof card.interval === 'number' ? card.interval : 0,
    repetitions: typeof card.repetitions === 'number' ? card.repetitions : 0,
    dueAt: typeof card.dueAt === 'number' ? card.dueAt : 0,
    lastReviewedAt: card.lastReviewedAt,
    lapses: typeof card.lapses === 'number' ? card.lapses : 0,
  };
}

export function isDue(card: Partial<SrsFields>, now = Date.now()): boolean {
  return (card.dueAt ?? 0) <= now;
}

export function isNew(card: Partial<SrsFields>): boolean {
  return !(card.lastReviewedAt) && (card.repetitions ?? 0) === 0;
}

export function countDue<T extends Partial<SrsFields>>(cards: T[], now = Date.now()): number {
  return cards.filter((c) => isDue(c, now)).length;
}

/**
 * Build a study queue: due cards (earliest first), then new cards up to newLimit.
 * Returns card ids in study order.
 */
export function buildStudyQueue<T extends { id: string } & Partial<SrsFields>>(
  cards: T[],
  opts: { newLimit?: number; now?: number } = {}
): string[] {
  const now = opts.now ?? Date.now();
  const newLimit = opts.newLimit ?? 20;

  const normalized = cards.map((c) => withSrsDefaults(c));
  const due = normalized
    .filter((c) => isDue(c, now) && !isNew(c))
    .sort((a, b) => a.dueAt - b.dueAt);

  const news = normalized.filter((c) => isNew(c)).slice(0, newLimit);

  // Brand-new decks: all cards are "new" and due — prefer news list so newLimit applies
  if (due.length === 0 && news.length === 0) {
    return normalized.filter((c) => isDue(c, now)).map((c) => c.id);
  }

  const seen = new Set<string>();
  const queue: string[] = [];
  for (const c of [...due, ...news]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    queue.push(c.id);
  }

  // Include any other due reviewed cards not already queued (should be rare)
  for (const c of normalized) {
    if (!seen.has(c.id) && isDue(c, now) && !isNew(c)) {
      seen.add(c.id);
      queue.push(c.id);
    }
  }

  return queue;
}

/** Apply a rating and return updated SRS fields (does not mutate). */
export function reviewCard(card: Partial<SrsFields>, rating: SrsRating, now = Date.now()): SrsFields {
  const current = withSrsDefaults({ id: 'tmp', ...card });
  let { ease, interval, repetitions, lapses = 0 } = current;

  if (rating === 'again') {
    return {
      ease: Math.max(1.3, ease - 0.2),
      interval: 0,
      repetitions: 0,
      dueAt: now + AGAIN_MS,
      lastReviewedAt: now,
      lapses: lapses + 1,
    };
  }

  if (repetitions === 0) {
    interval = rating === 'easy' ? 4 : rating === 'hard' ? 1 : 1;
  } else if (repetitions === 1) {
    interval = rating === 'easy' ? 8 : rating === 'hard' ? 3 : 6;
  } else {
    const factor = rating === 'hard' ? 1.2 : rating === 'easy' ? 1.3 : 1;
    interval = Math.max(1, Math.round(interval * ease * factor));
  }

  if (rating === 'hard') {
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === 'easy') {
    ease = ease + 0.15;
  }

  return {
    ease,
    interval,
    repetitions: repetitions + 1,
    dueAt: now + interval * DAY_MS,
    lastReviewedAt: now,
    lapses,
  };
}
