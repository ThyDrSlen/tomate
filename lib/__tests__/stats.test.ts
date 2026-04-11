import { describe, expect, it } from 'vitest';

import { computeStreak } from '../stats';
import type { CompletedSession } from '../types';

/** Return a YYYY-MM-DD key for `daysAgo` days before today. */
const dateKey = (daysAgo: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Minimal session stub — computeStreak only reads `date`. */
const session = (daysAgo: number): CompletedSession => ({
  id: `s-${daysAgo}`,
  label: 'Deep work',
  startTime: Date.now() - daysAgo * 86_400_000,
  endTime: Date.now() - daysAgo * 86_400_000 + 1_500_000,
  date: dateKey(daysAgo),
  duration: 1_500_000,
});

describe('computeStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 1 when only today has a session', () => {
    expect(computeStreak([session(0)])).toBe(1);
  });

  it('returns 0 when the most recent session is two or more days ago (gap day)', () => {
    expect(computeStreak([session(3)])).toBe(0);
  });

  it('continues the streak from yesterday when today has no session', () => {
    // yesterday + day-before-yesterday → streak of 2
    expect(computeStreak([session(1), session(2)])).toBe(2);
  });

  it('counts a multi-day consecutive streak ending today', () => {
    // today through 4 days ago → streak of 5
    const sessions = [session(0), session(1), session(2), session(3), session(4)];
    expect(computeStreak(sessions)).toBe(5);
  });

  it('stops counting at the first gap', () => {
    // today, yesterday, 2-days-ago, then a gap, then 4-days-ago
    const sessions = [session(0), session(1), session(2), session(4)];
    expect(computeStreak(sessions)).toBe(3);
  });

  it('handles multiple sessions on the same day without double-counting', () => {
    const sessions = [session(0), session(0), session(1)];
    expect(computeStreak(sessions)).toBe(2);
  });
});
