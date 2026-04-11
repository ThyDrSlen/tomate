import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

vi.mock('wxt/browser', () => ({ browser: fakeBrowser }));

import { setTimerState } from '@/lib/storage';
import { INITIAL_STATE, type TimerState } from '@/lib/types';

// Capture the storage.onChanged listener registered by background.ts
type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type StorageChangeListener = (changes: StorageChanges, area: string) => void | Promise<void>;

let storageChangeListener: StorageChangeListener | null = null;

const updateDynamicRules = vi.fn().mockResolvedValue(undefined);
const getDynamicRules = vi.fn().mockResolvedValue([]);

type BackgroundModule = {
  default: {
    main?: () => void | Promise<void>;
  };
};

const createState = (overrides: Partial<TimerState> = {}): TimerState => ({
  ...INITIAL_STATE,
  ...overrides,
});

const initBackground = async (): Promise<void> => {
  (
    globalThis as typeof globalThis & {
      defineBackground: (main?: () => void | Promise<void>) => { main?: () => void | Promise<void> };
    }
  ).defineBackground = (main) => ({ main });

  const background = (await import(`../background?blocking-test=${Math.random()}`)) as BackgroundModule;
  await background.default.main?.();
};

describe('applyBlockingRules and blockedSites storage listener', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    fakeBrowser.reset();
    await fakeBrowser.storage.local.clear();

    storageChangeListener = null;
    updateDynamicRules.mockClear().mockResolvedValue(undefined);
    getDynamicRules.mockClear().mockResolvedValue([]);

    fakeBrowser.action.setBadgeText = vi.fn().mockResolvedValue(undefined);
    fakeBrowser.action.setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);

    // Provide the chrome global that background.ts uses for declarativeNetRequest
    (globalThis as typeof globalThis & { chrome: unknown }).chrome = {
      declarativeNetRequest: {
        getDynamicRules,
        updateDynamicRules,
      },
    };

    // Capture the storage.onChanged listener
    fakeBrowser.storage.onChanged = {
      addListener: vi.fn().mockImplementation((listener: StorageChangeListener) => {
        storageChangeListener = listener;
      }),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
      hasListeners: vi.fn().mockReturnValue(false),
    } as unknown as typeof fakeBrowser.storage.onChanged;
  });

  it('creates correct declarativeNetRequest rules for a list of sites', async () => {
    await setTimerState(createState({ phase: 'WORKING', startTime: 1_000, endTime: 60_000, duration: 59_000 }));
    await initBackground();

    expect(storageChangeListener).not.toBeNull();

    await storageChangeListener!({ blockedSites: { newValue: ['example.com', 'social.net'] } }, 'local');

    // Allow the async .then() chain in the listener to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [],
      addRules: [
        {
          id: 1,
          priority: 1,
          action: { type: 'block' },
          condition: { urlFilter: 'example.com', resourceTypes: ['main_frame'] },
        },
        {
          id: 2,
          priority: 1,
          action: { type: 'block' },
          condition: { urlFilter: 'social.net', resourceTypes: ['main_frame'] },
        },
      ],
    });
  });

  it('replaces existing rules when sites change', async () => {
    getDynamicRules.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await setTimerState(createState({ phase: 'WORKING', startTime: 1_000, endTime: 60_000, duration: 59_000 }));
    await initBackground();

    await storageChangeListener!({ blockedSites: { newValue: ['news.io'] } }, 'local');
    await new Promise((r) => setTimeout(r, 0));

    expect(updateDynamicRules).toHaveBeenCalledWith(
      expect.objectContaining({
        removeRuleIds: [1, 2],
        addRules: [
          expect.objectContaining({
            id: 1,
            condition: expect.objectContaining({ urlFilter: 'news.io' }),
          }),
        ],
      }),
    );
  });

  it('clears all rules when blockedSites becomes empty', async () => {
    getDynamicRules.mockResolvedValue([{ id: 1 }]);

    await setTimerState(createState({ phase: 'WORKING', startTime: 1_000, endTime: 60_000, duration: 59_000 }));
    await initBackground();

    await storageChangeListener!({ blockedSites: { newValue: [] } }, 'local');
    await new Promise((r) => setTimeout(r, 0));

    expect(updateDynamicRules).toHaveBeenCalledWith({ removeRuleIds: [1], addRules: [] });
  });

  it('does not apply rules when phase is not WORKING (IDLE)', async () => {
    await setTimerState(createState({ phase: 'IDLE' }));
    await initBackground();

    await storageChangeListener!({ blockedSites: { newValue: ['example.com'] } }, 'local');
    await new Promise((r) => setTimeout(r, 0));

    expect(getDynamicRules).not.toHaveBeenCalled();
    expect(updateDynamicRules).not.toHaveBeenCalled();
  });

  it('does not apply rules when phase is SHORT_BREAK', async () => {
    await setTimerState(createState({ phase: 'SHORT_BREAK', startTime: 1_000, endTime: 60_000, duration: 59_000 }));
    await initBackground();

    await storageChangeListener!({ blockedSites: { newValue: ['example.com'] } }, 'local');
    await new Promise((r) => setTimeout(r, 0));

    expect(getDynamicRules).not.toHaveBeenCalled();
    expect(updateDynamicRules).not.toHaveBeenCalled();
  });

  it('ignores storage changes not in the local area', async () => {
    await setTimerState(createState({ phase: 'WORKING', startTime: 1_000, endTime: 60_000, duration: 59_000 }));
    await initBackground();

    await storageChangeListener!({ blockedSites: { newValue: ['example.com'] } }, 'sync');
    await new Promise((r) => setTimeout(r, 0));

    expect(getDynamicRules).not.toHaveBeenCalled();
    expect(updateDynamicRules).not.toHaveBeenCalled();
  });

  it('ignores storage changes unrelated to blockedSites', async () => {
    await setTimerState(createState({ phase: 'WORKING', startTime: 1_000, endTime: 60_000, duration: 59_000 }));
    await initBackground();

    await storageChangeListener!({ timerState: { newValue: {} } }, 'local');
    await new Promise((r) => setTimeout(r, 0));

    expect(getDynamicRules).not.toHaveBeenCalled();
    expect(updateDynamicRules).not.toHaveBeenCalled();
  });
});
