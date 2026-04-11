import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { _resetAudio, playCelebration } from '../celebration';

const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();

class MockAudio {
  src: string;
  constructor(src: string) {
    this.src = src;
  }
  play = mockPlay;
  pause = mockPause;
}

describe('playCelebration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    mockPlay.mockClear().mockResolvedValue(undefined);
    mockPause.mockClear();
    (confetti as ReturnType<typeof vi.fn>).mockClear();

    // Reset the module-level audio state so tests don't bleed into each other
    _resetAudio();

    (globalThis as typeof globalThis & { Audio: unknown }).Audio = MockAudio;

    fakeBrowser.runtime.getURL = vi.fn().mockImplementation((path: string) => `chrome-extension://abc123${path}`);
  });

  it('fires confetti for the work type', () => {
    playCelebration('work', true);

    expect(confetti).toHaveBeenCalledOnce();
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 150, spread: 80 }),
    );
  });

  it('fires confetti for the milestone type', () => {
    playCelebration('milestone', true);

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 300, spread: 100 }),
    );
  });

  it('fires confetti for the break type', () => {
    playCelebration('break', true);

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 50, spread: 60 }),
    );
  });

  it('creates an Audio object and calls play() when sound is enabled', () => {
    playCelebration('work', true);

    expect(mockPlay).toHaveBeenCalledOnce();
  });

  it('does not call play() when sound is disabled (muted)', () => {
    playCelebration('work', false);

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('still fires confetti when sound is disabled', () => {
    playCelebration('milestone', false);

    expect(confetti).toHaveBeenCalledOnce();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('pauses the previous Audio before creating a new one on repeated calls', () => {
    playCelebration('work', true);
    playCelebration('work', true);

    // pause() should be called on the first Audio instance before the second play
    expect(mockPause).toHaveBeenCalledOnce();
    expect(mockPlay).toHaveBeenCalledTimes(2);
  });

  it('defaults to sound enabled when no soundEnabled argument is provided', () => {
    playCelebration('work');

    expect(mockPlay).toHaveBeenCalledOnce();
  });

  it('uses the URL from browser.runtime.getURL for the audio source', () => {
    const constructorSpy = vi.fn().mockImplementation((src: string) => new MockAudio(src));
    (globalThis as typeof globalThis & { Audio: unknown }).Audio = constructorSpy;

    playCelebration('work', true);

    expect(constructorSpy).toHaveBeenCalledWith('chrome-extension://abc123/sounds/completion.mp3');
  });
});
