type TaskLabelProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function TaskLabel(props: TaskLabelProps) {
  return (
    <input
      type="text"
      value={props.value}
      onInput={(e) => props.onChange(e.currentTarget.value)}
      placeholder="What are you working on?"
      maxLength={50}
      class="w-full mt-4 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-700 placeholder:text-gray-400 dark:placeholder:text-gray-500"
    />
  );
}
