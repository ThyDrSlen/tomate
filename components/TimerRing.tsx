import { createMemo } from 'solid-js';
import type { TimerPhase } from '@/lib/types';

type TimerRingProps = {
  progress: number;
  phase: TimerPhase;
  remainingMs: number;
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
  WORKING: 'Focus',
  SHORT_BREAK: 'Short break',
  LONG_BREAK: 'Long break',
  BREAK_SUGGESTION: 'Break suggestion',
};

const SIZE = 160;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerRing(props: TimerRingProps) {
  const offset = () => CIRCUMFERENCE * (1 - props.progress);
  const color = () => PHASE_COLORS[props.phase];

  const minutesRemaining = createMemo(() => Math.ceil(props.remainingMs / 60000));

  const ariaLabel = createMemo(() => {
    const phase = PHASE_LABELS[props.phase];
    const mins = minutesRemaining();
    if (props.phase === 'IDLE') return 'Timer idle';
    return `${phase} timer: ${mins} ${mins === 1 ? 'minute' : 'minutes'} remaining`;
  });

  // Live region text updates every full minute to avoid too-frequent announcements.
  const liveText = createMemo(() => {
    const phase = PHASE_LABELS[props.phase];
    const mins = minutesRemaining();
    if (props.phase === 'IDLE') return '';
    return `${phase}: ${mins} ${mins === 1 ? 'minute' : 'minutes'} remaining`;
  });

  return (
    <>
      {/* Visually-hidden live region — announced on phase change or each minute */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0"
      >
        {liveText()}
      </div>
      <svg
        width={SIZE}
        height={SIZE}
        class="timer-ring"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
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
          class="transition-[stroke-dashoffset] duration-500 ease-linear"
        />
      </svg>
    </>
  );
}
