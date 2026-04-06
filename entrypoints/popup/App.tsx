import { createSignal, createEffect, onMount, onCleanup, Show, Switch, Match } from 'solid-js';
import { browser } from 'wxt/browser';

import { isActivePhase } from '@/lib/timer';
import {
  getCurrentLabel,
  setCurrentLabel,
  getConfig,
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
  const [dailyGoal, setDailyGoal] = createSignal(8);
  const [ready, setReady] = createSignal(false);

  const sendAction = async (message: Record<string, unknown>): Promise<TimerState | null> => {
    try {
      return (await browser.runtime.sendMessage(message)) as TimerState;
    } catch (error) {
      console.warn('Tomate: background message failed', error);
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
    const config = await getConfig();
    setDailyGoal(config.dailyGoal);
    await refreshStats();
    setReady(true);

    const onStorageChanged = (changes: Record<string, unknown>) => {
      if ('sessions' in changes) refreshStats();
    };
    browser.storage.onChanged.addListener(onStorageChanged);
    onCleanup(() => browser.storage.onChanged.removeListener(onStorageChanged));
  });

  createEffect(() => {
    const s = state();
    if (isActivePhase(s.phase) && s.endTime) {
      let rafId: number;
      const tick = () => {
        setRemaining(Math.max(0, s.endTime! - Date.now()));
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

  createEffect(() => {
    const s = state();
    if (s.phase === 'IDLE') {
      document.title = 'Tomate';
    } else if (s.phase === 'PAUSED') {
      document.title = `⏸ ${formatTime()} — Tomate`;
    } else if (s.phase === 'WORKING') {
      document.title = `🍅 ${formatTime()} — Tomate`;
    } else if (s.phase === 'SHORT_BREAK' || s.phase === 'LONG_BREAK') {
      document.title = `☕ ${formatTime()} — Tomate`;
    } else {
      document.title = 'Tomate';
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
    if ((phase === 'WORKING' || phase === 'PAUSED') && !window.confirm('Abandon this tomate?')) return;
    const newState = await sendAction({ action: 'ABANDON_TIMER' });
    if (newState) setState(newState);
  };

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

        <TaskLabel value={label()} onChange={handleLabelChange} />

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

        <div class="mt-3 w-full px-1">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>Daily goal</span>
            <span>{todayCount()}/{dailyGoal()}</span>
          </div>
          <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              class="h-full bg-red-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (todayCount() / dailyGoal()) * 100)}%` }}
            />
          </div>
        </div>

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
