import { createResource, For, Show } from 'solid-js';

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

const DAILY_GOAL = 8;

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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

function formatSessionDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}

function formatDuration(durationMs: number): string {
  const minutes = Math.round(durationMs / 60_000);
  return `${minutes} min`;
}

function SessionRow(props: { session: CompletedSession }) {
  const dateLabel = () => formatSessionDate(props.session.date);
  const durLabel = () => formatDuration(props.session.duration);
  const hasLabel = () => props.session.label && props.session.label.trim().length > 0;

  return (
    <div class="flex items-center gap-1 py-2 border-b border-gray-100 last:border-0 text-sm text-gray-700">
      <span class="text-gray-400 font-medium w-14 flex-shrink-0">{dateLabel()}</span>
      <span class="text-gray-300 mx-1">·</span>
      <span class="text-gray-500 w-14 flex-shrink-0">{durLabel()}</span>
      <Show when={hasLabel()}>
        <span class="text-gray-300 mx-1">·</span>
        <span class="text-gray-600 truncate italic">"{props.session.label}"</span>
      </Show>
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

  const recentSessions = () => {
    const all = sessions() ?? [];
    return all.slice(-20).reverse();
  };

  const goalReached = () => (todayCount() ?? 0) >= DAILY_GOAL;

  return (
    <div class="min-h-screen bg-red-50 py-10 px-4">
      <div class="max-w-[800px] mx-auto">
        <div class="flex items-center gap-3 mb-6">
          <h1 class="text-2xl font-bold text-red-600">Tomate Stats</h1>
          <Show when={goalReached()}>
            <span class="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-green-200">
              🎯 Goal reached!
            </span>
          </Show>
        </div>

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

        <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100 mb-4">
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

        <div class="bg-white rounded-xl p-5 shadow-sm border border-red-100">
          <h2 class="text-sm font-semibold text-gray-700 mb-2">Recent sessions</h2>
          <Show
            when={(sessions() ?? []).length > 0}
            fallback={
              <p class="text-sm text-gray-400 py-4 text-center">No sessions recorded yet.</p>
            }
          >
            <div class="max-h-72 overflow-y-auto">
              <For each={recentSessions()}>
                {(session) => <SessionRow session={session} />}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
