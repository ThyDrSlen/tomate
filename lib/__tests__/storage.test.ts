import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  MAX_SESSIONS,
  addCompletedSession,
  getConfig,
  getCurrentLabel,
  getHeatmapData,
  getPendingCelebration,
  getSessionHistory,
  getTimerState,
  getTodayCount,
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

  it('caps sessions at MAX_SESSIONS to prevent quota issues', async () => {
    const baseTime = new Date(2026, 0, 1, 9, 0, 0).getTime();

    // Pre-seed storage with MAX_SESSIONS sessions
    const initial = Array.from({ length: MAX_SESSIONS }, (_, i) =>
      createSession(baseTime + i * 1_000, { id: `seed-${i}` }),
    );
    await fakeBrowser.storage.local.set({ sessions: initial });

    // Add one more — should evict the oldest
    const extra = createSession(baseTime + MAX_SESSIONS * 1_000, { id: 'extra' });
    await addCompletedSession(extra);

    const stored = await getSessionHistory();
    expect(stored.length).toBe(MAX_SESSIONS);
    expect(stored[0].id).toBe('seed-1');
    expect(stored[stored.length - 1].id).toBe('extra');
  });

  it('prunes oldest sessions and retries when QuotaExceededError is thrown', async () => {
    // PRUNE_COUNT = Math.max(100, ceil(MAX_SESSIONS * 0.1)) = 200.
    // Seed with PRUNE_COUNT + 50 so that after pruning the newest sessions remain.
    const PRUNE_COUNT = Math.max(100, Math.ceil(MAX_SESSIONS * 0.1));
    const seedCount = PRUNE_COUNT + 50;
    const baseTime = new Date(2026, 0, 2, 9, 0, 0).getTime();
    const sessions = Array.from({ length: seedCount }, (_, i) =>
      createSession(baseTime + i * 1_000, { id: `s-${i}` }),
    );
    await fakeBrowser.storage.local.set({ sessions });

    // Intercept the first write with a QuotaExceededError, then restore so
    // the retry write goes through to the real fakeBrowser storage.
    let firstCall = true;
    const spy = vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items: Record<string, unknown>) => {
      if ('sessions' in items && firstCall) {
        firstCall = false;
        spy.mockRestore(); // let retry use the real set
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      throw new Error('unexpected spy call');
    });

    const newSession = createSession(baseTime + seedCount * 1_000, { id: 'new' });
    await addCompletedSession(newSession);

    const stored = await getSessionHistory();
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[stored.length - 1].id).toBe('new');
  });

  it('logs console.error and does not throw if retry also fails', async () => {
    const quotaError = new Error('QuotaExceededError');
    quotaError.name = 'QuotaExceededError';
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(quotaError);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const session = createSession(Date.now());
    await expect(addCompletedSession(session)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('re-throws non-quota errors from storage.set', async () => {
    const storageError = new Error('Internal storage error');
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(storageError);

    const session = createSession(Date.now());
    await expect(addCompletedSession(session)).rejects.toThrow('Internal storage error');
  });
});
