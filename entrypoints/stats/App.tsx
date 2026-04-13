import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';

import { getConfig, getSessionHistory, getHeatmapData, getTodayCount } from '@/lib/storage';
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

const isValidDateString = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
};

export default function App() {
  // #382: refetch trigger — incremented whenever storage.local changes
  const [refetchTick, setRefetchTick] = createSignal(0);

  onMount(() => {
    const handler = () => setRefetchTick((t) => t + 1);
    browser.storage.local.onChanged.addListener(handler);
    onCleanup(() => browser.storage.local.onChanged.removeListener(handler));
  });

  // Pass refetchTick as a source so createResource re-fetches on storage changes
  const [yearData] = createResource(refetchTick, () => getHeatmapData(365));
  const [sessions] = createResource(refetchTick, () => getSessionHistory());
  const [todayCount] = createResource(refetchTick, () => getTodayCount());
  const [config] = createResource(() => getConfig());

  // #383: custom date range filter state
  const [fromDate, setFromDate] = createSignal('');
  const [toDate, setToDate] = createSignal('');
  const [dateRangeError, setDateRangeError] = createSignal('');

  const dailyGoal = createMemo(() => config()?.dailyGoal ?? 8);
  const goalProgress = createMemo(() =>
    Math.min(100, Math.round(((todayCount() ?? 0) / dailyGoal()) * 100)),
  );

  // #383: filtered sessions based on validated date range
  const filteredSessions = createMemo(() => {
    const all = sessions() ?? [];
    const from = fromDate().trim();
    const to = toDate().trim();

    if (!from && !to) return all;

    if (from && !isValidDateString(from)) {
      setDateRangeError('Invalid "from" date — use YYYY-MM-DD format.');
      return all;
    }
    if (to && !isValidDateString(to)) {
      setDateRangeError('Invalid "to" date — use YYYY-MM-DD format.');
      return all;
    }

    // Swap silently when from > to
    const effectiveFrom = from && to && from > to ? to : from;
    const effectiveTo = from && to && from > to ? from : to;

    setDateRangeError('');

    return all.filter((s) => {
      if (effectiveFrom && s.date < effectiveFrom) return false;
      if (effectiveTo && s.date > effectiveTo) return false;
      return true;
    });
  });

  // #260: wrap derived computations in createMemo so they only re-run when deps change
  const total = createMemo(() => computeTotalCount(filteredSessions()));
  const week = createMemo(() => computeWeekCount(filteredSessions()));
  const bestDay = createMemo(() => computeBestDay(filteredSessions()));
  const streak = createMemo(() => computeStreak(filteredSessions()));

  // #264: memoize heatmap data so the Heatmap component receives a stable reference
  // and its internal monthLabels For-loop doesn't re-subscribe on every outer render
  const heatmapData = createMemo(() => yearData() ?? {});

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

        {/* #383: date range filter UI */}
        <div class="flex items-center gap-2 mb-4 flex-wrap">
          <label class="text-xs text-gray-600 font-medium">From</label>
          <input
            type="date"
            class="text-xs border border-gray-200 rounded px-2 py-1"
            value={fromDate()}
            onInput={(e) => setFromDate(e.currentTarget.value)}
          />
          <label class="text-xs text-gray-600 font-medium">To</label>
          <input
            type="date"
            class="text-xs border border-gray-200 rounded px-2 py-1"
            value={toDate()}
            onInput={(e) => setToDate(e.currentTarget.value)}
          />
          <Show when={fromDate() || toDate()}>
            <button
              class="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => { setFromDate(''); setToDate(''); setDateRangeError(''); }}
            >
              Clear
            </button>
          </Show>
          <Show when={dateRangeError()}>
            <span class="text-xs text-red-500">{dateRangeError()}</span>
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
            <h2 class="text-sm font-semibold text-gray-700 mb-3">365-day activity</h2>
            <Heatmap days={365} cellSize={14} data={heatmapData()} />

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
