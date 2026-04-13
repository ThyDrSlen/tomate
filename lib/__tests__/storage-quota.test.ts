import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { addCompletedSession, getSessionHistory, toDateKey } from '../storage';
import type { CompletedSession } from '../types';

const makeSession = (id: string, timestamp = 1_000_000): CompletedSession => ({
  id,
  label: 'Deep work',
  startTime: timestamp,
  endTime: timestamp + 1_500_000,
  date: toDateKey(timestamp),
  duration: 1_500_000,
});

describe('addCompletedSession — quota exceeded retry', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();
  });

  it('succeeds normally when storage.set does not throw', async () => {
    const session = makeSession('s1');
    await addCompletedSession(session);
    await expect(getSessionHistory()).resolves.toEqual([session]);
  });

  it('retries with pruned sessions when storage.set throws a quota error', async () => {
    // Seed storage with 10 existing sessions
    const existing: CompletedSession[] = Array.from({ length: 10 }, (_, i) =>
      makeSession(`existing-${i}`, 1_000_000 + i * 1_000),
    );
    await fakeBrowser.storage.local.set({ sessions: existing });

    const newSession = makeSession('new-session', 2_000_000);

    // Make the first set call throw a quota error, then succeed on the second call
    let callCount = 0;
    const originalSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items: Record<string, unknown>) => {
      if ('sessions' in items && callCount === 0) {
        callCount++;
        const quotaError = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
        throw quotaError;
      }
      return originalSet(items);
    });

    await addCompletedSession(newSession);

    const stored = await getSessionHistory();
    // The new session should be present after the retry
    expect(stored.some((s) => s.id === 'new-session')).toBe(true);
    // The pruned result should have fewer sessions than 11 (10 + 1 = 11 before pruning)
    expect(stored.length).toBeLessThan(11);
  });

  it('does not prune when a non-quota error is thrown', async () => {
    const existing: CompletedSession[] = [makeSession('s-existing', 1_000_000)];
    await fakeBrowser.storage.local.set({ sessions: existing });

    const nonQuotaError = new Error('Unknown storage error');
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(nonQuotaError);

    await expect(addCompletedSession(makeSession('s-new'))).rejects.toThrow('Unknown storage error');
  });

  it('prunes 10% of existing sessions on a quota error', async () => {
    // Seed storage with exactly 100 sessions
    const existing: CompletedSession[] = Array.from({ length: 100 }, (_, i) =>
      makeSession(`old-${i}`, 1_000_000 + i * 1_000),
    );
    await fakeBrowser.storage.local.set({ sessions: existing });

    const newSession = makeSession('trigger', 2_000_000);

    let callCount = 0;
    const originalSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items: Record<string, unknown>) => {
      if ('sessions' in items && callCount === 0) {
        callCount++;
        throw new Error('QuotaExceededError: quota exceeded');
      }
      return originalSet(items);
    });

    await addCompletedSession(newSession);

    const stored = await getSessionHistory();
    // 100 existing, prune 10% (10), add 1 new = 91 total
    expect(stored.length).toBe(91);
    expect(stored[stored.length - 1].id).toBe('trigger');
    // The oldest 10 sessions should be pruned
    expect(stored.some((s) => s.id === 'old-0')).toBe(false);
    expect(stored.some((s) => s.id === 'old-9')).toBe(false);
    expect(stored.some((s) => s.id === 'old-10')).toBe(true);
  });

  it('prunes at least 1 session when there is only 1 existing session', async () => {
    const existing: CompletedSession[] = [makeSession('only-one', 1_000_000)];
    await fakeBrowser.storage.local.set({ sessions: existing });

    const newSession = makeSession('after-prune', 2_000_000);

    let callCount = 0;
    const originalSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(async (items: Record<string, unknown>) => {
      if ('sessions' in items && callCount === 0) {
        callCount++;
        throw new Error('quota exceeded');
      }
      return originalSet(items);
    });

    await addCompletedSession(newSession);

    const stored = await getSessionHistory();
    // 1 existing pruned (Math.max(1, floor(1*0.1)) = 1), then new session added = 1 total
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe('after-prune');
  });
});
