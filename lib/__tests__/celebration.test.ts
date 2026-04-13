import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { playCelebration } from '../celebration';

const mockConfetti = vi.mocked(confetti);

describe('playCelebration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    mockConfetti.mockReset();
  });

  it('fires confetti with the work config', () => {
    playCelebration('work', false);
    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as confetti.Options;
    expect(opts?.particleCount).toBe(150);
  });

  it('fires confetti with the milestone config', () => {
    playCelebration('milestone', false);
    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as confetti.Options;
    expect(opts?.particleCount).toBe(300);
  });

  it('fires confetti with the break config', () => {
    playCelebration('break', false);
    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as confetti.Options;
    expect(opts?.particleCount).toBe(50);
  });

  it('does not create an Audio instance when playSound is false', () => {
    const AudioSpy = vi.fn(() => ({ play: vi.fn().mockResolvedValue(undefined) }));
    vi.stubGlobal('Audio', AudioSpy);

    playCelebration('work', false);

    expect(AudioSpy).not.toHaveBeenCalled();
  });

  it('creates an Audio instance and calls play() when playSound is true', () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const AudioSpy = vi.fn(() => ({ play: playSpy }));
    vi.stubGlobal('Audio', AudioSpy);
    fakeBrowser.runtime.getURL = vi.fn(() => 'chrome-extension://abc/sounds/completion.mp3');

    playCelebration('work', true);

    expect(AudioSpy).toHaveBeenCalledOnce();
    expect(AudioSpy).toHaveBeenCalledWith('chrome-extension://abc/sounds/completion.mp3');
    expect(playSpy).toHaveBeenCalledOnce();
  });

  it('defaults playSound to true', () => {
    const playSpy = vi.fn().mockResolvedValue(undefined);
    const AudioSpy = vi.fn(() => ({ play: playSpy }));
    vi.stubGlobal('Audio', AudioSpy);
    fakeBrowser.runtime.getURL = vi.fn(() => 'chrome-extension://abc/sounds/completion.mp3');

    playCelebration('break');

    expect(AudioSpy).toHaveBeenCalledOnce();
    expect(playSpy).toHaveBeenCalledOnce();
  });

  it('silently absorbs a rejected play() promise', async () => {
    const playSpy = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const AudioSpy = vi.fn(() => ({ play: playSpy }));
    vi.stubGlobal('Audio', AudioSpy);
    fakeBrowser.runtime.getURL = vi.fn(() => 'chrome-extension://abc/sounds/completion.mp3');

    // Should not throw — the .catch(() => {}) in playCelebration eats the rejection
    expect(() => playCelebration('work', true)).not.toThrow();

    // Give the microtask queue a chance to process the rejection
    await Promise.resolve();
    expect(playSpy).toHaveBeenCalledOnce();
  });

  it('silently absorbs an Audio constructor error when playSound is true', () => {
    vi.stubGlobal('Audio', () => {
      throw new Error('Audio not available');
    });
    fakeBrowser.runtime.getURL = vi.fn(() => 'chrome-extension://abc/sounds/completion.mp3');

    // The try/catch around the Audio constructor should prevent this from throwing
    expect(() => playCelebration('work', true)).not.toThrow();

    // Confetti should still have fired despite the Audio failure
    expect(mockConfetti).toHaveBeenCalledOnce();
  });
});
