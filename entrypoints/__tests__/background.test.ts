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

  it('opens stats tab when WORKING session completes and openBreakTab is true', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const createTabSpy = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
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

    expect(createTabSpy).toHaveBeenCalledOnce();
    expect(createTabSpy).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('stats.html') }),
    );
  });

  it('does not open tab when openBreakTab is false', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const createTabSpy = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
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

    expect(createTabSpy).not.toHaveBeenCalled();
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
});
