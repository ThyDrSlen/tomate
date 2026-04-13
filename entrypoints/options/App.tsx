import { createSignal, For, onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

const isValidWork = (v: number) => v >= 1 && v <= 120;
const isValidShortBreak = (v: number) => v >= 1 && v <= 30;
const isValidLongBreak = (v: number) => v >= 5 && v <= 60;

/**
 * Strip a protocol prefix (http:// or https://) from a raw hostname input.
 * Returns the stripped value, or the original string if no protocol is present.
 */
export const stripProtocol = (value: string): string =>
  value.replace(/^https?:\/\//i, '');

/**
 * Validate that a string is a well-formed plain hostname suitable for use in
 * declarativeNetRequest rules.  Rules:
 *  - No protocol prefix (http://, https://)
 *  - No path separator (/)
 *  - No query string (?)
 *  - At least one dot (.)
 *  - Only valid hostname characters: letters, digits, hyphens, dots
 */
export const isValidHostname = (value: string): boolean => {
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.includes('/')) return false;
  if (value.includes('?')) return false;
  if (!value.includes('.')) return false;
  return /^[a-zA-Z0-9.\-]+$/.test(value);
};

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [openBreakTab, setOpenBreakTab] = createSignal(true);
  const [playCompletionSound, setPlayCompletionSound] = createSignal(true);
  const [blockedSites, setBlockedSites] = createSignal<string[]>([]);
  const [hostnameInput, setHostnameInput] = createSignal('');
  const [hostnameError, setHostnameError] = createSignal('');
  // Preserve fields not yet surfaced in UI (e.g. dailyGoal) so we don't wipe them on save
  const [extraConfig, setExtraConfig] = createSignal<Partial<TimerConfig>>({});
  const [saved, setSaved] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));
    setOpenBreakTab(config.openBreakTab !== false);
    setPlayCompletionSound(config.playCompletionSound !== false);
    setBlockedSites(config.blockedSites ?? []);
    // Stash any extra fields so round-trip save doesn't lose them
    const { workDuration: _w, shortBreakDuration: _s, longBreakDuration: _l, openBreakTab: _o, playCompletionSound: _p, blockedSites: _b, ...rest } = config;
    setExtraConfig(rest);
  });

  const isValid = () =>
    isValidWork(work()) && isValidShortBreak(shortBreak()) && isValidLongBreak(longBreak());

  const handleSave = async () => {
    setError('');
    if (!isValid()) {
      setError('Please check the duration values — work must be 1–120 min, short break 1–30 min, long break 5–60 min.');
      return;
    }
    const config: TimerConfig = {
      ...DEFAULT_CONFIG,
      ...extraConfig(),
      workDuration: work() * MS_PER_MINUTE,
      shortBreakDuration: shortBreak() * MS_PER_MINUTE,
      longBreakDuration: longBreak() * MS_PER_MINUTE,
      openBreakTab: openBreakTab(),
      playCompletionSound: playCompletionSound(),
      blockedSites: blockedSites(),
    };
    try {
      await setConfig(config);
    } catch {
      setError('Failed to save settings to storage.');
      return;
    }
    try {
      await browser.runtime.sendMessage({ action: 'UPDATE_CONFIG', config });
    } catch {
      // Background may not be reachable; config is already saved
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setWork(Math.round(DEFAULT_CONFIG.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(DEFAULT_CONFIG.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(DEFAULT_CONFIG.longBreakDuration / MS_PER_MINUTE));
    setOpenBreakTab(DEFAULT_CONFIG.openBreakTab);
    setPlayCompletionSound(DEFAULT_CONFIG.playCompletionSound);
    setBlockedSites(DEFAULT_CONFIG.blockedSites);
    setHostnameInput('');
    setHostnameError('');
    setExtraConfig({ dailyGoal: DEFAULT_CONFIG.dailyGoal });
    setError('');
  };

  const handleAddHostname = () => {
    const raw = hostnameInput().trim();
    if (!raw) return;

    // Auto-strip protocol prefix
    const stripped = stripProtocol(raw);

    if (!isValidHostname(stripped)) {
      setHostnameError(
        'Invalid hostname. Enter a plain domain like "example.com" — no protocol, path, or query string.',
      );
      return;
    }

    if (blockedSites().includes(stripped)) {
      setHostnameError(`"${stripped}" is already in the list.`);
      return;
    }

    setBlockedSites([...blockedSites(), stripped]);
    setHostnameInput('');
    setHostnameError('');
  };

  const handleRemoveHostname = (hostname: string) => {
    setBlockedSites(blockedSites().filter((h) => h !== hostname));
  };

  const handleHostnameKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddHostname();
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

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={openBreakTab()}
              onChange={(e) => setOpenBreakTab(e.currentTarget.checked)}
              class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span class="text-sm font-medium text-gray-700">Open stats tab when session completes</span>
          </label>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={playCompletionSound()}
              onChange={(e) => setPlayCompletionSound(e.currentTarget.checked)}
              class="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span class="text-sm font-medium text-gray-700">Play completion sound</span>
          </label>

          <div class="block">
            <span class="text-sm font-medium text-gray-700">Blocked Sites (during work sessions)</span>
            <p class="text-xs text-gray-500 mt-0.5 mb-2">
              Enter hostnames like <code class="font-mono bg-gray-100 px-1 rounded">example.com</code>. No protocol or path.
            </p>

            <div class="flex gap-2">
              <input
                type="text"
                value={hostnameInput()}
                onInput={(e) => {
                  setHostnameInput(e.currentTarget.value);
                  setHostnameError('');
                }}
                onKeyDown={handleHostnameKeyDown}
                placeholder="e.g. example.com"
                aria-label="Hostname to block"
                aria-describedby={hostnameError() ? 'hostname-error' : undefined}
                class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={handleAddHostname}
                class="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Add
              </button>
            </div>

            <Show when={hostnameError()}>
              <p id="hostname-error" class="mt-1 text-xs text-red-600" role="alert">{hostnameError()}</p>
            </Show>

            <Show when={blockedSites().length > 0}>
              <ul class="mt-2 space-y-1" aria-label="Blocked hostnames">
                <For each={blockedSites()}>
                  {(hostname) => (
                    <li class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm">
                      <span class="font-mono text-gray-800">{hostname}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHostname(hostname)}
                        aria-label={`Remove ${hostname}`}
                        class="text-gray-400 hover:text-red-600 focus:outline-none focus:text-red-600 ml-2 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </div>

        <div class="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid()}
            class="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <Show when={error()}>
          <p class="mt-3 text-sm text-red-600" role="alert">{error()}</p>
        </Show>
      </div>
    </div>
  );
}
