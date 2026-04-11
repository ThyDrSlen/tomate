type TaskLabelProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function TaskLabel(props: TaskLabelProps) {
  return (
    <div class="mt-4">
      <input
        type="text"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder="Label this session..."
        maxLength={100}
        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-400"
      />
      <p class="text-xs text-gray-400 mt-1">Optional label for this session (max 100 characters)</p>
    </div>
  );
}
