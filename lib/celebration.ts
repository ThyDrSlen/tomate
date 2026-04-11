import confetti from 'canvas-confetti';
import { browser } from 'wxt/browser';

const CONFETTI_CONFIGS: Record<string, confetti.Options> = {
  work: {
    particleCount: 150,
    spread: 40,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#DC2626', '#16A34A', '#FBBF24'],
  },
  milestone: {
    particleCount: 300,
    spread: 50,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#DC2626', '#16A34A', '#FBBF24', '#7C3AED', '#2563EB'],
  },
  break: {
    particleCount: 50,
    spread: 40,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#60A5FA', '#34D399', '#A78BFA'],
  },
};

export const playCelebration = (type: 'work' | 'milestone' | 'break'): void => {
  confetti(CONFETTI_CONFIGS[type]);

  try {
    new Audio(browser.runtime.getURL('/sounds/completion.mp3' as '/popup.html')).play();
  } catch {}
};
