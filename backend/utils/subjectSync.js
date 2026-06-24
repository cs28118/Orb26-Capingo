const UserProfile = require('../models/userProfile');

function normalizeSubject(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function extractSubjectsFromTimetable(todos, events) {
  const seen = new Map();
  for (const item of [...(todos || []), ...(events || [])]) {
    const normalized = normalizeSubject(item.subject);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) seen.set(key, normalized);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function getEffectiveSubjects(profile) {
  const seen = new Map();
  for (const s of [...(profile.subjects || []), ...(profile.manualSubjects || [])]) {
    const normalized = normalizeSubject(s);
    if (!normalized) continue;
    seen.set(normalized.toLowerCase(), normalized);
  }
  return [...seen.values()];
}

function intersectSubjects(a, b) {
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.filter((s) => setB.has(s.toLowerCase()));
}

function jaccardScore(shared, unionSize) {
  if (unionSize === 0) return 0;
  return shared.length / unionSize;
}

async function syncSubjectsToProfile(uid, todos, events) {
  const subjects = extractSubjectsFromTimetable(todos, events);
  await UserProfile.findOneAndUpdate({ firebaseUid: uid }, { subjects });
  return subjects;
}

module.exports = {
  normalizeSubject,
  extractSubjectsFromTimetable,
  getEffectiveSubjects,
  intersectSubjects,
  jaccardScore,
  syncSubjectsToProfile,
};
