import { createSignal, createEffect, onMount, onCleanup, Switch, Match } from 'solid-js';
import { browser } from 'wxt/browser';

import { isActivePhase } from '@/lib/timer';
import { playCelebration } from '@/lib/celebration';
import {
  getConfig,
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

export default function App() {
  const [state, setState] = createSignal<TimerState>(INITIAL_STATE);
  const [remaining, setRemaining] = createSignal(0);
  const [label, setLabel] = createSignal('');
  const [todayCount, setTodayCount] = createSignal(0);
  const [dailyGoal, setDailyGoal] = createSignal<number | undefined>(undefined);
  const [heatmapData, setHeatmapData] = createSignal<Record<string, number>>({});

  const refreshStats = async () => {
    setTodayCount(await getTodayCount());
    setHeatmapData(await getHeatmapData(120));
  };

  onMount(async () => {
    const currentState = await browser.runtime.sendMessage({ action: 'GET_STATE' });
    setState(currentState as TimerState);

    const config = await getConfig();
    setDailyGoal(config.dailyGoal);

    const pending = await getPendingCelebration();
    if (pending) {
      playCelebration('work', config.playCompletionSound);
      await setPendingCelebration(false);
    }

    setLabel(await getCurrentLabel());
    await refreshStats().catch(console.error);

    const onStorageChanged = () => refreshStats().catch(console.error);
    browser.storage.onChanged.addListener(onStorageChanged);
    onCleanup(() => browser.storage.onChanged.removeListener(onStorageChanged));
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
        onStart={startTimer}
        onAbandon={abandonTimer}
        onAcceptLongBreak={acceptLongBreak}
        onSkipLongBreak={skipLongBreak}
      />

      <TodayCount count={todayCount()} goal={dailyGoal()} />

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
