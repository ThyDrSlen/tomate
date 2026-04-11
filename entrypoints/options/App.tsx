import { createSignal, onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type AmbientSound, type TimerConfig } from '@/lib/types';
import { ambientPlay, ambientStop } from '@/lib/ambient';

const MS_PER_MINUTE = 60_000;

const AMBIENT_SOUND_OPTIONS: { value: AmbientSound; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'rain', label: 'Rain' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'whitenoise', label: 'White Noise' },
];

export default function App() {
  const [work, setWork] = createSignal(25);
  const [shortBreak, setShortBreak] = createSignal(5);
  const [longBreak, setLongBreak] = createSignal(30);
  const [ambientSound, setAmbientSound] = createSignal<AmbientSound>('none');
  const [ambientVolume, setAmbientVolume] = createSignal(50);
  const [saved, setSaved] = createSignal(false);

  onMount(async () => {
    const config = await getConfig();
    setWork(Math.round(config.workDuration / MS_PER_MINUTE));
    setShortBreak(Math.round(config.shortBreakDuration / MS_PER_MINUTE));
    setLongBreak(Math.round(config.longBreakDuration / MS_PER_MINUTE));
    setAmbientSound(config.ambientSound);
    setAmbientVolume(config.ambientVolume);
  });

  const handleSave = async () => {
    const config: TimerConfig = {
      workDuration: work() * MS_PER_MINUTE,
      shortBreakDuration: shortBreak() * MS_PER_MINUTE,
      longBreakDuration: longBreak() * MS_PER_MINUTE,
      ambientSound: ambientSound(),
      ambientVolume: ambientVolume(),
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
    setAmbientSound(DEFAULT_CONFIG.ambientSound);
    setAmbientVolume(DEFAULT_CONFIG.ambientVolume);
  };

  const handlePreview = () => {
    const sound = ambientSound();
    if (sound === 'none') {
      ambientStop();
    } else {
      ambientPlay(sound, ambientVolume());
      setTimeout(() => ambientStop(), 4000);
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

          <div class="block">
            <span class="text-sm font-medium text-gray-700">Ambient Sound (during focus)</span>
            <div class="mt-2 flex flex-wrap gap-2">
              {AMBIENT_SOUND_OPTIONS.map((opt) => (
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="ambientSound"
                    value={opt.value}
                    checked={ambientSound() === opt.value}
                    onChange={() => setAmbientSound(opt.value)}
                    class="accent-red-600"
                  />
                  <span class="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label class="block">
            <span class="text-sm font-medium text-gray-700">
              Ambient Volume ({ambientVolume()}%)
            </span>
            <div class="mt-1 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={ambientVolume()}
                onInput={(e) => setAmbientVolume(Number(e.currentTarget.value))}
                class="flex-1 accent-red-600"
              />
              <button
                type="button"
                onClick={handlePreview}
                class="text-xs text-red-600 hover:text-red-800 underline whitespace-nowrap"
              >
                Preview (4s)
              </button>
            </div>
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
