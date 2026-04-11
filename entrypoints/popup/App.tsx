import { createSignal, createEffect, onMount, onCleanup, Switch, Match, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { isActivePhase } from '@/lib/timer';
import { playCelebration } from '@/lib/celebration';
import {
  getPendingCelebration,
  setPendingCelebration,
  getCurrentLabel,
  setCurrentLabel,
  getTodayCount,
  getHeatmapData,
} from '@/lib/storage';
import { INITIAL_STATE, type TimerState } from '@/lib/types';

import TimerRing from '@/components/TimerRing';
import Controls from '@/components/Controls';
import TaskLabel from '@/components/TaskLabel';
import TodayCount from '@/components/TodayCount';
import Heatmap from '@/components/Heatmap';

const SEND_TIMEOUT_MS = 5_000;

function sendMessageWithTimeout<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('sendMessage timed out')),
      SEND_TIMEOUT_MS,
    );
    browser.runtime.sendMessage(message).then(
      (res) => { clearTimeout(timer); resolve(res as T); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export default function App() {
  const [state, setState] = createSignal<TimerState>(INITIAL_STATE);
  const [remaining, setRemaining] = createSignal(0);
  const [label, setLabel] = createSignal('');
  const [todayCount, setTodayCount] = createSignal(0);
  const [heatmapData, setHeatmapData] = createSignal<Record<string, number>>({});
  const [bgError, setBgError] = createSignal(false);
  const [controlsLoading, setControlsLoading] = createSignal(false);

  const refreshStats = async () => {
    setTodayCount(await getTodayCount());
    setHeatmapData(await getHeatmapData(120));
  };

  onMount(async () => {
    let currentState: TimerState;
    try {
      currentState = await sendMessageWithTimeout<TimerState>({ action: 'GET_STATE' });
      setBgError(false);
    } catch (err) {
      console.error('[tomate] popup could not reach background service worker:', err);
      setBgError(true);
      currentState = INITIAL_STATE;
    }
    setState(currentState);

    const pending = await getPendingCelebration();
    if (pending) {
      playCelebration('work');
      await setPendingCelebration(false);
    }

    setLabel(await getCurrentLabel());
    await refreshStats();

    const statsListener = (changes: Record<string, unknown>) => {
      // Only refresh when session data changes, not on every storage write
      // (e.g. timerState, currentLabel, pendingCelebration all write frequently)
      if ('sessions' in changes) {
        refreshStats();
      }
    };
    browser.storage.onChanged.addListener(statsListener);
    onCleanup(() => browser.storage.onChanged.removeListener(statsListener));
  });

  createEffect(() => {
    const s = state();
    if (isActivePhase(s.phase) && s.endTime) {
      const tick = () => setRemaining(Math.max(0, s.endTime! - Date.now()));
      tick();
      const id = setInterval(tick, 1000);
      onCleanup(() => clearInterval(id));
    } else {
      setRemaining(0);
    }
  });

  const formatTime = () => {
    const ms = remaining();
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const progress = () => {
    const s = state();
    if (!s.duration || !isActivePhase(s.phase)) return 0;
    return 1 - remaining() / s.duration;
  };

  const sendAction = async (action: string) => {
    if (controlsLoading()) return;
    setControlsLoading(true);
    try {
      const newState = await sendMessageWithTimeout<TimerState>({ action });
      setState(newState);
      setBgError(false);
    } catch (err) {
      console.error(`[tomate] action ${action} failed:`, err);
      setBgError(true);
    } finally {
      setControlsLoading(false);
    }
  };

  const startTimer = () => sendAction('START_TIMER');
  const abandonTimer = () => sendAction('ABANDON_TIMER');
  const acceptLongBreak = () => sendAction('ACCEPT_LONG_BREAK');
  const skipLongBreak = () => sendAction('SKIP_LONG_BREAK');

  const reconnect = async () => {
    setBgError(false);
    try {
      const currentState = await sendMessageWithTimeout<TimerState>({ action: 'GET_STATE' });
      setState(currentState);
    } catch {
      setBgError(true);
    }
  };

  let labelTimeout: ReturnType<typeof setTimeout>;
  const handleLabelChange = (value: string) => {
    setLabel(value);
    clearTimeout(labelTimeout);
    labelTimeout = setTimeout(() => setCurrentLabel(value), 300);
  };

  return (
    <div class="w-[360px] min-h-[400px] bg-red-50 p-4 flex flex-col items-center">
      <div class="w-full flex justify-between items-center mb-4">
        <h1 class="text-xl font-bold text-red-600">Tomate</h1>
        <button
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
          class="text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Open settings"
          tabIndex={0}
        >
          ⚙️
        </button>
      </div>

      <Show when={bgError()}>
        <div class="w-full mb-2 flex items-center justify-between gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-700">
          <span>Timer unavailable. Try reloading.</span>
          <button
            type="button"
            onClick={reconnect}
            class="underline font-medium hover:text-amber-900"
          >
            Reconnect
          </button>
        </div>
      </Show>

      <TimerRing progress={progress()} phase={state().phase} />
      <div class="text-4xl font-mono font-bold text-gray-800 mt-2">{formatTime()}</div>

      <div class="text-sm text-gray-500 mt-1">
        <Switch>
          <Match when={state().phase === 'IDLE'}>Ready to focus</Match>
          <Match when={state().phase === 'WORKING'}>Working</Match>
          <Match when={state().phase === 'SHORT_BREAK'}>Short Break</Match>
          <Match when={state().phase === 'LONG_BREAK'}>Long Break</Match>
          <Match when={state().phase === 'BREAK_SUGGESTION'}>Time for a long break!</Match>
        </Switch>
      </div>

      <TaskLabel value={label()} onChange={handleLabelChange} />

      <Controls
        phase={state().phase}
        loading={controlsLoading()}
        onStart={startTimer}
        onAbandon={abandonTimer}
        onAcceptLongBreak={acceptLongBreak}
        onSkipLongBreak={skipLongBreak}
      />

      <TodayCount count={todayCount()} />

      <div class="mt-2 w-full">
        <Heatmap days={120} data={heatmapData()} />
      </div>

      <button
        type="button"
        onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/stats.html' as '/popup.html') })}
        class="mt-2 text-xs text-red-400 hover:text-red-600 underline"
        tabIndex={0}
      >
        View all stats →
      </button>
    </div>
  );
}
