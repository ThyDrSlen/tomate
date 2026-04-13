import type { TimerPhase } from '@/lib/types';

type TimerRingProps = {
  progress: number;
  phase: TimerPhase;
};

/** Light-mode stroke colors keyed by phase */
const PHASE_COLORS_LIGHT: Record<TimerPhase, string> = {
  IDLE: '#9CA3AF',
  WORKING: '#DC2626',
  SHORT_BREAK: '#16A34A',
  LONG_BREAK: '#16A34A',
  BREAK_SUGGESTION: '#CA8A04',
};

/** Dark-mode stroke colors keyed by phase (brighter for contrast on dark bg) */
const PHASE_COLORS_DARK: Record<TimerPhase, string> = {
  IDLE: '#6B7280',
  WORKING: '#F87171',
  SHORT_BREAK: '#4ADE80',
  LONG_BREAK: '#4ADE80',
  BREAK_SUGGESTION: '#FCD34D',
};

const SIZE = 160;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const isDarkMode = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

export default function TimerRing(props: TimerRingProps) {
  const offset = () => CIRCUMFERENCE * (1 - props.progress);
  const color = () =>
    isDarkMode() ? PHASE_COLORS_DARK[props.phase] : PHASE_COLORS_LIGHT[props.phase];
  const trackColor = () => (isDarkMode() ? '#374151' : '#E5E7EB');

  return (
    <svg width={SIZE} height={SIZE} class="timer-ring" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <title>Timer progress</title>
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={trackColor()}
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
