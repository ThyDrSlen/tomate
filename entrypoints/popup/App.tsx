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

// Fix #2 — ensure any pending sendMessage is awaited before closing the popup
async function closePopup(pendingMessages: Promise<unknown>[] = []) {
  await Promise.allSettled(pendingMessages);
  window.close();
}

export default function App() {
  // Fix #50 — track async-load state so we don't render stale INITIAL_STATE
  const [loading, setLoading] = createSignal(true);

  const [state, setState] = createSignal<TimerState>(INITIAL_STATE);
  const [remaining, setRemaining] = createSignal(0);
  const [label, setLabel] = createSignal('');
  const [todayCount, setTodayCount] = createSignal(0);
  const [heatmapData, setHeatmapData] = createSignal<Record<string, number>>({});

  const refreshStats = async () => {
    setTodayCount(await getTodayCount());
    setHeatmapData(await getHeatmapData(120));
  };

  onMount(async () => {
    const currentState = await browser.runtime.sendMessage({ action: 'GET_STATE' });
    setState(currentState as TimerState);

    // Fix #50 — state is now real; reveal the UI
    setLoading(false);

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

  const startTimer = async () => {
    const newState = await browser.runtime.sendMessage({ action: 'START_TIMER' });
    setState(newState as TimerState);
  };

  const abandonTimer = async () => {
    const newState = await browser.runtime.sendMessage({ action: 'ABANDON_TIMER' });
    setState(newState as TimerState);
  };

  const acceptLongBreak = async () => {
    const newState = await browser.runtime.sendMessage({ action: 'ACCEPT_LONG_BREAK' });
    setState(newState as TimerState);
  };

  const skipLongBreak = async () => {
    const newState = await browser.runtime.sendMessage({ action: 'SKIP_LONG_BREAK' });
    setState(newState as TimerState);
  };

  // Fix #3 — keep a ref to the timeout so we can cancel it on unmount
  let labelTimeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(labelTimeout));

  const handleLabelChange = (value: string) => {
    setLabel(value);
    clearTimeout(labelTimeout);
    labelTimeout = setTimeout(() => setCurrentLabel(value), 300);
  };

  // Fix #17 — compute human-readable cycle position (1-based, repeats every 4)
  const cycleLabel = () => {
    const s = state();
    // cyclePosition is 0-indexed within the current 4-session cycle
    const pos = (s.cyclePosition % 4) + 1;
    return `Session ${pos} of 4`;
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

      {/* Fix #50 — show loading indicator until async state arrives */}
      <Show
        when={!loading()}
        fallback={
          <div class="flex-1 flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading…
          </div>
        }
      >
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

        {/* Fix #17 — cycle position indicator */}
        <div class="text-xs text-gray-400 mt-0.5">{cycleLabel()}</div>

        <TaskLabel value={label()} onChange={handleLabelChange} />

        <Controls
          phase={state().phase}
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
        >
          View all stats →
        </button>
      </Show>
    </div>
  );
}

// Re-export closePopup so callers that need to close the popup after sending a
// message can await it properly (Fix #2).
export { closePopup };
