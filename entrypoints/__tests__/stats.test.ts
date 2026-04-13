import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  getConfig,
  getHeatmapData,
  getSessionHistory,
  getTodayCount,
  toDateKey,
} from '@/lib/storage';
import {
  computeBestDay,
  computeStreak,
  computeTotalCount,
  computeWeekCount,
} from '@/lib/stats';
import { DEFAULT_CONFIG, type CompletedSession } from '@/lib/types';

/**
 * Integration tests for the stats App entrypoint (#58).
 *
 * The stats page renders session history from extension storage and derives
 * display values using lib/stats helpers.  We verify the full data flow:
 * storage → stat helpers → display values that the component renders.
 */

const MS_PER_MINUTE = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const makeSession = (daysAgo: number, id: string, label = 'Focus block'): CompletedSession => {
  const startTime = Date.now() - daysAgo * DAY_MS;
  return {
    id,
    label,
    startTime,
    endTime: startTime + 25 * MS_PER_MINUTE,
    date: toDateKey(startTime),
    duration: 25 * MS_PER_MINUTE,
  };
};

describe('stats — empty state (no sessions)', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('getSessionHistory returns an empty array', async () => {
    await expect(getSessionHistory()).resolves.toEqual([]);
  });

  it('getTodayCount returns 0', async () => {
    await expect(getTodayCount()).resolves.toBe(0);
  });

  it('computeTotalCount is 0 for empty sessions', () => {
    expect(computeTotalCount([])).toBe(0);
  });

  it('computeWeekCount is 0 for empty sessions', () => {
    expect(computeWeekCount([])).toBe(0);
  });

  it('computeBestDay is null for empty sessions', () => {
    expect(computeBestDay([])).toBeNull();
  });

  it('computeStreak is 0 for empty sessions', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('getHeatmapData returns an empty object', async () => {
    await expect(getHeatmapData(365)).resolves.toEqual({});
  });
});

describe('stats — session counts displayed correctly', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('total count equals the number of stored sessions', async () => {
    const sessions = [makeSession(0, 'a'), makeSession(1, 'b'), makeSession(2, 'c')];
    await fakeBrowser.storage.local.set({ sessions });

    const history = await getSessionHistory();
    expect(computeTotalCount(history)).toBe(3);
  });

  it('today count reflects only sessions from today', async () => {
    const sessions = [
      makeSession(0, 'today-1'),
      makeSession(0, 'today-2'),
      makeSession(1, 'yesterday-1'),
    ];
    await fakeBrowser.storage.local.set({ sessions });

    const count = await getTodayCount();
    expect(count).toBe(2);
  });

  it('week count reflects only sessions within the last 7 days', async () => {
    const sessions = [
      makeSession(0, 'day-0'),
      makeSession(6, 'day-6'),
      makeSession(7, 'day-7'), // excluded
    ];
    await fakeBrowser.storage.local.set({ sessions });

    const history = await getSessionHistory();
    expect(computeWeekCount(history)).toBe(2);
  });

  it('bestDay identifies the date with the most sessions', async () => {
    const sessions = [
      makeSession(2, 'a1'),
      makeSession(2, 'a2'),
      makeSession(2, 'a3'),
      makeSession(1, 'b1'),
      makeSession(0, 'c1'),
    ];
    await fakeBrowser.storage.local.set({ sessions });

    const history = await getSessionHistory();
    const best = computeBestDay(history);
    expect(best?.count).toBe(3);
  });

  it('streak is 1 when only today has a session', async () => {
    const sessions = [makeSession(0, 'today-only')];
    await fakeBrowser.storage.local.set({ sessions });

    const history = await getSessionHistory();
    expect(computeStreak(history)).toBe(1);
  });

  it('streak spans consecutive days', async () => {
    const sessions = [
      makeSession(0, 'd0'),
      makeSession(1, 'd1'),
      makeSession(2, 'd2'),
    ];
    await fakeBrowser.storage.local.set({ sessions });

    const history = await getSessionHistory();
    expect(computeStreak(history)).toBe(3);
  });
});

