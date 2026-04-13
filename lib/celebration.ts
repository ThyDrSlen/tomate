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

/**
 * Create a confetti cannon bound to a canvas that covers the popup document.
 * canvas-confetti's default canvas uses viewport/fixed coordinates which
 * overflow outside the extension popup window (#214).  By passing an explicit
 * canvas sized to the popup document we keep all particles within bounds.
 */
function createBoundedConfetti(): confetti.CreateTypes {
  // Reuse an existing canvas if one was already injected by a previous call.
  const existing = document.getElementById('tomate-confetti-canvas') as HTMLCanvasElement | null;
  if (existing) {
    return confetti.create(existing, { resize: true, useWorker: false });
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'tomate-confetti-canvas';
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);

  return confetti.create(canvas, { resize: true, useWorker: false });
}

export const playCelebration = (type: 'work' | 'milestone' | 'break', playSound = true): void => {
  const fire = typeof document !== 'undefined' ? createBoundedConfetti() : confetti;
  fire(CONFETTI_CONFIGS[type]);

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
