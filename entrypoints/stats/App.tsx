import { createMemo, createResource, For, Show } from 'solid-js';
import { browser } from 'wxt/browser';

import { getSessionsForYear, getHeatmapData, getTodayCount } from '@/lib/storage';
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

  const [yearData] = createResource(() => getHeatmapData(365));
  const [sessions] = createResource(() => getSessionsForYear(currentYear));
  const [todayCount] = createResource(() => getTodayCount());

  const sessionList = () => sessions() ?? [];
  const sessionDateSet = createMemo(() => new Set(sessionList().map((s) => s.date)));

  const statsData = createMemo(() => ({
    total: computeTotalCount(sessionList()),
    week: computeWeekCount(sessionList()),
    best: computeBestDay(sessionList()),
    streak: computeStreak(sessionList(), sessionDateSet()),
  }));

  const stableYearData = createMemo(() => yearData() ?? {});

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-red-600">{browser.i18n.getMessage('statsTitle') || 'Tomate Stats'}</h1>
          <Show when={sessionList().length > 0}>
            <button
              class="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              onClick={() => exportCSV(sessionList())}
            >
              {browser.i18n.getMessage('statsExportCSV') || 'Export CSV'}
            </button>
          </Show>
        </div>

        <Show when={sessionList().length === 0}>
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <p class="text-lg">{browser.i18n.getMessage('statsNoSessions') || 'No sessions yet'}</p>
            <p class="text-sm mt-1">{browser.i18n.getMessage('statsNoSessionsHint') || 'Complete your first Pomodoro to see your stats here.'}</p>
          </div>
        </Show>

        <Show when={sessionList().length > 0}>
          <div class="grid grid-cols-5 gap-3 mb-6">
            <StatCard label={browser.i18n.getMessage('statLabelTotal') || 'Total tomates'} value={statsData().total} />
            <StatCard label={browser.i18n.getMessage('statLabelToday') || 'Today'} value={todayCount() ?? 0} />
            <StatCard label={browser.i18n.getMessage('statLabelWeek') || 'This week'} value={statsData().week} />
            <StatCard
              label={browser.i18n.getMessage('statLabelBestDay') || 'Best day'}
              value={statsData().best?.count ?? '—'}
              sublabel={statsData().best?.date}
            />
            <StatCard
              label={browser.i18n.getMessage('statLabelStreak') || 'Current streak'}
              value={`${statsData().streak}d`}
            />
          </div>

          <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <h2 class="text-sm font-semibold text-gray-700 mb-3">{browser.i18n.getMessage('statsActivityTitle') || '365-day activity'}</h2>
            <Heatmap days={365} cellSize={14} data={stableYearData()} />

            <div class="flex items-center gap-1 mt-3 text-[10px] text-gray-400">
              <span>{browser.i18n.getMessage('statsLegendLess') || 'Less'}</span>
              <For each={INTENSITY_LEGEND}>
                {(item) => (
                  <div
                    class="w-3 h-3 rounded-sm"
                    style={{ "background-color": item.color }}
                    title={item.label}
                  />
                )}
              </For>
              <span>{browser.i18n.getMessage('statsLegendMore') || 'More'}</span>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
