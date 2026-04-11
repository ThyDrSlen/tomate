import { createSignal, onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [saved, setSaved] = createSignal(false);

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));
  });

  const handleSave = async () => {
    const config: TimerConfig = {
      workDuration: work() * MS_PER_MINUTE,
      shortBreakDuration: shortBreak() * MS_PER_MINUTE,
      longBreakDuration: longBreak() * MS_PER_MINUTE,
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
  };

  return (
    <div class="min-h-screen bg-red-50 dark:bg-gray-900 flex items-start justify-center pt-16">
      <div class="w-full max-w-[400px] bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 class="text-xl font-bold text-red-600 dark:text-red-400 mb-6">Tomate Settings</h1>

        <div class="space-y-4">
          <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Work Duration (minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={work()}
              onInput={(e) => setWork(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-red-500 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Short Break (minutes)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={shortBreak()}
              onInput={(e) => setShortBreak(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-red-500 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
            />
          </label>

          <label class="block">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Long Break (minutes)</span>
            <input
              type="number"
              min={5}
              max={60}
              value={longBreak()}
              onInput={(e) => setLongBreak(Number(e.currentTarget.value))}
              class="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-red-500 dark:focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400"
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
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 underline"
          >
            Reset to defaults
          </button>

          <Show when={saved()}>
            <span class="text-sm text-green-600 dark:text-green-400">Settings saved ✓</span>
          </Show>
        </div>
      </div>
    </div>
  );
}
