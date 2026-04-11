import { createResource, createSignal, For } from 'solid-js';

import { getSessionHistory, getHeatmapData, getTodayCount } from '@/lib/storage';
import { computeTotalCount, computeBestDay, computeStreak } from '@/lib/stats';

import Heatmap from '@/components/Heatmap';

const INTENSITY_LEGEND = [
  { color: '#F3F4F6', label: '0' },
  { color: '#FCA5A5', label: '1' },
  { color: '#EF4444', label: '2-3' },
  { color: '#DC2626', label: '4-5' },
  { color: '#991B1B', label: '6+' },
] as const;

type Period = 7 | 30 | 90 | 0;

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 0, label: 'All' },
];

type StatCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
};

function StatCard(props: StatCardProps) {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-red-100 dark:border-red-900 flex flex-col items-center gap-1">
      <span class="text-2xl font-bold text-red-600 dark:text-red-400">{props.value}</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">{props.label}</span>
      {props.sublabel && <span class="text-[10px] text-gray-400 dark:text-gray-500">{props.sublabel}</span>}
    </div>
  );
}

export default function App() {
  const [period, setPeriod] = createSignal<Period>(30);

  const heatmapDays = () => (period() === 0 ? 365 : period());

  const [heatmapData] = createResource(period, (p) =>
    getHeatmapData(p === 0 ? 365 : p),
  );
  const [sessions] = createResource(period, (p) =>
    getSessionHistory(p === 0 ? undefined : p),
  );
  const [todayCount] = createResource(() => getTodayCount());

  const total = () => computeTotalCount(sessions() ?? []);
  const bestDay = () => computeBestDay(sessions() ?? []);
  const streak = () => computeStreak(sessions() ?? []);

  const periodLabel = () => {
    const p = period();
    if (p === 0) return 'All time';
    return `Last ${p} days`;
  };

  return (
    <div class="min-h-screen bg-red-50 dark:bg-gray-900 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-red-600 dark:text-red-400">Tomate Stats</h1>

          {/* Period selector */}
          <div class="flex items-center gap-1 bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900 rounded-lg p-1 shadow-sm">
            <For each={PERIODS}>
              {(item) => (
                <button
                  class={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    period() === item.value
                      ? 'bg-red-600 text-white dark:bg-red-500'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setPeriod(item.value)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="Today" value={todayCount() ?? 0} />
          <StatCard label={periodLabel()} value={total()} />
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

        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-red-100 dark:border-red-900">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {period() === 0 ? '365-day' : `${period()}-day`} activity
          </h2>
          <Heatmap days={heatmapDays()} cellSize={14} data={heatmapData() ?? {}} />

          <div class="flex items-center gap-1 mt-3 text-[10px] text-gray-400 dark:text-gray-500">
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
