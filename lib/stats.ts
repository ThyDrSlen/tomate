import type { CompletedSession } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const computeTotalCount = (sessions: CompletedSession[]): number => sessions.length;

export const computeWeekCount = (sessions: CompletedSession[]): number => {
  const today = new Date(Date.now());
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * DAY_MS);
  const cutoff = toDateKey(weekAgo);

  return sessions.filter((s) => s.date > cutoff).length;
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

  // Collect unique dates into a sorted array (ascending) — O(n log n) once,
  // avoids rebuilding a Set and mutating Date objects on every reactive call.
  const uniqueDates = Array.from(new Set(sessions.map((s) => s.date))).sort();

  const today = new Date(Date.now());
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  // Determine the most-recent date to start counting from.
  // If there is no session today, try starting from yesterday.
  let startKey = uniqueDates[uniqueDates.length - 1];
  if (startKey !== todayKey) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);
    if (startKey !== yesterdayKey) {
      return 0;
    }
  }

  // Walk the sorted dates array backwards, counting consecutive calendar days.
  // Date arithmetic is done entirely with string comparison on ISO keys —
  // no repeated Date allocation inside the hot loop.
  let streak = 0;
  let i = uniqueDates.length - 1;
  let expectedKey = startKey;

  while (i >= 0 && uniqueDates[i] === expectedKey) {
    streak++;
    i--;
    // Compute the previous calendar day key from expectedKey.
    const [y, mo, d] = expectedKey.split('-').map(Number);
    const prev = new Date(y, mo - 1, d - 1);
    expectedKey = toDateKey(prev);
  }

  return streak;
};
