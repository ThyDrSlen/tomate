import { describe, it, expect } from 'vitest';
import { recoverMissedAlarm, isActivePhase } from '../lib/timer';
import { DEFAULT_CONFIG } from '../lib/types';

const NOW = 1_000_000_000_000; // fixed reference timestamp (ms)
const FIVE_MINUTES = 5 * 60 * 1_000;
const WORK_DURATION = DEFAULT_CONFIG.workDuration; // 25 min

describe('recoverMissedAlarm — timer still active (endTime in the future)', () => {
  it('returns null when WORKING timer has not yet expired', () => {
    // Scenario: extension updates while user has 5 min left on a work session.
    // recoverMissedAlarm must return null so the background can reschedule
    // the existing alarm rather than treating it as a missed/expired one.
    const state = {
      phase: 'WORKING' as const,
      startTime: NOW - WORK_DURATION + FIVE_MINUTES,
      endTime: NOW + FIVE_MINUTES,
      duration: WORK_DURATION,
      sessionCount: 0,
      cyclePosition: 0,
      completedToday: 0,
    };

    const result = recoverMissedAlarm(state, DEFAULT_CONFIG, NOW);

    expect(result).toBeNull();
  });

  it('isActivePhase is true for WORKING so background can reschedule', () => {
    expect(isActivePhase('WORKING')).toBe(true);
  });

  it('isActivePhase is true for SHORT_BREAK so background can reschedule', () => {
    expect(isActivePhase('SHORT_BREAK')).toBe(true);
  });

  it('isActivePhase is true for LONG_BREAK so background can reschedule', () => {
    expect(isActivePhase('LONG_BREAK')).toBe(true);
  });

  it('isActivePhase is false for IDLE and BREAK_SUGGESTION — no alarm needed', () => {
    expect(isActivePhase('IDLE')).toBe(false);
    expect(isActivePhase('BREAK_SUGGESTION')).toBe(false);
  });
});

describe('recoverMissedAlarm — timer already expired', () => {
  it('returns a new state when WORKING timer expired before now', () => {
    // Simulates a missed alarm: extension was dormant longer than the session.
    const state = {
      phase: 'WORKING' as const,
      startTime: NOW - WORK_DURATION - 1,
      endTime: NOW - 1, // expired 1 ms ago
      duration: WORK_DURATION,
      sessionCount: 0,
      cyclePosition: 0,
      completedToday: 0,
    };

    const result = recoverMissedAlarm(state, DEFAULT_CONFIG, NOW);

    expect(result).not.toBeNull();
    // After a WORKING session completes (cyclePosition < 3) → SHORT_BREAK
    expect(result!.phase).toBe('SHORT_BREAK');
    expect(result!.completedToday).toBe(1);
  });

  it('returns null for IDLE state (nothing to recover)', () => {
    const state = {
      phase: 'IDLE' as const,
      startTime: null,
      endTime: null,
      duration: null,
      sessionCount: 0,
      cyclePosition: 0,
      completedToday: 0,
    };

    const result = recoverMissedAlarm(state, DEFAULT_CONFIG, NOW);

    expect(result).toBeNull();
  });
});

describe('reschedule-on-update invariant', () => {
  it('a WORKING state with future endTime should trigger alarm rescheduling in background', () => {
    // This test documents the contract relied on by recoverFromMissedAlarm in background.ts:
    // when recoverMissedAlarm returns null AND isActivePhase is true AND endTime > now,
    // the background MUST reschedule the alarm to endTime.
    const futureEndTime = NOW + FIVE_MINUTES;
    const state = {
      phase: 'WORKING' as const,
      startTime: NOW - WORK_DURATION + FIVE_MINUTES,
      endTime: futureEndTime,
      duration: WORK_DURATION,
      sessionCount: 0,
      cyclePosition: 0,
      completedToday: 0,
    };

    // recoverMissedAlarm returns null (timer still running)
    expect(recoverMissedAlarm(state, DEFAULT_CONFIG, NOW)).toBeNull();

    // background should detect active phase + future endTime and reschedule
    const shouldReschedule = isActivePhase(state.phase) && state.endTime !== null && state.endTime > NOW;
    expect(shouldReschedule).toBe(true);

    // The endTime the alarm should be rescheduled to
    expect(state.endTime).toBe(futureEndTime);
  });
});
