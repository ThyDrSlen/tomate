import { createSignal, createMemo, onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

const WORK_MIN = 1;
const WORK_MAX = 120;
const SHORT_BREAK_MIN = 1;
const SHORT_BREAK_MAX = 30;
const LONG_BREAK_MIN = 5;
const LONG_BREAK_MAX = 60;

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [openBreakTab, setOpenBreakTab] = createSignal(true);
  const [saved, setSaved] = createSignal(false);

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));
    setOpenBreakTab(config.openBreakTab !== false);
  });

  const workError = createMemo(() => {
    const v = work();
    if (!Number.isFinite(v) || v < WORK_MIN || v > WORK_MAX) {
      return `Must be between ${WORK_MIN} and ${WORK_MAX} minutes.`;
    }
    return null;
  });

  const shortBreakError = createMemo(() => {
    const v = shortBreak();
    if (!Number.isFinite(v) || v < SHORT_BREAK_MIN || v > SHORT_BREAK_MAX) {
      return `Must be between ${SHORT_BREAK_MIN} and ${SHORT_BREAK_MAX} minutes.`;
    }
    return null;
  });

  const longBreakError = createMemo(() => {
    const v = longBreak();
    if (!Number.isFinite(v) || v < LONG_BREAK_MIN || v > LONG_BREAK_MAX) {
      return `Must be between ${LONG_BREAK_MIN} and ${LONG_BREAK_MAX} minutes.`;
    }
    return null;
  });

  const hasErrors = createMemo(
    () => workError() !== null || shortBreakError() !== null || longBreakError() !== null,
  );

  const handleSave = async () => {
    if (hasErrors()) return;

    const config: TimerConfig = {
      workDuration: work() * MS_PER_MINUTE,
      shortBreakDuration: shortBreak() * MS_PER_MINUTE,
      longBreakDuration: longBreak() * MS_PER_MINUTE,
      openBreakTab: openBreakTab(),
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
    setOpenBreakTab(DEFAULT_CONFIG.openBreakTab);
  };

  return (
    <div class="min-h-screen bg-red-50 flex items-start justify-center pt-16">
      <div class="w-full max-w-[400px] bg-white rounded-lg shadow-sm p-6">
        <h1 class="text-xl font-bold text-red-600 mb-6">Tomate Settings</h1>

        <div class="space-y-4">
          <div>
            <label class="block">
              <span class="text-sm font-medium text-gray-700">
                Work Duration (minutes)
              </span>
              <input
                type="number"
                min={WORK_MIN}
                max={WORK_MAX}
                value={work()}
                onInput={(e) => setWork(Number(e.currentTarget.value))}
                aria-describedby="work-hint work-error"
                class={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  workError()
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
                }`}
              />
            </label>
            <p id="work-hint" class="mt-1 text-xs text-gray-400">Range: {WORK_MIN}–{WORK_MAX} min</p>
            <Show when={workError()}>
              <p id="work-error" class="mt-1 text-xs text-red-600" role="alert">{workError()}</p>
            </Show>
          </div>

          <div>
            <label class="block">
              <span class="text-sm font-medium text-gray-700">
                Short Break (minutes)
              </span>
              <input
                type="number"
                min={SHORT_BREAK_MIN}
                max={SHORT_BREAK_MAX}
                value={shortBreak()}
                onInput={(e) => setShortBreak(Number(e.currentTarget.value))}
                aria-describedby="short-break-hint short-break-error"
                class={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  shortBreakError()
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
                }`}
              />
            </label>
            <p id="short-break-hint" class="mt-1 text-xs text-gray-400">Range: {SHORT_BREAK_MIN}–{SHORT_BREAK_MAX} min</p>
            <Show when={shortBreakError()}>
              <p id="short-break-error" class="mt-1 text-xs text-red-600" role="alert">{shortBreakError()}</p>
            </Show>
          </div>

          <div>
            <label class="block">
              <span class="text-sm font-medium text-gray-700">
                Long Break (minutes)
              </span>
              <input
                type="number"
                min={LONG_BREAK_MIN}
                max={LONG_BREAK_MAX}
                value={longBreak()}
                onInput={(e) => setLongBreak(Number(e.currentTarget.value))}
                aria-describedby="long-break-hint long-break-error"
                class={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  longBreakError()
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
                }`}
              />
            </label>
            <p id="long-break-hint" class="mt-1 text-xs text-gray-400">Range: {LONG_BREAK_MIN}–{LONG_BREAK_MAX} min</p>
            <Show when={longBreakError()}>
              <p id="long-break-error" class="mt-1 text-xs text-red-600" role="alert">{longBreakError()}</p>
            </Show>
          </div>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={openBreakTab()}
              onChange={(e) => setOpenBreakTab(e.currentTarget.checked)}
              class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span class="text-sm font-medium text-gray-700">Open stats tab when session completes</span>
          </label>
        </div>

        <div class="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={hasErrors()}
            class={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              hasErrors()
                ? 'bg-red-300 text-white cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
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
