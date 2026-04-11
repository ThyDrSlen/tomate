import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeBestDay,
  computeStreak,
  computeTotalCount,
  computeWeekCount,
} from '../stats';
import type { CompletedSession } from '../types';

// Fixed reference point: 2026-04-11 (a Saturday), noon UTC
const FIXED_NOW = new Date('2026-04-11T12:00:00.000Z').getTime();

const makeSession = (date: string, overrides: Partial<CompletedSession> = {}): CompletedSession => ({
  id: `session-${date}-${Math.random()}`,
  label: 'Work',
  startTime: new Date(`${date}T09:00:00.000Z`).getTime(),
  endTime: new Date(`${date}T09:25:00.000Z`).getTime(),
  date,
  duration: 1_500_000,
  ...overrides,
});

const makeSessions = (dates: string[]): CompletedSession[] => dates.map((d) => makeSession(d));

// ---------------------------------------------------------------------------
// computeTotalCount
// ---------------------------------------------------------------------------
describe('computeTotalCount', () => {
  it('returns 0 for an empty session list', () => {
    expect(computeTotalCount([])).toBe(0);
  });

  it('returns 1 for a single session', () => {
    expect(computeTotalCount([makeSession('2026-04-11')])).toBe(1);
  });

  it('returns the correct count for multiple sessions', () => {
    expect(computeTotalCount(makeSessions(['2026-04-01', '2026-04-05', '2026-04-11']))).toBe(3);
  });

  it('counts all sessions regardless of date', () => {
    const sessions = makeSessions([
      '2020-01-01',
      '2022-06-15',
      '2025-12-31',
      '2026-04-11',
      '2026-04-11',
    ]);
    expect(computeTotalCount(sessions)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// computeWeekCount
// ---------------------------------------------------------------------------
describe('computeWeekCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The "week" window is today inclusive back 6 days: 2026-04-05 … 2026-04-11

  it('returns 0 for an empty session list', () => {
    expect(computeWeekCount([])).toBe(0);
  });

  it('counts a session on today', () => {
    expect(computeWeekCount([makeSession('2026-04-11')])).toBe(1);
  });

  it('counts a session 6 days ago (inclusive boundary)', () => {
    expect(computeWeekCount([makeSession('2026-04-05')])).toBe(1);
  });

  it('excludes a session 7 days ago (outside boundary)', () => {
    expect(computeWeekCount([makeSession('2026-04-04')])).toBe(0);
  });

  it('excludes sessions further in the past', () => {
    expect(computeWeekCount(makeSessions(['2026-03-01', '2026-01-01']))).toBe(0);
  });

  it('counts multiple sessions within the window', () => {
    const sessions = makeSessions([
      '2026-04-05', // boundary day
      '2026-04-07',
      '2026-04-10',
      '2026-04-11', // today
    ]);
    expect(computeWeekCount(sessions)).toBe(4);
  });

  it('mixes inside and outside window sessions correctly', () => {
    const sessions = makeSessions([
      '2026-04-03', // outside
      '2026-04-04', // outside (7 days ago)
      '2026-04-05', // inside (6 days ago)
      '2026-04-11', // inside (today)
    ]);
    expect(computeWeekCount(sessions)).toBe(2);
  });

  it('counts multiple sessions on the same day within the window', () => {
    const sessions = [
      makeSession('2026-04-11', { id: 'a' }),
      makeSession('2026-04-11', { id: 'b' }),
      makeSession('2026-04-11', { id: 'c' }),
    ];
    expect(computeWeekCount(sessions)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeBestDay
// ---------------------------------------------------------------------------
describe('computeBestDay', () => {
  it('returns null for an empty session list', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('returns the single date with count 1', () => {
    expect(computeBestDay([makeSession('2026-04-11')])).toEqual({
      date: '2026-04-11',
      count: 1,
    });
  });

  it('returns count 2 when two sessions share the same date', () => {
    const sessions = [
      makeSession('2026-04-11', { id: 'a' }),
      makeSession('2026-04-11', { id: 'b' }),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: '2026-04-11', count: 2 });
  });

  it('picks the day with the highest session count', () => {
    const sessions = [
      makeSession('2026-04-09', { id: 'a' }),           // 1 session
      makeSession('2026-04-10', { id: 'b' }),           // 3 sessions
      makeSession('2026-04-10', { id: 'c' }),
      makeSession('2026-04-10', { id: 'd' }),
      makeSession('2026-04-11', { id: 'e' }),           // 2 sessions
      makeSession('2026-04-11', { id: 'f' }),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: '2026-04-10', count: 3 });
  });

  it('handles sessions spread across many different days', () => {
    const sessions = makeSessions([
      '2026-01-01',
      '2026-02-14',
      '2026-03-01',
      '2026-04-01',
    ]);
    // Each day has count 1; the first one encountered with count > 0 wins
    const result = computeBestDay(sessions);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
  });

  it('in a tie the first encountered date in iteration order wins', () => {
    // Two dates each with 2 sessions; JS object iteration preserves insertion order
    const sessions = [
      makeSession('2026-04-09', { id: 'a' }),
      makeSession('2026-04-09', { id: 'b' }),
      makeSession('2026-04-10', { id: 'c' }),
      makeSession('2026-04-10', { id: 'd' }),
    ];
    const result = computeBestDay(sessions);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    // '2026-04-09' is inserted first so it wins the tie (strict > means the
    // later equal date does NOT displace the earlier one)
    expect(result!.date).toBe('2026-04-09');
  });
});

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------
describe('computeStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // "today" = 2026-04-11

  it('returns 0 for an empty session list', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 when the only session is today', () => {
    expect(computeStreak([makeSession('2026-04-11')])).toBe(1);
  });

  it('returns 1 when the only session was yesterday', () => {
    expect(computeStreak([makeSession('2026-04-10')])).toBe(1);
  });

  it('returns 0 when the most recent session was 2 days ago', () => {
    expect(computeStreak([makeSession('2026-04-09')])).toBe(0);
  });

  it('returns the correct streak for consecutive days ending today', () => {
    // today + 2 previous = 3-day streak
    const sessions = makeSessions(['2026-04-09', '2026-04-10', '2026-04-11']);
    expect(computeStreak(sessions)).toBe(3);
  });

  it('returns the correct streak for consecutive days ending yesterday', () => {
    const sessions = makeSessions(['2026-04-08', '2026-04-09', '2026-04-10']);
    expect(computeStreak(sessions)).toBe(3);
  });

  it('stops counting at the first gap in consecutive days', () => {
    // gap between 04-08 and 04-10 (04-09 missing)
    const sessions = makeSessions([
      '2026-04-05',
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
      // gap here
      '2026-04-10',
      '2026-04-11',
    ]);
    expect(computeStreak(sessions)).toBe(2);
  });

  it('ignores duplicate sessions on the same day (treats each date once)', () => {
    const sessions = [
      makeSession('2026-04-10', { id: 'a' }),
      makeSession('2026-04-10', { id: 'b' }),
      makeSession('2026-04-11', { id: 'c' }),
      makeSession('2026-04-11', { id: 'd' }),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });
});
