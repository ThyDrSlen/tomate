import { createSignal, onMount, Show, For } from 'solid-js';
import { browser } from 'wxt/browser';

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

/**
 * RFC 1123 hostname validation.
 * Accepts labels of 1–63 characters each, separated by dots.
 * Each label must start and end with an alphanumeric character and may contain hyphens.
 */
const VALID_HOSTNAME =
  /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [saved, setSaved] = createSignal(false);

  const [blockedSites, setBlockedSites] = createSignal<string[]>([]);
  const [siteInput, setSiteInput] = createSignal('');
  const [siteError, setSiteError] = createSignal('');

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));
    setBlockedSites(config.blockedSites ?? []);
  });

  const handleSave = async () => {
    const config: TimerConfig = {
      workDuration: work() * MS_PER_MINUTE,
      shortBreakDuration: shortBreak() * MS_PER_MINUTE,
      longBreakDuration: longBreak() * MS_PER_MINUTE,
      blockedSites: blockedSites(),
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

  const handleAddSite = () => {
    const hostname = siteInput().trim().toLowerCase();

    if (!hostname) {
      setSiteError('Please enter a hostname.');
      return;
    }

    if (!VALID_HOSTNAME.test(hostname)) {
      setSiteError(
        'Invalid hostname. Enter a plain domain like "example.com" (no http://, no paths, no wildcards).',
      );
      return;
    }

    if (blockedSites().includes(hostname)) {
      setSiteError('This site is already in the list.');
      return;
    }

    setSiteError('');
    setBlockedSites((prev) => [...prev, hostname]);
    setSiteInput('');
  };

  const handleRemoveSite = (hostname: string) => {
    setBlockedSites((prev) => prev.filter((s) => s !== hostname));
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

        <div class="mt-8 border-t border-gray-100 pt-6">
          <h2 class="text-base font-semibold text-gray-800 mb-1">Blocked Sites</h2>
          <p class="text-xs text-gray-500 mb-4">
            Sites blocked during work sessions. Enter hostnames only (e.g. <code>twitter.com</code>).
            Changes take effect after saving.
          </p>

          <div class="flex gap-2">
            <input
              type="text"
              placeholder="example.com"
              value={siteInput()}
              onInput={(e) => {
                setSiteInput(e.currentTarget.value);
                setSiteError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSite();
              }}
              class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={handleAddSite}
              class="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Add
            </button>
          </div>

          <Show when={siteError()}>
            <p class="mt-1 text-xs text-red-600">{siteError()}</p>
          </Show>

          <Show when={blockedSites().length > 0}>
            <ul class="mt-3 space-y-1">
              <For each={blockedSites()}>
                {(hostname) => (
                  <li class="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    <span>{hostname}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSite(hostname)}
                      class="ml-2 text-gray-400 hover:text-red-600 focus:outline-none"
                      aria-label={`Remove ${hostname}`}
                    >
                      ✕
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </div>
  );
}
