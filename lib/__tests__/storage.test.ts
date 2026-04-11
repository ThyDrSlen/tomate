import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  StorageQuotaError,
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

  describe('getConfig() schema version migration', () => {
    it('migrates a v1 config (no _version field) to v2 with defaults filled in', async () => {
      // Simulate a v1 config stored without the _version field
      const v1Config = { workDuration: 20 * 60 * 1000, shortBreakDuration: 3 * 60 * 1000, longBreakDuration: 15 * 60 * 1000 };
      await fakeBrowser.storage.local.set({ config: v1Config });

      const result = await getConfig();

      // Should return config with v1 values merged with defaults
      expect(result).toEqual({
        workDuration: 20 * 60 * 1000,
        shortBreakDuration: 3 * 60 * 1000,
        longBreakDuration: 15 * 60 * 1000,
      });

      // After migration, storage should now contain _version: 2
      const stored = await fakeBrowser.storage.local.get('config');
      expect((stored.config as { _version?: number })._version).toBe(2);
    });

    it('passes through a v2 config without overwriting storage', async () => {
      const v2Config = { workDuration: 30 * 60 * 1000, shortBreakDuration: 10 * 60 * 1000, longBreakDuration: 20 * 60 * 1000, _version: 2 };
      await fakeBrowser.storage.local.set({ config: v2Config });

      const setMock = vi.spyOn(fakeBrowser.storage.local, 'set');

      const result = await getConfig();

      // Should return config without the internal _version field
      expect(result).toEqual({
        workDuration: 30 * 60 * 1000,
        shortBreakDuration: 10 * 60 * 1000,
        longBreakDuration: 20 * 60 * 1000,
      });

      // No migration write should have been triggered for an up-to-date config
      expect(setMock).not.toHaveBeenCalled();
    });
  });

  describe('addCompletedSession() quota exceeded auto-prune and retry', () => {
    it('calls pruneOldestSessions and retries when the first set throws QuotaExceededError', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) =>
        createSession(new Date(2026, 0, i + 1).getTime(), { id: `session-${i}` }),
      );
      for (const s of sessions) {
        await fakeBrowser.storage.local.set({ sessions: [...((await fakeBrowser.storage.local.get('sessions')).sessions as CompletedSession[] | undefined ?? []), s] });
      }

      const quotaError = Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
      let callCount = 0;
      const originalSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
      vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
        if ('sessions' in items) {
          callCount++;
          if (callCount === 1) throw quotaError;
        }
        return originalSet(items);
      });

      const newSession = createSession(new Date(2026, 0, 20).getTime(), { id: 'new-session' });
      await addCompletedSession(newSession);

      // The retry should have been attempted (set called twice for sessions)
      expect(callCount).toBe(2);

      // The saved sessions should be pruned (first 10% removed) plus the new session
      const stored = await fakeBrowser.storage.local.get('sessions');
      const savedSessions = stored.sessions as CompletedSession[];
      expect(savedSessions[savedSessions.length - 1].id).toBe('new-session');
      // 10 sessions → prune 1 → 9 remaining + new = 10
      expect(savedSessions.length).toBe(10);
    });

    it('throws StorageQuotaError if the retry also fails with a quota error', async () => {
      const quotaError = Object.assign(new Error('QUOTA_BYTES exceeded'), { name: 'QuotaExceededError' });
      vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
        if ('sessions' in items) throw quotaError;
      });

      const newSession = createSession(Date.now(), { id: 'fail-session' });
      await expect(addCompletedSession(newSession)).rejects.toBeInstanceOf(StorageQuotaError);
    });

    it('re-throws non-quota errors without pruning', async () => {
      const unexpectedError = new Error('Unexpected storage error');
      vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items) => {
        if ('sessions' in items) throw unexpectedError;
      });

      const newSession = createSession(Date.now(), { id: 'error-session' });
      await expect(addCompletedSession(newSession)).rejects.toThrow('Unexpected storage error');
    });
  });
});
