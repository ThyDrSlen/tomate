import { Switch, Match } from 'solid-js';
import type { TimerPhase } from '@/lib/types';

type ControlsProps = {
  phase: TimerPhase;
  loading?: boolean;
  onStart: () => void;
  onAbandon: () => void;
  onAcceptLongBreak: () => void;
  onSkipLongBreak: () => void;
};

const disabledClass = 'disabled:opacity-60 disabled:cursor-not-allowed';

export default function Controls(props: ControlsProps) {
  const busy = () => props.loading ?? false;

  return (
    <div class="mt-5 flex gap-3 justify-center">
      <Switch>
        <Match when={props.phase === 'IDLE'}>
          <button
            type="button"
            onClick={props.onStart}
            disabled={busy()}
            aria-busy={busy()}
            class={`px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors ${disabledClass}`}
          >
            {busy() ? 'Starting…' : 'Start'}
          </button>
        </Match>
        <Match when={props.phase === 'WORKING'}>
          <button
            type="button"
            onClick={props.onAbandon}
            disabled={busy()}
            aria-busy={busy()}
            class={`px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors ${disabledClass}`}
          >
            {busy() ? 'Updating…' : 'Abandon'}
          </button>
        </Match>
        <Match when={props.phase === 'SHORT_BREAK' || props.phase === 'LONG_BREAK'}>
          <button
            type="button"
            onClick={props.onAbandon}
            disabled={busy()}
            aria-busy={busy()}
            class={`px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors ${disabledClass}`}
          >
            {busy() ? 'Updating…' : 'Skip Break'}
          </button>
        </Match>
        <Match when={props.phase === 'BREAK_SUGGESTION'}>
          <button
            type="button"
            onClick={props.onAcceptLongBreak}
            disabled={busy()}
            aria-busy={busy()}
            class={`px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors ${disabledClass}`}
          >
            {busy() ? 'Updating…' : 'Long Break'}
          </button>
          <button
            type="button"
            onClick={props.onSkipLongBreak}
            disabled={busy()}
            aria-busy={busy()}
            class={`px-5 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors ${disabledClass}`}
          >
            {busy() ? 'Updating…' : 'Skip'}
          </button>
        </Match>
      </Switch>
    </div>
  );
}
