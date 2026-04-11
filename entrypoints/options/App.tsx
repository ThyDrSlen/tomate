import { createSignal, For, onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getBlockedSites, getConfig, setBlockedSites, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

const sanitizeHostname = (raw: string): string => {
  let value = raw.trim();
  // Strip leading scheme
  value = value.replace(/^https?:\/\//i, '');
  // Strip leading www.
  value = value.replace(/^www\./i, '');
  return value;
};

const validateHostname = (value: string): string | null => {
  if (value.length === 0) return 'Enter a hostname only (e.g. twitter.com)';
  if (/\s/.test(value)) return 'Enter a hostname only (e.g. twitter.com)';
  if (value.includes('/')) return 'Enter a hostname only (e.g. twitter.com)';
  return null;
};

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [saved, setSaved] = createSignal(false);

  const [blockedSites, setBlockedSitesSignal] = createSignal<string[]>([]);
  const [hostnameInput, setHostnameInput] = createSignal('');
  const [hostnameError, setHostnameError] = createSignal<string | null>(null);

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));

    const sites = await getBlockedSites();
    setBlockedSitesSignal(sites);
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

  const handleHostnameInput = (value: string) => {
    setHostnameInput(value);
    // Clear error as soon as the user starts typing
    if (hostnameError() !== null) {
      setHostnameError(null);
    }
  };

  const handleAddSite = async () => {
    const sanitized = sanitizeHostname(hostnameInput());
    const error = validateHostname(sanitized);
    if (error !== null) {
      setHostnameError(error);
      return;
    }

    // Skip duplicates silently
    if (blockedSites().includes(sanitized)) {
      setHostnameInput('');
      return;
    }

    const updated = [...blockedSites(), sanitized];
    setBlockedSitesSignal(updated);
    await setBlockedSites(updated);
    setHostnameInput('');
    setHostnameError(null);
  };

  const handleRemoveSite = async (site: string) => {
    const updated = blockedSites().filter((s) => s !== site);
    setBlockedSitesSignal(updated);
    await setBlockedSites(updated);
  };

  const handleHostnameKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSite();
    }
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

        <div class="mt-8">
          <h2 class="text-sm font-medium text-gray-700 mb-2">Blocked Sites</h2>
          <p class="text-xs text-gray-500 mb-3">
            Add hostnames to block during work sessions (e.g. twitter.com).
          </p>

          <div class="flex gap-2">
            <div class="flex-1">
              <input
                type="text"
                placeholder="twitter.com"
                value={hostnameInput()}
                onInput={(e) => handleHostnameInput(e.currentTarget.value)}
                onKeyDown={handleHostnameKeyDown}
                class={`block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  hostnameError() !== null
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-red-500 focus:ring-red-500'
                }`}
              />
              <Show when={hostnameError() !== null}>
                <p class="mt-1 text-xs text-red-600">{hostnameError()}</p>
              </Show>
            </div>
            <button
              type="button"
              onClick={handleAddSite}
              class="shrink-0 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Add
            </button>
          </div>

          <Show when={blockedSites().length > 0}>
            <ul class="mt-3 space-y-1">
              <For each={blockedSites()}>
                {(site) => (
                  <li class="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                    <span class="text-gray-800">{site}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSite(site)}
                      class="ml-2 text-gray-400 hover:text-red-600 focus:outline-none"
                      aria-label={`Remove ${site}`}
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
