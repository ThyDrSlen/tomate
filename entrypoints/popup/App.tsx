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

const CYCLES_PER_ROUND = 4;

export default function App() {
  const [state, setState] = createSignal<TimerState>(INITIAL_STATE);
  const [remaining, setRemaining] = createSignal(0);
  const [label, setLabel] = createSignal('');
  const [todayCount, setTodayCount] = createSignal(0);
  const [heatmapData, setHeatmapData] = createSignal<Record<string, number>>({});
  const [showAbandonConfirm, setShowAbandonConfirm] = createSignal(false);
  const [actionError, setActionError] = createSignal<string | null>(null);

  let errorTimeout: ReturnType<typeof setTimeout>;

  const showError = (msg: string) => {
    setActionError(msg);
    clearTimeout(errorTimeout);
    errorTimeout = setTimeout(() => setActionError(null), 3000);
  };

  const refreshStats = async () => {
    setTodayCount(await getTodayCount());
    setHeatmapData(await getHeatmapData(120));
  };

  onMount(async () => {
    const currentState = await browser.runtime.sendMessage({ action: 'GET_STATE' });
    setState(currentState as TimerState);

    const pending = await getPendingCelebration();
    if (pending) {
      playCelebration('work');
      await setPendingCelebration(false);
    }

    setLabel(await getCurrentLabel());
    await refreshStats();

    browser.storage.onChanged.addListener(refreshStats);
    onCleanup(() => browser.storage.onChanged.removeListener(refreshStats));
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

  const sendAction = async (action: string): Promise<TimerState | null> => {
    try {
      const newState = await browser.runtime.sendMessage({ action });
      return newState as TimerState;
    } catch {
      showError('Failed to connect. Try again.');
      return null;
    }
  };

  const startTimer = async () => {
    const newState = await sendAction('START_TIMER');
    if (newState) setState(newState);
  };

  const abandonTimer = async () => {
    const newState = await sendAction('ABANDON_TIMER');
    if (newState) {
      setState(newState);
      setShowAbandonConfirm(false);
    }
  };

  const acceptLongBreak = async () => {
    const newState = await sendAction('ACCEPT_LONG_BREAK');
    if (newState) setState(newState);
  };

  const skipLongBreak = async () => {
    const newState = await sendAction('SKIP_LONG_BREAK');
    if (newState) setState(newState);
  };

  let labelTimeout: ReturnType<typeof setTimeout>;
  const handleLabelChange = (value: string) => {
    setLabel(value);
    clearTimeout(labelTimeout);
    labelTimeout = setTimeout(() => setCurrentLabel(value), 300);
  };

  const cycleIndicator = () => {
    const s = state();
    if (s.phase === 'IDLE' || s.phase === 'BREAK_SUGGESTION') return null;
    const pos = s.cyclePosition + 1;
    return `${pos} / ${CYCLES_PER_ROUND}`;
  };

  return (
    <div class="w-[360px] min-h-[400px] bg-red-50 p-4 flex flex-col items-center">
      <div class="w-full flex justify-between items-center mb-4">
        <h1 class="text-xl font-bold text-red-600">Tomate</h1>
        <button
          type="button"
          onClick={() => browser.runtime.openOptionsPage()}
          class="text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

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

      <Show when={cycleIndicator() !== null}>
        <div class="text-xs text-gray-400 mt-0.5">Session {cycleIndicator()}</div>
      </Show>

      <Show when={actionError() !== null}>
        <div class="mt-2 px-3 py-1.5 bg-red-100 border border-red-300 text-red-700 text-xs rounded-md w-full text-center">
          {actionError()}
        </div>
      </Show>

      <TaskLabel value={label()} onChange={handleLabelChange} />

      <Show when={showAbandonConfirm()}>
        <div class="mt-3 w-full bg-amber-50 border border-amber-300 rounded-lg p-3 flex flex-col items-center gap-2">
          <p class="text-sm text-amber-800 font-medium">Abandon this session?</p>
          <div class="flex gap-2">
            <button
              type="button"
              onClick={abandonTimer}
              class="px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 active:bg-red-800 transition-colors"
            >
              Yes, abandon
            </button>
            <button
              type="button"
              onClick={() => setShowAbandonConfirm(false)}
              class="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-300 active:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      <Controls
        phase={state().phase}
        onStart={startTimer}
        onAbandon={() => setShowAbandonConfirm(true)}
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
      >
        View all stats →
      </button>
    </div>
  );
}
