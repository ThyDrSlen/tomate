import type { TimerPhase } from '@/lib/types';

type TimerRingProps = {
  progress: number;
  phase: TimerPhase;
  /** Remaining milliseconds; used for the screen-reader live region. */
  remaining?: number;
};

const PHASE_COLORS: Record<TimerPhase, string> = {
  IDLE: '#9CA3AF',
  WORKING: '#DC2626',
  SHORT_BREAK: '#16A34A',
  LONG_BREAK: '#16A34A',
  BREAK_SUGGESTION: '#CA8A04',
};

const SIZE = 160;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Returns the remaining time rounded down to the nearest whole minute.
 * The live region only changes once per minute, preventing per-second floods.
 */
function liveMinutes(ms: number): number {
  return Math.floor(ms / 60_000);
}

/** Human-readable announcement, e.g. "23 minutes remaining" or "45 seconds remaining". */
function liveLabel(ms: number, phase: TimerPhase): string {
  const activePhases: TimerPhase[] = ['WORKING', 'SHORT_BREAK', 'LONG_BREAK'];
  if (!activePhases.includes(phase) || ms <= 0) return '';
  const minutes = liveMinutes(ms);
  if (minutes >= 1) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} remaining`;
  const seconds = Math.floor(ms / 1000);
  return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} remaining`;
}

export default function TimerRing(props: TimerRingProps) {
  const offset = () => CIRCUMFERENCE * (1 - props.progress);
  const color = () => PHASE_COLORS[props.phase];

  return (
    <div class="relative inline-block">
      <svg
        width={SIZE}
        height={SIZE}
        class="timer-ring"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        <title>Timer progress</title>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#E5E7EB"
          stroke-width={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color()}
          stroke-width={STROKE}
          stroke-linecap="round"
          stroke-dasharray={String(CIRCUMFERENCE)}
          stroke-dashoffset={offset()}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          class="transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
      {/* Screen-reader live region: announces remaining time once per minute */}
      <span
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {liveLabel(props.remaining ?? 0, props.phase)}
      </span>
    </div>
  );
}
