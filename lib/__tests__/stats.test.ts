import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeTotalCount, computeWeekCount, computeBestDay, computeStreak } from '../stats';
import type { CompletedSession } from '../types';

const createSession = (date: string, id?: string): CompletedSession => ({
  id: id ?? `session-${date}`,
  label: 'Test',
  startTime: new Date(date).getTime(),
  endTime: new Date(date).getTime() + 1_500_000,
  date,
  duration: 1_500_000,
});

describe('computeTotalCount', () => {
  it('returns 0 for empty array', () => {
    expect(computeTotalCount([])).toBe(0);
  });

  it('returns count of sessions', () => {
    expect(computeTotalCount([createSession('2026-03-20'), createSession('2026-03-21')])).toBe(2);
  });
});

describe('computeWeekCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty array', () => {
    expect(computeWeekCount([])).toBe(0);
  });

  it('counts only sessions within last 7 days', () => {
    const sessions = [
      createSession('2026-03-20', 'today'),
      createSession('2026-03-14', 'week-ago'),    // exactly 6 days ago, included
      createSession('2026-03-13', 'too-old'),      // 7 days ago, excluded
    ];
    expect(computeWeekCount(sessions)).toBe(2);
  });
});

describe('computeBestDay', () => {
  it('returns null for empty array', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('returns the day with most sessions', () => {
    const sessions = [
      createSession('2026-03-20', '1'),
      createSession('2026-03-20', '2'),
      createSession('2026-03-20', '3'),
      createSession('2026-03-19', '4'),
    ];
    expect(computeBestDay(sessions)).toEqual({ date: '2026-03-20', count: 3 });
  });

  it('returns single session day', () => {
    expect(computeBestDay([createSession('2026-03-20')])).toEqual({ date: '2026-03-20', count: 1 });
  });
});

describe('computeStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty array', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 when only today has a session', () => {
    expect(computeStreak([createSession('2026-03-20')])).toBe(1);
  });

  it('returns consecutive day count', () => {
    const sessions = [
      createSession('2026-03-20'),
      createSession('2026-03-19'),
      createSession('2026-03-18'),
    ];
    expect(computeStreak(sessions)).toBe(3);
  });

  it('returns 0 when no session today or yesterday', () => {
    expect(computeStreak([createSession('2026-03-17')])).toBe(0);
  });

  it('starts from yesterday if no session today', () => {
    const sessions = [
      createSession('2026-03-19'),
      createSession('2026-03-18'),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });

  it('stops at first gap', () => {
    const sessions = [
      createSession('2026-03-20'),
      createSession('2026-03-19'),
      // gap on 2026-03-18
      createSession('2026-03-17'),
    ];
    expect(computeStreak(sessions)).toBe(2);
  });
});
