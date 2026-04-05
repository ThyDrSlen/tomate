import { INITIAL_STATE, type TimerConfig, type TimerPhase, type TimerState } from './types';

const getNow = (now?: number): number => now ?? Date.now();

const toIdleState = (state: TimerState): TimerState => ({
  ...state,
  ...INITIAL_STATE,
  sessionCount: state.sessionCount,
  cyclePosition: state.cyclePosition,
  completedToday: state.completedToday,
});

const getPhaseDuration = (phase: TimerPhase, config: TimerConfig): number | null => {
  switch (phase) {
    case 'WORKING':
      return config.workDuration;
    case 'SHORT_BREAK':
      return config.shortBreakDuration;
    case 'LONG_BREAK':
      return config.longBreakDuration;
    default:
      return null;
  }
};

export const isActivePhase = (phase: TimerPhase): boolean =>
  phase === 'WORKING' || phase === 'SHORT_BREAK' || phase === 'LONG_BREAK';

export const startTimer = (state: TimerState, config: TimerConfig, now?: number): TimerState => {
  if (state.phase !== 'IDLE') {
    return state;
  }

  const currentTime = getNow(now);

  return {
    ...state,
    phase: 'WORKING',
    startTime: currentTime,
    endTime: currentTime + config.workDuration,
    duration: config.workDuration,
  };
};

export const completeTimer = (state: TimerState, config: TimerConfig, now?: number): TimerState => {
  const currentTime = getNow(now);

  switch (state.phase) {
    case 'WORKING': {
      return {
        ...state,
        phase: 'BREAK_SUGGESTION',
        startTime: null,
        endTime: null,
        duration: null,
        sessionCount: state.sessionCount + 1,
        completedToday: state.completedToday + 1,
      };
    }
    case 'SHORT_BREAK':
      return {
        ...toIdleState(state),
        cyclePosition: state.cyclePosition + 1,
      };
    case 'LONG_BREAK':
      return {
        ...toIdleState(state),
        cyclePosition: 0,
      };
    default:
      return state;
  }
};

export const pauseTimer = (state: TimerState, now?: number): TimerState => {
  if (!isActivePhase(state.phase)) {
    return state;
  }

  const currentTime = getNow(now);
  const remaining = Math.max(0, (state.endTime ?? 0) - currentTime);

  return {
    ...state,
    phase: 'PAUSED',
    pausedFromPhase: state.phase,
    pausedRemaining: remaining,
    startTime: null,
    endTime: null,
  };
};

export const resumeTimer = (state: TimerState, now?: number): TimerState => {
  if (state.phase !== 'PAUSED' || state.pausedFromPhase === null || state.pausedRemaining === null) {
    return state;
  }

  const currentTime = getNow(now);

  return {
    ...state,
    phase: state.pausedFromPhase,
    startTime: currentTime,
    endTime: currentTime + state.pausedRemaining,
    pausedFromPhase: null,
    pausedRemaining: null,
  };
};

export const abandonTimer = (state: TimerState): TimerState => {
  if (!isActivePhase(state.phase) && state.phase !== 'PAUSED') {
    return state;
  }

  return toIdleState(state);
};

export const acceptBreak = (state: TimerState, config: TimerConfig, now?: number): TimerState => {
  if (state.phase !== 'BREAK_SUGGESTION') {
    return state;
  }

  const currentTime = getNow(now);
  const isLong = state.cyclePosition === 3;
  const breakDuration = isLong ? config.longBreakDuration : config.shortBreakDuration;

  return {
    ...state,
    phase: isLong ? 'LONG_BREAK' : 'SHORT_BREAK',
    startTime: currentTime,
    endTime: currentTime + breakDuration,
    duration: breakDuration,
  };
};

export const skipLongBreak = (state: TimerState): TimerState => {
  if (state.phase !== 'BREAK_SUGGESTION') {
    return state;
  }

  return {
    ...toIdleState(state),
    cyclePosition: 0,
  };
};

export const adjustDuration = (state: TimerState, newConfig: TimerConfig, now?: number): TimerState => {
  if (!isActivePhase(state.phase) || state.startTime === null) {
    return state;
  }

  const newDuration = getPhaseDuration(state.phase, newConfig);
  if (newDuration === null) {
    return state;
  }

  const currentTime = getNow(now);
  const recalculatedEndTime = state.startTime + newDuration;

  return {
    ...state,
    duration: newDuration,
    endTime: recalculatedEndTime <= currentTime ? currentTime : recalculatedEndTime,
  };
};

export const recoverMissedAlarm = (
  state: TimerState,
  config: TimerConfig,
  now?: number,
): TimerState | null => {
  const currentTime = getNow(now);

  if (!isActivePhase(state.phase) || state.endTime === null || state.endTime >= currentTime) {
    return null;
  }

  return completeTimer(state, config, currentTime);
};

export const getRemainingMs = (state: TimerState, now?: number): number => {
  if (state.phase === 'PAUSED') {
    return state.pausedRemaining ?? 0;
  }
  return Math.max(0, (state.endTime ?? 0) - getNow(now));
};
