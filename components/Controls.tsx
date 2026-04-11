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
            data-focus-target
            onClick={props.onStart}
            class="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors"
          >
            Start
          </button>
        </Match>
        <Match when={props.phase === 'WORKING'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onAbandon}
            class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            Abandon
          </button>
        </Match>
        <Match when={props.phase === 'SHORT_BREAK' || props.phase === 'LONG_BREAK'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onAbandon}
            class="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            Skip Break
          </button>
        </Match>
        <Match when={props.phase === 'BREAK_SUGGESTION'}>
          <button
            type="button"
            data-focus-target
            onClick={props.onAcceptLongBreak}
            class="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            Long Break
          </button>
          <button
            type="button"
            onClick={props.onSkipLongBreak}
            class="px-5 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors"
          >
            Skip
          </button>
        </Match>
      </Switch>
    </div>
  );
}
