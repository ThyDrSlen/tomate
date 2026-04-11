import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  addCompletedSession,
  getConfig,
  getCurrentLabel,
  getHeatmapData,
  getPendingCelebration,
  getSessionHistory,
  getSessionsForYear,
  getTimerState,
  getTodayCount,
  MAX_SESSIONS,
  setConfig,
  setCurrentLabel,
  setPendingCelebration,
  setTimerState,
  toDateKey,
} from '../storage';
import { DEFAULT_CONFIG, INITIAL_STATE, type CompletedSession, type TimerConfig, type TimerState } from '../types';

const createState = (overrides: Partial<TimerState> = {}): TimerState => ({
  ...INITIAL_STATE,
  ...overrides,
});

const createConfig = (overrides: Partial<TimerConfig> = {}): TimerConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createSession = (timestamp: number, overrides: Partial<CompletedSession> = {}): CompletedSession => ({
  id: overrides.id ?? `session-${timestamp}`,
  label: overrides.label ?? 'Deep work',
  startTime: overrides.startTime ?? timestamp,
  endTime: overrides.endTime ?? timestamp + 1_500_000,
  date: overrides.date ?? toDateKey(timestamp),
  duration: overrides.duration ?? 1_500_000,
});

describe('storage helpers', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('reads the default timer state when storage is empty', async () => {
    await expect(getTimerState()).resolves.toEqual(INITIAL_STATE);
  });

  it('roundtrips timer state through storage', async () => {
    const state = createState({
      phase: 'WORKING',
      startTime: 1_000,
      endTime: 2_000,
      duration: 1_000,
      sessionCount: 3,
      cyclePosition: 2,
      completedToday: 3,
    });

    await setTimerState(state);

    await expect(getTimerState()).resolves.toEqual(state);
  });

  it('reads the default config when storage is empty', async () => {
    await expect(getConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });

  it('roundtrips config through storage', async () => {
    const config = createConfig({
      workDuration: 10 * 60 * 1000,
      shortBreakDuration: 2 * 60 * 1000,
      longBreakDuration: 15 * 60 * 1000,
    });

    await setConfig(config);

    await expect(getConfig()).resolves.toEqual(config);
  });

  it('adds a completed session and returns it from history', async () => {
    const session = createSession(new Date(2026, 2, 15, 9, 0, 0).getTime());

    await addCompletedSession(session);

    await expect(getSessionHistory()).resolves.toEqual([session]);
  });

  it('filters session history to the last requested number of days', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 2, 20, 12, 0, 0).getTime());

    const withinRange = createSession(new Date(2026, 2, 19, 9, 0, 0).getTime());
    const today = createSession(new Date(2026, 2, 20, 8, 0, 0).getTime());
    const outsideRange = createSession(new Date(2026, 2, 16, 9, 0, 0).getTime());

    await addCompletedSession(withinRange);
    await addCompletedSession(today);
    await addCompletedSession(outsideRange);

    await expect(getSessionHistory(2)).resolves.toEqual([withinRange, today]);
  });

  it('getSessionsForYear returns only sessions within the given year', async () => {
    const inYear = createSession(new Date(2026, 5, 15, 9, 0, 0).getTime(), { id: 'in-2026' });
    const otherYear = createSession(new Date(2025, 11, 31, 9, 0, 0).getTime(), { id: 'in-2025' });

    await addCompletedSession(inYear);
    await addCompletedSession(otherYear);

    await expect(getSessionsForYear(2026)).resolves.toEqual([inYear]);
    await expect(getSessionsForYear(2025)).resolves.toEqual([otherYear]);
  });

  it('getSessionsForYear returns empty array when no sessions exist for year', async () => {
    await expect(getSessionsForYear(2030)).resolves.toEqual([]);
  });

  it('aggregates heatmap counts by local date key', async () => {
    const dateA = new Date(2026, 2, 15, 9, 0, 0).getTime();
    const dateB = new Date(2026, 2, 16, 14, 0, 0).getTime();

    await addCompletedSession(createSession(dateA, { id: 'a-1' }));
    await addCompletedSession(createSession(dateA + 1_000, { id: 'a-2' }));
    await addCompletedSession(createSession(dateA + 2_000, { id: 'a-3' }));
    await addCompletedSession(createSession(dateB, { id: 'b-1' }));

    await expect(getHeatmapData(30)).resolves.toEqual({
      [toDateKey(dateA)]: 3,
      [toDateKey(dateB)]: 1,
    });
  });

  it('counts only todays sessions', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 2, 20, 12, 0, 0).getTime());

    const todayTimestamp = new Date(2026, 2, 20, 9, 0, 0).getTime();
    const yesterdayTimestamp = new Date(2026, 2, 19, 9, 0, 0).getTime();

    await addCompletedSession(createSession(todayTimestamp, { id: 'today-1' }));
    await addCompletedSession(createSession(todayTimestamp + 1_000, { id: 'today-2' }));
    await addCompletedSession(createSession(yesterdayTimestamp, { id: 'yesterday-1' }));

    await expect(getTodayCount()).resolves.toBe(2);
  });

  it('truncates labels to 50 characters before storing', async () => {
    const label = 'x'.repeat(51);

    await setCurrentLabel(label);

    await expect(getCurrentLabel()).resolves.toBe('x'.repeat(50));
  });

  it('roundtrips the pending celebration flag', async () => {
    await expect(getPendingCelebration()).resolves.toBe(false);

    await setPendingCelebration(true);
    await expect(getPendingCelebration()).resolves.toBe(true);

    await setPendingCelebration(false);
    await expect(getPendingCelebration()).resolves.toBe(false);
  });

  it('caps sessions at MAX_SESSIONS when adding beyond the limit (#175)', async () => {
    // Pre-populate MAX_SESSIONS sessions
    const sessions = Array.from({ length: MAX_SESSIONS }, (_, i) =>
      createSession(i * 1000, { id: `s${i}` }),
    );
    await fakeBrowser.storage.local.set({ sessions });

    // Adding one more should drop the oldest
    const newest = createSession(MAX_SESSIONS * 1000, { id: 'newest' });
    await addCompletedSession(newest);

    const stored = await getSessionHistory();
    expect(stored).toHaveLength(MAX_SESSIONS);
    expect(stored[stored.length - 1].id).toBe('newest');
    expect(stored[0].id).toBe('s1'); // s0 was pruned
  });

  it('on QuotaExceededError, prunes oldest 10% and retries with MAX_SESSIONS cap (#202)', async () => {
    // Pre-populate with MAX_SESSIONS sessions
    const sessions = Array.from({ length: MAX_SESSIONS }, (_, i) =>
      createSession(i * 1000, { id: `s${i}` }),
    );
    await fakeBrowser.storage.local.set({ sessions });

    // Make first set() call throw QuotaExceededError, second succeed normally
    let callCount = 0;
    const origSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return origSet(items);
    });

    const newest = createSession(MAX_SESSIONS * 1000, { id: 'retry-session' });
    await addCompletedSession(newest);

    const stored = await getSessionHistory();
    // After retry: pruned 10% of MAX_SESSIONS = 200, leaving 1800 + 1 new = 1801
    expect(stored.length).toBeLessThanOrEqual(MAX_SESSIONS);
    expect(stored[stored.length - 1].id).toBe('retry-session');
  });

  it('rethrows non-quota storage errors (#202)', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('disk failure'));
    const session = createSession(Date.now(), { id: 'fail' });
    await expect(addCompletedSession(session)).rejects.toThrow('disk failure');
  });
});
