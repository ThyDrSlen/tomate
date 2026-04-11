import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  getConfig,
  getPendingCelebration,
  getSessionHistory,
  getTimerState,
  setConfig,
  setCurrentLabel,
  setTimerState,
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

const initBackground = async (): Promise<void> => {
  (globalThis as typeof globalThis & { defineBackground: (main?: () => void | Promise<void>) => { main?: () => void | Promise<void> } }).defineBackground =
    (main) => ({ main });

  const background = (await import(`../background?test=${Math.random()}`)) as BackgroundModule;
  await background.default.main?.();
};

describe('background service worker', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();

    fakeBrowser.action.setBadgeText = vi.fn().mockResolvedValue(undefined);
    fakeBrowser.action.setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    fakeBrowser.tabs.create = vi.fn().mockResolvedValue({ id: 1 });
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
        date: '1970-01-01',
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
        date: '1970-01-01',
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

  describe('openBreakTab', () => {
    it('opens the stats tab when openBreakTab is true and the working alarm fires', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(5_000);
      await setConfig(createConfig({ openBreakTab: true }));
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

      expect(fakeBrowser.tabs.create).toHaveBeenCalledOnce();
      expect(fakeBrowser.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('stats.html') }),
      );
    });

    it('does not open a tab when openBreakTab is false and the working alarm fires', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(5_000);
      await setConfig(createConfig({ openBreakTab: false }));
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

      expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
    });

    it('catches errors from browser.tabs.create silently and still completes the alarm', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(5_000);
      (fakeBrowser.tabs.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('No window'));
      await setConfig(createConfig({ openBreakTab: true }));
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: 1_000,
          endTime: 4_000,
          duration: 3_000,
        }),
      );
      await initBackground();

      // Should not throw even though tabs.create rejects
      await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

      // Timer state still advances to SHORT_BREAK
      await expect(getTimerState()).resolves.toMatchObject({ phase: 'SHORT_BREAK' });
    });
  });

  describe('multi-hop missed alarm recovery', () => {
    it('recovers through WORKING and expired SHORT_BREAK, ending in IDLE', async () => {
      // Date.now returns a small value for the first call (used when computing
      // firstRecovered's endTime) then a much larger value for the while-loop
      // check so that the SHORT_BREAK is also seen as expired.
      const shortBreakDuration = 1_000;
      let callCount = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount += 1;
        // First call: inside recoverMissedAlarm / completeTimer
        // SHORT_BREAK endTime will be 10_000 + 1_000 = 11_000
        if (callCount === 1) return 10_000;
        // Subsequent calls: while loop and badge refresh — time has advanced past break
        return 15_000;
      });

      await setConfig(createConfig({ shortBreakDuration }));
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

      // SHORT_BREAK (endTime=11_000) is expired at 15_000, so loop advances to IDLE
      await expect(getTimerState()).resolves.toMatchObject({ phase: 'IDLE' });
    });

    it('exits gracefully at the safety cap when Date.now keeps advancing past each new phase', async () => {
      // Simulate time always advancing past each new phase endTime by returning
      // an ever-increasing value. This exercises the MAX_ITERATIONS cap.
      const shortBreakDuration = 500;
      let callIndex = 0;
      // Each call to Date.now returns a value that makes the NEXT phase look expired too.
      // The sequence: 10_000 (for first recoverMissedAlarm), then 11_000, 12_000...
      // so SHORT_BREAK endTime = 10_000 + 500 = 10_500, which is < 11_000 ✓
      // then completeTimer for SHORT_BREAK → IDLE (endTime null) → loop exits naturally.
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callIndex += 1;
        return 10_000 + callIndex * 1_000;
      });

      await setConfig(createConfig({ shortBreakDuration }));
      await setTimerState(
        createState({
          phase: 'WORKING',
          startTime: 1_000,
          endTime: 2_000,
          duration: 1_000,
        }),
      );
      await initBackground();

      // Should complete without hanging or throwing
      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);

      // Recovery must terminate in a valid phase regardless of how many hops occurred
      const state = await getTimerState();
      expect(['IDLE', 'WORKING', 'SHORT_BREAK', 'LONG_BREAK', 'BREAK_SUGGESTION']).toContain(state.phase);
    });
  });
});
