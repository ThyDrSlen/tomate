import type { TimerPhase } from '@/lib/types';

type TimerRingProps = {
  progress: number;
  phase: TimerPhase;
  remaining: string;
};

const PHASE_LABELS: Record<TimerPhase, string> = {
  IDLE: 'Timer ready',
  WORKING: 'Working',
  SHORT_BREAK: 'Short break',
  LONG_BREAK: 'Long break',
  BREAK_SUGGESTION: 'Time for a long break',
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

export default function TimerRing(props: TimerRingProps) {
  const offset = () => CIRCUMFERENCE * (1 - props.progress);
  const color = () => PHASE_COLORS[props.phase];
  const accessibleTitle = () => {
    const label = PHASE_LABELS[props.phase];
    if (props.phase === 'IDLE' || props.phase === 'BREAK_SUGGESTION') return label;
    return `${label} — ${props.remaining} remaining`;
  };

  return (
    <svg
      width={SIZE}
      height={SIZE}
      class="timer-ring"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-label={accessibleTitle()}
    >
      <title>{accessibleTitle()}</title>
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
  );
}
