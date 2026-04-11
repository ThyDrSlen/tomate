import { createResource, For, Show } from 'solid-js';

import { getSessionHistory, getHeatmapData, getTodayCount, getConfig } from '@/lib/storage';
import { computeTotalCount, computeWeekCount, computeBestDay, computeStreak } from '@/lib/stats';

import Heatmap from '@/components/Heatmap';

const INTENSITY_LEGEND = [
  { color: '#F3F4F6', label: '0' },
  { color: '#FCA5A5', label: '1' },
  { color: '#EF4444', label: '2-3' },
  { color: '#DC2626', label: '4-5' },
  { color: '#991B1B', label: '6+' },
] as const;

type StatCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
};

function StatCard(props: StatCardProps) {
  return (
    <div class="bg-white rounded-xl p-4 shadow-sm border border-red-100 flex flex-col items-center gap-1">
      <span class="text-2xl font-bold text-red-600">{props.value}</span>
      <span class="text-xs text-gray-500 font-medium">{props.label}</span>
      {props.sublabel && <span class="text-[10px] text-gray-400">{props.sublabel}</span>}
    </div>
  );
}

export default function App() {
  const [yearData] = createResource(() => getHeatmapData(365));
  const [sessions] = createResource(() => getSessionHistory());
  const [todayCount] = createResource(() => getTodayCount());
  const [config] = createResource(() => getConfig());

  const total = () => computeTotalCount(sessions() ?? []);
  const week = () => computeWeekCount(sessions() ?? []);
  const bestDay = () => computeBestDay(sessions() ?? []);
  const streak = () => computeStreak(sessions() ?? []);

  const goalReached = () => {
    const count = todayCount();
    const goal = config()?.dailyGoal ?? 8;
    return count !== undefined && count >= goal;
  };

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <h1 class="text-2xl font-bold text-red-600 mb-6">Tomate Stats</h1>

        <div class="grid grid-cols-5 gap-3 mb-6">
          <StatCard label="Total tomates" value={total()} />
          <StatCard label="Today" value={todayCount() ?? 0} />
          <StatCard label="This week" value={week()} />
          <StatCard
            label="Best day"
            value={bestDay()?.count ?? '—'}
            sublabel={bestDay()?.date}
          />
          <StatCard
            label="Current streak"
            value={`${streak()}d`}
          />
        </div>

        <Show when={goalReached()}>
          <div class="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4 shadow-sm dark:border-green-800 dark:bg-green-950">
            <span class="text-2xl" aria-hidden="true">🎯</span>
            <div>
              <p class="font-semibold text-green-800 dark:text-green-200">Goal reached! Great work today!</p>
              <p class="text-sm text-green-600 dark:text-green-400">You've hit your daily goal of {config()?.dailyGoal ?? 8} tomates.</p>
            </div>
          </div>
        </Show>

        <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">365-day activity</h2>
          <Heatmap days={365} cellSize={14} data={yearData() ?? {}} />

          <div class="flex items-center gap-1 mt-3 text-[10px] text-gray-400">
            <span>Less</span>
            <For each={INTENSITY_LEGEND}>
              {(item) => (
                <div
                  class="w-3 h-3 rounded-sm"
                  style={{ "background-color": item.color }}
                  title={item.label}
                />
              )}
            </For>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
