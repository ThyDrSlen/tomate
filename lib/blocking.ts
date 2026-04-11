import { browser } from 'wxt/browser';

// Rule IDs are allocated from this base to avoid conflicts with any static rules.
const DYNAMIC_RULE_ID_BASE = 1000;

/**
 * Replaces all dynamic DNR blocking rules with new ones derived from the
 * supplied list of hostname/URL patterns.
 */
export const applyBlockingRules = async (sites: string[]): Promise<void> => {
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  const addRules = sites.map((site, index) => ({
    id: DYNAMIC_RULE_ID_BASE + index,
    priority: 1,
    action: { type: 'block' as const },
    condition: {
      urlFilter: site,
      resourceTypes: ['main_frame' as const],
    },
  }));

  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
};

/**
 * Removes all dynamic DNR blocking rules.
 */
export const clearBlockingRules = async (): Promise<void> => {
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  if (removeRuleIds.length === 0) {
    return;
  }

  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
};
