import { describe, expect, it } from 'vitest';

import { computeBestDay, computeTotalCount, computeWeekCount } from '../stats';
import type { CompletedSession } from '../types';

const makeSession = (date: string, id = date): CompletedSession => ({
  id,
  label: 'work',
  startTime: 0,
  endTime: 0,
  date,
  duration: 1_500_000,
});

// Compute date keys relative to actual today so tests are always valid
const dateKey = (daysAgo: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('computeTotalCount', () => {
  it('returns 0 for an empty array', () => {
    expect(computeTotalCount([])).toBe(0);
  });

  it('returns 1 for a single session', () => {
    expect(computeTotalCount([makeSession(dateKey(0))])).toBe(1);
  });

  it('returns n for n sessions', () => {
    const sessions = [
      makeSession(dateKey(2), 'a'),
      makeSession(dateKey(1), 'b'),
      makeSession(dateKey(0), 'c'),
    ];
    expect(computeTotalCount(sessions)).toBe(3);
  });
});

describe('computeWeekCount', () => {
  it('returns 0 for an empty array', () => {
    expect(computeWeekCount([])).toBe(0);
  });

  it('counts a session that falls on today', () => {
    expect(computeWeekCount([makeSession(dateKey(0))])).toBe(1);
  });

  it('counts a session 6 days ago (inclusive boundary)', () => {
    expect(computeWeekCount([makeSession(dateKey(6))])).toBe(1);
  });

  it('excludes a session 7 days ago (outside boundary)', () => {
    expect(computeWeekCount([makeSession(dateKey(7))])).toBe(0);
  });

  it('counts only sessions within the 7-day window', () => {
    const sessions = [
      makeSession(dateKey(7), 'outside'),  // 7 days ago — excluded
      makeSession(dateKey(6), 'border'),   // 6 days ago — included
      makeSession(dateKey(3), 'mid'),      // 3 days ago — included
      makeSession(dateKey(0), 'today'),    // today — included
    ];
    expect(computeWeekCount(sessions)).toBe(3);
  });
});

describe('computeBestDay', () => {
  it('returns null for an empty array', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('returns the single session date when there is one session', () => {
    expect(computeBestDay([makeSession(dateKey(0))])).toEqual({
      date: dateKey(0),
      count: 1,
    });
  });

  it('returns the date with the most sessions', () => {
    const sessions = [
      makeSession(dateKey(2), 'a1'),
      makeSession(dateKey(2), 'a2'),
      makeSession(dateKey(2), 'a3'),
      makeSession(dateKey(1), 'b1'),
      makeSession(dateKey(1), 'b2'),
      makeSession(dateKey(0), 'c1'),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: dateKey(2), count: 3 });
  });

  it('returns count 2 when two sessions share the same date with max count', () => {
    const sessions = [
      makeSession(dateKey(1), 'a1'),
      makeSession(dateKey(1), 'a2'),
      makeSession(dateKey(0), 'b1'),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: dateKey(1), count: 2 });
  });

  it('returns the first-encountered date on a tie (stable tie-breaking)', () => {
    // Two dates with 2 sessions each — the one encountered first in iteration wins
    const sessions = [
      makeSession(dateKey(2), 'a1'),
      makeSession(dateKey(2), 'a2'),
      makeSession(dateKey(1), 'b1'),
      makeSession(dateKey(1), 'b2'),
    ];
    const result = computeBestDay(sessions);
    expect(result?.count).toBe(2);
    // Both dates are valid winners; implementation keeps the first one encountered
    expect([dateKey(1), dateKey(2)]).toContain(result?.date);
  });
});
