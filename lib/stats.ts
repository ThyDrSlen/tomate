import type { CompletedSession } from './types';
import { toDateKey } from './utils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const computeTotalCount = (sessions: CompletedSession[]): number => sessions.length;

export const computeWeekCount = (sessions: CompletedSession[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * DAY_MS);
  const cutoff = toDateKey(weekAgo);

  return sessions.filter((s) => s.date >= cutoff).length;
};

export const computeBestDay = (
  sessions: CompletedSession[],
): { date: string; count: number } | null => {
  if (sessions.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.date] = (counts[s.date] ?? 0) + 1;
  }

  let bestDate = '';
  let bestCount = 0;
  for (const [date, count] of Object.entries(counts)) {
    if (count > bestCount) {
      bestDate = date;
      bestCount = count;
    }
  }

  return { date: bestDate, count: bestCount };
};

export const computeStreak = (sessions: CompletedSession[]): number => {
  if (sessions.length === 0) return 0;

  const sessionDates = new Set(sessions.map((s) => s.date));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  let streak = 0;
  let checkDate = new Date(today);

  if (!sessionDates.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
    if (!sessionDates.has(toDateKey(checkDate))) {
      return 0;
    }
  }

  while (sessionDates.has(toDateKey(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
};
