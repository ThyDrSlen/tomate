import { browser } from 'wxt/browser';

import {
  DEFAULT_CONFIG,
  INITIAL_STATE,
  type CompletedSession,
  type TimerConfig,
  type TimerState,
} from './types';

const KEYS = {
  TIMER_STATE: 'timerState',
  CONFIG: 'config',
  SESSIONS: 'sessions',
  PENDING_CELEBRATION: 'pendingCelebration',
  CURRENT_LABEL: 'currentLabel',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LABEL_LENGTH = 50;

const startOfLocalDay = (timestamp: number): Date => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getStoredValue = async <T>(key: string): Promise<T | undefined> => {
  const result = await browser.storage.local.get(key);
  return result[key] as T | undefined;
};

export const toDateKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const VALID_PHASES = new Set<string>([
  'IDLE',
  'WORKING',
  'SHORT_BREAK',
  'LONG_BREAK',
  'BREAK_SUGGESTION',
]);

const isValidTimerState = (raw: unknown): raw is TimerState => {
  if (typeof raw !== 'object' || raw === null) return false;
  const s = raw as Record<string, unknown>;
  return (
    typeof s.phase === 'string' &&
    VALID_PHASES.has(s.phase) &&
    (s.endTime === null || typeof s.endTime === 'number') &&
    (s.startTime === null || typeof s.startTime === 'number') &&
    (s.duration === null || typeof s.duration === 'number') &&
    typeof s.sessionCount === 'number' &&
    typeof s.cyclePosition === 'number' &&
    typeof s.completedToday === 'number'
  );
};

export const getTimerState = async (): Promise<TimerState> => {
  const raw = await getStoredValue<unknown>(KEYS.TIMER_STATE);
  return isValidTimerState(raw) ? raw : INITIAL_STATE;
};

export const setTimerState = async (state: TimerState): Promise<void> => {
  await browser.storage.local.set({ [KEYS.TIMER_STATE]: state });
};

const isValidNumber = (v: unknown): v is number =>
  typeof v === 'number' && isFinite(v) && v > 0;

export const getConfig = async (): Promise<TimerConfig> => {
  const raw = await getStoredValue<unknown>(KEYS.CONFIG);
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CONFIG;
  const stored = raw as Record<string, unknown>;
  return Object.assign({}, DEFAULT_CONFIG, {
    ...(isValidNumber(stored.workDuration) && {
      workDuration: stored.workDuration,
    }),
    ...(isValidNumber(stored.shortBreakDuration) && {
      shortBreakDuration: stored.shortBreakDuration,
    }),
    ...(isValidNumber(stored.longBreakDuration) && {
      longBreakDuration: stored.longBreakDuration,
    }),
  });
};

export const setConfig = async (config: TimerConfig): Promise<void> => {
  await browser.storage.local.set({ [KEYS.CONFIG]: config });
};

const isValidSession = (s: unknown): s is CompletedSession => {
  if (typeof s !== 'object' || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.date === 'string' &&
    obj.date.length > 0 &&
    typeof obj.label === 'string'
  );
};

const readSessions = async (): Promise<CompletedSession[]> => {
  const raw = await getStoredValue<unknown>(KEYS.SESSIONS);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidSession);
};

export const addCompletedSession = async (session: CompletedSession): Promise<void> => {
  const sessions = await readSessions();
  await browser.storage.local.set({ [KEYS.SESSIONS]: [...sessions, session] });
};

export const getSessionHistory = async (days?: number): Promise<CompletedSession[]> => {
  const sessions = await readSessions();

  if (days === undefined) {
    return sessions;
  }

  if (days <= 0) {
    return [];
  }

  const today = startOfLocalDay(Date.now()).getTime();
  const earliestKey = toDateKey(today - (days - 1) * DAY_MS);

  return sessions.filter((session) => session.date >= earliestKey);
};

export const getHeatmapData = async (days: number): Promise<Record<string, number>> => {
  const sessions = await getSessionHistory(days);

  return sessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.date] = (acc[session.date] ?? 0) + 1;
    return acc;
  }, {});
};

export const getTodayCount = async (): Promise<number> => {
  const todayKey = toDateKey(Date.now());
  const sessions = await readSessions();

  return sessions.filter((session) => session.date === todayKey).length;
};

export const getPendingCelebration = async (): Promise<boolean> =>
  (await getStoredValue<boolean>(KEYS.PENDING_CELEBRATION)) ?? false;

export const setPendingCelebration = async (pending: boolean): Promise<void> => {
  await browser.storage.local.set({ [KEYS.PENDING_CELEBRATION]: pending });
};

export const getCurrentLabel = async (): Promise<string> =>
  (await getStoredValue<string>(KEYS.CURRENT_LABEL)) ?? '';

export const setCurrentLabel = async (label: string): Promise<void> => {
  await browser.storage.local.set({ [KEYS.CURRENT_LABEL]: label.slice(0, MAX_LABEL_LENGTH) });
};
