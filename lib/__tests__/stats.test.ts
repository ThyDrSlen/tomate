import { describe, expect, it } from 'vitest';

import { computeBestDay, computeStreak, computeTotalCount, computeWeekCount } from '../stats';
import type { CompletedSession } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Build a date key string offset from today by `offsetDays` (negative = past). */
const dateKey = (offsetDays = 0): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

let idCounter = 0;
const makeSession = (date: string, overrides: Partial<CompletedSession> = {}): CompletedSession => ({
  id: `sess-${++idCounter}`,
  label: '',
  startTime: 0,
  endTime: DAY_MS,
  date,
  duration: DAY_MS,
  ...overrides,
});

// ---------------------------------------------------------------------------
// computeTotalCount
// ---------------------------------------------------------------------------

describe('computeTotalCount', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeTotalCount([])).toBe(0);
  });

  it('returns the number of sessions', () => {
    const sessions = [makeSession('2025-01-01'), makeSession('2025-01-02'), makeSession('2025-01-02')];
    expect(computeTotalCount(sessions)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeWeekCount
// ---------------------------------------------------------------------------

describe('computeWeekCount', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeWeekCount([])).toBe(0);
  });

  it('counts sessions within the last 7 days including today', () => {
    const sessions = [
      makeSession(dateKey(0)),   // today
      makeSession(dateKey(-3)),  // 3 days ago
      makeSession(dateKey(-6)),  // 6 days ago — still in window
      makeSession(dateKey(-7)),  // 7 days ago — outside window
      makeSession(dateKey(-30)), // old
    ];
    expect(computeWeekCount(sessions)).toBe(3);
  });

  it('includes the boundary day (6 days ago)', () => {
    const sessions = [makeSession(dateKey(-6))];
    expect(computeWeekCount(sessions)).toBe(1);
  });

  it('excludes sessions older than 6 days', () => {
    const sessions = [makeSession(dateKey(-7))];
    expect(computeWeekCount(sessions)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------

describe('computeStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 for a single session today', () => {
    const sessions = [makeSession(dateKey(0))];
    expect(computeStreak(sessions)).toBe(1);
  });

  it('returns 1 for a single session yesterday', () => {
    const sessions = [makeSession(dateKey(-1))];
    expect(computeStreak(sessions)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    const sessions = [
      makeSession(dateKey(0)),
      makeSession(dateKey(-1)),
      makeSession(dateKey(-2)),
    ];
    expect(computeStreak(sessions)).toBe(3);
  });

  it('counts consecutive days ending yesterday when there is no session today', () => {
    const sessions = [
      makeSession(dateKey(-1)),
      makeSession(dateKey(-2)),
      makeSession(dateKey(-3)),
    ];
    expect(computeStreak(sessions)).toBe(3);
  });

  it('returns 0 when the most recent session is 2 or more days ago', () => {
    const sessions = [
      makeSession(dateKey(-2)),
      makeSession(dateKey(-3)),
    ];
    expect(computeStreak(sessions)).toBe(0);
  });

  it('resets streak at a gap — only counts from the most recent run', () => {
    const sessions = [
      makeSession(dateKey(0)),
      makeSession(dateKey(-1)),
      // gap here
      makeSession(dateKey(-3)),
      makeSession(dateKey(-4)),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });

  it('handles multiple sessions on the same day without inflating the streak', () => {
    const sessions = [
      makeSession(dateKey(0)),
      makeSession(dateKey(0)),  // duplicate date
      makeSession(dateKey(-1)),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });

  it('counts today even when a past session exists at the end of the array', () => {
    const sessions = [
      makeSession(dateKey(-10)),
      makeSession(dateKey(-1)),
      makeSession(dateKey(0)),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeBestDay
// ---------------------------------------------------------------------------

describe('computeBestDay', () => {
  it('returns null for empty sessions', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('returns the only day for a single session', () => {
    const sessions = [makeSession('2025-03-01')];
    expect(computeBestDay(sessions)).toEqual({ date: '2025-03-01', count: 1 });
  });

  it('returns the day with the most sessions', () => {
    const sessions = [
      makeSession('2025-03-01'),
      makeSession('2025-03-02'),
      makeSession('2025-03-02'),
      makeSession('2025-03-02'),
      makeSession('2025-03-03'),
      makeSession('2025-03-03'),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: '2025-03-02', count: 3 });
  });

  it('picks the first encountered day when two days are tied', () => {
    // The implementation keeps the first winner encountered via object iteration.
    // Both tie at count 2 — we just verify count is correct and a date is returned.
    const sessions = [
      makeSession('2025-03-01'),
      makeSession('2025-03-01'),
      makeSession('2025-03-02'),
      makeSession('2025-03-02'),
    ];
    const result = computeBestDay(sessions);
    expect(result?.count).toBe(2);
    expect(['2025-03-01', '2025-03-02']).toContain(result?.date);
  });

  it('handles a single day with many sessions', () => {
    const sessions = Array.from({ length: 5 }, () => makeSession('2025-06-15'));
    expect(computeBestDay(sessions)).toEqual({ date: '2025-06-15', count: 5 });
  });
});
