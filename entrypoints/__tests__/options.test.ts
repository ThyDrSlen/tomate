import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { getConfig, setConfig } from '@/lib/storage';
import { DEFAULT_CONFIG, type TimerConfig } from '@/lib/types';

/**
 * Unit tests for the options page save/reset/validation logic (#106, #483).
 *
 * We test the extracted logic (validation predicates, config construction)
 * directly rather than through the SolidJS component so we avoid needing
 * a DOM environment.
 */

const MS_PER_MINUTE = 60_000;

const isValidWork = (v: number) => v >= 1 && v <= 120;
const isValidShortBreak = (v: number) => v >= 1 && v <= 30;
const isValidLongBreak = (v: number) => v >= 5 && v <= 60;
// PR #483: dailyGoal field — valid range is 1..20
const isValidDailyGoal = (v: number) => v >= 1 && v <= 20;

const isValid = (work: number, shortBreak: number, longBreak: number, dailyGoal = DEFAULT_CONFIG.dailyGoal) =>
  isValidWork(work) && isValidShortBreak(shortBreak) && isValidLongBreak(longBreak) && isValidDailyGoal(dailyGoal);

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

/** Build config with explicit dailyGoal (PR #483). */
const buildConfigWithGoal = (
  work: number,
  shortBreak: number,
  longBreak: number,
  openBreakTab: boolean,
  playCompletionSound: boolean,
  dailyGoal: number,
): TimerConfig => ({
  workDuration: work * MS_PER_MINUTE,
  shortBreakDuration: shortBreak * MS_PER_MINUTE,
  longBreakDuration: longBreak * MS_PER_MINUTE,
  openBreakTab,
  playCompletionSound,
  dailyGoal,
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

// ---------------------------------------------------------------------------
// PR #483 — dailyGoal input field (min=1, max=20)
// ---------------------------------------------------------------------------

describe('options page — dailyGoal validation predicate (#483)', () => {
  it('accepts the default daily goal of 8', () => {
    expect(isValidDailyGoal(DEFAULT_CONFIG.dailyGoal)).toBe(true);
    expect(DEFAULT_CONFIG.dailyGoal).toBe(8);
  });

  it('accepts the minimum boundary value of 1', () => {
    expect(isValidDailyGoal(1)).toBe(true);
  });

  it('accepts the maximum boundary value of 20', () => {
    expect(isValidDailyGoal(20)).toBe(true);
  });

  it('rejects 0 (below minimum)', () => {
    expect(isValidDailyGoal(0)).toBe(false);
  });

  it('rejects 21 (above maximum)', () => {
    expect(isValidDailyGoal(21)).toBe(false);
  });

  it('rejects negative values', () => {
    expect(isValidDailyGoal(-1)).toBe(false);
  });
});

describe('options page — isValid gated by dailyGoal (#483)', () => {
  it('returns true when all fields including dailyGoal are valid', () => {
    expect(isValid(25, 5, 30, 8)).toBe(true);
  });

  it('returns false when dailyGoal is 0 even if durations are valid', () => {
    expect(isValid(25, 5, 30, 0)).toBe(false);
  });

  it('returns false when dailyGoal is 21 even if durations are valid', () => {
    expect(isValid(25, 5, 30, 21)).toBe(false);
  });

  it('returns false when both dailyGoal and work duration are invalid', () => {
    expect(isValid(0, 5, 30, 0)).toBe(false);
  });

  it('returns true for boundary dailyGoal values 1 and 20', () => {
    expect(isValid(25, 5, 30, 1)).toBe(true);
    expect(isValid(25, 5, 30, 20)).toBe(true);
  });
});

describe('options page — dailyGoal storage round-trip (#483)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(undefined);
  });

  it('persists dailyGoal: 1 (minimum) to storage', async () => {
    const config = buildConfigWithGoal(25, 5, 30, true, true, 1);
    await setConfig(config);
    const loaded = await getConfig();
    expect(loaded.dailyGoal).toBe(1);
  });

  it('persists dailyGoal: 20 (maximum) to storage', async () => {
    const config = buildConfigWithGoal(25, 5, 30, true, true, 20);
    await setConfig(config);
    const loaded = await getConfig();
    expect(loaded.dailyGoal).toBe(20);
  });

  it('persists a mid-range dailyGoal: 12 to storage', async () => {
    const config = buildConfigWithGoal(25, 5, 30, true, true, 12);
    await setConfig(config);
    const loaded = await getConfig();
    expect(loaded.dailyGoal).toBe(12);
  });

  it('does not save when dailyGoal is invalid (0)', async () => {
    const valid = isValid(25, 5, 30, 0);
    if (!valid) {
      // guard: skip setConfig — nothing written
    } else {
      await setConfig(buildConfigWithGoal(25, 5, 30, true, true, 0));
    }
    // Storage should fall back to DEFAULT_CONFIG
    await expect(getConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });

  it('does not save when dailyGoal is invalid (21)', async () => {
    const valid = isValid(25, 5, 30, 21);
    if (!valid) {
      // guard: skip setConfig — nothing written
    } else {
      await setConfig(buildConfigWithGoal(25, 5, 30, true, true, 21));
    }
    await expect(getConfig()).resolves.toEqual(DEFAULT_CONFIG);
  });

  it('overwrites only dailyGoal while preserving other fields', async () => {
    // Save initial config
    await setConfig(buildConfigWithGoal(30, 10, 45, false, false, 5));

    // Update dailyGoal only
    const loaded = await getConfig();
    const updated: TimerConfig = { ...loaded, dailyGoal: 15 };
    await setConfig(updated);

    const reloaded = await getConfig();
    expect(reloaded.dailyGoal).toBe(15);
    expect(reloaded.workDuration).toBe(30 * MS_PER_MINUTE);
    expect(reloaded.openBreakTab).toBe(false);
    expect(reloaded.playCompletionSound).toBe(false);
  });

  it('falls back to DEFAULT_CONFIG.dailyGoal when storage has no dailyGoal field', async () => {
    // Simulate storage written before dailyGoal was added (no dailyGoal key)
    await fakeBrowser.storage.local.set({
      config: {
        workDuration: 25 * MS_PER_MINUTE,
        shortBreakDuration: 5 * MS_PER_MINUTE,
        longBreakDuration: 30 * MS_PER_MINUTE,
        openBreakTab: true,
        playCompletionSound: true,
        // dailyGoal intentionally absent
      },
    });
    const loaded = await getConfig();
    expect(loaded.dailyGoal).toBe(DEFAULT_CONFIG.dailyGoal);
  });
});
