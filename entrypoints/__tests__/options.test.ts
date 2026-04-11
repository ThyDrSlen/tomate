import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

const MS_PER_MINUTE = 60_000;

const buildConfig = (
  workMin: number,
  shortMin: number,
  longMin: number,
  playSound: boolean,
): TimerConfig => ({
  workDuration: workMin * MS_PER_MINUTE,
  shortBreakDuration: shortMin * MS_PER_MINUTE,
  longBreakDuration: longMin * MS_PER_MINUTE,
  playCompletionSound: playSound,
});

// Simulate handleSave: saves config then sends UPDATE_CONFIG to background
const handleSave = async (config: TimerConfig): Promise<void> => {
  await setConfig(config);
  await fakeBrowser.runtime.sendMessage({ action: 'UPDATE_CONFIG', config });
};

describe('options page — handleSave', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();

    // Register a no-op listener so sendMessage does not throw "No listeners available"
    fakeBrowser.runtime.onMessage.addListener(() => Promise.resolve(undefined));
  });

  it('persists a valid config to storage', async () => {
    const config = buildConfig(25, 5, 30, true);
    await handleSave(config);

    await expect(getConfig()).resolves.toEqual(config);
  });

  it('persists a config with sound disabled', async () => {
    const config = buildConfig(25, 5, 30, false);
    await handleSave(config);

    const stored = await getConfig();
    expect(stored.playCompletionSound).toBe(false);
  });

  it('sends an UPDATE_CONFIG message to the background', async () => {
    const sendSpy = vi.spyOn(fakeBrowser.runtime, 'sendMessage');
    const config = buildConfig(25, 5, 30, true);
    await handleSave(config);

    expect(sendSpy).toHaveBeenCalledWith({ action: 'UPDATE_CONFIG', config });
  });

  it('persists custom work/break durations correctly', async () => {
    const config = buildConfig(50, 10, 20, true);
    await handleSave(config);

    const stored = await getConfig();
    expect(stored.workDuration).toBe(50 * MS_PER_MINUTE);
    expect(stored.shortBreakDuration).toBe(10 * MS_PER_MINUTE);
    expect(stored.longBreakDuration).toBe(20 * MS_PER_MINUTE);
  });

  it('default config includes playCompletionSound: true', () => {
    expect(DEFAULT_CONFIG.playCompletionSound).toBe(true);
  });

  it('resets to default values including sound toggle', () => {
    // Simulate handleReset logic from options/App.tsx
    const work = Math.round(DEFAULT_CONFIG.workDuration / MS_PER_MINUTE);
    const shortBreak = Math.round(DEFAULT_CONFIG.shortBreakDuration / MS_PER_MINUTE);
    const longBreak = Math.round(DEFAULT_CONFIG.longBreakDuration / MS_PER_MINUTE);
    const playSound = DEFAULT_CONFIG.playCompletionSound;

    expect(work).toBe(25);
    expect(shortBreak).toBe(5);
    expect(longBreak).toBe(30);
    expect(playSound).toBe(true);
  });

  it('out-of-range values are stored as-is (HTML validation is browser-enforced)', async () => {
    // The options form uses HTML min/max attributes for validation;
    // the JS handleSave itself does not clamp values.
    const config = buildConfig(200, 0, 120, true);
    await handleSave(config);

    const stored = await getConfig();
    expect(stored.workDuration).toBe(200 * MS_PER_MINUTE);
  });
});
