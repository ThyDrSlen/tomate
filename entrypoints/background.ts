import { browser } from 'wxt/browser';

import {
  abandonTimer,
  acceptBreak,
  adjustDuration,
  completeTimer,
  getRemainingMs,
  isActivePhase,
  pauseTimer,
  recoverMissedAlarm,
  resumeTimer,
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
  | { action: 'PAUSE_TIMER' }
  | { action: 'RESUME_TIMER' }
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
  const BADGE_GRAY = '#6B7280';
  const badgeApi = browser.action;
  let messageQueue = Promise.resolve<unknown>(undefined);
  let recoveryDone = false;

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
      case 'PAUSED': {
        const pausedMin = Math.ceil(getRemainingMs(state) / 60_000);
        text = `❚❚${pausedMin}`;
        color = BADGE_GRAY;
        break;
      }
      case 'BREAK_SUGGESTION': {
        text = `${todayCount}✓`;
        color = BADGE_GOLD;
        break;
      }
      case 'IDLE':
      default: {
        text = todayCount > 0 ? `${todayCount}✓` : '';
        color = BADGE_GREEN;
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

  const recoverOnce = async (): Promise<void> => {
    if (recoveryDone) {
      return;
    }

    recoveryDone = true;
    await recoverFromMissedAlarm();
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
      case 'PAUSE_TIMER': {
        const nextState = pauseTimer(state);
        await setTimerState(nextState);
        await clearActiveAlarms();
        await refreshBadge();
        return nextState;
      }
      case 'RESUME_TIMER': {
        const nextState = resumeTimer(state);
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
        const nextState = acceptBreak(state, config);
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

  browser.runtime.onInstalled.addListener(async () => {
    await recoverOnce();
  });

  browser.runtime.onStartup.addListener(async () => {
    await recoverOnce();
  });

  browser.runtime.onMessage.addListener((message) => {
    messageQueue = messageQueue
      .then(() => handleMessage(message as MessageAction))
      .catch((error) => {
        console.error('Tomate: message handler error', error);
        return getTimerState();
      });

    return messageQueue;
  });

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

      const isLong = completed.cyclePosition === 3 ? '1' : '0';
      await browser.tabs.create({
        url: browser.runtime.getURL(
          `/complete.html?type=work&count=${completed.completedToday}&long=${isLong}` as '/popup.html',
        ),
      });
    }

    if (state.phase === 'SHORT_BREAK' || state.phase === 'LONG_BREAK') {
      await browser.tabs.create({
        url: browser.runtime.getURL('/complete.html?type=break' as '/popup.html'),
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
