import { describe, expect, it } from 'vitest';

import {
  abandonTimer,
  acceptBreak,
  adjustDuration,
  completeTimer,
  getRemainingMs,
  isActivePhase,
  pauseTimer,
  recoverMissedAlarm,
  resumeTimer,
  skipLongBreak,
  startTimer,
} from '../timer';
import { DEFAULT_CONFIG, INITIAL_STATE, type TimerConfig, type TimerState } from '../types';

const createState = (overrides: Partial<TimerState> = {}): TimerState => ({
  ...INITIAL_STATE,
  ...overrides,
});

const createConfig = (overrides: Partial<TimerConfig> = {}): TimerConfig => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

describe('timer state machine', () => {
  it('completes a full 4-tomate cycle through long break back to idle', () => {
    const config = createConfig({
      workDuration: 1_000,
      shortBreakDuration: 200,
      longBreakDuration: 500,
    });

    let state = createState();
    let now = 10_000;

    state = startTimer(state, config, now);
    expect(state.phase).toBe('WORKING');

    state = completeTimer(state, config, now + 1_000);
    expect(state.phase).toBe('BREAK_SUGGESTION');

    state = acceptBreak(state, config, now + 1_000);
    expect(state.phase).toBe('SHORT_BREAK');

    state = completeTimer(state, config, now + 1_200);
    expect(state.phase).toBe('IDLE');
    expect(state.cyclePosition).toBe(1);

    now += 2_000;
    state = startTimer(state, config, now);
    state = completeTimer(state, config, now + 1_000);
    state = acceptBreak(state, config, now + 1_000);
    state = completeTimer(state, config, now + 1_200);
    expect(state.cyclePosition).toBe(2);

    now += 2_000;
    state = startTimer(state, config, now);
    state = completeTimer(state, config, now + 1_000);
    state = acceptBreak(state, config, now + 1_000);
    state = completeTimer(state, config, now + 1_200);
    expect(state.cyclePosition).toBe(3);

    now += 2_000;
    state = startTimer(state, config, now);
    state = completeTimer(state, config, now + 1_000);
    expect(state.phase).toBe('BREAK_SUGGESTION');
    expect(state.sessionCount).toBe(4);
    expect(state.cyclePosition).toBe(3);

    state = acceptBreak(state, config, now + 1_100);
    expect(state.phase).toBe('LONG_BREAK');

    state = completeTimer(state, config, now + 1_600);
    expect(state.phase).toBe('IDLE');
    expect(state.sessionCount).toBe(4);
    expect(state.cyclePosition).toBe(0);
  });

  it('starts a timer from idle', () => {
    const now = 1_000;
    const state = startTimer(createState(), DEFAULT_CONFIG, now);

    expect(state.phase).toBe('WORKING');
    expect(state.startTime).toBe(now);
    expect(state.endTime).toBe(now + DEFAULT_CONFIG.workDuration);
    expect(state.duration).toBe(DEFAULT_CONFIG.workDuration);
  });

  it('does not start a timer from non-idle states', () => {
    const config = createConfig();
    const states = [
      createState({ phase: 'WORKING', startTime: 1_000, endTime: 2_000, duration: 1_000 }),
      createState({
        phase: 'SHORT_BREAK',
        startTime: 2_000,
        endTime: 2_500,
        duration: 500,
        sessionCount: 1,
        completedToday: 1,
      }),
      createState({
        phase: 'LONG_BREAK',
        startTime: 3_000,
        endTime: 3_500,
        duration: 500,
        sessionCount: 4,
        cyclePosition: 3,
        completedToday: 4,
      }),
      createState({
        phase: 'PAUSED',
        duration: 1_000,
        pausedFromPhase: 'WORKING',
        pausedRemaining: 500,
      }),
      createState({
        phase: 'BREAK_SUGGESTION',
        sessionCount: 4,
        cyclePosition: 3,
        completedToday: 4,
      }),
    ];

    for (const state of states) {
      expect(startTimer(state, config, 10_000)).toEqual(state);
    }
  });

  it('abandons a work session without changing counters', () => {
    const state = createState({
      phase: 'WORKING',
      startTime: 1_000,
      endTime: 2_000,
      duration: 1_000,
      sessionCount: 2,
      cyclePosition: 1,
      completedToday: 2,
    });

    expect(abandonTimer(state)).toEqual(
      createState({
        sessionCount: 2,
        cyclePosition: 1,
        completedToday: 2,
      }),
    );
  });

  it('abandons a short break without changing counters', () => {
    const state = createState({
      phase: 'SHORT_BREAK',
      startTime: 2_000,
      endTime: 2_500,
      duration: 500,
      sessionCount: 1,
      cyclePosition: 0,
      completedToday: 1,
    });

    expect(abandonTimer(state)).toEqual(
      createState({
        sessionCount: 1,
        cyclePosition: 0,
        completedToday: 1,
      }),
    );
  });

  it('skips a suggested long break and resets cycle position', () => {
    const state = createState({
      phase: 'BREAK_SUGGESTION',
      sessionCount: 4,
      cyclePosition: 3,
      completedToday: 4,
    });

    expect(skipLongBreak(state)).toEqual(
      createState({
        sessionCount: 4,
        cyclePosition: 0,
        completedToday: 4,
      }),
    );
  });

  it('accepts a suggested long break', () => {
    const now = 20_000;
    const config = createConfig({ longBreakDuration: 1_800_000 });
    const state = createState({
      phase: 'BREAK_SUGGESTION',
      sessionCount: 4,
      cyclePosition: 3,
      completedToday: 4,
    });

    expect(acceptBreak(state, config, now)).toEqual({
      ...state,
      phase: 'LONG_BREAK',
      startTime: now,
      endTime: now + config.longBreakDuration,
      duration: config.longBreakDuration,
    });
  });

  it('adjusts a work session to finish immediately when new duration is shorter than elapsed', () => {
    const now = 10_000;
    const state = createState({
      phase: 'WORKING',
      startTime: 5_000,
      endTime: 15_000,
      duration: 10_000,
    });
    const config = createConfig({ workDuration: 4_000 });

    expect(adjustDuration(state, config, now)).toEqual({
      ...state,
      duration: 4_000,
      endTime: now,
    });
  });

  it('adjusts a work session with a longer duration into the future', () => {
    const state = createState({
      phase: 'WORKING',
      startTime: 5_000,
      endTime: 15_000,
      duration: 10_000,
    });
    const config = createConfig({ workDuration: 20_000 });

    expect(adjustDuration(state, config, 10_000)).toEqual({
      ...state,
      duration: 20_000,
      endTime: 25_000,
    });
  });

  it('adjusts a break duration using the matching break config', () => {
    const state = createState({
      phase: 'SHORT_BREAK',
      startTime: 1_000,
      endTime: 1_500,
      duration: 500,
      sessionCount: 1,
      completedToday: 1,
    });
    const config = createConfig({ shortBreakDuration: 1_000 });

    expect(adjustDuration(state, config, 1_200)).toEqual({
      ...state,
      duration: 1_000,
      endTime: 2_000,
    });
  });

  it('recovers a missed alarm for a completed work session', () => {
    const config = createConfig({ shortBreakDuration: 500 });
    const state = createState({
      phase: 'WORKING',
      startTime: 1_000,
      endTime: 2_000,
      duration: 1_000,
      sessionCount: 0,
      cyclePosition: 0,
      completedToday: 0,
    });

    expect(recoverMissedAlarm(state, config, 3_000)).toEqual({
      ...state,
      phase: 'BREAK_SUGGESTION',
      startTime: null,
      endTime: null,
      duration: null,
      sessionCount: 1,
      completedToday: 1,
    });
  });

  it('returns null when recovering a missed alarm from idle', () => {
    expect(recoverMissedAlarm(createState(), DEFAULT_CONFIG, 5_000)).toBeNull();
  });

  it('does not complete a timer from idle', () => {
    const state = createState();

    expect(completeTimer(state, DEFAULT_CONFIG, 5_000)).toEqual(state);
  });

  it('does not complete a timer from paused', () => {
    const state = createState({
      phase: 'PAUSED',
      duration: 10_000,
      pausedFromPhase: 'WORKING',
      pausedRemaining: 5_000,
    });

    expect(completeTimer(state, DEFAULT_CONFIG, 5_000)).toEqual(state);
  });

  it('returns null when recovering a missed alarm before the end time', () => {
    const state = createState({
      phase: 'WORKING',
      startTime: 1_000,
      endTime: 10_000,
      duration: 9_000,
    });

    expect(recoverMissedAlarm(state, createConfig(), 5_000)).toBeNull();
  });

  it('returns correct remaining milliseconds', () => {
    const state = createState({ endTime: 10_000 });

    expect(getRemainingMs(state, 9_500)).toBe(500);
    expect(getRemainingMs(state, 10_500)).toBe(0);
  });

  it('uses the default 25/5/30 minute config values', () => {
    expect(DEFAULT_CONFIG).toEqual({
      workDuration: 25 * 60 * 1000,
      shortBreakDuration: 5 * 60 * 1000,
      longBreakDuration: 30 * 60 * 1000,
    });
  });

  it('identifies active phases correctly', () => {
    expect(isActivePhase('WORKING')).toBe(true);
    expect(isActivePhase('SHORT_BREAK')).toBe(true);
    expect(isActivePhase('LONG_BREAK')).toBe(true);
    expect(isActivePhase('IDLE')).toBe(false);
    expect(isActivePhase('PAUSED')).toBe(false);
    expect(isActivePhase('BREAK_SUGGESTION')).toBe(false);
  });

  it('pauses a working session and stores remaining time', () => {
    const state = createState({
      phase: 'WORKING',
      startTime: 1_000,
      endTime: 11_000,
      duration: 10_000,
    });

    const paused = pauseTimer(state, 6_000);
    expect(paused.phase).toBe('PAUSED');
    expect(paused.pausedFromPhase).toBe('WORKING');
    expect(paused.pausedRemaining).toBe(5_000);
    expect(paused.startTime).toBeNull();
    expect(paused.endTime).toBeNull();
    expect(paused.duration).toBe(10_000);
  });

  it('pauses a short break and stores remaining time', () => {
    const state = createState({
      phase: 'SHORT_BREAK',
      startTime: 10_000,
      endTime: 15_000,
      duration: 5_000,
      sessionCount: 1,
      completedToday: 1,
    });

    const paused = pauseTimer(state, 12_000);
    expect(paused.phase).toBe('PAUSED');
    expect(paused.pausedFromPhase).toBe('SHORT_BREAK');
    expect(paused.pausedRemaining).toBe(3_000);
  });

  it('resumes a paused working session with recalculated end time', () => {
    const state = createState({
      phase: 'PAUSED',
      duration: 10_000,
      pausedFromPhase: 'WORKING',
      pausedRemaining: 5_000,
    });

    const resumed = resumeTimer(state, 20_000);
    expect(resumed.phase).toBe('WORKING');
    expect(resumed.startTime).toBe(20_000);
    expect(resumed.endTime).toBe(25_000);
    expect(resumed.pausedFromPhase).toBeNull();
    expect(resumed.pausedRemaining).toBeNull();
  });

  it('abandons a paused session back to idle', () => {
    const state = createState({
      phase: 'PAUSED',
      duration: 10_000,
      pausedFromPhase: 'WORKING',
      pausedRemaining: 5_000,
      sessionCount: 2,
      cyclePosition: 1,
      completedToday: 2,
    });

    expect(abandonTimer(state)).toEqual(
      createState({
        sessionCount: 2,
        cyclePosition: 1,
        completedToday: 2,
      }),
    );
  });

  it('returns remaining ms from paused state', () => {
    const state = createState({
      phase: 'PAUSED',
      pausedRemaining: 7_500,
    });

    expect(getRemainingMs(state)).toBe(7_500);
  });

  it('does not pause from idle', () => {
    const state = createState();
    expect(pauseTimer(state)).toEqual(state);
  });

  it('does not resume from non-paused state', () => {
    const state = createState({ phase: 'WORKING', startTime: 1_000, endTime: 2_000, duration: 1_000 });
    expect(resumeTimer(state)).toEqual(state);
  });
});
