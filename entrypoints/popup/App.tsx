import { createSignal, createEffect, onMount, onCleanup, Switch, Match } from 'solid-js';
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
  getConfig,
} from '@/lib/storage';
import { INITIAL_STATE, type TimerState, type AmbientSound } from '@/lib/types';
import { ambientPlay, ambientStop, ambientClose } from '@/lib/ambient';

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
  const [ambientSound, setAmbientSound] = createSignal<AmbientSound>('none');
  const [ambientVolume, setAmbientVolume] = createSignal(50);

  const refreshStats = async () => {
    setTodayCount(await getTodayCount());
    setHeatmapData(await getHeatmapData(120));
  };

  const refreshAmbientConfig = async () => {
    const config = await getConfig();
    setAmbientSound(config.ambientSound);
    setAmbientVolume(config.ambientVolume);
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
    await refreshAmbientConfig();

    const handleStorageChange = async () => {
      await refreshStats();
      await refreshAmbientConfig();
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    onCleanup(() => {
      browser.storage.onChanged.removeListener(handleStorageChange);
      // Fix #98: stop nodes first, then fully close the AudioContext so it
      // doesn't accumulate across popup open/close cycles.
      ambientStop();
      void ambientClose();
    });
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

  // Ambient sound: play during WORKING phase only, stop otherwise.
  // ambientPlay is async (#96/#97 fix); fire-and-forget is fine because
  // errors are handled internally and we don't need to block the effect.
  createEffect(() => {
    const phase = state().phase;
    const sound = ambientSound();
    const volume = ambientVolume();

    if (phase === 'WORKING' && sound !== 'none') {
      void ambientPlay(sound, volume);
    } else {
      ambientStop();
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
