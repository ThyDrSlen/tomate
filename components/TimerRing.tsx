import type { TimerPhase } from '@/lib/types';

type TimerRingProps = {
  progress: number;
  phase: TimerPhase;
  /** Formatted time string, e.g. "24:30", used for accessible announcements */
  timeLabel?: string;
};

const PHASE_COLORS: Record<TimerPhase, string> = {
  IDLE: '#9CA3AF',
  WORKING: '#DC2626',
  SHORT_BREAK: '#16A34A',
  LONG_BREAK: '#16A34A',
  BREAK_SUGGESTION: '#CA8A04',
};

const PHASE_LABELS: Record<TimerPhase, string> = {
  IDLE: 'Idle',
  WORKING: 'Working',
  SHORT_BREAK: 'Short break',
  LONG_BREAK: 'Long break',
  BREAK_SUGGESTION: 'Long break suggested',
};

const SIZE = 160;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerRing(props: TimerRingProps) {
  const offset = () => CIRCUMFERENCE * (1 - props.progress);
  const color = () => PHASE_COLORS[props.phase];
  const progressPct = () => Math.round(props.progress * 100);
  const ariaLabel = () =>
    props.timeLabel
      ? `${PHASE_LABELS[props.phase]} — ${props.timeLabel} remaining`
      : PHASE_LABELS[props.phase];

  return (
    <svg
      width={SIZE}
      height={SIZE}
      class="timer-ring"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPct()}
      aria-label={ariaLabel()}
    >
      <title>{ariaLabel()}</title>
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
        class="transition-[stroke-dashoffset,stroke] duration-500 ease-linear"
        style={{ "transition-property": "stroke-dashoffset, stroke", "transition-duration": "500ms, 400ms", "transition-timing-function": "linear, ease-in-out" }}
      />
    </svg>
  );
}
