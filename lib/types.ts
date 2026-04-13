export type TimerPhase = 'IDLE' | 'WORKING' | 'SHORT_BREAK' | 'LONG_BREAK' | 'BREAK_SUGGESTION';

export type TimerConfig = {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  openBreakTab: boolean;
  playCompletionSound: boolean;
  dailyGoal: number;
  /** Hostnames to block during WORKING sessions (e.g. "twitter.com"). Max 100 entries. */
  blockedSites: string[];
};

export type TimerState = {
  phase: TimerPhase;
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  sessionCount: number;
  cyclePosition: number;
  completedToday: number;
};

export type CompletedSession = {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  date: string;
  duration: number;
};

/** Maximum number of sites that can be blocked (enforced in the options UI). */
export const MAX_BLOCKED_SITES = 100;

export const DEFAULT_CONFIG: TimerConfig = {
  workDuration: 25 * 60 * 1000,
  shortBreakDuration: 5 * 60 * 1000,
  longBreakDuration: 30 * 60 * 1000,
  openBreakTab: true,
  playCompletionSound: true,
  dailyGoal: 8,
  blockedSites: [],
};

export const INITIAL_STATE: TimerState = {
  phase: 'IDLE',
  startTime: null,
  endTime: null,
  duration: null,
  sessionCount: 0,
  cyclePosition: 0,
  completedToday: 0,
};
