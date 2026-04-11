import { createResource, createSignal, createMemo, For, Show } from 'solid-js';

import { getSessionHistory, getHeatmapData, getTodayCount } from '@/lib/storage';
import { computeTotalCount, computeWeekCount, computeBestDay, computeStreak } from '@/lib/stats';
import type { CompletedSession } from '@/lib/types';

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

function exportCSV(sessions: CompletedSession[]): void {
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
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Returns the calendar year of a YYYY-MM-DD date string */
const yearFromKey = (key: string): number => Number.parseInt(key.slice(0, 4), 10);

/** Heatmap data scoped to a single calendar year */
function buildYearHeatmap(sessions: CompletedSession[], year: number): Record<string, number> {
  return sessions
    .filter((s) => yearFromKey(s.date) === year)
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.date] = (acc[s.date] ?? 0) + 1;
      return acc;
    }, {});
}

/** Count days in a given year (handles leap years) */
function daysInYear(year: number): number {
  return new Date(year, 11, 31).getTime() - new Date(year, 0, 1).getTime() <= 365 * 86_400_000
    ? 365
    : 366;
}

type DateFilter = 'all' | 'this-month' | 'last-month' | 'this-year' | 'custom';

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [allSessions] = createResource(() => getSessionHistory());
  const [todayCount] = createResource(() => getTodayCount());
  const [yearData] = createResource(() => getHeatmapData(365));

  // ---- Date-range filter state (#200) ----
  const [activeFilter, setActiveFilter] = createSignal<DateFilter>('all');
  const [customFrom, setCustomFrom] = createSignal('');
  const [customTo, setCustomTo] = createSignal('');

  const filteredSessions = createMemo<CompletedSession[]>(() => {
    const all = allSessions() ?? [];
    const filter = activeFilter();
    const now = new Date();

    if (filter === 'all') return all;

    if (filter === 'this-month') {
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return all.filter((s) => s.date.startsWith(key));
    }

    if (filter === 'last-month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      return all.filter((s) => s.date.startsWith(key));
    }

    if (filter === 'this-year') {
      const key = String(now.getFullYear());
      return all.filter((s) => s.date.startsWith(key));
    }

    if (filter === 'custom') {
      const from = customFrom();
      const to = customTo();
      return all.filter((s) => {
        if (from && s.date < from) return false;
        if (to && s.date > to) return false;
        return true;
      });
    }

    return all;
  });

  const filteredHeatmap = createMemo<Record<string, number>>(() =>
    filteredSessions().reduce<Record<string, number>>((acc, s) => {
      acc[s.date] = (acc[s.date] ?? 0) + 1;
      return acc;
    }, {}),
  );

  // ---- Summary stats over filtered sessions ----
  const total = () => computeTotalCount(filteredSessions());
  const week = () => computeWeekCount(filteredSessions());
  const bestDay = () => computeBestDay(filteredSessions());
  const streak = () => computeStreak(filteredSessions());

  // ---- Year navigation state (#199) ----
  const availableYears = createMemo<number[]>(() => {
    const all = allSessions() ?? [];
    if (all.length === 0) return [new Date().getFullYear()];
    const years = new Set(all.map((s) => yearFromKey(s.date)));
    return [...years].sort((a, b) => b - a);
  });

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = createSignal<number>(currentYear);

  const yearSessions = createMemo(() =>
    (allSessions() ?? []).filter((s) => yearFromKey(s.date) === selectedYear()),
  );

  const yearHeatmap = createMemo(() => buildYearHeatmap(allSessions() ?? [], selectedYear()));

  // ---- Session list sort ----
  type SortKey = 'date' | 'duration' | 'label';
  const [sortKey, setSortKey] = createSignal<SortKey>('date');
  const [sortAsc, setSortAsc] = createSignal(false);

  const sortedSessions = createMemo(() => {
    const list = [...filteredSessions()].sort((a, b) => {
      const key = sortKey();
      if (key === 'date') return a.startTime - b.startTime;
      if (key === 'duration') return a.duration - b.duration;
      return a.label.localeCompare(b.label);
    });
    return sortAsc() ? list : list.reverse();
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortAsc(!sortAsc());
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const hasSessions = () => (allSessions() ?? []).length > 0;

  const filterBtn = (f: DateFilter, label: string) => (
    <button
      type="button"
      class={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        activeFilter() === f
          ? 'bg-red-600 text-white'
          : 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
      }`}
      onClick={() => setActiveFilter(f)}
    >
      {label}
    </button>
  );

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[860px] mx-auto">

        {/* Header */}
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-red-600">Tomate Stats</h1>
          <Show when={hasSessions()}>
            <button
              type="button"
              class="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
              onClick={() => exportCSV(filteredSessions())}
            >
              Export CSV
            </button>
          </Show>
        </div>

        {/* Empty state */}
        <Show when={allSessions.state !== 'pending' && !hasSessions()}>
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <span class="text-5xl mb-4" aria-hidden="true">🍅</span>
            <p class="text-lg font-semibold text-gray-700">No sessions yet. Start a timer to track your first tomate!</p>
            <p class="text-sm text-gray-500 mt-2">Open the Tomate extension popup to start a work session.</p>
          </div>
        </Show>

        <Show when={hasSessions()}>
          {/* Date-range filter bar (#200) */}
          <div class="flex flex-wrap items-center gap-2 mb-5">
            {filterBtn('all', 'All time')}
            {filterBtn('this-month', 'This month')}
            {filterBtn('last-month', 'Last month')}
            {filterBtn('this-year', 'This year')}
            {filterBtn('custom', 'Custom')}
            <Show when={activeFilter() === 'custom'}>
              <input
                type="date"
                class="ml-2 text-xs border border-red-200 rounded px-2 py-1"
                value={customFrom()}
                onInput={(e) => setCustomFrom(e.currentTarget.value)}
                aria-label="From date"
              />
              <span class="text-xs text-gray-400">to</span>
              <input
                type="date"
                class="text-xs border border-red-200 rounded px-2 py-1"
                value={customTo()}
                onInput={(e) => setCustomTo(e.currentTarget.value)}
                aria-label="To date"
              />
            </Show>
          </div>

          {/* Stats cards */}
          <div class="grid grid-cols-5 gap-3 mb-6">
            <StatCard label="Total tomates" value={total()} />
            <StatCard label="Today" value={todayCount() ?? 0} />
            <StatCard label="This week" value={week()} />
            <StatCard
              label="Best day"
              value={bestDay()?.count ?? '—'}
              sublabel={bestDay()?.date}
            />
            <StatCard label="Current streak" value={`${streak()}d`} />
          </div>

          {/* Year navigation heatmap (#199, #198) */}
          <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100 mb-6">
            {/* Year selector row */}
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-700">
                {selectedYear()} activity
                <span class="ml-2 text-xs text-gray-400 font-normal">
                  ({yearSessions().length} tomate{yearSessions().length !== 1 ? 's' : ''})
                </span>
              </h2>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous year"
                  class="px-2 py-0.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                  disabled={availableYears()[availableYears().length - 1] >= selectedYear()}
                  onClick={() => setSelectedYear((y) => y - 1)}
                >
                  ‹
                </button>
                <select
                  class="text-xs border border-red-200 rounded px-1 py-0.5 text-gray-700"
                  value={selectedYear()}
                  onChange={(e) => setSelectedYear(Number(e.currentTarget.value))}
                  aria-label="Select year"
                >
                  <For each={availableYears()}>
                    {(y) => <option value={y}>{y}</option>}
                  </For>
                </select>
                <button
                  type="button"
                  aria-label="Next year"
                  class="px-2 py-0.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                  disabled={selectedYear() >= currentYear}
                  onClick={() => setSelectedYear((y) => y + 1)}
                >
                  ›
                </button>
              </div>
            </div>

            {/* Year boundary note (#198) — shown when rolling-365 spans two calendar years */}
            <Show when={activeFilter() === 'all' && selectedYear() === currentYear}>
              {(() => {
                const startYear = new Date(Date.now() - 364 * 86_400_000).getFullYear();
                return startYear < currentYear ? (
                  <p class="text-[10px] text-gray-400 mb-2">
                    Rolling 365 days — showing data from {startYear} and {currentYear}
                  </p>
                ) : null;
              })()}
            </Show>

            <Heatmap
              days={daysInYear(selectedYear())}
              cellSize={14}
              data={yearHeatmap()}
              startDate={new Date(selectedYear(), 0, 1)}
            />

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

          {/* Session history list (#193) */}
          <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-gray-700">
                Session history
                <span class="ml-2 text-xs text-gray-400 font-normal">
                  ({sortedSessions().length} session{sortedSessions().length !== 1 ? 's' : ''})
                </span>
              </h2>
              <div class="flex gap-2 text-xs text-gray-500">
                <button
                  type="button"
                  class={`hover:text-red-600 ${sortKey() === 'date' ? 'text-red-600 font-medium' : ''}`}
                  onClick={() => toggleSort('date')}
                >
                  Date {sortKey() === 'date' ? (sortAsc() ? '↑' : '↓') : ''}
                </button>
                <button
                  type="button"
                  class={`hover:text-red-600 ${sortKey() === 'duration' ? 'text-red-600 font-medium' : ''}`}
                  onClick={() => toggleSort('duration')}
                >
                  Duration {sortKey() === 'duration' ? (sortAsc() ? '↑' : '↓') : ''}
                </button>
                <button
                  type="button"
                  class={`hover:text-red-600 ${sortKey() === 'label' ? 'text-red-600 font-medium' : ''}`}
                  onClick={() => toggleSort('label')}
                >
                  Label {sortKey() === 'label' ? (sortAsc() ? '↑' : '↓') : ''}
                </button>
              </div>
            </div>

            <Show when={sortedSessions().length === 0}>
              <p class="text-xs text-gray-400 text-center py-4">No sessions match the current filter.</p>
            </Show>

            <Show when={sortedSessions().length > 0}>
              <div class="overflow-x-auto">
                <table class="w-full text-xs text-gray-600 border-collapse">
                  <thead>
                    <tr class="border-b border-gray-100">
                      <th class="text-left py-2 pr-4 font-medium text-gray-500">Completed</th>
                      <th class="text-left py-2 pr-4 font-medium text-gray-500">Label</th>
                      <th class="text-right py-2 font-medium text-gray-500">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sortedSessions()}>
                      {(session) => (
                        <tr class="border-b border-gray-50 hover:bg-red-50 transition-colors">
                          <td class="py-1.5 pr-4 whitespace-nowrap text-gray-500">
                            {formatDateTime(session.endTime)}
                          </td>
                          <td class="py-1.5 pr-4 max-w-[300px] truncate" title={session.label}>
                            {session.label || <span class="text-gray-300 italic">unlabelled</span>}
                          </td>
                          <td class="py-1.5 text-right tabular-nums">
                            {formatDuration(session.duration)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
