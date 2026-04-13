import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  getConfig,
  getPendingCelebration,
  getSessionHistory,
  getTimerState,
  setCurrentLabel,
  setTimerState,
  toDateKey,
} from '@/lib/storage';
import { DEFAULT_CONFIG, INITIAL_STATE, type TimerConfig, type TimerState } from '@/lib/types';

type BackgroundModule = {
  default: {
    main?: () => void | Promise<void>;
  };
};

const createState = (overrides: Partial<TimerState> = {}): TimerState => ({
  ...INITIAL_STATE,
  ...overrides,
});

const createConfig = (overrides: Partial<TimerConfig> = {}): TimerConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

let testId = 0;

const initBackground = async (): Promise<void> => {
  (globalThis as typeof globalThis & { defineBackground: (main?: () => void | Promise<void>) => { main?: () => void | Promise<void> } }).defineBackground =
    (main) => ({ main });

  const background = (await import(`../background?test=${testId++}`)) as BackgroundModule;
  await background.default.main?.();
};

describe('background service worker', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();

    fakeBrowser.action.setBadgeText = vi.fn().mockResolvedValue(undefined);
    fakeBrowser.action.setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
  });

  it('starts a timer, persists working state, and creates the timer alarm', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await initBackground();

    const response = await fakeBrowser.runtime.sendMessage({ action: 'START_TIMER' });
    const state = await getTimerState();
    const alarm = await fakeBrowser.alarms.get('tomate-timer');
    const badgeRefresh = await fakeBrowser.alarms.get('badge-refresh');

    expect(response).toEqual(state);
    expect(state).toEqual(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 1_000 + DEFAULT_CONFIG.workDuration,
        duration: DEFAULT_CONFIG.workDuration,
      }),
    );
    expect(alarm?.scheduledTime).toBe(1_000 + DEFAULT_CONFIG.workDuration);
    expect(badgeRefresh?.periodInMinutes).toBe(1);
    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: '25' });
  });

  it('abandons an active timer, clears alarms, and returns to idle', async () => {
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 2_000,
        duration: 1_000,
        sessionCount: 2,
        cyclePosition: 1,
        completedToday: 2,
      }),
    );
    await initBackground();
    await fakeBrowser.alarms.create('tomate-timer', { when: 2_000 });
    await fakeBrowser.alarms.create('badge-refresh', { periodInMinutes: 1 });

    const response = await fakeBrowser.runtime.sendMessage({ action: 'ABANDON_TIMER' });

    expect(response).toEqual(
      createState({
        sessionCount: 2,
        cyclePosition: 1,
        completedToday: 2,
      }),
    );
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();
    await expect(fakeBrowser.alarms.get('badge-refresh')).resolves.toBeUndefined();
  });

  it('completes a working alarm, saves a session, sets celebration, and notifies', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    await setCurrentLabel('Focus block');
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 4_000,
        duration: 3_000,
      }),
    );
    await initBackground();

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

    await expect(getTimerState()).resolves.toEqual(
      createState({
        phase: 'SHORT_BREAK',
        startTime: 5_000,
        endTime: 5_000 + DEFAULT_CONFIG.shortBreakDuration,
        duration: DEFAULT_CONFIG.shortBreakDuration,
        sessionCount: 1,
        completedToday: 1,
      }),
    );
    await expect(getPendingCelebration()).resolves.toBe(true);
    await expect(getSessionHistory()).resolves.toEqual([
      {
        id: expect.any(String),
        label: 'Focus block',
        startTime: 1_000,
        endTime: 5_000,
        date: toDateKey(1_000),
        duration: 3_000,
      },
    ]);

    const notifications = await fakeBrowser.notifications.getAll();
    expect(Object.values(notifications)).toContainEqual(
      expect.objectContaining({
        title: '🍅 Tomate Complete!',
        message: "Time for a break. You've done 1 tomate(s) today.",
      }),
    );
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toEqual(
      expect.objectContaining({
        scheduledTime: 5_000 + DEFAULT_CONFIG.shortBreakDuration,
      }),
    );
  });

  it('completes a short break alarm and returns to idle with a notification', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_000);
    await setTimerState(
      createState({
        phase: 'SHORT_BREAK',
        startTime: 6_000,
        endTime: 8_000,
        duration: 2_000,
        sessionCount: 1,
        completedToday: 1,
      }),
    );
    await initBackground();

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 8_000 });

    await expect(getTimerState()).resolves.toEqual(
      createState({
        sessionCount: 1,
        cyclePosition: 1,
        completedToday: 1,
      }),
    );
    await expect(fakeBrowser.alarms.get('badge-refresh')).resolves.toBeUndefined();

    const notifications = await fakeBrowser.notifications.getAll();
    expect(Object.values(notifications)).toContainEqual(
      expect.objectContaining({
        title: "Break's Over",
        message: 'Ready for another tomate?',
      }),
    );
  });

  it('recovers a missed working alarm on startup and records the completed session', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    await setCurrentLabel('Recovered work');
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 2_000,
        duration: 1_000,
      }),
    );
    await initBackground();

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);

    await expect(getTimerState()).resolves.toEqual(
      createState({
        phase: 'SHORT_BREAK',
        startTime: 10_000,
        endTime: 10_000 + DEFAULT_CONFIG.shortBreakDuration,
        duration: DEFAULT_CONFIG.shortBreakDuration,
        sessionCount: 1,
        completedToday: 1,
      }),
    );
    await expect(getPendingCelebration()).resolves.toBe(true);
    await expect(getSessionHistory()).resolves.toEqual([
      {
        id: expect.any(String),
        label: 'Recovered work',
        startTime: 1_000,
        endTime: 10_000,
        date: toDateKey(1_000),
        duration: 1_000,
      },
    ]);
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toEqual(
      expect.objectContaining({
        scheduledTime: 10_000 + DEFAULT_CONFIG.shortBreakDuration,
      }),
    );
  });

  it('returns the current timer state for GET_STATE', async () => {
    const storedState = createState({
      phase: 'BREAK_SUGGESTION',
      sessionCount: 4,
      cyclePosition: 3,
      completedToday: 4,
    });
    await setTimerState(storedState);
    await initBackground();

    await expect(fakeBrowser.runtime.sendMessage({ action: 'GET_STATE' })).resolves.toEqual(storedState);
  });

  it('updates config during an active timer and recreates the timer alarm', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const updatedConfig = createConfig({ workDuration: 20_000, shortBreakDuration: 1_000 });
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 5_000,
        endTime: 15_000,
        duration: 10_000,
      }),
    );
    await initBackground();

    const response = await fakeBrowser.runtime.sendMessage({ action: 'UPDATE_CONFIG', config: updatedConfig });

    expect(response).toEqual(
      createState({
        phase: 'WORKING',
        startTime: 5_000,
        endTime: 25_000,
        duration: 20_000,
      }),
    );
    await expect(getConfig()).resolves.toEqual(updatedConfig);
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toEqual(
      expect.objectContaining({
        scheduledTime: 25_000,
      }),
    );
  });

  // #177 — reschedulePendingTimer and onInstalled reason tests
  describe('onInstalled reason routing (#177)', () => {
    it('reschedules active WORKING timer on update reason', async () => {
      const endTime = Date.now() + 10_000; // future
      vi.spyOn(Date, 'now').mockReturnValue(endTime - 10_000);
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: endTime - 10_000,
          endTime,
          duration: 10_000,
        }),
      );
      await initBackground();

      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', temporary: false } as never);

      // Should have recreated the timer alarm at the original endTime
      const alarm = await fakeBrowser.alarms.get('tomate-timer');
      expect(alarm?.scheduledTime).toBe(endTime);
    });

    it('reschedules active SHORT_BREAK timer on chrome_update reason', async () => {
      const endTime = Date.now() + 5_000;
      vi.spyOn(Date, 'now').mockReturnValue(endTime - 5_000);
      await setTimerState(
        createState({
          phase: 'SHORT_BREAK',
          startTime: endTime - 5_000,
          endTime,
          duration: 5_000,
        }),
      );
      await initBackground();

      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'chrome_update', temporary: false } as never);

      const alarm = await fakeBrowser.alarms.get('tomate-timer');
      expect(alarm?.scheduledTime).toBe(endTime);
    });

    it('calls recoverFromMissedAlarm for install reason (fresh install)', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(10_000);
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: 1_000,
          endTime: 2_000, // already expired
          duration: 1_000,
        }),
      );
      await initBackground();

      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);

      // Recovery should have advanced to SHORT_BREAK
      const state = await getTimerState();
      expect(state.phase).toBe('SHORT_BREAK');
    });

    it('reschedulePendingTimer falls back to recovery when timer is expired', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(50_000);
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: 1_000,
          endTime: 2_000, // expired
          duration: 1_000,
        }),
      );
      await initBackground();

      // 'update' reason with expired timer → should recover
      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', temporary: false } as never);

      const state = await getTimerState();
      expect(state.phase).toBe('SHORT_BREAK');
    });

    it('reschedulePendingTimer falls back to recovery when in IDLE state', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(10_000);
      // IDLE state — no timer to reschedule
      await initBackground();

      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', temporary: false } as never);

      // Should remain IDLE (recovery from IDLE is a no-op)
      const state = await getTimerState();
      expect(state.phase).toBe('IDLE');
    });
  });

  // #179 — onAlarm try/catch and error badge tests
  describe('onAlarm error handling (#179)', () => {
    it('sets error badge when onAlarm throws an unexpected error', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(5_000);
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: 1_000,
          endTime: 4_000,
          duration: 3_000,
        }),
      );
      await initBackground();

      // Make getTimerState throw to simulate alarm handler error
      // We'll trigger the alarm on an unexpected internal error path
      // by making completeTimer throw through setTimerState
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate an error during alarm processing by corrupting storage read
      vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValueOnce(new Error('storage read failed'));

      await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

      // Should have set error badge
      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: '!' });
      expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#DC2626' });
      expect(consoleSpy).toHaveBeenCalledWith('[tomate] onAlarm error:', expect.any(Error));
    });

    it('badge-refresh alarm only loads state, not config', async () => {
      await initBackground();

      const getSpy = vi.spyOn(fakeBrowser.storage.local, 'get');

      await fakeBrowser.alarms.onAlarm.trigger({ name: 'badge-refresh', scheduledTime: 0 });

      // Should have loaded timerState and sessions (for todayCount), not config
      const keys = getSpy.mock.calls.flatMap((call) => {
        const arg = call[0];
        return Array.isArray(arg) ? arg : [arg];
      });
      expect(keys).not.toContain('config');
    });

    it('notification error during WORKING phase does not stop timer processing', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(5_000);
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: 1_000,
          endTime: 4_000,
          duration: 3_000,
        }),
      );
      await initBackground();

      // Make notifications.create throw
      vi.spyOn(fakeBrowser.notifications, 'create').mockRejectedValueOnce(new Error('notifications unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

      // Timer state should still advance despite notification failure
      const state = await getTimerState();
      expect(state.phase).toBe('SHORT_BREAK');
    });
  });
});
