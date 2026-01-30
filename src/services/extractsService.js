// Service to load and parse extracts.json for item acquisition methods
// Now uses Supabase for efficient querying - only loads data for specific item IDs
// Never loads all extracts data at once

import { getItemSourcesById } from './supabaseData';

/**
 * Load extracts index file (small metadata file)
 * @deprecated No longer needed - Supabase queries don't require an index
 * @returns {Promise<Object>} Empty index object for backward compatibility
 */
export async function loadExtractsIndex() {
  // No longer needed with Supabase - return empty object for backward compatibility
  return { chunkCount: 0, totalRecords: 0, idRanges: [] };
}

/**
 * Get chunk index for a given item ID
 * @param {number|string} itemId - Item ID
 * @param {Object} index - Index object from loadExtractsIndex()
 * @returns {number|null} Chunk index or null if not found
 */
function getChunkIndex(itemId, index) {
  const id = parseInt(itemId, 10);
  if (isNaN(id)) {
    return null;
  }

  // Binary search through idRanges for efficiency
  const ranges = index.idRanges;
  let left = 0;
  let right = ranges.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const range = ranges[mid];

    if (id >= range.minId && id <= range.maxId) {
      return range.chunk;
    } else if (id < range.minId) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return null;
}

/**
 * Load a specific chunk by index
 * @deprecated No longer needed - Supabase queries don't use chunks
 * @param {number} chunkIndex - Chunk index to load
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} Empty object for backward compatibility
 */
export async function loadChunk(chunkIndex, signal = null) {
  // No longer needed with Supabase - return empty object for backward compatibility
  return {};
}

/**
 * Load extracts data (acquisition methods for items)
 * @deprecated This function loads ALL extracts data which is inefficient.
 * Use getItemSources() instead to query only specific items from Supabase.
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} Empty object (loading all extracts is disabled for performance)
 */
export async function loadExtracts(signal = null) {
  // DISABLED - Loading all extracts is inefficient and not needed
  // Components should use getItemSources(itemId) instead to query specific items
  console.warn('[extractsService] loadExtracts() is deprecated. Use getItemSources(itemId) instead.');
  return {};
}

/**
 * Get acquisition sources for an item by ID from Supabase
 * This is the preferred method - only queries for the specific item, never loads all data
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Array>} Array of source objects with type and data
 */
export async function getItemSources(itemId, signal = null) {
  try {
    // Use Supabase to query only this specific item ID
    // This is much more efficient than loading chunks or all data
    const sources = await getItemSourcesById(itemId, signal);
    
    if (!sources || !Array.isArray(sources)) {
      return [];
    }

    return sources;
  } catch (error) {
    // If loading fails, log the error but return empty array to prevent UI crash
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      // Don't log abort errors - they're expected when user navigates away
      throw error;
    }
    console.error(`[extractsService] Failed to load item sources for item ${itemId}:`, error);
    console.error('[extractsService] Error details:', {
      message: error.message,
      stack: error.stack
    });
    return [];
  }
}

/**
 * Get all chunks for searching through all items
 * @deprecated Loading all extracts is inefficient. Use targeted Supabase queries instead.
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @param {Function} onChunkLoaded - Optional callback called when each chunk loads (chunkIndex, chunk)
 * @returns {Promise<Array<Object>>} Empty array (loading all chunks is disabled for performance)
 */
export async function loadAllChunks(signal = null, onChunkLoaded = null) {
  // DISABLED - Loading all extracts is inefficient and not needed
  // Components should use targeted queries instead
  console.warn('[extractsService] loadAllChunks() is deprecated. Use targeted Supabase queries instead.');
  return [];
}

/**
 * DataType enum values (matching Teamcraft)
 */
export const DataType = {
  DEPRECATED: 0,
  CRAFTED_BY: 1,
  TRADE_SOURCES: 2,
  VENDORS: 3,
  REDUCED_FROM: 4,
  DESYNTHS: 5,
  INSTANCES: 6,
  GATHERED_BY: 7,
  VENTURES: 8,
  TREASURES: 9,
  QUESTS: 10,
  FATES: 11,
  GARDENING: 12,
  MOGSTATION: 13,
  ISLAND_PASTURE: 14,
  ISLAND_CROP: 15,
  VOYAGES: 16,
  REQUIREMENTS: 17,
  MASTERBOOKS: 18,
  ALARMS: 19,
  ACHIEVEMENTS: 22,
};
