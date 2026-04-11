import { createResource, createSignal, For } from 'solid-js';

import { getSessionHistory, getHeatmapDataForRange, getTodayCount } from '@/lib/storage';
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

/** Return the last calendar day of the given year as a YYYY-MM-DD string. */
function yearEndKey(year: number): string {
  return `${year}-12-31`;
}

/** Return the first calendar day of the given year as a YYYY-MM-DD string. */
function yearStartKey(year: number): string {
  return `${year}-01-01`;
}

export default function App() {
  const currentYear = new Date().getFullYear();

  // 0 = current year, 1 = last year, etc.
  const [yearOffset, setYearOffset] = createSignal(0);

  const selectedYear = () => currentYear - yearOffset();

  /** The anchor date passed to the heatmap: Dec 31 of the selected year,
   *  but capped at today for the current year so we don't show future cells. */
  const anchorDate = () => {
    if (yearOffset() === 0) {
      // current year — anchor to today
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return yearEndKey(selectedYear());
  };

  const heatmapRange = () => {
    const end = anchorDate();
    // Always show 365 days ending on anchorDate
    const endDate = new Date(`${end}T00:00:00`);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);
    const sy = startDate.getFullYear();
    const sm = String(startDate.getMonth() + 1).padStart(2, '0');
    const sd = String(startDate.getDate()).padStart(2, '0');
    return { start: `${sy}-${sm}-${sd}`, end };
  };

  const [yearData] = createResource(
    () => heatmapRange(),
    ({ start, end }) => getHeatmapDataForRange(start, end),
  );

  const [sessions] = createResource(() => getSessionHistory());
  const [todayCount] = createResource(() => getTodayCount());

  const total = () => computeTotalCount(sessions() ?? []);
  const week = () => computeWeekCount(sessions() ?? []);
  const bestDay = () => computeBestDay(sessions() ?? []);
  const streak = () => computeStreak(sessions() ?? []);

  const heatmapHeading = () =>
    yearOffset() === 0 ? 'This year' : String(selectedYear());

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
          {/* Heading row with year navigation */}
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-700">{heatmapHeading()}</h2>
            <div class="flex items-center gap-2">
              <button
                class="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setYearOffset((o) => o + 1)}
              >
                ← {selectedYear() - 1}
              </button>
              <button
                class="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={yearOffset() === 0}
                onClick={() => setYearOffset((o) => Math.max(0, o - 1))}
              >
                {selectedYear() + 1} →
              </button>
            </div>
          </div>

          <Heatmap days={365} cellSize={14} data={yearData() ?? {}} anchorDate={anchorDate()} />

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
