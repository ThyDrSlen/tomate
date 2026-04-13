import { createResource, createSignal, For, Show } from 'solid-js';

import { getConfig, getSessionHistory, getHeatmapDataForYear, getTodayCount } from '@/lib/storage';
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

function exportCSV(sessions: import('@/lib/types').CompletedSession[]): void {
  const header = 'startTime,endTime,duration,label';
  const rows = sessions.map((s) => {
    const label = `"${s.label.replace(/"/g, '""')}"`;
    return `${s.startTime},${s.endTime},${s.duration},${label}`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tomate-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = createSignal(currentYear);

  const [yearData] = createResource(selectedYear, (year) => getHeatmapDataForYear(year));
  const [sessions] = createResource(() => getSessionHistory());
  const [todayCount] = createResource(() => getTodayCount());
  const [config] = createResource(() => getConfig());

  const dailyGoal = () => config()?.dailyGoal ?? 8;
  const goalProgress = () => Math.min(100, Math.round(((todayCount() ?? 0) / dailyGoal()) * 100));

  const total = () => computeTotalCount(sessions() ?? []);
  const week = () => computeWeekCount(sessions() ?? []);
  const bestDay = () => computeBestDay(sessions() ?? []);
  const streak = () => computeStreak(sessions() ?? []);

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-red-600">Tomate Stats</h1>
          <Show when={(sessions() ?? []).length > 0}>
            <button
              class="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              onClick={() => exportCSV(sessions() ?? [])}
            >
              Export CSV
            </button>
          </Show>
        </div>

        <Show when={(sessions() ?? []).length === 0}>
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <p class="text-lg">No sessions yet</p>
            <p class="text-sm mt-1">Complete your first Pomodoro to see your stats here.</p>
          </div>
        </Show>

        <Show when={(sessions() ?? []).length > 0}>
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

          <div class="bg-white rounded-xl p-4 shadow-sm border border-red-100 mb-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-gray-700">Daily Goal</span>
              <span class="text-xs text-gray-500">{todayCount() ?? 0} / {dailyGoal()}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
              <div
                class="h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${goalProgress()}%`,
                  "background-color": goalProgress() >= 100 ? '#16A34A' : '#DC2626',
                }}
              />
            </div>
            <Show when={goalProgress() >= 100}>
              <p class="text-xs text-green-600 mt-1 font-medium">Daily goal reached!</p>
            </Show>
          </div>

          <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-700">Activity</h2>
              <div class="flex items-center gap-2">
                <button
                  aria-label="Previous year"
                  class="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-600 transition-colors"
                  onClick={() => setSelectedYear((y) => y - 1)}
                >
                  &#8249;
                </button>
                <span class="text-sm font-medium text-gray-700 w-10 text-center">
                  {selectedYear()}
                </span>
                <button
                  aria-label="Next year"
                  disabled={selectedYear() >= currentYear}
                  class="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={() => setSelectedYear((y) => Math.min(y + 1, currentYear))}
                >
                  &#8250;
                </button>
              </div>
            </div>
            <Heatmap days={365} year={selectedYear()} cellSize={14} data={yearData() ?? {}} />

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
        </Show>
      </div>
    </div>
  );
}
