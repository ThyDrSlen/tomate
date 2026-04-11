import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock values — vi.hoisted() runs before any imports so the variable
// is available when the vi.mock() factory is evaluated.
// ---------------------------------------------------------------------------

const { mockConfetti } = vi.hoisted(() => ({ mockConfetti: vi.fn() }));

vi.mock('canvas-confetti', () => ({ default: mockConfetti }));

// Provide a minimal browser stub so wxt/browser resolves without a real
// extension environment.
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: (path: string) => `chrome-extension://fake-id${path}`,
    },
  },
}));

import { playCelebration } from '../celebration';

// ---------------------------------------------------------------------------
// HTMLAudioElement mock
//
// The test environment is Node (not jsdom), so `Audio` does not exist on
// globalThis.  We install a minimal stub before each test and tear it down
// after so the module under test can call `new Audio(...)`.
// ---------------------------------------------------------------------------

type MockAudioInstance = { play: ReturnType<typeof vi.fn> };

let mockAudioInstance: MockAudioInstance;

beforeEach(() => {
  vi.clearAllMocks();

  mockAudioInstance = { play: vi.fn().mockResolvedValue(undefined) };

  // Install a constructor function on globalThis so `new Audio(url)` works.
  (globalThis as Record<string, unknown>).Audio = vi.fn(() => mockAudioInstance);
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Audio;
});

// Typed accessor so call-site assertions stay tidy.
const AudioMock = () => (globalThis as Record<string, unknown>).Audio as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('playCelebration — confetti config selection', () => {
  it('calls confetti with the "work" config (150 particles)', () => {
    playCelebration('work');

    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.particleCount).toBe(150);
    expect(opts.spread).toBe(80);
    expect((opts.origin as { y: number }).y).toBe(0.6);
    expect(opts.colors).toEqual(['#DC2626', '#16A34A', '#FBBF24']);
  });

  it('calls confetti with the "milestone" config (300 particles)', () => {
    playCelebration('milestone');

    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.particleCount).toBe(300);
    expect(opts.spread).toBe(100);
    expect((opts.colors as string[]).length).toBe(5);
  });

  it('calls confetti with the "break" config (50 particles)', () => {
    playCelebration('break');

    expect(mockConfetti).toHaveBeenCalledOnce();
    const opts = mockConfetti.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.particleCount).toBe(50);
    expect(opts.spread).toBe(60);
    expect(opts.colors).toEqual(['#60A5FA', '#34D399', '#A78BFA']);
  });

  it('uses a different particle count for each celebration type', () => {
    playCelebration('work');
    const workCount = (mockConfetti.mock.calls[0][0] as Record<string, unknown>).particleCount;

    mockConfetti.mockClear();
    playCelebration('milestone');
    const milestoneCount = (mockConfetti.mock.calls[0][0] as Record<string, unknown>).particleCount;

    mockConfetti.mockClear();
    playCelebration('break');
    const breakCount = (mockConfetti.mock.calls[0][0] as Record<string, unknown>).particleCount;

    expect(new Set([workCount, milestoneCount, breakCount]).size).toBe(3);
  });
});

describe('playCelebration — audio playback', () => {
  it('creates an Audio element and calls play()', () => {
    playCelebration('work');

    expect(AudioMock()).toHaveBeenCalledOnce();
    expect(AudioMock()).toHaveBeenCalledWith(expect.stringContaining('completion.mp3'));
    expect(mockAudioInstance.play).toHaveBeenCalledOnce();
  });

  it('constructs the audio URL via browser.runtime.getURL', () => {
    playCelebration('work');

    const url = (AudioMock().mock.calls[0] as [string])[0];
    expect(url).toBe('chrome-extension://fake-id/sounds/completion.mp3');
  });
});

describe('playCelebration — audio error recovery', () => {
  it('still runs confetti even when audio.play() throws synchronously', () => {
    mockAudioInstance.play.mockImplementation(() => {
      throw new Error('NotAllowedError');
    });

    // Should not throw — the try/catch in celebration.ts swallows audio errors.
    expect(() => playCelebration('work')).not.toThrow();

    // Confetti must have been called before audio was attempted.
    expect(mockConfetti).toHaveBeenCalledOnce();
  });

  it('still runs confetti when audio.play() returns a rejected promise', () => {
    mockAudioInstance.play.mockRejectedValue(new Error('AbortError'));

    // The rejection is not awaited so it does not propagate to the caller.
    expect(() => playCelebration('work')).not.toThrow();
    expect(mockConfetti).toHaveBeenCalledOnce();
  });

  it('does not throw when the Audio constructor itself throws', () => {
    // Replace the stub with one that throws on construction.
    (globalThis as Record<string, unknown>).Audio = vi.fn(() => {
      throw new Error('Audio not supported');
    });

    expect(() => playCelebration('work')).not.toThrow();
    // Confetti is called *before* new Audio() is attempted, so it still fires.
    expect(mockConfetti).toHaveBeenCalledOnce();
  });
});

describe('playCelebration — audio instance per call', () => {
  it('creates a new Audio element on each call', () => {
    playCelebration('work');
    playCelebration('work');
    playCelebration('work');

    // Each invocation of playCelebration calls new Audio(...)
    expect(AudioMock()).toHaveBeenCalledTimes(3);
  });

  it('calls confetti once per playCelebration call', () => {
    playCelebration('work');
    playCelebration('milestone');
    playCelebration('break');

    expect(mockConfetti).toHaveBeenCalledTimes(3);
  });
});
