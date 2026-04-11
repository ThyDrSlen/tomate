import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { playCelebration } from '../celebration';

// Typed reference to the global that may or may not be set
type FakeAudio = { play: ReturnType<typeof vi.fn> };
let fakeAudioInstances: FakeAudio[];

const installFakeAudio = (): void => {
  fakeAudioInstances = [];
  (globalThis as typeof globalThis & { Audio: unknown }).Audio = function (src: string) {
    const inst: FakeAudio = { play: vi.fn().mockResolvedValue(undefined) };
    fakeAudioInstances.push(inst);
    return inst;
  };
};

const removeFakeAudio = (): void => {
  delete (globalThis as typeof globalThis & { Audio?: unknown }).Audio;
};

describe('playCelebration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    fakeBrowser.runtime.getURL = vi.fn().mockReturnValue('chrome-extension://id/sounds/completion.mp3');
    fakeAudioInstances = [];
  });

  it('fires confetti with the correct work config', async () => {
    installFakeAudio();
    const confettiMod = await import('canvas-confetti');
    const confettiFn = confettiMod.default as unknown as ReturnType<typeof vi.fn>;

    playCelebration('work');

    expect(confettiFn).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 150, spread: 80 }),
    );
    removeFakeAudio();
  });

  it('with playSound=true, creates Audio and calls play()', () => {
    installFakeAudio();

    playCelebration('work', true);

    expect(fakeAudioInstances).toHaveLength(1);
    expect(fakeAudioInstances[0]!.play).toHaveBeenCalledOnce();
    removeFakeAudio();
  });

  it('with playSound=false, skips Audio entirely', () => {
    installFakeAudio();

    playCelebration('work', false);

    expect(fakeAudioInstances).toHaveLength(0);
    removeFakeAudio();
  });

  it('defaults to playing sound when playSound is omitted', () => {
    installFakeAudio();

    playCelebration('milestone');

    expect(fakeAudioInstances).toHaveLength(1);
    expect(fakeAudioInstances[0]!.play).toHaveBeenCalledOnce();
    removeFakeAudio();
  });
});
