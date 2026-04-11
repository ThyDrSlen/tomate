import { Show } from 'solid-js';

type TodayCountProps = {
  count: number;
  goal?: number;
};

export default function TodayCount(props: TodayCountProps) {
  const hasGoal = () => (props.goal ?? 0) > 0;
  const pct = () => {
    const g = props.goal ?? 0;
    if (g <= 0) return 0;
    return Math.min(100, Math.round((props.count / g) * 100));
  };
  const goalReached = () => hasGoal() && props.count >= (props.goal ?? 0);

  return (
    <div class="mt-4 w-full">
      <div class="text-sm text-gray-500 text-center">
        🍅 {props.count} tomate{props.count !== 1 ? 's' : ''} today
        <Show when={hasGoal()}>
          <span class="ml-1 text-gray-400">/ {props.goal} goal</span>
        </Show>
      </div>
      <Show when={hasGoal()}>
        <div class="mt-1 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            class={`h-1.5 rounded-full transition-all duration-300 ${goalReached() ? 'bg-green-500' : 'bg-red-400'}`}
            style={{ width: `${pct()}%` }}
            role="progressbar"
            aria-valuenow={props.count}
            aria-valuemax={props.goal}
            aria-label="Daily goal progress"
          />
        </div>
      </Show>
    </div>
  );
}
