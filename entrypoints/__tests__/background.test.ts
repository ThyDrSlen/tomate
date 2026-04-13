import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  getConfig,
  getPendingCelebration,
  getSessionHistory,
  getTimerState,
  setBlockedSites,
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

    // Stub declarativeNetRequest so blocking helpers don't throw in any test.
    (fakeBrowser as typeof fakeBrowser & {
      declarativeNetRequest: {
        getDynamicRules: ReturnType<typeof vi.fn>;
        updateDynamicRules: ReturnType<typeof vi.fn>;
      };
    }).declarativeNetRequest = {
      getDynamicRules: vi.fn().mockResolvedValue([]),
      updateDynamicRules: vi.fn().mockResolvedValue(undefined),
    };
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

  it('opens a tab when a WORKING session completes and openBreakTab is true (#269)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 4_000,
        duration: 3_000,
      }),
    );
    // Persist openBreakTab = true into storage before background initialises
    const { setConfig } = await import('@/lib/storage');
    await setConfig(createConfig({ openBreakTab: true }));
    await initBackground();

    fakeBrowser.tabs.create = vi.fn().mockResolvedValue({ id: 1 });

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

    expect(fakeBrowser.tabs.create).toHaveBeenCalledOnce();
    expect(fakeBrowser.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('stats') }),
    );
  });

  it('does NOT open a tab when a WORKING session completes and openBreakTab is false (#269)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: 4_000,
        duration: 3_000,
      }),
    );
    const { setConfig } = await import('@/lib/storage');
    await setConfig(createConfig({ openBreakTab: false }));
    await initBackground();

    fakeBrowser.tabs.create = vi.fn().mockResolvedValue({ id: 1 });

    await fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 });

    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
  });

  it('recovers a missed WORKING alarm on startup (multi-hop: endTime hours in the past) and transitions to SHORT_BREAK', async () => {
    // Simulate the browser being closed while a WORKING session was active.
    // The endTime is several hours in the past, well past when the session ended.
    const now = 3 * 60 * 60 * 1_000; // 3 hours in ms as "now"
    const sessionStart = 1_000;
    const sessionEnd = sessionStart + DEFAULT_CONFIG.workDuration; // endTime is hours before "now"
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await setCurrentLabel('Overnight session');
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: sessionStart,
        endTime: sessionEnd,
        duration: DEFAULT_CONFIG.workDuration,
      }),
    );
    await initBackground();

    await fakeBrowser.runtime.onStartup.trigger();

    // A single recoverMissedAlarm hop: WORKING → SHORT_BREAK (startTime=now, endTime=now+shortBreak)
    await expect(getTimerState()).resolves.toEqual(
      createState({
        phase: 'SHORT_BREAK',
        startTime: now,
        endTime: now + DEFAULT_CONFIG.shortBreakDuration,
        duration: DEFAULT_CONFIG.shortBreakDuration,
        sessionCount: 1,
        completedToday: 1,
      }),
    );
    // The completed WORKING session must be recorded
    await expect(getSessionHistory()).resolves.toEqual([
      {
        id: expect.any(String),
        label: 'Overnight session',
        startTime: sessionStart,
        endTime: now,
        date: toDateKey(sessionStart),
        duration: DEFAULT_CONFIG.workDuration,
      },
    ]);
    // A timer alarm must be scheduled for the break's end
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toEqual(
      expect.objectContaining({
        scheduledTime: now + DEFAULT_CONFIG.shortBreakDuration,
      }),
    );
  });

  it('recovers a missed SHORT_BREAK alarm on startup (multi-hop: break endTime in the past) and returns to IDLE', async () => {
    // Simulate browser restart where a SHORT_BREAK was active but has also elapsed.
    const now = 2 * 60 * 60 * 1_000; // 2 hours in ms as "now"
    const breakStart = 1_000;
    const breakEnd = breakStart + DEFAULT_CONFIG.shortBreakDuration; // endTime is hours before "now"
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await setTimerState(
      createState({
        phase: 'SHORT_BREAK',
        startTime: breakStart,
        endTime: breakEnd,
        duration: DEFAULT_CONFIG.shortBreakDuration,
        sessionCount: 1,
        cyclePosition: 0,
        completedToday: 1,
      }),
    );
    await initBackground();

    await fakeBrowser.runtime.onStartup.trigger();

    // A single recoverMissedAlarm hop: SHORT_BREAK → IDLE (cyclePosition increments)
    await expect(getTimerState()).resolves.toEqual(
      createState({
        phase: 'IDLE',
        startTime: null,
        endTime: null,
        duration: null,
        sessionCount: 1,
        cyclePosition: 1,
        completedToday: 1,
      }),
    );
    // No additional session should be recorded (only WORKING sessions are persisted)
    await expect(getSessionHistory()).resolves.toEqual([]);
    // All alarms must be cleared
    await expect(fakeBrowser.alarms.get('tomate-timer')).resolves.toBeUndefined();
    await expect(fakeBrowser.alarms.get('badge-refresh')).resolves.toBeUndefined();
  });

  it('rolls back to previous state and skips side effects when setTimerState throws on alarm (#369)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const workingState = createState({
      phase: 'WORKING',
      startTime: 1_000,
      endTime: 4_000,
      duration: 3_000,
    });
    await setTimerState(workingState);
    await initBackground();

    // Make the first setTimerState call (the "completed" write) throw a quota error,
    // but allow the rollback write (second call) to succeed.
    let callCount = 0;
    const originalSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items: Record<string, unknown>) => {
      if ('timerState' in items) {
        callCount += 1;
        if (callCount === 1) {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
      }
      return originalSet(items as Parameters<typeof originalSet>[0]);
    });

    fakeBrowser.tabs.create = vi.fn().mockResolvedValue({ id: 1 });

    await expect(
      fakeBrowser.alarms.onAlarm.trigger({ name: 'tomate-timer', scheduledTime: 4_000 }),
    ).rejects.toThrow('QuotaExceededError');

    // State must be rolled back to the original WORKING state
    await expect(getTimerState()).resolves.toEqual(workingState);

    // Side effects (tab open, session persist) must NOT have run
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled();
    await expect(getSessionHistory()).resolves.toEqual([]);
  });

  it('applies blocking rules on startup when phase is WORKING and blocked sites are configured (#371)', async () => {
    // Freeze time so the timer has not yet elapsed; recoverFromMissedAlarm will
    // find no missed alarm and leave the phase as WORKING, after which
    // applyBlockingOnStartup should call updateDynamicRules with blocking rules.
    const now = 2_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const dnr = (fakeBrowser as typeof fakeBrowser & {
      declarativeNetRequest: {
        getDynamicRules: ReturnType<typeof vi.fn>;
        updateDynamicRules: ReturnType<typeof vi.fn>;
      };
    }).declarativeNetRequest;

    const blockedSites = ['twitter.com', 'reddit.com'];
    await setBlockedSites(blockedSites);
    await setTimerState(
      createState({
        phase: 'WORKING',
        startTime: 1_000,
        endTime: now + DEFAULT_CONFIG.workDuration,
        duration: DEFAULT_CONFIG.workDuration,
      }),
    );
    await initBackground();

    await fakeBrowser.runtime.onStartup.trigger();

    expect(dnr.updateDynamicRules).toHaveBeenCalledWith(
      expect.objectContaining({
        addRules: expect.arrayContaining([
          expect.objectContaining({ condition: expect.objectContaining({ urlFilter: 'twitter.com' }) }),
          expect.objectContaining({ condition: expect.objectContaining({ urlFilter: 'reddit.com' }) }),
        ]),
      }),
    );
  });
});
