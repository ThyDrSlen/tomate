import { Switch, Match } from 'solid-js';
import { browser } from 'wxt/browser';
import type { TimerPhase } from '@/lib/types';

const t = (key: string, fallback: string): string => {
  try {
    return browser.i18n.getMessage(key as any) || fallback;
  } catch {
    return fallback;
  }
};

type ControlsProps = {
  phase: TimerPhase;
  onStart: () => void;
  onAbandon: () => void;
  onAcceptLongBreak: () => void;
  onSkipLongBreak: () => void;
};

export default function Controls(props: ControlsProps) {
  return (
    <div class="mt-5 flex gap-3 justify-center">
      <Switch>
        <Match when={props.phase === 'IDLE'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onStart}
            aria-label="Start a focus session"
            class="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            {t('controlStart', 'Start')}
          </button>
        </Match>
        <Match when={props.phase === 'WORKING'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onAbandon}
            aria-label="Abandon the current focus session"
            class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            {t('controlAbandon', 'Abandon')}
          </button>
        </Match>
        <Match when={props.phase === 'SHORT_BREAK' || props.phase === 'LONG_BREAK'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onAbandon}
            aria-label="Skip the current break and return to idle"
            class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            {t('controlSkipBreak', 'Skip Break')}
          </button>
        </Match>
        <Match when={props.phase === 'BREAK_SUGGESTION'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onAcceptLongBreak}
            aria-label="Start a long break (you've earned it!)"
            class="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            {t('controlLongBreak', 'Long Break')}
          </button>
          <button
            type="button"
            onClick={props.onSkipLongBreak}
            aria-label="Skip the long break and return to idle"
            class="px-5 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            {t('controlSkip', 'Skip')}
          </button>
        </Match>
      </Switch>
    </div>
  );
}
