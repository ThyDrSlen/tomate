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
/** Maximum number of completed sessions kept in local storage (#175) */
export const MAX_SESSIONS = 2000;

/** Prune the oldest 10% of sessions to make room on quota error (#138) */
const pruneOldestSessions = (sessions: CompletedSession[]): CompletedSession[] => {
  const pruneCount = Math.max(1, Math.floor(sessions.length * 0.1));
  return sessions.slice(pruneCount);
};

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

export const getTimerState = async (): Promise<TimerState> =>
  (await getStoredValue<TimerState>(KEYS.TIMER_STATE)) ?? INITIAL_STATE;

export const setTimerState = async (state: TimerState): Promise<void> => {
  await browser.storage.local.set({ [KEYS.TIMER_STATE]: state });
};

export const getConfig = async (): Promise<TimerConfig> => {
  const stored = await getStoredValue<Partial<TimerConfig>>(KEYS.CONFIG);
  return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG;
};

export const setConfig = async (config: TimerConfig): Promise<void> => {
  await browser.storage.local.set({ [KEYS.CONFIG]: config });
};

export const addCompletedSession = async (session: CompletedSession): Promise<void> => {
  const sessions = (await getStoredValue<CompletedSession[]>(KEYS.SESSIONS)) ?? [];
  const updated = [...sessions, session];
  // Cap to MAX_SESSIONS to prevent unbounded growth (#175)
  const capped = updated.length > MAX_SESSIONS ? updated.slice(updated.length - MAX_SESSIONS) : updated;

  try {
    await browser.storage.local.set({ [KEYS.SESSIONS]: capped });
  } catch (err) {
    // On QuotaExceededError, prune the oldest 10% and retry with MAX_SESSIONS cap (#138, #202)
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      const pruned = pruneOldestSessions(sessions);
      const retryArr = [...pruned, session];
      const retryCapped =
        retryArr.length > MAX_SESSIONS ? retryArr.slice(retryArr.length - MAX_SESSIONS) : retryArr;
      await browser.storage.local.set({ [KEYS.SESSIONS]: retryCapped });
    } else {
      throw err;
    }
  }
};

export const getSessionHistory = async (days?: number): Promise<CompletedSession[]> => {
  const sessions = (await getStoredValue<CompletedSession[]>(KEYS.SESSIONS)) ?? [];

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

export const getSessionsForYear = async (year: number): Promise<CompletedSession[]> => {
  const sessions = (await getStoredValue<CompletedSession[]>(KEYS.SESSIONS)) ?? [];
  const prefix = String(year);
  return sessions.filter((session) => session.date.startsWith(prefix));
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
  const sessions = (await getStoredValue<CompletedSession[]>(KEYS.SESSIONS)) ?? [];

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
