import { Switch, Match } from 'solid-js';
import type { TimerPhase } from '@/lib/types';

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
            onClick={props.onStart}
            disabled={props.phase !== 'IDLE' && props.phase !== 'BREAK_SUGGESTION'}
            class="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600 dark:active:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start
          </button>
        </Match>
        <Match when={props.phase === 'WORKING'}>
          <button
            type="button"
            onClick={props.onAbandon}
            disabled={props.phase === 'IDLE'}
            class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Abandon
          </button>
        </Match>
        <Match when={props.phase === 'SHORT_BREAK' || props.phase === 'LONG_BREAK'}>
          <button
            type="button"
            onClick={props.onAbandon}
            disabled={props.phase === 'IDLE'}
            class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip Break
          </button>
        </Match>
        <Match when={props.phase === 'BREAK_SUGGESTION'}>
          <button
            type="button"
            onClick={props.onAcceptLongBreak}
            class="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 dark:bg-green-700 dark:hover:bg-green-600 dark:active:bg-green-500 transition-colors"
          >
            Long Break
          </button>
          <button
            type="button"
            onClick={props.onSkipLongBreak}
            class="px-5 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:active:bg-gray-500 transition-colors"
          >
            Skip
          </button>
        </Match>
      </Switch>
    </div>
  );
}
