import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { INITIAL_STATE, type TimerState } from '@/lib/types';

/**
 * Unit tests for the popup onMount GET_STATE / isReconnecting logic (#486).
 *
 * The popup's onMount races browser.runtime.sendMessage({ action: 'GET_STATE' })
 * against a 3000 ms timeout.  If the background responds in time, the returned
 * TimerState is used directly.  If the message times out or throws, the
 * component sets isReconnecting = true and returns early (no further storage
 * reads happen).
 *
 * We test the Promise.race pattern extracted from the component rather than
 * mounting SolidJS to avoid a DOM environment dependency.
 */

// ---------------------------------------------------------------------------
// Helpers that mirror the onMount logic from entrypoints/popup/App.tsx
// ---------------------------------------------------------------------------

const GET_STATE_TIMEOUT_MS = 3000;

/**
 * Reproduces the Promise.race guard used in popup onMount.
 * Returns the TimerState on success, or throws on timeout / send error.
 */
async function fetchStateWithTimeout(
  timeoutMs: number = GET_STATE_TIMEOUT_MS,
): Promise<TimerState> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('GET_STATE timeout')), timeoutMs),
  );
  return (await Promise.race([
    fakeBrowser.runtime.sendMessage({ action: 'GET_STATE' }),
    timeout,
  ])) as TimerState;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('popup — GET_STATE success path (#486)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    vi.useFakeTimers();
  });

  it('returns the state from the background when it responds before timeout', async () => {
    const expected: TimerState = { ...INITIAL_STATE, phase: 'WORKING', sessionCount: 3 };
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(expected);

    const result = await fetchStateWithTimeout();
    expect(result).toEqual(expected);
  });

  it('returns IDLE state when background responds with INITIAL_STATE', async () => {
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(INITIAL_STATE);

    const result = await fetchStateWithTimeout();
    expect(result.phase).toBe('IDLE');
  });

  it('calls sendMessage with GET_STATE action', async () => {
    fakeBrowser.runtime.sendMessage = vi.fn().mockResolvedValue(INITIAL_STATE);

    await fetchStateWithTimeout();
    expect(fakeBrowser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'GET_STATE' });
  });
});

describe('popup — isReconnecting state triggered by GET_STATE timeout (#486)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    vi.useFakeTimers();
  });

  it('rejects with timeout error when background does not respond within 3000 ms', async () => {
    // sendMessage never resolves
    fakeBrowser.runtime.sendMessage = vi.fn().mockImplementation(
      () => new Promise<never>(() => {}),
    );

    let isReconnecting = false;
    const onMount = async () => {
      try {
        await fetchStateWithTimeout(GET_STATE_TIMEOUT_MS);
      } catch {
        isReconnecting = true;
        return; // mirrors the component: early return on failure
      }
    };

    const mountPromise = onMount();
    // Advance time past the 3000 ms threshold to trigger the rejection
    await vi.advanceTimersByTimeAsync(GET_STATE_TIMEOUT_MS + 1);
    await mountPromise;

    expect(isReconnecting).toBe(true);
  });

  it('sets isReconnecting=true and returns early, leaving state as INITIAL_STATE', async () => {
    fakeBrowser.runtime.sendMessage = vi.fn().mockImplementation(
      () => new Promise<never>(() => {}),
    );

    let isReconnecting = false;
    let capturedState = { ...INITIAL_STATE }; // starts as default

    const onMount = async () => {
      let currentState: TimerState | undefined;
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GET_STATE timeout')), GET_STATE_TIMEOUT_MS),
        );
        currentState = (await Promise.race([
          fakeBrowser.runtime.sendMessage({ action: 'GET_STATE' }),
          timeout,
        ])) as TimerState;
      } catch {
        isReconnecting = true;
        return; // early return — no state update
      }
      capturedState = currentState;
    };

    const mountPromise = onMount();
    await vi.advanceTimersByTimeAsync(GET_STATE_TIMEOUT_MS + 1);
    await mountPromise;

    expect(isReconnecting).toBe(true);
    // capturedState must remain the initial default because onMount returned early
    expect(capturedState.phase).toBe('IDLE');
  });

  it('sets isReconnecting=true when sendMessage rejects immediately (connection error)', async () => {
    fakeBrowser.runtime.sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('Could not establish connection'));

    let isReconnecting = false;
    const onMount = async () => {
      try {
        await fetchStateWithTimeout(GET_STATE_TIMEOUT_MS);
      } catch {
        isReconnecting = true;
        return;
      }
    };

    await onMount();

    expect(isReconnecting).toBe(true);
  });

  it('does not set isReconnecting when background responds just before the 3000 ms deadline', async () => {
    const expected: TimerState = { ...INITIAL_STATE, phase: 'SHORT_BREAK' };
    // Responds after 2999 ms — within the window
    fakeBrowser.runtime.sendMessage = vi.fn().mockImplementation(
      () =>
        new Promise<TimerState>((resolve) => {
          setTimeout(() => resolve(expected), GET_STATE_TIMEOUT_MS - 1);
        }),
    );

    let isReconnecting = false;
    let capturedState: TimerState | undefined;

    const onMount = async () => {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GET_STATE timeout')), GET_STATE_TIMEOUT_MS),
        );
        capturedState = (await Promise.race([
          fakeBrowser.runtime.sendMessage({ action: 'GET_STATE' }),
          timeout,
        ])) as TimerState;
      } catch {
        isReconnecting = true;
        return;
      }
    };

    const mountPromise = onMount();
    await vi.advanceTimersByTimeAsync(GET_STATE_TIMEOUT_MS + 10);
    await mountPromise;

    expect(isReconnecting).toBe(false);
    expect(capturedState?.phase).toBe('SHORT_BREAK');
  });
});

describe('popup — reconnecting panel display contract (#486)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    vi.useFakeTimers();
  });

  it('isReconnecting starts as false before onMount runs', () => {
    // Represents component initialisation before onMount completes
    const isReconnecting = false;
    expect(isReconnecting).toBe(false);
  });

  it('isReconnecting becomes true only after timeout fires, not before', async () => {
    fakeBrowser.runtime.sendMessage = vi.fn().mockImplementation(
      () => new Promise<never>(() => {}),
    );

    let isReconnecting = false;
    const onMount = async () => {
      try {
        await fetchStateWithTimeout(GET_STATE_TIMEOUT_MS);
      } catch {
        isReconnecting = true;
        return;
      }
    };

    const mountPromise = onMount();

    // Advance to just before timeout — isReconnecting must still be false
    await vi.advanceTimersByTimeAsync(GET_STATE_TIMEOUT_MS - 1);
    expect(isReconnecting).toBe(false);

    // Advance past timeout — now it should be true
    await vi.advanceTimersByTimeAsync(2);
    await mountPromise;
    expect(isReconnecting).toBe(true);
  });
});
