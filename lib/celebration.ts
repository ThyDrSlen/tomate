import confetti from 'canvas-confetti';
import { browser } from 'wxt/browser';

const CONFETTI_CONFIGS: Record<string, confetti.Options> = {
  work: {
    particleCount: 150,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#DC2626', '#16A34A', '#FBBF24'],
  },
  milestone: {
    particleCount: 300,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#DC2626', '#16A34A', '#FBBF24', '#7C3AED', '#2563EB'],
  },
  break: {
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#60A5FA', '#34D399', '#A78BFA'],
  },
};

let currentAudio: { pause: () => void } | null = null;

/** @internal exposed for testing only */
export const _resetAudio = (): void => {
  currentAudio = null;
};

export const playCelebration = (type: 'work' | 'milestone' | 'break', soundEnabled = true): void => {
  confetti(CONFETTI_CONFIGS[type]);

  if (!soundEnabled) {
    return;
  }

  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    const audio = new Audio(browser.runtime.getURL('/sounds/completion.mp3' as '/popup.html'));
    currentAudio = audio;
    audio.play();
  } catch {}
};
