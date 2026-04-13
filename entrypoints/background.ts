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
import type { CompletedSession, TimerConfig } from '@/lib/types';

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

  const refreshBadge = async (): Promise<void> => {
    // Fix #381: skip getTodayCount() during break phases where the count is unused.
    const state = await getTimerState();

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
        // Fix #286: re-read from storage here so the count reflects the current
        // calendar day, not a value that may have been cached before midnight.
        const todayCount = await getTodayCount();
        text = `${todayCount}✓`;
        color = BADGE_GOLD;
        break;
      }
      case 'IDLE':
      default: {
        const todayCount = await getTodayCount();
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
    const [state, config] = await Promise.all([getTimerState(), getConfig()]);
    const recovered = recoverMissedAlarm(state, config);

    if (!recovered) {
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
    const [state, config] = await Promise.all([getTimerState(), getConfig()]);

    switch (message.action) {
      case 'START_TIMER': {
        const nextState = startTimer(state, config);
        try {
          await setTimerState(nextState);
        } catch (err) {
          console.error('[tomate] handleMessage START_TIMER: setTimerState failed', err);
          return { error: 'storage_failure' };
        }

        if (nextState.endTime !== null) {
          await scheduleTimerAlarm(nextState.endTime);
          await startBadgeRefresh();
        }

        await refreshBadge();
        return nextState;
      }
      case 'ABANDON_TIMER': {
        const nextState = abandonTimer(state);
        try {
          await setTimerState(nextState);
        } catch (err) {
          console.error('[tomate] handleMessage ABANDON_TIMER: setTimerState failed', err);
          return { error: 'storage_failure' };
        }
        await clearActiveAlarms();
        await refreshBadge();
        return nextState;
      }
      case 'GET_STATE': {
        return state;
      }
      case 'ACCEPT_LONG_BREAK': {
        const nextState = acceptLongBreak(state, config);
        try {
          await setTimerState(nextState);
        } catch (err) {
          console.error('[tomate] handleMessage ACCEPT_LONG_BREAK: setTimerState failed', err);
          return { error: 'storage_failure' };
        }

        if (nextState.endTime !== null) {
          await scheduleTimerAlarm(nextState.endTime);
          await startBadgeRefresh();
        }

        await refreshBadge();
        return nextState;
      }
      case 'SKIP_LONG_BREAK': {
        const nextState = skipLongBreak(state);
        try {
          await setTimerState(nextState);
        } catch (err) {
          console.error('[tomate] handleMessage SKIP_LONG_BREAK: setTimerState failed', err);
          return { error: 'storage_failure' };
        }
        await clearActiveAlarms();
        await refreshBadge();
        return nextState;
      }
      case 'UPDATE_CONFIG': {
        await setConfig(message.config);
        const nextState = adjustDuration(state, message.config);
        try {
          await setTimerState(nextState);
        } catch (err) {
          console.error('[tomate] handleMessage UPDATE_CONFIG: setTimerState failed', err);
          return { error: 'storage_failure' };
        }

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

  // Fix #371: Re-apply declarativeNetRequest blocking rules after a service-worker
  // restart if the stored phase is still WORKING. Dynamic rules are ephemeral and
  // lost when the service worker terminates; reading the persisted blockedSites list
  // and re-registering them ensures sites remain blocked on browser restart.
  const reapplyBlockingRulesIfWorking = async (): Promise<void> => {
    try {
      const state = await getTimerState();
      if (state.phase !== 'WORKING') {
        return;
      }

      const dnr = (browser as typeof browser & {
        declarativeNetRequest?: {
          getDynamicRules(): Promise<{ id: number }[]>;
          updateDynamicRules(opts: { removeRuleIds: number[]; addRules: object[] }): Promise<void>;
        };
      }).declarativeNetRequest;

      if (!dnr) {
        return;
      }

      // Read the stored blockedSites list (separate from TimerConfig).
      const stored = await browser.storage.local.get('blockedSites');
      const sites: unknown = stored['blockedSites'];
      if (!Array.isArray(sites) || sites.length === 0) {
        return;
      }

      const validSites = sites.filter((s): s is string => typeof s === 'string');
      if (validSites.length === 0) {
        return;
      }

      const existing = await dnr.getDynamicRules();
      const newRules = validSites.map((site, idx) => ({
        id: idx + 1,
        priority: 1,
        action: { type: 'block' },
        condition: { urlFilter: site, resourceTypes: ['main_frame'] },
      }));

      await dnr.updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: newRules,
      });
    } catch {
      // declarativeNetRequest may not be available if permission not declared
    }
  };

  browser.runtime.onInstalled.addListener(async (details) => {
    // On fresh install or update, remove any stale dynamic declarativeNetRequest rules (#103)
    if (details.reason === 'install' || details.reason === 'update') {
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
    }
    await recoverFromMissedAlarm();
    await reapplyBlockingRulesIfWorking();
  });

  browser.runtime.onStartup.addListener(async () => {
    await recoverFromMissedAlarm();
    await reapplyBlockingRulesIfWorking();
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

    const [state, config] = await Promise.all([getTimerState(), getConfig()]);
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
