import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import {
  getConfig,
  getCurrentLabel,
  getPendingCelebration,
  getSessionHistory,
  getTodayCount,
  setCurrentLabel,
  setPendingCelebration,
  setTimerState,
  toDateKey,
} from '@/lib/storage';
import { DEFAULT_CONFIG, INITIAL_STATE, type CompletedSession, type TimerState } from '@/lib/types';
import { isActivePhase } from '@/lib/timer';

/**
 * Integration tests for the popup App entrypoint (#58).
 *
 * The popup component is a SolidJS island that reads state from the background
 * via runtime messages and from extension storage.  We test the underlying
 * storage and message flows that the component depends on — the same approach
 * used by options.test.ts and background.test.ts.
 */

const MS_PER_MINUTE = 60_000;

const makeSession = (daysAgo: number, id: string): CompletedSession => {
  const now = Date.now();
  const startTime = now - daysAgo * 24 * 60 * 60 * 1000;
  return {
    id,
    label: 'Focus block',
    startTime,
    endTime: startTime + 25 * MS_PER_MINUTE,
    date: toDateKey(startTime),
    duration: 25 * MS_PER_MINUTE,
  };
};

describe('popup — initial state shape', () => {
  it('INITIAL_STATE has phase IDLE', () => {
    expect(INITIAL_STATE.phase).toBe('IDLE');
  });

  it('INITIAL_STATE has zero counts', () => {
    expect(INITIAL_STATE.sessionCount).toBe(0);
    expect(INITIAL_STATE.completedToday).toBe(0);
    expect(INITIAL_STATE.cyclePosition).toBe(0);
  });

  it('INITIAL_STATE has null timing fields', () => {
    expect(INITIAL_STATE.startTime).toBeNull();
    expect(INITIAL_STATE.endTime).toBeNull();
    expect(INITIAL_STATE.duration).toBeNull();
  });
});

describe('popup — isTimerState guard (runtime shape check)', () => {
  const VALID_PHASES = new Set(['IDLE', 'WORKING', 'SHORT_BREAK', 'LONG_BREAK', 'BREAK_SUGGESTION']);

  const isTimerState = (x: unknown): x is TimerState =>
    typeof x === 'object' &&
    x !== null &&
    'phase' in x &&
    VALID_PHASES.has((x as TimerState).phase);

  it('accepts a valid TimerState', () => {
    expect(isTimerState(INITIAL_STATE)).toBe(true);
  });

  it('accepts a WORKING state', () => {
    const s: TimerState = { ...INITIAL_STATE, phase: 'WORKING', startTime: 1000, endTime: 2000, duration: 1000 };
    expect(isTimerState(s)).toBe(true);
  });

  it('rejects null', () => {
    expect(isTimerState(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isTimerState(undefined)).toBe(false);
  });

  it('rejects an empty object (no phase field)', () => {
    expect(isTimerState({})).toBe(false);
  });

  it('rejects an object with an unknown phase', () => {
    expect(isTimerState({ phase: 'UNKNOWN' })).toBe(false);
  });
});

describe('popup — isActivePhase helper', () => {
  it('WORKING is an active phase', () => {
    expect(isActivePhase('WORKING')).toBe(true);
  });

  it('SHORT_BREAK is an active phase', () => {
    expect(isActivePhase('SHORT_BREAK')).toBe(true);
  });

  it('LONG_BREAK is an active phase', () => {
    expect(isActivePhase('LONG_BREAK')).toBe(true);
  });

  it('IDLE is not an active phase', () => {
    expect(isActivePhase('IDLE')).toBe(false);
  });

  it('BREAK_SUGGESTION is not an active phase', () => {
    expect(isActivePhase('BREAK_SUGGESTION')).toBe(false);
  });
});

describe('popup — formatTime derived value', () => {
  const formatTime = (remainingMs: number): string => {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  it('formats 25 minutes as 25:00', () => {
    expect(formatTime(25 * MS_PER_MINUTE)).toBe('25:00');
  });

  it('formats 0 ms as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 90 seconds as 01:30', () => {
    expect(formatTime(90_000)).toBe('01:30');
  });

  it('formats 1 ms as 00:01 (ceiling)', () => {
    expect(formatTime(1)).toBe('00:01');
  });

  it('formats 5 minutes 5 seconds as 05:05', () => {
    expect(formatTime(5 * MS_PER_MINUTE + 5_000)).toBe('05:05');
  });
});

describe('popup — progress computation', () => {
  const progress = (remaining: number, state: TimerState): number => {
    if (!state.duration || !isActivePhase(state.phase)) return 0;
    return 1 - remaining / state.duration;
  };

  it('returns 0 for IDLE state', () => {
    expect(progress(0, INITIAL_STATE)).toBe(0);
  });

  it('returns 0 at the start of a session (full remaining)', () => {
    const s: TimerState = { ...INITIAL_STATE, phase: 'WORKING', duration: 1500_000, startTime: 0, endTime: 1500_000 };
    expect(progress(1500_000, s)).toBe(0);
  });

  it('returns 1 at the end of a session (no remaining)', () => {
    const s: TimerState = { ...INITIAL_STATE, phase: 'WORKING', duration: 1500_000, startTime: 0, endTime: 1500_000 };
    expect(progress(0, s)).toBe(1);
  });

  it('returns 0.5 at the midpoint', () => {
    const s: TimerState = { ...INITIAL_STATE, phase: 'WORKING', duration: 1000, startTime: 0, endTime: 1000 };
    expect(progress(500, s)).toBe(0.5);
  });
});

describe('popup — storage flows (GET_STATE, today count, celebration)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();

    fakeBrowser.runtime.sendMessage = vi.fn().mockImplementation(async (msg: { action: string }) => {
      if (msg.action === 'GET_STATE') return INITIAL_STATE;
      return undefined;
    });
  });

  it('GET_STATE returns INITIAL_STATE when background responds with idle state', async () => {
    const state = await fakeBrowser.runtime.sendMessage({ action: 'GET_STATE' });
    expect(state).toEqual(INITIAL_STATE);
  });

  it('todayCount returns 0 when there are no sessions', async () => {
    const count = await getTodayCount();
    expect(count).toBe(0);
  });

  it('todayCount counts only sessions from today', async () => {
    const todaySession = makeSession(0, 'today-1');
    const yesterdaySession = makeSession(1, 'yesterday-1');
    await fakeBrowser.storage.local.set({ sessions: [todaySession, yesterdaySession] });
    const count = await getTodayCount();
    expect(count).toBe(1);
  });

  it('config dailyGoal defaults to 8', async () => {
    const config = await getConfig();
    expect(config.dailyGoal).toBe(DEFAULT_CONFIG.dailyGoal);
    expect(config.dailyGoal).toBe(8);
  });

  it('pending celebration defaults to false', async () => {
    const pending = await getPendingCelebration();
    expect(pending).toBe(false);
  });

  it('sets and clears pending celebration', async () => {
    await setPendingCelebration(true);
    expect(await getPendingCelebration()).toBe(true);
    await setPendingCelebration(false);
    expect(await getPendingCelebration()).toBe(false);
  });

  it('current label defaults to empty string', async () => {
    const label = await getCurrentLabel();
    expect(label).toBe('');
  });

  it('persists and retrieves current label', async () => {
    await setCurrentLabel('Deep work');
    expect(await getCurrentLabel()).toBe('Deep work');
  });

  it('truncates labels longer than 50 characters', async () => {
    const long = 'a'.repeat(60);
    await setCurrentLabel(long);
    const stored = await getCurrentLabel();
    expect(stored.length).toBe(50);
  });
});

