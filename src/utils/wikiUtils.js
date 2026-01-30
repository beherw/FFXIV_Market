/**
 * Wiki Utilities - Centralized functions for generating Wiki links
 * Handles Huiji Wiki (灰機) link generation with Simplified Chinese names
 */

import { getSimplifiedChineseName } from '../services/itemDatabase';

/**
 * Generate Huiji Wiki URL for an item
 * @param {number} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<string>} - Wiki URL (uses Simplified Chinese name if available, falls back to ID)
 */
export async function getHuijiWikiUrlForItem(itemId, signal = null) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  try {
    // Try to get Simplified Chinese name
    const simplifiedName = await getSimplifiedChineseName(itemId, signal);
    
    if (simplifiedName) {
      // Use prefix for items with ID > 1000 or < 20 (same logic as existing code)
      const prefix = itemId > 1000 || itemId < 20 ? '物品:' : '';
      return `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(simplifiedName)}`;
    } else {
      // Fallback to ID if Simplified Chinese name not available
      return `https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(itemId)}`;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return null;
    }
    console.error(`[wikiUtils] Failed to generate Wiki URL for item ${itemId}:`, error);
    // Fallback to ID-based URL
    return `https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(itemId)}`;
  }
}

/**
 * Generate Huiji Wiki URL for a quest
 * @param {number} questId - Quest ID
 * @param {string} questCNName - Simplified Chinese quest name (optional, will be fetched if not provided)
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<string>} - Wiki URL
 */
export async function getHuijiWikiUrlForQuest(questId, questCNName = null, signal = null) {
  if (!questId || questId <= 0) {
    return null;
  }

  // If Simplified Chinese name is provided, use it directly
  if (questCNName) {
    return `https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(questCNName)}`;
  }

  // Otherwise, fallback to ID-based URL
  return `https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(questId)}`;
}

/**
 * Generate Huiji Wiki URL for a FATE
 * @param {number} fateId - FATE ID
 * @param {string} fateCNName - Simplified Chinese FATE name (optional)
 * @returns {string} - Wiki URL
 */
export function getHuijiWikiUrlForFate(fateId, fateCNName = null) {
  if (!fateId || fateId <= 0) {
    return null;
  }

  // If Simplified Chinese name is provided, use it with "临危受命:" prefix
  if (fateCNName) {
    return `https://ff14.huijiwiki.com/wiki/临危受命:${encodeURIComponent(fateCNName)}`;
  }

  // Otherwise, fallback to ID-based URL
  return `https://ff14.huijiwiki.com/wiki/临危受命:${encodeURIComponent(fateId)}`;
}

/**
 * Generate Huiji Wiki URL for an instance/dungeon
 * @param {number} instanceId - Instance ID
 * @param {string} instanceCNName - Simplified Chinese instance name (optional)
 * @returns {string} - Wiki URL
 */
export function getHuijiWikiUrlForInstance(instanceId, instanceCNName = null) {
  if (!instanceId || instanceId <= 0) {
    return null;
  }

  // If Simplified Chinese name is provided, use it directly
  if (instanceCNName) {
    return `https://ff14.huijiwiki.com/wiki/${encodeURIComponent(instanceCNName)}`;
  }

  // Otherwise, fallback to ID-based URL
  return `https://ff14.huijiwiki.com/wiki/${encodeURIComponent(instanceId)}`;
}

/**
 * Open Huiji Wiki link for an item in a new tab
 * @param {number} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<void>}
 */
export async function openHuijiWikiForItem(itemId, signal = null) {
  try {
    const url = await getHuijiWikiUrlForItem(itemId, signal);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    console.error(`[wikiUtils] Failed to open Wiki link for item ${itemId}:`, error);
  }
}
