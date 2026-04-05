import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { computeBestDay, computeStreak, computeTotalCount, computeWeekCount } from '../stats';
import { toDateKey } from '../storage';
import type { CompletedSession } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

const createSession = (dateOffset: number, id?: string): CompletedSession => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const timestamp = today.getTime() + dateOffset * DAY_MS;

  return {
    id: id ?? `session-${dateOffset}`,
    label: 'Test',
    startTime: timestamp,
    endTime: timestamp + 1_500_000,
    date: toDateKey(timestamp),
    duration: 1_500_000,
  };
};

describe('computeTotalCount', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeTotalCount([])).toBe(0);
  });

  it('returns the number of sessions', () => {
    expect(computeTotalCount([createSession(0), createSession(-1)])).toBe(2);
  });
});

describe('computeWeekCount', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeWeekCount([])).toBe(0);
  });

  it('counts sessions within the last 7 days', () => {
    const sessions = [
      createSession(0, 'today'),
      createSession(-3, 'three-days-ago'),
      createSession(-6, 'six-days-ago'),
      createSession(-10, 'ten-days-ago'),
    ];

    expect(computeWeekCount(sessions)).toBe(3);
  });

  it('includes sessions from exactly 6 days ago', () => {
    const sessions = [createSession(-6, 'boundary')];

    expect(computeWeekCount(sessions)).toBe(1);
  });
});

describe('computeBestDay', () => {
  it('returns null for empty sessions', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('returns the day with the highest count', () => {
    const sessions = [
      createSession(0, 'a1'),
      createSession(0, 'a2'),
      createSession(0, 'a3'),
      createSession(-1, 'b1'),
    ];

    const result = computeBestDay(sessions);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(3);
    expect(result!.date).toBe(toDateKey(sessions[0].startTime));
  });

  it('returns first encountered day on ties', () => {
    const sessions = [createSession(0, 'a1'), createSession(-1, 'b1')];

    const result = computeBestDay(sessions);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
  });
});

describe('computeStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('counts consecutive days including today', () => {
    const sessions = [
      createSession(0, 'today'),
      createSession(-1, 'yesterday'),
      createSession(-2, 'two-days-ago'),
    ];

    expect(computeStreak(sessions)).toBe(3);
  });

  it('counts consecutive days starting from yesterday when today has no sessions', () => {
    vi.spyOn(Date.prototype, 'setHours').mockImplementation(function (this: Date) {
      return this.getTime();
    });

    const yesterday = new Date();
    yesterday.setHours(12, 0, 0, 0);
    const yesterdayTs = yesterday.getTime() - DAY_MS;
    const twoDaysAgoTs = yesterday.getTime() - 2 * DAY_MS;

    const sessions: CompletedSession[] = [
      {
        id: 'y1',
        label: 'Test',
        startTime: yesterdayTs,
        endTime: yesterdayTs + 1_500_000,
        date: toDateKey(yesterdayTs),
        duration: 1_500_000,
      },
      {
        id: 'd2',
        label: 'Test',
        startTime: twoDaysAgoTs,
        endTime: twoDaysAgoTs + 1_500_000,
        date: toDateKey(twoDaysAgoTs),
        duration: 1_500_000,
      },
    ];

    vi.restoreAllMocks();

    expect(computeStreak(sessions)).toBe(2);
  });

  it('returns 0 when neither today nor yesterday has sessions', () => {
    const sessions = [createSession(-5, 'old')];

    expect(computeStreak(sessions)).toBe(0);
  });

  it('breaks streak on a gap day', () => {
    const sessions = [
      createSession(0, 'today'),
      createSession(-2, 'two-days-ago'),
    ];

    expect(computeStreak(sessions)).toBe(1);
  });
});
