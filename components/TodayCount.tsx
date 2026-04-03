type TodayCountProps = {
  count: number;
};

export default function TodayCount(props: TodayCountProps) {
  return (
    <div class="mt-4 text-sm text-gray-500">
      🍅 {props.count} tomate{props.count !== 1 ? 's' : ''} today
    </div>
  );
}
