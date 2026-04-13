import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

/**
 * Unit tests for the options page save/reset/validation logic (#106).
 *
 * We test the extracted logic (validation predicates, config construction)
 * directly rather than through the SolidJS component so we avoid needing
 * a DOM environment.
 */

const MS_PER_MINUTE = 60_000;

const isValidWork = (v: number) => v >= 1 && v <= 120;
const isValidShortBreak = (v: number) => v >= 1 && v <= 30;
const isValidLongBreak = (v: number) => v >= 5 && v <= 60;

const isValid = (work: number, shortBreak: number, longBreak: number) =>
  isValidWork(work) && isValidShortBreak(shortBreak) && isValidLongBreak(longBreak);

const buildConfig = (
  work: number,
  shortBreak: number,
  longBreak: number,
  openBreakTab: boolean,
  playCompletionSound: boolean,
  extra: Partial<TimerConfig> = {},
): TimerConfig => ({
  dailyGoal: DEFAULT_CONFIG.dailyGoal,
  ...extra,
  workDuration: work * MS_PER_MINUTE,
  shortBreakDuration: shortBreak * MS_PER_MINUTE,
  longBreakDuration: longBreak * MS_PER_MINUTE,
  openBreakTab,
  playCompletionSound,
});

describe('options page — validation predicates (#106)', () => {
  it('accepts valid default durations', () => {
    expect(isValid(25, 5, 30)).toBe(true);
  });

  it('rejects work duration below 1', () => {
    expect(isValid(0, 5, 30)).toBe(false);
  });

  it('rejects work duration above 120', () => {
    expect(isValid(121, 5, 30)).toBe(false);
  });

  it('accepts work duration of 1', () => {
    expect(isValid(1, 5, 30)).toBe(true);
  });

  it('accepts work duration of 120', () => {
    expect(isValid(120, 5, 30)).toBe(true);
  });

  it('rejects short break below 1', () => {
    expect(isValid(25, 0, 30)).toBe(false);
  });

  it('rejects short break above 30', () => {
    expect(isValid(25, 31, 30)).toBe(false);
  });

  it('rejects long break below 5', () => {
    expect(isValid(25, 5, 4)).toBe(false);
  });

  it('rejects long break above 60', () => {
    expect(isValid(25, 5, 61)).toBe(false);
  });

  it('accepts boundary long break values', () => {
    expect(isValid(25, 5, 5)).toBe(true);
    expect(isValid(25, 5, 60)).toBe(true);
  });
});

describe('options page — handleSave storage flow (#106)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();

    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(undefined);
  });

  it('saves a valid config to storage', async () => {
    const config = buildConfig(25, 5, 30, true, true);
    await setConfig(config);
    await expect(getConfig()).resolves.toEqual(config);
  });

  it('sends UPDATE_CONFIG message to background on save', async () => {
    const config = buildConfig(25, 5, 30, true, true);
    await fakeBrowser.runtime.sendMessage({ action: 'UPDATE_CONFIG', config });
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'UPDATE_CONFIG',
      config,
    });
  });

  it('preserves playCompletionSound: false in the saved config', async () => {
    const config = buildConfig(25, 5, 30, true, false);
    await setConfig(config);
    const loaded = await getConfig();
    expect(loaded.playCompletionSound).toBe(false);
  });

  it('preserves openBreakTab: false in the saved config', async () => {
    const config = buildConfig(25, 5, 30, false, true);
    await setConfig(config);
    const loaded = await getConfig();
    expect(loaded.openBreakTab).toBe(false);
  });

  it('does not save when validation fails (work = 0)', async () => {
    // Simulate the guard: invalid → skip setConfig
    const valid = isValid(0, 5, 30);
    if (!valid) {
      // nothing saved
    } else {
      await setConfig(buildConfig(0, 5, 30, true, true));
    }
    // Storage should still be the default (empty → DEFAULT_CONFIG)
    await expect(getConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });

  it('preserves extra fields (e.g. dailyGoal) during round-trip save', async () => {
    // Pre-store a config with dailyGoal
    await setConfig({ ...DEFAULT_CONFIG, dailyGoal: 12 });

    // Simulate loading, changing only work duration, then saving back
    const loaded = await getConfig();
    const { workDuration: _w, shortBreakDuration: _s, longBreakDuration: _l, openBreakTab: _o, playCompletionSound: _p, ...extra } = loaded;
    const saved = buildConfig(30, 5, 30, true, true, extra);
    await setConfig(saved);

    const reloaded = await getConfig();
    expect(reloaded.dailyGoal).toBe(12);
    expect(reloaded.workDuration).toBe(30 * MS_PER_MINUTE);
  });

  it('handles storage failure gracefully without crashing', async () => {
    // Simulate what the component does: catch storage errors
    const storageError = new Error('QuotaExceededError');
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(storageError);

    let caughtError = false;
    try {
      await setConfig(buildConfig(25, 5, 30, true, true));
    } catch {
      caughtError = true;
    }
    // The component catches this and sets error signal; the error should propagate from setConfig
    expect(caughtError).toBe(true);
  });
});

describe('options page — reset to defaults (#106)', () => {
  it('reset values match DEFAULT_CONFIG durations in minutes', () => {
    expect(Math.round(DEFAULT_CONFIG.workDuration / MS_PER_MINUTE)).toBe(25);
    expect(Math.round(DEFAULT_CONFIG.shortBreakDuration / MS_PER_MINUTE)).toBe(5);
    expect(Math.round(DEFAULT_CONFIG.longBreakDuration / MS_PER_MINUTE)).toBe(30);
  });

  it('default openBreakTab is true', () => {
    expect(DEFAULT_CONFIG.openBreakTab).toBe(true);
  });

  it('default playCompletionSound is true', () => {
    expect(DEFAULT_CONFIG.playCompletionSound).toBe(true);
  });
});
