import { describe, it, expect } from 'vitest';
import { computeWeekCount, computeTotalCount, computeBestDay, computeStreak } from '../stats';
import type { CompletedSession } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeSession(daysAgo: number): CompletedSession {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const ts = now.getTime() - daysAgo * DAY_MS;
  const date = new Date(ts).toISOString().slice(0, 10);
  return {
    id: `session-${daysAgo}`,
    label: '',
    startTime: ts,
    endTime: ts + 25 * 60 * 1000,
    date,
    duration: 25 * 60 * 1000,
  };
}

describe('computeWeekCount', () => {
  it('counts a session from today', () => {
    expect(computeWeekCount([makeSession(0)])).toBe(1);
  });

  it('counts a session from 6 days ago', () => {
    expect(computeWeekCount([makeSession(6)])).toBe(1);
  });

  it('counts a session from exactly 7 days ago (boundary)', () => {
    // The cutoff is today - 7 * DAY_MS, so a session 7 days ago is included.
    expect(computeWeekCount([makeSession(7)])).toBe(1);
  });

  it('excludes a session from 8 days ago', () => {
    expect(computeWeekCount([makeSession(8)])).toBe(0);
  });

  it('counts all sessions within the 7-day window', () => {
    const sessions = [makeSession(0), makeSession(3), makeSession(7)];
    expect(computeWeekCount(sessions)).toBe(3);
  });

  it('returns 0 for an empty session list', () => {
    expect(computeWeekCount([])).toBe(0);
  });
});

describe('computeTotalCount', () => {
  it('returns the total number of sessions', () => {
    expect(computeTotalCount([makeSession(0), makeSession(10), makeSession(100)])).toBe(3);
  });

  it('returns 0 for empty sessions', () => {
    expect(computeTotalCount([])).toBe(0);
  });
});

describe('computeBestDay', () => {
  it('returns null for empty sessions', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('returns the day with the highest count', () => {
    const sessions = [makeSession(0), makeSession(0), makeSession(1)];
    const result = computeBestDay(sessions);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });
});

describe('computeStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 for a session only today', () => {
    expect(computeStreak([makeSession(0)])).toBe(1);
  });

  it('returns correct streak for consecutive days', () => {
    const sessions = [makeSession(0), makeSession(1), makeSession(2)];
    expect(computeStreak(sessions)).toBe(3);
  });
});
