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
const MAX_SESSIONS = 2000;
const STORAGE_VERSION = 2;

type StoredConfig = TimerConfig & { _version?: number };

const startOfLocalDay = (timestamp: number): Date => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getStoredValue = async <T>(key: string): Promise<T | undefined> => {
  const result = await browser.storage.local.get(key);
  return result[key] as T | undefined;
};

const isQuotaError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('QUOTA_BYTES') ||
    error.message.includes('QuotaExceededError') ||
    error.message.includes('quota') ||
    (error as { name?: string }).name === 'QuotaExceededError'
  );
};

const pruneOldestSessions = (sessions: CompletedSession[]): CompletedSession[] => {
  const pruneCount = Math.max(1, Math.ceil(sessions.length * 0.1));
  return sessions.slice(pruneCount);
};

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

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
  const stored = await getStoredValue<StoredConfig>(KEYS.CONFIG);
  if (stored === undefined) {
    return DEFAULT_CONFIG;
  }
  const version = stored._version ?? 1;
  const { _version: _v, ...storedFields } = stored;
  const config: TimerConfig = { ...DEFAULT_CONFIG, ...storedFields };
  if (version < STORAGE_VERSION) {
    // v1→v2: ensure all new fields have defaults
    await browser.storage.local.set({ [KEYS.CONFIG]: { ...config, _version: STORAGE_VERSION } });
  }
  return config;
};

export const setConfig = async (config: TimerConfig): Promise<void> => {
  await browser.storage.local.set({ [KEYS.CONFIG]: config });
};

export const addCompletedSession = async (session: CompletedSession): Promise<void> => {
  const sessions = (await getStoredValue<CompletedSession[]>(KEYS.SESSIONS)) ?? [];
  const updated = [...sessions, session];
  const capped = updated.length > MAX_SESSIONS ? updated.slice(updated.length - MAX_SESSIONS) : updated;

  try {
    await browser.storage.local.set({ [KEYS.SESSIONS]: capped });
  } catch (error) {
    if (!isQuotaError(error)) {
      throw error;
    }

    // Storage is full — prune oldest 10% of sessions and retry once
    const pruned = pruneOldestSessions(sessions);
    try {
      await browser.storage.local.set({ [KEYS.SESSIONS]: [...pruned, session] });
    } catch (retryError) {
      if (isQuotaError(retryError)) {
        throw new StorageQuotaError(
          'Storage is full. Session could not be saved even after pruning old sessions.',
        );
      }
      throw retryError;
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
