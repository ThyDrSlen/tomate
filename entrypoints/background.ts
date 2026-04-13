import { browser } from 'wxt/browser';

import {
  abandonTimer,
  acceptLongBreak,
  adjustDuration,
  completeTimer,
  getRemainingMs,
  isActivePhase,
  recoverMissedAlarm,
  skipLongBreak,
  startTimer,
} from '@/lib/timer';
import {
  addCompletedSession,
  getConfig,
  getCurrentLabel,
  getTimerState,
  getTodayCount,
  setConfig,
  setPendingCelebration,
  setTimerState,
  toDateKey,
} from '@/lib/storage';
import { DEFAULT_CONFIG, INITIAL_STATE, type CompletedSession, type TimerConfig } from '@/lib/types';

export type MessageAction =
  | { action: 'START_TIMER' }
  | { action: 'ABANDON_TIMER' }
  | { action: 'GET_STATE' }
  | { action: 'ACCEPT_LONG_BREAK' }
  | { action: 'SKIP_LONG_BREAK' }
  | { action: 'UPDATE_CONFIG'; config: TimerConfig };

export default defineBackground(() => {
  const ALARM_TIMER = 'tomate-timer';
  const ALARM_BADGE_REFRESH = 'badge-refresh';
  const BADGE_RED = '#DC2626';
  const BADGE_GREEN = '#16A34A';
  const BADGE_GOLD = '#CA8A04';
  const badgeApi = browser.action;

  // Cached config — only changes when UPDATE_CONFIG is received, so we avoid
  // redundant storage reads in the hot ALARM_TIMER / ALARM_BADGE_REFRESH paths.
  let cachedConfig: TimerConfig = DEFAULT_CONFIG;
  const loadConfig = async (): Promise<TimerConfig> => {
    cachedConfig = await getConfig();
    return cachedConfig;
  };

  const refreshBadge = async (): Promise<void> => {
    const [state, todayCount] = await Promise.all([getTimerState(), getTodayCount()]);

    let text = '';
    let color = BADGE_RED;

    switch (state.phase) {
      case 'WORKING': {
        text = String(Math.ceil(getRemainingMs(state) / 60_000));
        color = BADGE_RED;
        break;
      }
      case 'SHORT_BREAK':
      case 'LONG_BREAK': {
        text = 'BRK';
        color = BADGE_GREEN;
        break;
      }
      case 'BREAK_SUGGESTION': {
        text = `${todayCount}✓`;
        color = BADGE_GOLD;
        break;
      }
      case 'IDLE':
      default: {
        text = todayCount > 0 ? String(todayCount) : '';
        color = BADGE_RED;
        break;
      }
    }

    await badgeApi.setBadgeText({ text });
    await badgeApi.setBadgeBackgroundColor({ color });
  };

  const scheduleTimerAlarm = async (when: number | null): Promise<void> => {
    if (when === null) {
      await browser.alarms.clear(ALARM_TIMER);
      return;
    }

    await browser.alarms.create(ALARM_TIMER, { when });
  };

  const startBadgeRefresh = async (): Promise<void> => {
    // Clear any existing alarm first to avoid silent duplicate alarms (#97)
    await browser.alarms.clear(ALARM_BADGE_REFRESH);
    await browser.alarms.create(ALARM_BADGE_REFRESH, { periodInMinutes: 1 });
  };

  const clearActiveAlarms = async (): Promise<void> => {
    await Promise.all([browser.alarms.clear(ALARM_TIMER), browser.alarms.clear(ALARM_BADGE_REFRESH)]);
  };

  const persistCompletedSession = async (
    state: Awaited<ReturnType<typeof getTimerState>>,
    endTime: number,
  ): Promise<void> => {
    if (state.startTime === null || state.duration === null) {
      return;
    }

    const label = await getCurrentLabel();
    const session: CompletedSession = {
      id: crypto.randomUUID(),
      label,
      startTime: state.startTime,
      endTime,
      date: toDateKey(state.startTime),
      duration: state.duration,
    };

    await addCompletedSession(session);
    await setPendingCelebration(true);
  };

  const recoverFromMissedAlarm = async (): Promise<void> => {
    const [state, config] = await Promise.all([getTimerState(), loadConfig()]);
    const recovered = recoverMissedAlarm(state, config);

    if (!recovered) {
      // No missed alarm — but if a timer is actively running, Chrome may have
      // cleared its alarm during an update/restart, so reschedule it (#142).
      if (isActivePhase(state.phase) && state.endTime !== null) {
        await scheduleTimerAlarm(state.endTime);
        await startBadgeRefresh();
      }
      await refreshBadge();
      return;
    }

    await setTimerState(recovered);

    if (state.phase === 'WORKING') {
      await persistCompletedSession(state, Date.now());
    }

    if (recovered.phase === 'SHORT_BREAK' && recovered.endTime !== null) {
      await scheduleTimerAlarm(recovered.endTime);
      await startBadgeRefresh();
    } else if (!isActivePhase(recovered.phase)) {
      await clearActiveAlarms();
    }

    await refreshBadge();
  };

  const handleMessage = async (message: MessageAction) => {
    // Config is cached; re-fetch only when needed (UPDATE_CONFIG updates it below).
    const [state, config] = await Promise.all([getTimerState(), Promise.resolve(cachedConfig)]);

    switch (message.action) {
      case 'START_TIMER': {
        const nextState = startTimer(state, config);
        await setTimerState(nextState);

        if (nextState.endTime !== null) {
          await scheduleTimerAlarm(nextState.endTime);
          await startBadgeRefresh();
        }

        await refreshBadge();
        return nextState;
      }
      case 'ABANDON_TIMER': {
        const nextState = abandonTimer(state);
        await setTimerState(nextState);
        await clearActiveAlarms();
        await refreshBadge();
        return nextState;
      }
      case 'GET_STATE': {
        return state;
      }
      case 'ACCEPT_LONG_BREAK': {
        const nextState = acceptLongBreak(state, config);
        await setTimerState(nextState);

        if (nextState.endTime !== null) {
          await scheduleTimerAlarm(nextState.endTime);
          await startBadgeRefresh();
        }

        await refreshBadge();
        return nextState;
      }
      case 'SKIP_LONG_BREAK': {
        const nextState = skipLongBreak(state);
        await setTimerState(nextState);
        await clearActiveAlarms();
        await refreshBadge();
        return nextState;
      }
      case 'UPDATE_CONFIG': {
        cachedConfig = message.config;
        await setConfig(message.config);
        const nextState = adjustDuration(state, message.config);
        await setTimerState(nextState);

        if (isActivePhase(nextState.phase) && nextState.endTime !== null) {
          await scheduleTimerAlarm(nextState.endTime);
          await startBadgeRefresh();
        } else {
          await clearActiveAlarms();
        }

        await refreshBadge();
        return nextState;
      }
      default: {
        return state;
      }
    }
  };

  browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
      // Fresh install: seed storage with defaults only if nothing is stored yet,
      // then warm the config cache and paint the initial badge.
      const [storedState, storedConfig] = await Promise.all([getTimerState(), getConfig()]);
      if (storedState.phase === 'IDLE' && storedState.sessionCount === 0) {
        await setTimerState(INITIAL_STATE);
      }
      cachedConfig = storedConfig;
      await refreshBadge();
      return;
    }

    if (details.reason === 'update') {
      // Extension update: clear stale declarativeNetRequest rules (#103), then
      // reschedule any alarms that were running before the update.
      try {
        const existing = await (browser as typeof browser & {
          declarativeNetRequest?: {
            getDynamicRules(): Promise<{ id: number }[]>;
            updateDynamicRules(opts: { removeRuleIds: number[] }): Promise<void>;
          };
        }).declarativeNetRequest?.getDynamicRules();
        if (existing && existing.length > 0) {
          await (browser as typeof browser & {
            declarativeNetRequest?: {
              updateDynamicRules(opts: { removeRuleIds: number[] }): Promise<void>;
            };
          }).declarativeNetRequest?.updateDynamicRules({
            removeRuleIds: existing.map((r) => r.id),
          });
        }
      } catch {
        // declarativeNetRequest may not be available if permission not declared
      }
      await recoverFromMissedAlarm();
      return;
    }

    // 'browser_update' and any other reasons — no action needed.
  });

  browser.runtime.onStartup.addListener(async () => {
    await recoverFromMissedAlarm();
  });

  browser.runtime.onMessage.addListener((message) => handleMessage(message as MessageAction));

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_BADGE_REFRESH) {
      await refreshBadge();
      return;
    }

    if (alarm.name !== ALARM_TIMER) {
      return;
    }

    // Use cached config — config doesn't change during a running session (#170).
    const [state, config] = await Promise.all([getTimerState(), Promise.resolve(cachedConfig)]);
    const completed = completeTimer(state, config);
    await setTimerState(completed);

    if (state.phase === 'WORKING') {
      await persistCompletedSession(state, Date.now());
      if (typeof browser.notifications !== 'undefined' && browser.notifications.create) {
        await browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
          title: '🍅 Tomate Complete!',
          message: `Time for a break. You've done ${completed.completedToday} tomate(s) today.`,
        });
      }
      if (config.openBreakTab !== false) {
        try {
          await browser.tabs.create({ url: browser.runtime.getURL('/stats.html') });
        } catch {
          // tab creation can fail if no browser window is open
        }
      }
    }

    if (state.phase === 'SHORT_BREAK' || state.phase === 'LONG_BREAK') {
      if (typeof browser.notifications !== 'undefined' && browser.notifications.create) {
        await browser.notifications.create({
          type: 'basic',
          iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
          title: state.phase === 'SHORT_BREAK' ? "Break's Over" : "Long Break's Over",
          message: state.phase === 'SHORT_BREAK' ? 'Ready for another tomate?' : "Refreshed? Let's go!",
        });
      }
    }

    if (isActivePhase(completed.phase) && completed.endTime !== null) {
      await scheduleTimerAlarm(completed.endTime);
      await startBadgeRefresh();
    } else {
      await clearActiveAlarms();
    }

    await refreshBadge();
  });
});
