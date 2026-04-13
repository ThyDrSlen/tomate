import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfetti = vi.hoisted(() => vi.fn());

vi.mock('canvas-confetti', () => ({ default: mockConfetti }));
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: vi.fn(() => '/sounds/completion.mp3'),
    },
  },
}));

import { playCelebration } from '../celebration';

describe('playCelebration confetti constants', () => {
  beforeEach(() => {
    mockConfetti.mockClear();
  });

  it.each(['work', 'milestone', 'break'] as const)(
    'calls confetti with origin.y in [0, 1] for type "%s"',
    (type) => {
      playCelebration(type, false);

      expect(mockConfetti).toHaveBeenCalledOnce();
      const [options] = mockConfetti.mock.calls[0] as [confetti.Options];
      const originY = options.origin?.y ?? 0;
      expect(originY).toBeGreaterThanOrEqual(0);
      expect(originY).toBeLessThanOrEqual(1);
    },
  );

  it.each(['work', 'milestone', 'break'] as const)(
    'calls confetti with origin.x in [0, 1] (or undefined) for type "%s"',
    (type) => {
      playCelebration(type, false);

      const [options] = mockConfetti.mock.calls[0] as [confetti.Options];
      const originX = options.origin?.x;
      if (originX !== undefined) {
        expect(originX).toBeGreaterThanOrEqual(0);
        expect(originX).toBeLessThanOrEqual(1);
      } else {
        // undefined origin.x is valid (canvas-confetti defaults to 0.5)
        expect(originX).toBeUndefined();
      }
    },
  );

  it.each([
    ['work', 80],
    ['milestone', 100],
    ['break', 60],
  ] as const)('calls confetti with spread %i for type "%s"', (type, expectedSpread) => {
    playCelebration(type, false);

    const [options] = mockConfetti.mock.calls[0] as [confetti.Options];
    expect(options.spread).toBe(expectedSpread);
    // spread must be a positive finite number (canvas-confetti constraint)
    expect(options.spread).toBeGreaterThan(0);
    expect(Number.isFinite(options.spread)).toBe(true);
  });

  it('passes the correct particleCount for each type', () => {
    const expected = { work: 150, milestone: 300, break: 50 } as const;

    for (const [type, count] of Object.entries(expected) as [keyof typeof expected, number][]) {
      mockConfetti.mockClear();
      playCelebration(type, false);
      const [options] = mockConfetti.mock.calls[0] as [confetti.Options];
      expect(options.particleCount).toBe(count);
    }
  });
});
