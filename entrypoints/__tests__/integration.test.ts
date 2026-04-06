import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  addCompletedSession,
  getConfig,
  getHeatmapData,
  getSessionHistory,
  getTodayCount,
  setConfig,
  setTimerState,
  getTimerState,
  setPendingCelebration,
  getPendingCelebration,
} from '../../lib/storage';
import { computeTotalCount, computeWeekCount, computeBestDay, computeStreak } from '../../lib/stats';
import { startTimer, completeTimer, abandonTimer } from '../../lib/timer';
import { DEFAULT_CONFIG, INITIAL_STATE, type CompletedSession, type TimerState } from '../../lib/types';

const createSession = (date: string, id?: string): CompletedSession => ({
  id: id ?? crypto.randomUUID(),
  label: 'Test task',
  startTime: new Date(date + 'T09:00:00').getTime(),
  endTime: new Date(date + 'T09:25:00').getTime(),
  date,
  duration: 25 * 60 * 1000,
});

describe('timer → storage integration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('completes a work session and persists it to storage', async () => {
    const now = new Date('2026-03-20T10:00:00').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const started = startTimer(INITIAL_STATE, DEFAULT_CONFIG, now);
    expect(started.phase).toBe('WORKING');
    await setTimerState(started);

    const completed = completeTimer(started, DEFAULT_CONFIG, now + DEFAULT_CONFIG.workDuration);
    expect(completed.phase).toBe('SHORT_BREAK');
    expect(completed.sessionCount).toBe(1);

    const session = createSession('2026-03-20');
    await addCompletedSession(session);
    await setTimerState(completed);

    const storedState = await getTimerState();
    expect(storedState.sessionCount).toBe(1);
    expect(storedState.phase).toBe('SHORT_BREAK');

    const todayCount = await getTodayCount();
    expect(todayCount).toBe(1);

    const history = await getSessionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].date).toBe('2026-03-20');
  });

  it('tracks a full 4-pomodoro cycle through storage', async () => {
    let now = new Date('2026-03-20T08:00:00').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    let state: TimerState = INITIAL_STATE;

    for (let i = 0; i < 4; i++) {
      state = startTimer(state, DEFAULT_CONFIG, now);
      now += DEFAULT_CONFIG.workDuration;
      state = completeTimer(state, DEFAULT_CONFIG, now);

      await addCompletedSession(createSession('2026-03-20', `session-${i}`));
      await setTimerState(state);

      if (state.phase === 'SHORT_BREAK') {
        now += DEFAULT_CONFIG.shortBreakDuration;
        state = completeTimer(state, DEFAULT_CONFIG, now);
        await setTimerState(state);
      }
    }

    expect(state.phase).toBe('BREAK_SUGGESTION');
    expect(state.sessionCount).toBe(4);

    const todayCount = await getTodayCount();
    expect(todayCount).toBe(4);
  });

  it('abandoning a session does not create a storage record', async () => {
    const now = Date.now();
    const started = startTimer(INITIAL_STATE, DEFAULT_CONFIG, now);
    await setTimerState(started);

    const abandoned = abandonTimer(started);
    await setTimerState(abandoned);

    expect(abandoned.phase).toBe('IDLE');
    const history = await getSessionHistory();
    expect(history).toHaveLength(0);
  });
});

describe('storage → stats integration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes stats from stored session history', async () => {
    await addCompletedSession(createSession('2026-03-20', 's1'));
    await addCompletedSession(createSession('2026-03-20', 's2'));
    await addCompletedSession(createSession('2026-03-19', 's3'));
    await addCompletedSession(createSession('2026-03-18', 's4'));
    await addCompletedSession(createSession('2026-03-10', 's5'));

    const sessions = await getSessionHistory();
    expect(computeTotalCount(sessions)).toBe(5);
    expect(computeWeekCount(sessions)).toBe(4);
    expect(computeBestDay(sessions)).toEqual({ date: '2026-03-20', count: 2 });
    expect(computeStreak(sessions)).toBe(3);
  });

  it('computes heatmap data from stored sessions', async () => {
    await addCompletedSession(createSession('2026-03-20', 'h1'));
    await addCompletedSession(createSession('2026-03-20', 'h2'));
    await addCompletedSession(createSession('2026-03-15', 'h3'));

    const heatmap = await getHeatmapData(30);
    expect(heatmap['2026-03-20']).toBe(2);
    expect(heatmap['2026-03-15']).toBe(1);
    expect(heatmap['2026-03-16']).toBeUndefined();
  });
});

describe('config → timer integration', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('custom config affects timer durations', async () => {
    const customConfig = {
      workDuration: 50 * 60 * 1000,
      shortBreakDuration: 10 * 60 * 1000,
      longBreakDuration: 20 * 60 * 1000,
    };

    await setConfig(customConfig);
    const config = await getConfig();

    const now = Date.now();
    const started = startTimer(INITIAL_STATE, config, now);
    expect(started.duration).toBe(50 * 60 * 1000);
    expect(started.endTime).toBe(now + 50 * 60 * 1000);
  });

  it('pending celebration flag roundtrips through storage', async () => {
    expect(await getPendingCelebration()).toBe(false);

    await setPendingCelebration(true);
    expect(await getPendingCelebration()).toBe(true);

    await setPendingCelebration(false);
    expect(await getPendingCelebration()).toBe(false);
  });
});
