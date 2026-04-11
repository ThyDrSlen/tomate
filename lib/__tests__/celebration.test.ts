import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

// Mock canvas-confetti before importing celebration
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { playCelebration } from '../celebration';

describe('playCelebration', () => {
  let mockAudioPlay: ReturnType<typeof vi.fn>;
  let mockAudioConstructor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();

    // Mock Audio constructor + .play()
    mockAudioPlay = vi.fn().mockResolvedValue(undefined);
    mockAudioConstructor = vi.fn(() => ({ play: mockAudioPlay }));
    global.Audio = mockAudioConstructor as unknown as typeof Audio;

    // Stub getURL to return the path as-is
    fakeBrowser.runtime.getURL = vi.fn((url: string) => url) as typeof fakeBrowser.runtime.getURL;
  });

  it('calls confetti with the correct config for work type', () => {
    playCelebration('work');
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#DC2626', '#16A34A', '#FBBF24'],
      }),
    );
  });

  it('calls confetti with the correct config for milestone type', () => {
    playCelebration('milestone');
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 300,
        spread: 100,
        origin: { y: 0.6 },
      }),
    );
  });

  it('calls confetti with the correct config for break type', () => {
    playCelebration('break');
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#60A5FA', '#34D399', '#A78BFA'],
      }),
    );
  });

  it('creates an Audio object with the completion sound URL', () => {
    playCelebration('work');
    expect(mockAudioConstructor).toHaveBeenCalledWith('/sounds/completion.mp3');
  });

  it('calls .play() on the Audio instance', () => {
    playCelebration('work');
    expect(mockAudioPlay).toHaveBeenCalled();
  });

  it('returns void', () => {
    const result = playCelebration('work');
    expect(result).toBeUndefined();
  });

  it('does not throw when Audio constructor throws', () => {
    global.Audio = vi.fn(() => {
      throw new Error('audio not available');
    }) as unknown as typeof Audio;

    expect(() => playCelebration('work')).not.toThrow();
  });

  it('does not throw when .play() rejects', () => {
    mockAudioPlay.mockRejectedValue(new Error('play() blocked'));
    expect(() => playCelebration('work')).not.toThrow();
  });

  it('does not throw when .play() throws synchronously', () => {
    mockAudioPlay.mockImplementation(() => {
      throw new Error('sync play error');
    });
    expect(() => playCelebration('work')).not.toThrow();
  });

  it('uses browser.runtime.getURL to resolve the sound file path', () => {
    playCelebration('work');
    expect(fakeBrowser.runtime.getURL).toHaveBeenCalledWith('/sounds/completion.mp3');
  });

  it('skips audio playback when sound=false', () => {
    playCelebration('work', false);
    expect(mockAudioConstructor).not.toHaveBeenCalled();
    expect(mockAudioPlay).not.toHaveBeenCalled();
    // Confetti should still fire
    expect(confetti).toHaveBeenCalled();
  });

  it('plays audio by default (sound=true)', () => {
    playCelebration('break');
    expect(mockAudioPlay).toHaveBeenCalled();
  });
});
