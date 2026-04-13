import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock canvas-confetti before importing celebration
const { mockConfetti } = vi.hoisted(() => {
  const mockConfetti = vi.fn();
  return { mockConfetti };
});
vi.mock('canvas-confetti', () => ({ default: mockConfetti }));

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: (path: string) => `chrome-extension://fake-id${path}`,
    },
  },
}));

// Mock Audio to avoid DOM errors in test environment
const mockPlay = vi.fn().mockResolvedValue(undefined);
globalThis.Audio = vi.fn().mockImplementation(() => ({ play: mockPlay })) as unknown as typeof Audio;

import { playCelebration } from '../celebration';

describe('playCelebration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls canvas-confetti once for work type', () => {
    playCelebration('work');
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it('calls canvas-confetti once for milestone type', () => {
    playCelebration('milestone');
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it('calls canvas-confetti once for break type', () => {
    playCelebration('break');
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it('work config has particleCount, spread, origin, and colors', () => {
    playCelebration('work');
    const [opts] = mockConfetti.mock.calls[0] as [Record<string, unknown>];
    expect(typeof opts.particleCount).toBe('number');
    expect(typeof opts.spread).toBe('number');
    expect(opts.origin).toBeDefined();
    expect(Array.isArray(opts.colors)).toBe(true);
  });

  it('milestone config has particleCount, spread, origin, and colors', () => {
    playCelebration('milestone');
    const [opts] = mockConfetti.mock.calls[0] as [Record<string, unknown>];
    expect(typeof opts.particleCount).toBe('number');
    expect(typeof opts.spread).toBe('number');
    expect(opts.origin).toBeDefined();
    expect(Array.isArray(opts.colors)).toBe(true);
  });

  it('break config has particleCount, spread, origin, and colors', () => {
    playCelebration('break');
    const [opts] = mockConfetti.mock.calls[0] as [Record<string, unknown>];
    expect(typeof opts.particleCount).toBe('number');
    expect(typeof opts.spread).toBe('number');
    expect(opts.origin).toBeDefined();
    expect(Array.isArray(opts.colors)).toBe(true);
  });

  it('origin.y is a number within 0-1 bounds for all types', () => {
    for (const type of ['work', 'milestone', 'break'] as const) {
      vi.clearAllMocks();
      playCelebration(type);
      const [opts] = mockConfetti.mock.calls[0] as [{ origin: { y: number } }];
      expect(typeof opts.origin.y).toBe('number');
      expect(opts.origin.y).toBeGreaterThanOrEqual(0);
      expect(opts.origin.y).toBeLessThanOrEqual(1);
    }
  });

  it('spread is a positive number within 0-360 bounds for all types', () => {
    for (const type of ['work', 'milestone', 'break'] as const) {
      vi.clearAllMocks();
      playCelebration(type);
      const [opts] = mockConfetti.mock.calls[0] as [{ spread: number }];
      expect(typeof opts.spread).toBe('number');
      expect(opts.spread).toBeGreaterThan(0);
      expect(opts.spread).toBeLessThanOrEqual(360);
    }
  });

  it('milestone has more particles than work, work has more than break', () => {
    playCelebration('work');
    const [workOpts] = mockConfetti.mock.calls[0] as [{ particleCount: number }];
    vi.clearAllMocks();

    playCelebration('milestone');
    const [milestoneOpts] = mockConfetti.mock.calls[0] as [{ particleCount: number }];
    vi.clearAllMocks();

    playCelebration('break');
    const [breakOpts] = mockConfetti.mock.calls[0] as [{ particleCount: number }];

    expect(milestoneOpts.particleCount).toBeGreaterThan(workOpts.particleCount);
    expect(workOpts.particleCount).toBeGreaterThan(breakOpts.particleCount);
  });
});
