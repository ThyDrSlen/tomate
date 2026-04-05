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

const initBackground = async (): Promise<void> => {
  vi.resetModules();

  (globalThis as typeof globalThis & { defineBackground: (main?: () => void | Promise<void>) => { main?: () => void | Promise<void> } }).defineBackground =
    (main) => ({ main });

  const background = (await import('../background')) as BackgroundModule;
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
        phase: 'BREAK_SUGGESTION',
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

    expect(fakeBrowser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/complete.html?type=work&count=1'),
      }),
    );
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();
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

    expect(fakeBrowser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/complete.html?type=break'),
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
        phase: 'BREAK_SUGGESTION',
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
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();
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

  it('accepts a suggested long break, schedules the alarm, and shows a break badge', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(20_000);
    const config = createConfig({ longBreakDuration: 1_800_000 });
    await fakeBrowser.storage.local.set({ config });
    await setTimerState(
      createState({
        phase: 'BREAK_SUGGESTION',
        cyclePosition: 3,
        completedToday: 4,
        sessionCount: 4,
      }),
    );
    await initBackground();

    const response = await fakeBrowser.runtime.sendMessage({ action: 'ACCEPT_LONG_BREAK' });

    expect(response).toEqual(
      createState({
        phase: 'LONG_BREAK',
        startTime: 20_000,
        endTime: 20_000 + config.longBreakDuration,
        duration: config.longBreakDuration,
        cyclePosition: 3,
        completedToday: 4,
        sessionCount: 4,
      }),
    );
    await expect(getTimerState()).resolves.toEqual(response);
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toEqual(
      expect.objectContaining({ scheduledTime: 20_000 + config.longBreakDuration }),
    );
    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: 'BRK' });
    expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#16A34A' });
  });

  it('skips a suggested long break, resets cycle position, and clears alarms', async () => {
    await setTimerState(
      createState({
        phase: 'BREAK_SUGGESTION',
        cyclePosition: 3,
        completedToday: 4,
        sessionCount: 4,
      }),
    );
    await initBackground();
    await fakeBrowser.alarms.create('tomate-timer', { when: 50_000 });
    await fakeBrowser.alarms.create('badge-refresh', { periodInMinutes: 1 });

    const response = await fakeBrowser.runtime.sendMessage({ action: 'SKIP_LONG_BREAK' });

    expect(response).toEqual(
      createState({
        cyclePosition: 0,
        completedToday: 4,
        sessionCount: 4,
      }),
    );
    await expect(getTimerState()).resolves.toEqual(response);
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();
    await expect(fakeBrowser.alarms.get('badge-refresh')).resolves.toBeUndefined();
  });

  it('shows the break badge while a short break is active', async () => {
    await setTimerState(
      createState({
        phase: 'SHORT_BREAK',
        startTime: 1_000,
        endTime: 6_000,
        duration: 5_000,
        sessionCount: 1,
        completedToday: 1,
      }),
    );
    await initBackground();

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'badge-refresh', scheduledTime: 2_000 });

    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: 'BRK' });
    expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#16A34A' });
  });

  it('shows a pause indicator badge while paused', async () => {
    await setTimerState(
      createState({
        phase: 'PAUSED',
        duration: 1_500_000,
        pausedFromPhase: 'WORKING',
        pausedRemaining: 300_000,
      }),
    );
    await initBackground();

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'badge-refresh', scheduledTime: 2_000 });

    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: expect.stringContaining('❚❚') });
    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: '❚❚5' });
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

  it('pauses a working timer, clears alarms, and resumes with a new alarm', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 5_000,
        endTime: 15_000,
        duration: 10_000,
      }),
    );
    await initBackground();
    await fakeBrowser.alarms.create('tomate-timer', { when: 15_000 });
    await fakeBrowser.alarms.create('badge-refresh', { periodInMinutes: 1 });

    const pauseResponse = await fakeBrowser.runtime.sendMessage({ action: 'PAUSE_TIMER' });

    expect(pauseResponse).toEqual(
      createState({
        phase: 'PAUSED',
        startTime: null,
        endTime: null,
        duration: 10_000,
        pausedFromPhase: 'WORKING',
        pausedRemaining: 5_000,
      }),
    );
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();
    await expect(fakeBrowser.alarms.get('badge-refresh')).resolves.toBeUndefined();

    vi.spyOn(Date, 'now').mockReturnValue(30_000);
    const resumeResponse = await fakeBrowser.runtime.sendMessage({ action: 'RESUME_TIMER' });

    expect(resumeResponse).toEqual(
      createState({
        phase: 'WORKING',
        startTime: 30_000,
        endTime: 35_000,
        duration: 10_000,
      }),
    );
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toEqual(
      expect.objectContaining({ scheduledTime: 35_000 }),
    );
    await expect(fakeBrowser.alarms.get('badge-refresh')).resolves.toBeDefined();
  });
});