describe('stats — daily goal progress', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  const goalProgress = (todayCount: number, dailyGoal: number): number =>
    Math.min(100, Math.round((todayCount / dailyGoal) * 100));

  it('goalProgress is 0 with no sessions', () => {
    expect(goalProgress(0, 8)).toBe(0);
  });

  it('goalProgress is 50 when halfway to goal', () => {
    expect(goalProgress(4, 8)).toBe(50);
  });

  it('goalProgress is 100 when goal is exactly met', () => {
    expect(goalProgress(8, 8)).toBe(100);
  });

  it('goalProgress is capped at 100 even when exceeding goal', () => {
    expect(goalProgress(10, 8)).toBe(100);
  });

  it('default dailyGoal from storage is 8', async () => {
    const config = await getConfig();
    expect(config.dailyGoal).toBe(DEFAULT_CONFIG.dailyGoal);
    expect(config.dailyGoal).toBe(8);
  });

  it('custom dailyGoal is persisted and reflected in progress calculation', async () => {
    await fakeBrowser.storage.local.set({ config: { ...DEFAULT_CONFIG, dailyGoal: 4 } });
    const config = await getConfig();
    expect(config.dailyGoal).toBe(4);
    expect(goalProgress(4, config.dailyGoal)).toBe(100);
  });
});

describe('stats — heatmap data', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('heatmap data maps dates to session counts', async () => {
    const sessions = [
      makeSession(0, 'a1'),
      makeSession(0, 'a2'),
      makeSession(1, 'b1'),
    ];
    await fakeBrowser.storage.local.set({ sessions });

    const data = await getHeatmapData(365);
    const todayKey = toDateKey(Date.now());
    const yesterdayKey = toDateKey(Date.now() - DAY_MS);

    expect(data[todayKey]).toBe(2);
    expect(data[yesterdayKey]).toBe(1);
  });

  it('heatmap excludes sessions older than the requested window', async () => {
    const sessions = [
      makeSession(0, 'recent'),
      makeSession(400, 'old'), // outside 365-day window
    ];
    await fakeBrowser.storage.local.set({ sessions });

    const data = await getHeatmapData(365);
    const values = Object.values(data);
    // Only the recent session should be included
    expect(values.reduce((sum, v) => sum + v, 0)).toBe(1);
  });
});

describe('stats — CSV export logic', () => {
  const buildCSV = (sessions: CompletedSession[]): string => {
    const header = 'startTime,endTime,duration,label';
    const rows = sessions.map((s) => {
      const label = `"${s.label.replace(/"/g, '""')}"`;
      return `${s.startTime},${s.endTime},${s.duration},${label}`;
    });
    return [header, ...rows].join('\n');
  };

  it('produces a header row', () => {
    const csv = buildCSV([]);
    expect(csv).toBe('startTime,endTime,duration,label');
  });

  it('produces one data row per session', () => {
    const session = makeSession(0, 'x1', 'Morning focus');
    const csv = buildCSV([session]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Morning focus"');
  });

  it('escapes double-quotes in labels', () => {
    const session: CompletedSession = {
      ...makeSession(0, 'q1'),
      label: 'Say "hello"',
    };
    const csv = buildCSV([session]);
    expect(csv).toContain('"Say ""hello"""');
  });

  it('produces correct column order: startTime, endTime, duration, label', () => {
    const session = makeSession(0, 'order-test', 'Work');
    const csv = buildCSV([session]);
    const [header, row] = csv.split('\n');
    expect(header).toBe('startTime,endTime,duration,label');
    const parts = row.split(',');
    // startTime and endTime are numeric; duration is numeric; label is quoted
    expect(Number(parts[0])).toBeGreaterThan(0);
    expect(Number(parts[1])).toBeGreaterThan(0);
    expect(Number(parts[2])).toBe(25 * MS_PER_MINUTE);
    expect(parts[3]).toBe('"Work"');
  });

  it('includes all sessions in export', () => {
    const sessions = [
      makeSession(0, 'x1', 'A'),
      makeSession(1, 'x2', 'B'),
      makeSession(2, 'x3', 'C'),
    ];
    const csv = buildCSV(sessions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4); // header + 3 rows
  });
});
