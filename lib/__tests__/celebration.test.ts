import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { playCelebration } from '../celebration';

describe('celebration', () => {
  it('fires confetti for a work celebration', () => {
    vi.stubGlobal('Audio', vi.fn(() => ({ play: vi.fn() })));

    playCelebration('work');

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 150, spread: 80 }),
    );

    vi.unstubAllGlobals();
  });

  it('fires confetti for a milestone celebration', () => {
    vi.stubGlobal('Audio', vi.fn(() => ({ play: vi.fn() })));

    playCelebration('milestone');

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 300, spread: 100 }),
    );

    vi.unstubAllGlobals();
  });

  it('fires confetti for a break celebration', () => {
    vi.stubGlobal('Audio', vi.fn(() => ({ play: vi.fn() })));

    playCelebration('break');

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 50, spread: 60 }),
    );

    vi.unstubAllGlobals();
  });

  it('logs a warning when audio playback fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'Audio',
      vi.fn(() => ({
        play: () => {
          throw new Error('autoplay blocked');
        },
      })),
    );

    playCelebration('work');

    expect(warnSpy).toHaveBeenCalledWith('Tomate: audio playback failed', expect.any(Error));

    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
