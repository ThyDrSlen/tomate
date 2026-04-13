import { createResource, createSignal, createMemo, For, Show } from 'solid-js';

import {
  getConfig,
  getSessionHistory,
  getRecentSessions,
  getSessionCount,
  getHeatmapData,
  getTodayCount,
} from '@/lib/storage';
import { computeTotalCount, computeWeekCount, computeBestDay, computeStreak } from '@/lib/stats';

import Heatmap from '@/components/Heatmap';

const INITIAL_TABLE_LIMIT = 50;

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  return `${mins} min`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  const [yearData] = createResource(() => getHeatmapData(365));
  const [sessions] = createResource(() => getSessionHistory());
  const [recentSessions] = createResource(() => getRecentSessions(INITIAL_TABLE_LIMIT));
  const [sessionCount] = createResource(() => getSessionCount());
  const [todayCount] = createResource(() => getTodayCount());
  const [config] = createResource(() => getConfig());

  const [loadAll, setLoadAll] = createSignal(false);
  const [allSessions] = createResource(loadAll, (shouldLoad) =>
    shouldLoad ? getSessionHistory() : Promise.resolve(null),
  );

  const dailyGoal = () => config()?.dailyGoal ?? 8;
  const goalProgress = () => Math.min(100, Math.round(((todayCount() ?? 0) / dailyGoal()) * 100));

  const total = () => computeTotalCount(sessions() ?? []);
  const week = () => computeWeekCount(sessions() ?? []);
  const bestDay = () => computeBestDay(sessions() ?? []);
  const streak = () => computeStreak(sessions() ?? []);

  const totalCount = () => sessionCount() ?? 0;
  const hasMore = () => totalCount() > INITIAL_TABLE_LIMIT;

  const tableSessions = createMemo(() => {
    const full = allSessions();
    if (loadAll() && full != null) {
      return [...full].sort((a, b) => b.startTime - a.startTime);
    }
    return [...(recentSessions() ?? [])].sort((a, b) => b.startTime - a.startTime);
  });

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

          <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100 mt-6">
            <h2 class="text-sm font-semibold text-gray-700 mb-3">Session history</h2>
            <Show
              when={tableSessions().length > 0}
              fallback={
                <p class="text-sm text-gray-400 text-center py-4">No sessions to display.</p>
              }
            >
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-red-100">
                      <th class="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                      <th class="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Label</th>
                      <th class="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={tableSessions()}>
                      {(session) => (
                        <tr class="border-b border-red-50 last:border-0 hover:bg-red-50 transition-colors">
                          <td class="py-2 pr-4 text-gray-700 whitespace-nowrap">{formatDate(session.date)}</td>
                          <td class="py-2 pr-4 text-gray-700 truncate max-w-[200px]">{session.label || '—'}</td>
                          <td class="py-2 text-right text-red-600 font-medium whitespace-nowrap">{formatDuration(session.duration)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <Show when={hasMore() && !loadAll()}>
                <div class="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>Showing {INITIAL_TABLE_LIMIT} of {totalCount()} sessions</span>
                  <button
                    class="text-sm px-4 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                    onClick={() => setLoadAll(true)}
                  >
                    Load all {totalCount()} sessions
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
