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

  it('caps stored sessions at MAX_SESSIONS (10 000)', async () => {
    // Seed storage with MAX_SESSIONS sessions directly so addCompletedSession
    // can observe the cap on a single add.
    const MAX_SESSIONS = 10_000;
    const seed: CompletedSession[] = Array.from({ length: MAX_SESSIONS }, (_, i) =>
      createSession(i, { id: `seed-${i}` }),
    );
    await fakeBrowser.storage.local.set({ sessions: seed });

    const extra = createSession(MAX_SESSIONS, { id: 'extra' });
    await addCompletedSession(extra);

    const stored = await fakeBrowser.storage.local.get('sessions');
    const result = stored['sessions'] as CompletedSession[];
    expect(result).toHaveLength(MAX_SESSIONS);
    expect(result[result.length - 1].id).toBe('extra');
  });

  it('prunes ~10 % of sessions on quota error and still applies MAX_SESSIONS cap on retry', async () => {
    const MAX_SESSIONS = 10_000;
    const seed: CompletedSession[] = Array.from({ length: MAX_SESSIONS }, (_, i) =>
      createSession(i, { id: `seed-${i}` }),
    );
    await fakeBrowser.storage.local.set({ sessions: seed });

    // Make the first storage.set throw a quota error, but let the retry through.
    let callCount = 0;
    const originalSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
      if (callCount === 0 && 'sessions' in items) {
        callCount++;
        throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
      }
      callCount++;
      return originalSet(items);
    });

    const extra = createSession(MAX_SESSIONS, { id: 'retry-extra' });
    await addCompletedSession(extra);

    const stored = await fakeBrowser.storage.local.get('sessions');
    const result = stored['sessions'] as CompletedSession[];

    // Must never exceed MAX_SESSIONS
    expect(result.length).toBeLessThanOrEqual(MAX_SESSIONS);
    // The new session must be present
    expect(result[result.length - 1].id).toBe('retry-extra');
  });

  it('roundtrips the pending celebration flag', async () => {
    await expect(getPendingCelebration()).resolves.toBe(false);

    await setPendingCelebration(true);
    await expect(getPendingCelebration()).resolves.toBe(true);

    await setPendingCelebration(false);
    await expect(getPendingCelebration()).resolves.toBe(false);
  });
});
