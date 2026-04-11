import { createResource, createSignal, createMemo, For, Show } from 'solid-js';

import { getSessionHistory } from '@/lib/storage';
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
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation to ensure the browser can initiate the async download (#282)
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

const CURRENT_YEAR = new Date().getFullYear();
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type FilterMode = 'all' | 'year' | 'month';

export default function App() {
  const [sessions] = createResource(() => getSessionHistory());

  // Filter state
  const [filterMode, setFilterMode] = createSignal<FilterMode>('all');
  const [filterYear, setFilterYear] = createSignal(CURRENT_YEAR);
  const [filterMonth, setFilterMonth] = createSignal(new Date().getMonth()); // 0-indexed

  // Derive the earliest year with data
  const earliestYear = createMemo(() => {
    const all = sessions() ?? [];
    if (all.length === 0) return CURRENT_YEAR;
    const minDate = all[0].date; // sessions are stored oldest-first
    return Number.parseInt(minDate.split('-')[0], 10);
  });

  const availableYears = createMemo(() => {
    const years: number[] = [];
    for (let y = CURRENT_YEAR; y >= earliestYear(); y--) {
      years.push(y);
    }
    return years;
  });

  // Filtered sessions based on current filter mode
  const filteredSessions = createMemo(() => {
    const all = sessions() ?? [];
    if (filterMode() === 'all') return all;

    const year = filterYear();
    const month = filterMonth();

    if (filterMode() === 'year') {
      return all.filter((s) => s.date.startsWith(`${year}-`));
    }

    // month filter
    const monthStr = String(month + 1).padStart(2, '0');
    return all.filter((s) => s.date.startsWith(`${year}-${monthStr}-`));
  });

  // Build heatmap data from filtered sessions
  const heatmapData = createMemo(() => {
    const map: Record<string, number> = {};
    for (const s of filteredSessions()) {
      map[s.date] = (map[s.date] ?? 0) + 1;
    }
    return map;
  });

  // Heatmap days: year = 365, month = days in month, all = 365
  const heatmapDays = createMemo(() => {
    if (filterMode() === 'month') {
      return new Date(filterYear(), filterMonth() + 1, 0).getDate();
    }
    return 365;
  });

  // Stats
  const total = () => computeTotalCount(filteredSessions());
  const week = () => (filterMode() === 'all' ? computeWeekCount(filteredSessions()) : null);
  const bestDay = () => computeBestDay(filteredSessions());
  const streak = () => (filterMode() === 'all' ? computeStreak(filteredSessions()) : null);
  const todayCount = createMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredSessions().filter((s) => s.date === today).length;
  });

  // Navigation helpers
  const filterLabel = () => {
    if (filterMode() === 'all') return 'All time';
    if (filterMode() === 'year') return String(filterYear());
    return `${MONTH_NAMES[filterMonth()]} ${filterYear()}`;
  };

  const canGoBack = () => {
    if (filterMode() === 'year') return filterYear() > earliestYear();
    if (filterMode() === 'month') {
      return filterYear() > earliestYear() || filterMonth() > 0;
    }
    return false;
  };

  const canGoForward = () => {
    if (filterMode() === 'year') return filterYear() < CURRENT_YEAR;
    if (filterMode() === 'month') {
      return filterYear() < CURRENT_YEAR || filterMonth() < new Date().getMonth();
    }
    return false;
  };

  const goBack = () => {
    if (filterMode() === 'year') {
      setFilterYear((y) => y - 1);
    } else if (filterMode() === 'month') {
      if (filterMonth() === 0) {
        setFilterYear((y) => y - 1);
        setFilterMonth(11);
      } else {
        setFilterMonth((m) => m - 1);
      }
    }
  };

  const goForward = () => {
    if (filterMode() === 'year') {
      setFilterYear((y) => y + 1);
    } else if (filterMode() === 'month') {
      if (filterMonth() === 11) {
        setFilterYear((y) => y + 1);
        setFilterMonth(0);
      } else {
        setFilterMonth((m) => m + 1);
      }
    }
  };

  const setModeAll = () => setFilterMode('all');
  const setModeYear = () => { setFilterMode('year'); setFilterYear(CURRENT_YEAR); };
  const setModeMonth = () => { setFilterMode('month'); setFilterYear(CURRENT_YEAR); setFilterMonth(new Date().getMonth()); };

  const hasData = () => (sessions() ?? []).length > 0;

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-red-600">Tomate Stats</h1>
          <Show when={hasData()}>
            <button
              class="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              onClick={() => exportCSV(filteredSessions())}
            >
              Export CSV
            </button>
          </Show>
        </div>

        {/* Filter controls */}
        <Show when={hasData()}>
          <div class="flex flex-wrap items-center gap-2 mb-4">
            {/* Quick filter buttons */}
            <div class="flex rounded-lg overflow-hidden border border-red-200 text-sm">
              <button
                type="button"
                class={`px-3 py-1.5 transition-colors ${filterMode() === 'all' ? 'bg-red-600 text-white' : 'bg-white text-red-600 hover:bg-red-50'}`}
                onClick={setModeAll}
              >
                All time
              </button>
              <button
                type="button"
                class={`px-3 py-1.5 border-l border-red-200 transition-colors ${filterMode() === 'year' ? 'bg-red-600 text-white' : 'bg-white text-red-600 hover:bg-red-50'}`}
                onClick={setModeYear}
              >
                Year
              </button>
              <button
                type="button"
                class={`px-3 py-1.5 border-l border-red-200 transition-colors ${filterMode() === 'month' ? 'bg-red-600 text-white' : 'bg-white text-red-600 hover:bg-red-50'}`}
                onClick={setModeMonth}
              >
                Month
              </button>
            </div>

            {/* Navigation arrows + label */}
            <Show when={filterMode() !== 'all'}>
              <div class="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={!canGoBack()}
                  class="px-2 py-1 rounded text-red-600 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
                  aria-label="Previous period"
                >
                  ‹
                </button>
                <span class="text-sm font-medium text-gray-700 min-w-[120px] text-center">{filterLabel()}</span>
                <button
                  type="button"
                  onClick={goForward}
                  disabled={!canGoForward()}
                  class="px-2 py-1 rounded text-red-600 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
                  aria-label="Next period"
                >
                  ›
                </button>
              </div>

              {/* Year dropdown (shown in year mode) */}
              <Show when={filterMode() === 'year' && availableYears().length > 1}>
                <select
                  value={filterYear()}
                  onChange={(e) => setFilterYear(Number(e.currentTarget.value))}
                  class="text-sm border border-red-200 rounded-md px-2 py-1 text-red-600 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                  aria-label="Select year"
                >
                  <For each={availableYears()}>
                    {(y) => <option value={y}>{y}</option>}
                  </For>
                </select>
              </Show>
            </Show>
          </div>
        </Show>

        <Show when={!hasData()}>
          <div class="text-center py-8 text-gray-500 dark:text-gray-400">
            <p class="text-lg">No sessions yet</p>
            <p class="text-sm mt-1">Complete your first Pomodoro to see your stats here.</p>
          </div>
        </Show>

        <Show when={hasData()}>
          {/* Stats cards */}
          <div class="grid grid-cols-5 gap-3 mb-6">
            <StatCard label="Total tomates" value={total()} sublabel={filterMode() !== 'all' ? filterLabel() : undefined} />
            <Show when={filterMode() === 'all'}>
              <StatCard label="Today" value={todayCount()} />
            </Show>
            <Show when={filterMode() !== 'all'}>
              <StatCard label="Best day" value={bestDay()?.count ?? '—'} sublabel={bestDay()?.date} />
            </Show>
            <Show when={filterMode() === 'all'}>
              <StatCard label="This week" value={week() ?? 0} />
            </Show>
            <Show when={filterMode() !== 'all'}>
              <StatCard
                label="Avg / day"
                value={(() => {
                  const days = filterMode() === 'month'
                    ? new Date(filterYear(), filterMonth() + 1, 0).getDate()
                    : 365;
                  return total() === 0 ? '—' : (total() / days).toFixed(1);
                })()}
              />
            </Show>
            <StatCard
              label="Best day"
              value={bestDay()?.count ?? '—'}
              sublabel={bestDay()?.date}
            />
            <Show when={filterMode() === 'all'}>
              <StatCard
                label="Current streak"
                value={`${streak() ?? 0}d`}
              />
            </Show>
            <Show when={filterMode() !== 'all'}>
              <StatCard label="Active days" value={Object.keys(heatmapData()).length} />
            </Show>
          </div>

          <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <h2 class="text-sm font-semibold text-gray-700 mb-3">
              {filterMode() === 'all' ? '365-day activity' : `${filterLabel()} activity`}
            </h2>
            <Heatmap days={heatmapDays()} cellSize={14} data={heatmapData()} />

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
