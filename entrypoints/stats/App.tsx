import { createResource, For } from 'solid-js';

import { getSessionHistory, getHeatmapData, getTodayCount } from '@/lib/storage';
import type { CompletedSession } from '@/lib/types';
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

  const total = () => computeTotalCount(sessions() ?? []);
  const week = () => computeWeekCount(sessions() ?? []);
  const bestDay = () => computeBestDay(sessions() ?? []);
  const streak = () => computeStreak(sessions() ?? []);

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
        <div class="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => exportData('csv')}
            class="text-xs text-gray-500 hover:text-red-600 underline"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportData('json')}
            class="text-xs text-gray-500 hover:text-red-600 underline"
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );

  function exportData(format: 'csv' | 'json') {
    const data = sessions();
    if (!data || data.length === 0) return;

    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === 'csv') {
      const header = 'date,label,startTime,endTime,duration_minutes';
      const rows = data.map((s: CompletedSession) =>
        `${s.date},"${s.label.replace(/"/g, '""')}",${new Date(s.startTime).toISOString()},${new Date(s.endTime).toISOString()},${Math.round(s.duration / 60000)}`
      );
      content = [header, ...rows].join('\n');
      mimeType = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tomate-sessions.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
