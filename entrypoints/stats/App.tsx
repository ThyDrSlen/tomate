import { createMemo, createResource, createSignal, For, Show } from 'solid-js';

import { getSessionHistory, getHeatmapData, getTodayCount } from '@/lib/storage';
import { computeTotalCount, computeWeekCount, computeBestDay, computeStreak } from '@/lib/stats';

import Heatmap from '@/components/Heatmap';

const INTENSITY_LEGEND = [
  { color: '#F3F4F6', label: '0' },
  { color: '#FCA5A5', label: '1' },
  { color: '#EF4444', label: '2-3' },
  { color: '#DC2626', label: '4-5' },
  { color: '#991B1B', label: '6+' },
] as const;

type FilterType = 'all' | 'week' | 'month' | 'custom';

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

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

/** Returns a YYYY-MM-DD date key for a date offset from today.
 *  offset 0 = today, offset -6 = 6 days ago, etc. */
function relativeDateKey(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Validate a YYYY-MM-DD string: non-empty and represents a real date. */
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00');
  return !isNaN(d.getTime());
}

export default function App() {
  const [yearData] = createResource(() => getHeatmapData(365));
  const [sessions] = createResource(() => getSessionHistory());
  const [todayCount] = createResource(() => getTodayCount());

  const [activeFilter, setActiveFilter] = createSignal<FilterType>('all');
  const [customFrom, setCustomFrom] = createSignal('');
  const [customTo, setCustomTo] = createSignal('');

  /** Validation error for the custom date range. Empty string = no error. */
  const customDateError = createMemo<string>(() => {
    if (activeFilter() !== 'custom') return '';
    const from = customFrom().trim();
    const to = customTo().trim();
    if (!from && !to) return 'Please enter a start and end date.';
    if (!from) return 'Start date is required.';
    if (!to) return 'End date is required.';
    if (!isValidDateString(from)) return 'Start date is not a valid date (use YYYY-MM-DD).';
    if (!isValidDateString(to)) return 'End date is not a valid date (use YYYY-MM-DD).';
    if (from > to) return 'Start date must be on or before the end date.';
    return '';
  });

  /** Whether the custom filter inputs are currently valid. */
  const isCustomValid = () => activeFilter() !== 'custom' || customDateError() === '';

  const filteredSessions = createMemo(() => {
    const all = sessions() ?? [];
    const filter = activeFilter();

    if (filter === 'week') {
      const cutoff = relativeDateKey(-6);
      return all.filter((s) => s.date >= cutoff);
    }

    if (filter === 'month') {
      const cutoff = relativeDateKey(-29);
      return all.filter((s) => s.date >= cutoff);
    }

    if (filter === 'custom') {
      // Only apply the custom filter when both dates are valid.
      if (!isCustomValid()) return all;
      const from = customFrom().trim();
      const to = customTo().trim();
      return all.filter((s) => s.date >= from && s.date <= to);
    }

    return all;
  });

  const total = () => computeTotalCount(filteredSessions());
  const week = () => computeWeekCount(filteredSessions());
  const bestDay = () => computeBestDay(filteredSessions());
  const streak = () => computeStreak(filteredSessions());

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-red-600">Tomate Stats</h1>
          <Show when={(sessions() ?? []).length > 0}>
            <button
              class="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              onClick={() => exportCSV(filteredSessions())}
            >
              Export CSV
            </button>
          </Show>
        </div>

        {/* Date range filter */}
        <div class="mb-5">
          <div class="flex items-center gap-1 bg-white border border-red-100 rounded-lg p-1 shadow-sm inline-flex">
            <For each={FILTER_OPTIONS}>
              {(option) => (
                <button
                  class={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    activeFilter() === option.value
                      ? 'bg-red-600 text-white'
                      : 'text-gray-600 hover:bg-red-50'
                  }`}
                  onClick={() => setActiveFilter(option.value)}
                >
                  {option.label}
                </button>
              )}
            </For>
          </div>

          {/* Custom date range inputs */}
          <Show when={activeFilter() === 'custom'}>
            <div class="mt-3 flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <label class="text-sm text-gray-600 w-16">From</label>
                <input
                  type="date"
                  class={`text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-300 ${
                    customDateError() && !customFrom().trim()
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200'
                  }`}
                  value={customFrom()}
                  onInput={(e) => setCustomFrom(e.currentTarget.value)}
                />
                <label class="text-sm text-gray-600 w-6 text-center">–</label>
                <label class="text-sm text-gray-600 w-6">To</label>
                <input
                  type="date"
                  class={`text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-300 ${
                    customDateError() && !customTo().trim()
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200'
                  }`}
                  value={customTo()}
                  onInput={(e) => setCustomTo(e.currentTarget.value)}
                />
              </div>

              {/* Inline validation error */}
              <Show when={customDateError()}>
                <p class="text-xs text-red-600 font-medium" role="alert">
                  {customDateError()}
                </p>
              </Show>
            </div>
          </Show>
        </div>

        <Show when={(sessions() ?? []).length === 0}>
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <p class="text-lg">No sessions yet</p>
            <p class="text-sm mt-1">Complete your first Pomodoro to see your stats here.</p>
          </div>
        </Show>

        <Show when={(sessions() ?? []).length > 0}>
          {/* Show empty state when custom filter is valid but yields no results */}
          <Show
            when={filteredSessions().length > 0 || !isCustomValid()}
            fallback={
              <div class="text-center py-8 text-gray-400">
                <p class="text-sm">No sessions found for this date range.</p>
              </div>
            }
          >
            <Show when={isCustomValid()}>
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
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
