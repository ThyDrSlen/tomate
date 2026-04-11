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
        startTime: 2_000,
        endTime: 2_000 + DEFAULT_CONFIG.shortBreakDuration,
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
        scheduledTime: 2_000 + DEFAULT_CONFIG.shortBreakDuration,
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

  it('attributes a cross-midnight session to the completion date, not the start date', async () => {
    // Session started at 23:58 on 2026-03-19, completed at 00:03 on 2026-03-20
    const startTime = new Date(2026, 2, 19, 23, 58, 0).getTime();
    const endTime = new Date(2026, 2, 20, 0, 3, 0).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(endTime);

    await setCurrentLabel('Late night session');
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime,
        endTime: startTime + DEFAULT_CONFIG.workDuration,
        duration: DEFAULT_CONFIG.workDuration,
      }),
    );
    await initBackground();

    await fakeBrowser.alarms.onAlarm.trigger({
      name: 'tomate-timer',
      scheduledTime: startTime + DEFAULT_CONFIG.workDuration,
    });

    const sessions = await getSessionHistory();
    expect(sessions).toHaveLength(1);
    // The session must be filed under the completion date (2026-03-20), not start date (2026-03-19)
    expect(sessions[0].date).toBe('2026-03-20');
    expect(sessions[0].startTime).toBe(startTime);
    expect(sessions[0].endTime).toBe(endTime);
  });

  it('shows storage-derived today count in BREAK_SUGGESTION badge after midnight', async () => {
    // Simulate: state has completedToday=5 from yesterday, but storage has 0 sessions today
    // (the counter was never reset). refreshBadge should show 0, not 5.
    const now = new Date(2026, 2, 20, 0, 5, 0).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await setTimerState(
      createState({
        phase: 'BREAK_SUGGESTION',
        completedToday: 5, // stale — from yesterday
        sessionCount: 5,
      }),
    );
    // No sessions stored for today (2026-03-20) — all were from yesterday
    await initBackground();

    // Trigger badge refresh
    await fakeBrowser.alarms.onAlarm.trigger({ name: 'badge-refresh', scheduledTime: now });

    // Badge should reflect 0 sessions today, not the stale completedToday=5
    expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({ text: '0✓' });
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

  // #269: openBreakTab path in onAlarm
  it('opens the stats tab on working alarm completion when openBreakTab is true', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const tabsCreate = vi.fn().mockResolvedValue({});
    fakeBrowser.tabs.create = tabsCreate;
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

    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('stats.html') }),
    );
  });

  it('does NOT open the stats tab on working alarm completion when openBreakTab is false', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const tabsCreate = vi.fn().mockResolvedValue({});
    fakeBrowser.tabs.create = tabsCreate;
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 4_000,
        duration: 3_000,
      }),
    );
    // set openBreakTab: false in config
    await setConfig(createConfig({ openBreakTab: false }));
    await initBackground();

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

    expect(tabsCreate).not.toHaveBeenCalled();
  });

  // #270: multi-hop missed alarm recovery
  it('recovers two-hop missed alarms: WORKING->SHORT_BREAK->IDLE when both phases expired', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100_000);
    await setCurrentLabel('Multi-hop work');
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 2_000,
        duration: 1_000,
      }),
    );
    // Use a short break duration that also expires before now=100_000
    await setConfig(createConfig({ shortBreakDuration: 500 }));
    await initBackground();

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);

    // Both WORKING and SHORT_BREAK have expired -> final state is IDLE
    const finalState = await getTimerState();
    expect(finalState.phase).toBe('IDLE');
    expect(finalState.sessionCount).toBe(1);
    expect(finalState.completedToday).toBe(1);

    // Alarm should be cleared since we're idle
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();

    // Session was saved for the WORKING phase
    const sessions = await getSessionHistory();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ label: 'Multi-hop work' });
  });

  it('exits gracefully and reaches IDLE when both WORKING and SHORT_BREAK have expired', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    // Use a very short cycle so many hops would occur without cap
    await setConfig(createConfig({ workDuration: 100, shortBreakDuration: 100 }));
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 1_100,
        duration: 100,
      }),
    );
    await initBackground();

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false } as never);

    const finalState = await getTimerState();
    // WORKING -> SHORT_BREAK -> IDLE (both phases expired)
    expect(finalState.phase).toBe('IDLE');
    expect(finalState.sessionCount).toBe(1);
  });
});
