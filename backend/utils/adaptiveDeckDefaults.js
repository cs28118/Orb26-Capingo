/**
 * Flashcard consumer — adaptive creation defaults from study session history.
 * Sessions track completed vs abandoned study so defaults aren't one-size-fits-all.
 */

const UNFINISHED_CARD_WARN_AT = 20;
const MIN_SESSIONS_FOR_ADAPT = 2;

function normalizeHint(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sessionMatchesHint(session, hint) {
  if (!hint) return true;
  const title = normalizeHint(session.deckTitle);
  const h = normalizeHint(hint);
  return Boolean(h) && title.includes(h);
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * @param {Array} sessions
 * @param {string} [subjectHint] deck title / subject keyword
 * @returns {{ cardCount: number, difficulty: 'basic'|'standard'|'advanced', warning: string|null, sampleSize: number }}
 */
function computeAdaptiveDeckDefaults(sessions, subjectHint = '') {
  const related = (sessions || []).filter((s) => sessionMatchesHint(s, subjectHint));
  const sample = related.length >= MIN_SESSIONS_FOR_ADAPT ? related : sessions || [];

  let cardCount = 20;
  let difficulty = 'standard';
  let warning = null;

  if (sample.length < MIN_SESSIONS_FOR_ADAPT) {
    return { cardCount, difficulty, warning, sampleSize: sample.length };
  }

  const completed = sample.filter((s) => s.completed);
  const abandoned = sample.filter((s) => !s.completed && (s.reviewedCount || 0) > 0);
  const abandonRate = abandoned.length / sample.length;

  const reviewedWhenAbandoned = abandoned
    .map((s) => s.reviewedCount)
    .filter((n) => typeof n === 'number' && n > 0);
  const queueWhenAbandoned = abandoned
    .map((s) => s.queueSize)
    .filter((n) => typeof n === 'number' && n > 0);

  if (abandonRate >= 0.4) {
    const typicalStop = median(reviewedWhenAbandoned) || 12;
    cardCount = Math.min(20, Math.max(8, typicalStop));
  } else if (completed.length > 0) {
    const completedQueues = completed
      .map((s) => s.queueSize)
      .filter((n) => typeof n === 'number' && n > 0);
    const m = median(completedQueues);
    if (m) cardCount = Math.min(40, Math.max(10, m));
  }

  const avgReviewed =
    sample.reduce((sum, s) => sum + (s.reviewedCount || 0), 0) / sample.length;
  if (avgReviewed >= 18 && abandonRate < 0.3) difficulty = 'advanced';
  else if (avgReviewed <= 8 || abandonRate >= 0.5) difficulty = 'basic';

  const largeAbandon = abandoned.some(
    (s) => (s.queueSize || 0) >= UNFINISHED_CARD_WARN_AT || (s.deckCardCount || 0) >= UNFINISHED_CARD_WARN_AT
  );
  if (abandonRate >= 0.5 && largeAbandon) {
    const label = subjectHint ? ` in “${subjectHint}”` : '';
    warning = `Your decks${label} tend to go unfinished past ~${UNFINISHED_CARD_WARN_AT} cards — want to keep this one smaller?`;
  } else if (
    (queueWhenAbandoned[0] || 0) >= UNFINISHED_CARD_WARN_AT ||
    cardCount >= UNFINISHED_CARD_WARN_AT
  ) {
    // soft nudge when requesting a large count with a history of abandon
    if (abandonRate >= 0.35) {
      const label = subjectHint ? ` in “${subjectHint}”` : '';
      warning = `Your decks${label} tend to go unfinished past ~${UNFINISHED_CARD_WARN_AT} cards — want to split this one?`;
    }
  }

  return { cardCount, difficulty, warning, sampleSize: sample.length };
}

module.exports = {
  computeAdaptiveDeckDefaults,
  UNFINISHED_CARD_WARN_AT,
  MIN_SESSIONS_FOR_ADAPT,
};
