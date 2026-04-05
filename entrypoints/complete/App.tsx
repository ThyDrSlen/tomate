import { onMount, Show } from 'solid-js';
import { browser } from 'wxt/browser';
import { playCelebration } from '@/lib/celebration';
import { setPendingCelebration } from '@/lib/storage';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') ?? 'work';
  const count = Number(params.get('count') ?? '0');
  const isLongBreak = params.get('long') === '1';

  onMount(async () => {
    if (type === 'work') {
      playCelebration(count >= 4 ? 'milestone' : 'work');
      await setPendingCelebration(false);
    }
  });

  const startBreak = async () => {
    await browser.runtime.sendMessage({ action: 'ACCEPT_LONG_BREAK' });
    window.close();
  };

  const skipBreak = async () => {
    await browser.runtime.sendMessage({ action: 'SKIP_LONG_BREAK' });
    window.close();
  };

  const startTimer = async () => {
    await browser.runtime.sendMessage({ action: 'START_TIMER' });
    window.close();
  };

  const closeTab = () => {
    window.close();
  };

  return (
    <div class="min-h-screen bg-red-50 flex items-center justify-center">
      <div class="text-center p-8">
        <Show when={type === 'work'}>
          <div class="text-7xl mb-4">{isLongBreak ? '☕' : '🍅'}</div>
          <h1 class="text-3xl font-bold text-red-600 mb-2">Tomate Complete!</h1>
          <p class="text-lg text-gray-600 mb-1">
            You've done <span class="font-bold text-red-600">{count}</span> tomate{count !== 1 ? 's' : ''} today.
          </p>
          <p class="text-gray-500 mb-8">
            {isLongBreak ? 'You earned a long break.' : 'Time for a break.'}
          </p>
          <div class="flex gap-3 justify-center">
            <button
              type="button"
              onClick={startBreak}
              class="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors text-lg"
            >
              {isLongBreak ? 'Take Long Break' : 'Take a Break'}
            </button>
            <button
              type="button"
              onClick={skipBreak}
              class="px-5 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Skip
            </button>
          </div>
        </Show>

        <Show when={type === 'break'}>
          <div class="text-7xl mb-4">💪</div>
          <h1 class="text-3xl font-bold text-blue-600 mb-2">Break's Over!</h1>
          <p class="text-lg text-gray-600 mb-8">Ready for another tomate?</p>
          <div class="flex gap-3 justify-center">
            <button
              type="button"
              onClick={startTimer}
              class="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-lg"
            >
              Start Timer
            </button>
            <button
              type="button"
              onClick={closeTab}
              class="px-5 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Not Yet
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}
