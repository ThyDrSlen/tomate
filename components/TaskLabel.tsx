const MAX_LENGTH = 100;

const HELPER_ID = 'task-label-helper';

type TaskLabelProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function TaskLabel(props: TaskLabelProps) {
  return (
    <div class="w-full mt-4">
      <input
        type="text"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder="What are you working on?"
        maxLength={MAX_LENGTH}
        aria-describedby={HELPER_ID}
        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-400"
      />
      <div
        id={HELPER_ID}
        class="flex justify-between mt-1 px-1 text-xs text-gray-400"
      >
        <span>Optional · auto-saved</span>
        <span aria-live="polite">
          {props.value.length}/{MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
