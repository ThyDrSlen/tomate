type TaskLabelProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function TaskLabel(props: TaskLabelProps) {
  return (
    <div class="w-full mt-4">
      <label
        for="task-label-input"
        style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
      >
        What are you working on?
      </label>
      <input
        id="task-label-input"
        type="text"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        placeholder="What are you working on?"
        maxLength={50}
        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-400"
      />
    </div>
  );
}
