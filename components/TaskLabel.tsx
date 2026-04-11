import { createSignal } from 'solid-js';

const MAX_LENGTH = 50;

type TaskLabelProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function TaskLabel(props: TaskLabelProps) {
  const [focused, setFocused] = createSignal(false);
  const remaining = () => MAX_LENGTH - props.value.length;

  return (
    <div class="w-full mt-4">
      <label
        for="task-label-input"
        class="block text-xs font-medium text-gray-500 mb-1"
      >
        Task label{' '}
        <span class="font-normal text-gray-400">(optional, max {MAX_LENGTH} chars)</span>
      </label>
      <div class="relative">
        <input
          id="task-label-input"
          type="text"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="What are you working on?"
          maxLength={MAX_LENGTH}
          aria-describedby="task-label-counter"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-400"
        />
        {(focused() || props.value.length > 0) && (
          <span
            id="task-label-counter"
            aria-live="polite"
            class={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none ${
              remaining() <= 10 ? 'text-red-400' : 'text-gray-400'
            }`}
          >
            {remaining()}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
}
