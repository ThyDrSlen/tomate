import type { TimerPhase } from '@/lib/types';

type TimerRingProps = {
  progress: number;
  phase: TimerPhase;
};

/**
 * Tailwind color classes for each phase.
 * `text-*` sets `currentColor` which is used as the SVG `stroke` on the
 * progress arc.  Each pair includes a `dark:` variant so the ring is
 * legible in both light and dark mode.
 */
const PHASE_CLASSES: Record<TimerPhase, string> = {
  IDLE: 'text-gray-400 dark:text-gray-500',
  WORKING: 'text-red-600 dark:text-red-500',
  SHORT_BREAK: 'text-green-600 dark:text-green-500',
  LONG_BREAK: 'text-green-600 dark:text-green-500',
  BREAK_SUGGESTION: 'text-yellow-600 dark:text-yellow-500',
};

const SIZE = 160;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerRing(props: TimerRingProps) {
  const offset = () => CIRCUMFERENCE * (1 - props.progress);
  const colorClass = () => PHASE_CLASSES[props.phase];

  return (
    <svg
      width={SIZE}
      height={SIZE}
      class={`timer-ring ${colorClass()}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
    >
      <title>Timer progress</title>
      {/* Track ring — uses a neutral color in both light and dark mode */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        class="stroke-gray-200 dark:stroke-gray-700"
        stroke-width={STROKE}
      />
      {/* Progress arc — inherits `currentColor` from the parent SVG class */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="currentColor"
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
