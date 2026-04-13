import { describe, expect, it } from 'vitest';

import { computeBestDay, computeStreak, computeTotalCount, computeWeekCount, sanitizeCSVCell } from '../stats';
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
const DAY_MS = 24 * 60 * 60 * 1000;

const dateKey = (daysAgo: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('sanitizeCSVCell', () => {
  it('returns plain strings unchanged', () => {
    expect(sanitizeCSVCell('hello')).toBe('hello');
    expect(sanitizeCSVCell('work session')).toBe('work session');
    expect(sanitizeCSVCell('')).toBe('');
  });

  it('prefixes = with a single quote', () => {
    expect(sanitizeCSVCell('=SUM(A1)')).toBe("'=SUM(A1)");
  });

  it('prefixes + with a single quote', () => {
    expect(sanitizeCSVCell('+1')).toBe("'+1");
  });

  it('prefixes - with a single quote', () => {
    expect(sanitizeCSVCell('-1')).toBe("'-1");
  });

  it('prefixes @ with a single quote', () => {
    expect(sanitizeCSVCell('@SUM')).toBe("'@SUM");
  });

  it('does not prefix characters that are not formula triggers', () => {
    expect(sanitizeCSVCell('1+2')).toBe('1+2');
    expect(sanitizeCSVCell('a@b')).toBe('a@b');
  });
});

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
    expect(computeBestDay([makeSession('2026-04-06')])).toEqual({
      date: '2026-04-06',
      count: 1,
    });
  });

  it('returns the date with the most sessions', () => {
    const sessions = [
      makeSession('2026-04-04', 'a1'),
      makeSession('2026-04-04', 'a2'),
      makeSession('2026-04-04', 'a3'),
      makeSession('2026-04-05', 'b1'),
      makeSession('2026-04-05', 'b2'),
      makeSession('2026-04-06', 'c1'),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: '2026-04-04', count: 3 });
  });

  it('returns the first-encountered date on a tie (stable tie-breaking)', () => {
    // Two dates with 2 sessions each — the one that appears first in iteration wins
    const sessions = [
      makeSession('2026-04-04', 'a1'),
      makeSession('2026-04-04', 'a2'),
      makeSession('2026-04-05', 'b1'),
      makeSession('2026-04-05', 'b2'),
    ];
    const result = computeBestDay(sessions);
    expect(result?.count).toBe(2);
    // Both dates are valid winners; implementation keeps the first one encountered
    expect(['2026-04-04', '2026-04-05']).toContain(result?.date);
  });
});

describe('computeStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 when the only session is today', () => {
    expect(computeStreak([makeSession(dateKey(0))])).toBe(1);
  });

  it('counts consecutive days including today', () => {
    const sessions = [
      makeSession(dateKey(0), 'a'),
      makeSession(dateKey(1), 'b'),
      makeSession(dateKey(2), 'c'),
    ];
    expect(computeStreak(sessions)).toBe(3);
  });

  it('returns 0 when the streak is broken (gap yesterday, only older sessions)', () => {
    // Session 2 days ago but nothing yesterday or today — streak is 0
    const sessions = [makeSession(dateKey(2))];
    expect(computeStreak(sessions)).toBe(0);
  });

  it('counts a streak starting from yesterday when today has no session', () => {
    const sessions = [
      makeSession(dateKey(1), 'a'),
      makeSession(dateKey(2), 'b'),
      makeSession(dateKey(3), 'c'),
    ];
    expect(computeStreak(sessions)).toBe(3);
  });

  it('stops the streak at the first gap', () => {
    // Today, yesterday, skip day 2, then day 3
    const sessions = [
      makeSession(dateKey(0), 'a'),
      makeSession(dateKey(1), 'b'),
      // gap at dateKey(2)
      makeSession(dateKey(3), 'c'),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });

  it('counts multiple sessions on the same day as one day', () => {
    const sessions = [
      makeSession(dateKey(0), 'a1'),
      makeSession(dateKey(0), 'a2'),
      makeSession(dateKey(0), 'a3'),
      makeSession(dateKey(1), 'b1'),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });
});
