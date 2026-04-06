export type TimerPhase = 'IDLE' | 'WORKING' | 'SHORT_BREAK' | 'LONG_BREAK' | 'PAUSED' | 'BREAK_SUGGESTION';

export type TimerConfig = {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
  dailyGoal: number;
};

export type TimerState = {
  phase: TimerPhase;
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  sessionCount: number;
  cyclePosition: number;
  completedToday: number;
  pausedFromPhase: TimerPhase | null;
  pausedRemaining: number | null;
};

export type CompletedSession = {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  date: string;
  duration: number;
};

export const DEFAULT_CONFIG: TimerConfig = {
  workDuration: 25 * 60 * 1000,
  shortBreakDuration: 5 * 60 * 1000,
  longBreakDuration: 30 * 60 * 1000,
  autoStartBreak: false,
  autoStartWork: false,
  dailyGoal: 8,
};

export const INITIAL_STATE: TimerState = {
  phase: 'IDLE',
  startTime: null,
  endTime: null,
  duration: null,
  sessionCount: 0,
  cyclePosition: 0,
  completedToday: 0,
  pausedFromPhase: null,
  pausedRemaining: null,
};
