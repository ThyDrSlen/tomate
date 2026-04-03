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

export const getTimerState = async (): Promise<TimerState> =>
  (await getStoredValue<TimerState>(KEYS.TIMER_STATE)) ?? INITIAL_STATE;

export const setTimerState = async (state: TimerState): Promise<void> => {
  await browser.storage.local.set({ [KEYS.TIMER_STATE]: state });
};

export const getConfig = async (): Promise<TimerConfig> =>
  (await getStoredValue<TimerConfig>(KEYS.CONFIG)) ?? DEFAULT_CONFIG;

export const setConfig = async (config: TimerConfig): Promise<void> => {
  await browser.storage.local.set({ [KEYS.CONFIG]: config });
};

export const addCompletedSession = async (session: CompletedSession): Promise<void> => {
  const sessions = (await getStoredValue<CompletedSession[]>(KEYS.SESSIONS)) ?? [];
  await browser.storage.local.set({ [KEYS.SESSIONS]: [...sessions, session] });
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
