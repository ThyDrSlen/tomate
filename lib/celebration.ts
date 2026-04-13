import confetti from 'canvas-confetti';
import { browser } from 'wxt/browser';

const CONFETTI_CONFIGS: Record<string, confetti.Options> = {
  work: {
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 },
    scalar: 0.7,
    colors: ['#DC2626', '#16A34A', '#FBBF24'],
  },
  milestone: {
    particleCount: 300,
    spread: 100,
    origin: { y: 0.6 },
    scalar: 0.7,
    colors: ['#DC2626', '#16A34A', '#FBBF24', '#7C3AED', '#2563EB'],
  },
  break: {
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    scalar: 0.7,
    colors: ['#60A5FA', '#34D399', '#A78BFA'],
  },
};

export const playCelebration = (type: 'work' | 'milestone' | 'break', playSound = true): void => {
  confetti(CONFETTI_CONFIGS[type]).then(() => confetti.reset());

  if (playSound) {
    try {
      new Audio(browser.runtime.getURL('/sounds/completion.mp3' as '/popup.html'))
        .play()
        .catch(() => {});
    } catch {
      // Audio constructor can throw in non-browser environments
    }
  }
};
