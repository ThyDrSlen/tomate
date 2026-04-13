import { Show } from 'solid-js';

type TodayCountProps = {
  count: number;
  goal?: number;
};

export default function TodayCount(props: TodayCountProps) {
  const goalText = () =>
    props.goal != null ? ` / ${props.goal}` : '';

  return (
    <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
      <span>
        🍅 {props.count}{goalText()} tomate{props.count !== 1 ? 's' : ''} today
      </span>
      <Show when={props.goal != null && props.count >= props.goal!}>
        <span class="ml-1 text-green-600 font-medium">✓ Goal reached</span>
      </Show>
    </div>
  );
}
