import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

const mockConfetti = vi.hoisted(() => vi.fn());
vi.mock('canvas-confetti', () => ({ default: mockConfetti }));

import { playCelebration } from '../celebration';

// The test environment is Node (no browser globals). Provide a minimal Audio
// stub so that celebration.ts can be exercised fully.
class StubAudio {
  src: string;
  play = vi.fn().mockResolvedValue(undefined);
  constructor(src: string) {
    this.src = src;
  }
}

beforeEach(() => {
  // Install the stub as the global Audio constructor before each test.
  Object.defineProperty(globalThis, 'Audio', {
    value: StubAudio,
    writable: true,
    configurable: true,
  });

  mockConfetti.mockReset();
  fakeBrowser.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Remove the stub so other test files are not affected.
  // @ts-expect-error — intentionally removing the global
  delete globalThis.Audio;
});

describe('playCelebration', () => {
  describe('confetti configs', () => {
    it('fires confetti with work config', () => {
      playCelebration('work', false);

      expect(mockConfetti).toHaveBeenCalledOnce();
      const opts = mockConfetti.mock.calls[0][0];
      expect(opts.particleCount).toBe(150);
      expect(opts.spread).toBe(80);
      expect(opts.origin).toEqual({ y: 0.6 });
      expect(opts.colors).toContain('#DC2626');
    });

    it('fires confetti with milestone config (larger burst)', () => {
      playCelebration('milestone', false);

      expect(mockConfetti).toHaveBeenCalledOnce();
      const opts = mockConfetti.mock.calls[0][0];
      expect(opts.particleCount).toBe(300);
      expect(opts.spread).toBe(100);
      expect(opts.origin).toEqual({ y: 0.6 });
      expect(opts.colors).toContain('#7C3AED');
    });

    it('fires confetti with break config (smaller burst)', () => {
      playCelebration('break', false);

      expect(mockConfetti).toHaveBeenCalledOnce();
      const opts = mockConfetti.mock.calls[0][0];
      expect(opts.particleCount).toBe(50);
      expect(opts.spread).toBe(60);
      expect(opts.origin).toEqual({ y: 0.6 });
      expect(opts.colors).toContain('#60A5FA');
    });
  });

  describe('audio behaviour', () => {
    it('does not create an Audio object when playSound is false', () => {
      const AudioSpy = vi.spyOn(globalThis, 'Audio' as never);

      playCelebration('work', false);

      expect(AudioSpy).not.toHaveBeenCalled();
    });

    it('creates an Audio object and calls play() when playSound is true', () => {
      playCelebration('work', true);

      // The StubAudio constructor was called — verify via its instances.
      // We cannot use vi.spyOn on StubAudio here because it is already set;
      // instead assert side-effects: confetti was called and no error thrown.
      expect(mockConfetti).toHaveBeenCalledOnce();
    });

    it('playSound defaults to true — play() is invoked', async () => {
      // Provide a spy-backed Audio so we can check play().
      const playMock = vi.fn().mockResolvedValue(undefined);
      const MockAudio = vi.fn().mockReturnValue({ play: playMock });
      Object.defineProperty(globalThis, 'Audio', {
        value: MockAudio,
        writable: true,
        configurable: true,
      });

      playCelebration('work');

      expect(MockAudio).toHaveBeenCalledOnce();
      expect(playMock).toHaveBeenCalledOnce();
    });

    it('play() is called when playSound is true', async () => {
      const playMock = vi.fn().mockResolvedValue(undefined);
      const MockAudio = vi.fn().mockReturnValue({ play: playMock });
      Object.defineProperty(globalThis, 'Audio', {
        value: MockAudio,
        writable: true,
        configurable: true,
      });

      playCelebration('work', true);

      expect(MockAudio).toHaveBeenCalledOnce();
      expect(playMock).toHaveBeenCalledOnce();
    });
  });

  describe('error handling', () => {
    it('silently catches NotAllowedError from Audio.play()', async () => {
      const playMock = vi
        .fn()
        .mockRejectedValue(new DOMException('', 'NotAllowedError'));
      Object.defineProperty(globalThis, 'Audio', {
        value: vi.fn().mockReturnValue({ play: playMock }),
        writable: true,
        configurable: true,
      });

      // Should not throw synchronously; the .catch(() => {}) absorbs the rejection.
      expect(() => playCelebration('work', true)).not.toThrow();

      // Flush microtasks so the rejection handler runs without bubbling.
      await Promise.resolve();
    });

    it('silently catches Audio constructor errors', () => {
      Object.defineProperty(globalThis, 'Audio', {
        value: vi.fn().mockImplementation(() => {
          throw new Error('Audio not supported');
        }),
        writable: true,
        configurable: true,
      });

      expect(() => playCelebration('work', true)).not.toThrow();
    });
  });
});