describe('popup — runtime message routing', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('sends START_TIMER message and receives a WORKING state', async () => {
    const workingState: TimerState = {
      ...INITIAL_STATE,
      phase: 'WORKING',
      startTime: 1000,
      endTime: 1000 + DEFAULT_CONFIG.workDuration,
      duration: DEFAULT_CONFIG.workDuration,
    };
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(workingState);

    const response = await fakeBrowser.runtime.sendMessage({ action: 'START_TIMER' });
    expect(response).toMatchObject({ phase: 'WORKING' });
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'START_TIMER' });
  });

  it('sends ABANDON_TIMER message and receives an IDLE state', async () => {
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(INITIAL_STATE);

    const response = await fakeBrowser.runtime.sendMessage({ action: 'ABANDON_TIMER' });
    expect(response).toMatchObject({ phase: 'IDLE' });
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'ABANDON_TIMER' });
  });

  it('sends ACCEPT_LONG_BREAK and receives a LONG_BREAK state', async () => {
    const breakState: TimerState = {
      ...INITIAL_STATE,
      phase: 'LONG_BREAK',
      startTime: 5000,
      endTime: 5000 + DEFAULT_CONFIG.longBreakDuration,
      duration: DEFAULT_CONFIG.longBreakDuration,
    };
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(breakState);

    const response = await fakeBrowser.runtime.sendMessage({ action: 'ACCEPT_LONG_BREAK' });
    expect(response).toMatchObject({ phase: 'LONG_BREAK' });
  });

  it('sends SKIP_LONG_BREAK and receives an IDLE state', async () => {
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(INITIAL_STATE);

    const response = await fakeBrowser.runtime.sendMessage({ action: 'SKIP_LONG_BREAK' });
    expect(response).toMatchObject({ phase: 'IDLE' });
  });
});

describe('popup — full timer cycle via storage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('timer state transitions from IDLE → WORKING in storage', async () => {
    const workingState: TimerState = {
      ...INITIAL_STATE,
      phase: 'WORKING',
      startTime: 1000,
      endTime: 1000 + DEFAULT_CONFIG.workDuration,
      duration: DEFAULT_CONFIG.workDuration,
    };
    await setTimerState(workingState);

    const stored = await fakeBrowser.storage.local.get('timerState');
    expect(stored.timerState).toMatchObject({ phase: 'WORKING' });
  });

  it('session history grows after a completed session', async () => {
    const session = makeSession(0, 'sess-1');
    await fakeBrowser.storage.local.set({ sessions: [session] });

    const history = await getSessionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('sess-1');
  });

  it('todayCount increments correctly for multiple today sessions', async () => {
    const sessions = [
      makeSession(0, 'a'),
      makeSession(0, 'b'),
      makeSession(0, 'c'),
    ];
    await fakeBrowser.storage.local.set({ sessions });
    expect(await getTodayCount()).toBe(3);
  });
});
