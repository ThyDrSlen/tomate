import { createSignal, onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [autoStartBreak, setAutoStartBreak] = createSignal(false);
  const [autoStartWork, setAutoStartWork] = createSignal(false);
  const [dailyGoal, setDailyGoal] = createSignal(8);
  const [saved, setSaved] = createSignal(false);

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));
    setAutoStartBreak(config.autoStartBreak);
    setAutoStartWork(config.autoStartWork);
    setDailyGoal(config.dailyGoal);
  });

  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, Math.round(value) || min));

  const handleSave = async () => {
    const clampedWork = clamp(work(), 1, 120);
    const clampedShort = clamp(shortBreak(), 1, 30);
    const clampedLong = clamp(longBreak(), 5, 60);

    setWork(clampedWork);
    setShortBreak(clampedShort);
    setLongBreak(clampedLong);

    const clampedGoal = clamp(dailyGoal(), 1, 20);
    setDailyGoal(clampedGoal);

    const config: TimerConfig = {
      workDuration: clampedWork * MS_PER_MINUTE,
      shortBreakDuration: clampedShort * MS_PER_MINUTE,
      longBreakDuration: clampedLong * MS_PER_MINUTE,
      autoStartBreak: autoStartBreak(),
      autoStartWork: autoStartWork(),
      dailyGoal: clampedGoal,
    };
    await setConfig(config);
    await browser.runtime.sendMessage({ action: 'UPDATE_CONFIG', config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setWork(Math.round(DEFAULT_CONFIG.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(DEFAULT_CONFIG.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(DEFAULT_CONFIG.longBreakDuration / MS_PER_MINUTE));
    setAutoStartBreak(DEFAULT_CONFIG.autoStartBreak);
    setAutoStartWork(DEFAULT_CONFIG.autoStartWork);
    setDailyGoal(DEFAULT_CONFIG.dailyGoal);
  };

  return (
    <div class="min-h-screen bg-red-50 flex items-start justify-center pt-16">
      <div class="w-full max-w-[400px] bg-white rounded-lg shadow-sm p-6">
        <h1 class="text-xl font-bold text-red-600 mb-6">Tomate Settings</h1>

        <div class="space-y-4">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Work Duration (minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={work()}
              onInput={(e) => setWork(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-gray-700">Short Break (minutes)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={shortBreak()}
              onInput={(e) => setShortBreak(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-gray-700">Long Break (minutes)</span>
            <input
              type="number"
              min={5}
              max={60}
              value={longBreak()}
              onInput={(e) => setLongBreak(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>
        </div>

        <div class="mt-6 space-y-3">
          <h2 class="text-sm font-semibold text-gray-700">Automation</h2>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStartBreak()}
              onChange={(e) => setAutoStartBreak(e.currentTarget.checked)}
              class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span class="text-sm text-gray-700">Auto-start break after work</span>
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoStartWork()}
              onChange={(e) => setAutoStartWork(e.currentTarget.checked)}
              class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span class="text-sm text-gray-700">Auto-start work after break</span>
          </label>
        </div>

        <div class="mt-6">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">
              Daily Goal <span class="font-normal text-gray-400">(1–20 tomates)</span>
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={dailyGoal()}
              onInput={(e) => setDailyGoal(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>
        </div>

        <div class="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            class="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Save
          </button>

          <button
            type="button"
            onClick={handleReset}
            class="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset to defaults
          </button>

          <Show when={saved()}>
            <span class="text-sm text-green-600">Settings saved ✓</span>
          </Show>
        </div>
      </div>
    </div>
  );
}
