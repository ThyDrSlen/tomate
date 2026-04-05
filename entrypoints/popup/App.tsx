import { createSignal, createEffect, onMount, onCleanup, Show, Switch, Match, For } from 'solid-js';
import { browser } from 'wxt/browser';

import { isActivePhase } from '@/lib/timer';
import {
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

export default function App() {
  const [state, setState] = createSignal<TimerState>(INITIAL_STATE);
  const [remaining, setRemaining] = createSignal(0);
  const [label, setLabel] = createSignal('');
  const [todayCount, setTodayCount] = createSignal(0);
  const [heatmapData, setHeatmapData] = createSignal<Record<string, number>>({});
  const [ready, setReady] = createSignal(false);
  const [bgError, setBgError] = createSignal(false);
  const [confirmingAbandon, setConfirmingAbandon] = createSignal(false);

  const sendAction = async (message: Record<string, unknown>): Promise<TimerState | null> => {
    try {
      setBgError(false);
      return (await browser.runtime.sendMessage(message)) as TimerState;
    } catch (error) {
      console.warn('Tomate: background message failed', error);
      setBgError(true);
      return null;
    }
  };

  const refreshStats = async () => {
    setTodayCount(await getTodayCount());
    setHeatmapData(await getHeatmapData(120));
  };

  onMount(async () => {
    const currentState = await sendAction({ action: 'GET_STATE' });
    if (currentState) setState(currentState);

    setLabel(await getCurrentLabel());
    await refreshStats();
    setReady(true);

    const onStorageChanged: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes) => {
      if ('sessions' in changes) refreshStats();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      const phase = state().phase;
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'IDLE') startTimer();
        else if (phase === 'WORKING' || phase === 'SHORT_BREAK' || phase === 'LONG_BREAK') pauseTimer();
        else if (phase === 'PAUSED') resumeTimer();
      } else if (e.code === 'Escape') {
        if (confirmingAbandon()) cancelAbandon();
        else void abandonTimer();
      }
    };

    browser.storage.onChanged.addListener(onStorageChanged);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => browser.storage.onChanged.removeListener(onStorageChanged));
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
    onCleanup(() => clearTimeout(labelTimeout));
  });

  createEffect(() => {
    const s = state();
    if (isActivePhase(s.phase) && s.endTime) {
      let rafId: number;
      const tick = () => {
        const current = state();
        if (current.endTime) {
          setRemaining(Math.max(0, current.endTime - Date.now()));
        }
        rafId = requestAnimationFrame(tick);
      };
      tick();
      onCleanup(() => cancelAnimationFrame(rafId));
    } else if (s.phase === 'PAUSED' && s.pausedRemaining !== null) {
      setRemaining(s.pausedRemaining);
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
    if (s.phase === 'PAUSED' && s.duration && s.pausedRemaining !== null) {
      return 1 - s.pausedRemaining / s.duration;
    }
    if (!s.duration || !isActivePhase(s.phase)) return 0;
    return 1 - remaining() / s.duration;
  };

  const startTimer = async () => {
    const newState = await sendAction({ action: 'START_TIMER' });
    if (newState) setState(newState);
  };

  const pauseTimer = async () => {
    const newState = await sendAction({ action: 'PAUSE_TIMER' });
    if (newState) setState(newState);
  };

  const resumeTimer = async () => {
    const newState = await sendAction({ action: 'RESUME_TIMER' });
    if (newState) setState(newState);
  };

  const abandonTimer = async () => {
    const phase = state().phase;
    if (phase === 'WORKING' || phase === 'PAUSED') {
      if (!confirmingAbandon()) {
        setConfirmingAbandon(true);
        return;
      }
    }
    setConfirmingAbandon(false);
    const newState = await sendAction({ action: 'ABANDON_TIMER' });
    if (newState) setState(newState);
  };

  const cancelAbandon = () => setConfirmingAbandon(false);

  const acceptLongBreak = async () => {
    const newState = await sendAction({ action: 'ACCEPT_LONG_BREAK' });
    if (newState) setState(newState);
  };

  const skipLongBreak = async () => {
    const newState = await sendAction({ action: 'SKIP_LONG_BREAK' });
    if (newState) setState(newState);
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
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      <Show when={bgError()}>
        <div class="w-full text-center text-xs text-red-500 bg-red-100 rounded px-2 py-1 mb-2">
          Unable to reach timer — try reopening the popup
        </div>
      </Show>

      <Show
        when={ready()}
        fallback={
          <div class="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
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
            <Match when={state().phase === 'PAUSED'}>Paused</Match>
            <Match when={state().phase === 'BREAK_SUGGESTION'}>Time for a long break!</Match>
          </Switch>
        </div>

        <Show when={state().phase !== 'IDLE' || state().cyclePosition > 0}>
          <div class="flex gap-1 mt-1 justify-center">
            <For each={[0, 1, 2, 3]}>
              {(i) => (
                <div
                  class={`w-2 h-2 rounded-full ${
                    i < state().cyclePosition || (state().phase !== 'IDLE' && i === state().cyclePosition)
                      ? 'bg-red-400'
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </For>
          </div>
        </Show>

        <TaskLabel value={label()} onChange={handleLabelChange} />

        <Show when={confirmingAbandon()}>
          <div class="mt-3 text-sm text-center text-red-600">
            <span>Abandon this tomate?</span>
            <div class="flex gap-2 justify-center mt-2">
              <button
                type="button"
                onClick={() => void abandonTimer()}
                class="px-4 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                Yes, abandon
              </button>
              <button
                type="button"
                onClick={cancelAbandon}
                class="px-4 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </Show>

        <Controls
          phase={state().phase}
          onStart={startTimer}
          onPause={pauseTimer}
          onResume={resumeTimer}
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
