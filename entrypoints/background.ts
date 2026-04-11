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
        text = `${state.completedToday}✓`;
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

  /**
   * Issue #100: Use `requestDomains` instead of `urlFilter` so that Chrome matches
   * the exact hostname and all its subdomains correctly (e.g. blocking "twitter.com"
   * also blocks "pbs.twimg.com" does NOT follow — but "mobile.twitter.com" does).
   * `requestDomains` is the canonical per-domain matcher in Chrome's DNR API.
   *
   * Issue #101: Guard against Chrome's hard cap of 5000 dynamic rules.  If the list
   * would exceed MAX_RULES we warn in the console and trim to the safe limit so that
   * `updateDynamicRules` never silently fails.
   */
  const MAX_RULES: number =
    (typeof chrome !== 'undefined' &&
      (chrome?.declarativeNetRequest?.MAX_NUMBER_OF_DYNAMIC_RULES as number | undefined)) ||
    5000;

  const applyBlockingRules = async (blockedSites: string[]): Promise<void> => {
    // Issue #101: trim to the Chrome dynamic-rule cap so the API call never silently fails.
    if (blockedSites.length > MAX_RULES) {
      console.warn(
        `[tomate] Blocked-sites list (${blockedSites.length}) exceeds Chrome's dynamic rule limit (${MAX_RULES}). ` +
          `Only the first ${MAX_RULES} sites will be blocked.`,
      );
      blockedSites = blockedSites.slice(0, MAX_RULES);
    }

    const addRules = blockedSites.map((hostname, index) => ({
      id: index + 1,
      priority: 1,
      action: { type: 'block' as const },
      condition: {
        // Issue #100: `requestDomains` matches the exact domain and all subdomains,
        // e.g. ["twitter.com"] also blocks mobile.twitter.com, api.twitter.com, etc.
        // This is more reliable than urlFilter patterns which can miss CDN subdomains.
        requestDomains: [hostname],
        resourceTypes: ['main_frame' as const],
      },
    }));

    try {
      await browser.declarativeNetRequest.updateDynamicRules({ addRules });
    } catch (err) {
      console.error('[tomate] Failed to apply blocking rules:', err);
    }
  };

  browser.runtime.onInstalled.addListener(async () => {
    await recoverFromMissedAlarm();
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

    const [state, config] = await Promise.all([getTimerState(), getConfig()]);
    const completed = completeTimer(state, config);
    await setTimerState(completed);

    if (state.phase === 'WORKING') {
      await persistCompletedSession(state, Date.now());
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
        title: '🍅 Tomate Complete!',
        message: `Time for a break. You've done ${completed.completedToday} tomate(s) today.`,
      });
    }

    if (state.phase === 'SHORT_BREAK' || state.phase === 'LONG_BREAK') {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icons/icon-128.png'),
        title: state.phase === 'SHORT_BREAK' ? "Break's Over" : "Long Break's Over",
        message: state.phase === 'SHORT_BREAK' ? 'Ready for another tomate?' : "Refreshed? Let's go!",
      });
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
