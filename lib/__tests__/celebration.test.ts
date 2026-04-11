import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfetti = vi.fn();

vi.mock('canvas-confetti', () => ({ default: mockConfetti }));
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: (path: string) => `chrome-extension://fake/${path}`,
    },
  },
}));

import { playCelebration } from '../celebration';

describe('playCelebration', () => {
  beforeEach(() => {
    mockConfetti.mockReset();
  });

  it('calls confetti with centered origin and spread 40 for work celebration', () => {
    playCelebration('work');

    expect(mockConfetti).toHaveBeenCalledOnce();
    expect(mockConfetti).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { x: 0.5, y: 0.5 },
        spread: 40,
      }),
    );
  });

  it('calls confetti with centered origin and spread 50 for milestone celebration', () => {
    playCelebration('milestone');

    expect(mockConfetti).toHaveBeenCalledOnce();
    expect(mockConfetti).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { x: 0.5, y: 0.5 },
        spread: 50,
      }),
    );
  });

  it('calls confetti with centered origin and spread 40 for break celebration', () => {
    playCelebration('break');

    expect(mockConfetti).toHaveBeenCalledOnce();
    expect(mockConfetti).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: { x: 0.5, y: 0.5 },
        spread: 40,
      }),
    );
  });

  it('does not throw an unhandled rejection when confetti throws', () => {
    mockConfetti.mockImplementation(() => {
      throw new Error('confetti unavailable');
    });

    expect(() => playCelebration('work')).not.toThrow();
  });
});
