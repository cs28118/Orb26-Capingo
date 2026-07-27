import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generatePartnerCode } = require('../../utils/partnerCode.js');
const {
  extractSubjectsFromTimetable,
  intersectSubjects,
  jaccardScore,
  normalizeSubject,
} = require('../../utils/subjectSync.js');
const { generateRoomCode } = require('../../models/room.js');
const { canonicalPair } = require('../../models/studyPartnership.js');

describe('generatePartnerCode', () => {
  it('matches CAPY-XXXX format without ambiguous characters', () => {
    const code = generatePartnerCode();
    expect(code).toMatch(/^CAPY-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });
});

describe('generateRoomCode', () => {
  it('matches ROOM-XXXXXX format', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^ROOM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe('canonicalPair', () => {
  it('orders uids lexicographically', () => {
    expect(canonicalPair('b', 'a')).toEqual(['a', 'b']);
    expect(canonicalPair('a', 'b')).toEqual(['a', 'b']);
  });
});

describe('subjectSync helpers', () => {
  it('normalizes whitespace', () => {
    expect(normalizeSubject('  Data   Structures  ')).toBe('Data Structures');
  });

  it('extracts unique subjects case-insensitively', () => {
    const subjects = extractSubjectsFromTimetable(
      [{ subject: 'Math' }, { subject: 'math' }, { subject: '' }],
      [{ subject: 'Physics' }]
    );
    expect(subjects).toEqual(['Math', 'Physics']);
  });

  it('intersects subjects case-insensitively', () => {
    expect(intersectSubjects(['Math', 'CS'], ['math', 'Art'])).toEqual(['Math']);
  });

  it('computes jaccard score', () => {
    expect(jaccardScore(['a'], 2)).toBe(0.5);
    expect(jaccardScore([], 0)).toBe(0);
  });
});
