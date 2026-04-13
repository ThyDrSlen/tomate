import { beforeEach, describe, expect, it, vi } from 'vitest';

// canvas-confetti won't work in jsdom — mock it before importing the module
vi.mock('canvas-confetti', () => ({ default: vi.fn(() => Promise.resolve()) }));

// Mock wxt/browser so browser.runtime.getURL is available
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test${path}`),
    },
  },
}));

import confetti from 'canvas-confetti';
import { playCelebration } from '../celebration';

describe('playCelebration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls confetti with work config and does not throw', () => {
    expect(() => playCelebration('work', false)).not.toThrow();
    expect(confetti).toHaveBeenCalledOnce();
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 150, spread: 80 }),
    );
  });

  it('calls confetti with break config and does not throw', () => {
    expect(() => playCelebration('break', false)).not.toThrow();
    expect(confetti).toHaveBeenCalledOnce();
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 50, spread: 60 }),
    );
  });

  it('calls confetti with milestone config and does not throw', () => {
    expect(() => playCelebration('milestone', false)).not.toThrow();
    expect(confetti).toHaveBeenCalledOnce();
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 300, spread: 100 }),
    );
  });

  it('does not attempt Audio construction when playSound is false', () => {
    // jsdom does not ship Audio; add a stub so we can assert it is never called
    const mockAudio = vi.fn();
    const original = (globalThis as Record<string, unknown>).Audio;
    (globalThis as Record<string, unknown>).Audio = mockAudio;
    try {
      playCelebration('work', false);
      expect(mockAudio).not.toHaveBeenCalled();
    } finally {
      (globalThis as Record<string, unknown>).Audio = original;
    }
  });

  it('all celebration types use origin.y = 0.6', () => {
    for (const type of ['work', 'break', 'milestone'] as const) {
      vi.clearAllMocks();
      playCelebration(type, false);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({ origin: { y: 0.6 } }),
      );
    }
  });
});
