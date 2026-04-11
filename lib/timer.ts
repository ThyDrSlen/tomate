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
      const completedState = {
        ...state,
        sessionCount: state.sessionCount + 1,
        completedToday: state.completedToday + 1,
      };

      if (state.cyclePosition === 3) {
        return {
          ...completedState,
          phase: 'BREAK_SUGGESTION',
          startTime: null,
          endTime: null,
          duration: null,
        };
      }

      return {
        ...completedState,
        phase: 'SHORT_BREAK',
        startTime: currentTime,
        endTime: currentTime + config.shortBreakDuration,
        duration: config.shortBreakDuration,
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

export const abandonTimer = (state: TimerState): TimerState => {
  if (!isActivePhase(state.phase)) {
    return state;
  }

  return toIdleState(state);
};

export const acceptLongBreak = (state: TimerState, config: TimerConfig, now?: number): TimerState => {
  if (state.phase !== 'BREAK_SUGGESTION') {
    return state;
  }

  const currentTime = getNow(now);

  return {
    ...state,
    phase: 'LONG_BREAK',
    startTime: currentTime,
    endTime: currentTime + config.longBreakDuration,
    duration: config.longBreakDuration,
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

export type RecoveryStep = { before: TimerState; after: TimerState };

export const recoverMissedAlarm = (
  state: TimerState,
  config: TimerConfig,
  now?: number,
): RecoveryStep[] => {
  const currentTime = getNow(now);
  const steps: RecoveryStep[] = [];

  let current = state;
  // Loop until the state is no longer an active phase with an expired endTime.
  // Each transition uses the *original* endTime of the expired phase as the
  // "now" for completeTimer, so the next phase's start/end times reflect when
  // it would have actually started rather than the recovery moment. This lets
  // us detect whether the next phase also expired during dormancy.
  // Safety cap at 10 iterations to avoid infinite loops from unexpected states.
  for (let i = 0; i < 10; i++) {
    if (!isActivePhase(current.phase) || current.endTime === null || current.endTime >= currentTime) {
      break;
    }

    // Use the expired phase's endTime as the transition moment so the next
    // phase's endTime is calculated from when it *would* have started.
    const transitionTime = current.endTime;
    const next = completeTimer(current, config, transitionTime);
    steps.push({ before: current, after: next });
    current = next;
  }

  return steps;
};

export const getRemainingMs = (state: TimerState, now?: number): number =>
  Math.max(0, (state.endTime ?? 0) - getNow(now));
