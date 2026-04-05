import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, INITIAL_STATE } from '@/lib/types';

describe('module exports', () => {
  it('exports valid default config values', () => {
    expect(DEFAULT_CONFIG.workDuration).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.shortBreakDuration).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.longBreakDuration).toBeGreaterThan(0);
  });

  it('exports an idle initial state', () => {
    expect(INITIAL_STATE.phase).toBe('IDLE');
    expect(INITIAL_STATE.startTime).toBeNull();
    expect(INITIAL_STATE.endTime).toBeNull();
    expect(INITIAL_STATE.sessionCount).toBe(0);
  });
});
