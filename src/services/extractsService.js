// Service to load and parse extracts.json for item acquisition methods
// Uses obtainable msgpack for specific item IDs (local, no remote DB)
// Never loads all extracts data at once

import { getObtainableSourcesById } from './obtainableMethodsMsgpack';

/**
 * Load extracts index file (small metadata file)
 * @deprecated No longer needed - targeted queries use msgpack
 * @returns {Promise<Object>} Empty index object for backward compatibility
 */
export async function loadExtractsIndex() {
  // No longer needed - return empty object for backward compatibility
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
 * @deprecated No longer needed - msgpack doesn't use chunks
 * @param {number} chunkIndex - Chunk index to load
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} Empty object for backward compatibility
 */
export async function loadChunk(chunkIndex, signal = null) {
  // No longer needed - return empty object for backward compatibility
  return {};
}

/**
 * Load extracts data (acquisition methods for items)
 * @deprecated Loading all extracts data is disabled for performance.
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
 * Get acquisition sources for an item by ID from local prebuilt database
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Array>} Array of source objects with type and data
 */
export async function getItemSources(itemId, signal = null) {
  try {
    const sources = await getObtainableSourcesById(itemId);
    return Array.isArray(sources) ? sources : [];
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
 * @deprecated Loading all extracts is inefficient. Use getItemSources(itemId) instead.
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @param {Function} onChunkLoaded - Optional callback called when each chunk loads (chunkIndex, chunk)
 * @returns {Promise<Array<Object>>} Empty array (loading all chunks is disabled for performance)
 */
export async function loadAllChunks(signal = null, onChunkLoaded = null) {
  // DISABLED - Loading all extracts is inefficient and not needed
  // Components should use targeted queries instead
  console.warn('[extractsService] loadAllChunks() is deprecated. Use getItemSources(itemId) instead.');
  return [];
}

// 导入中心化的 DataType 定义
// 这是整个项目唯一的 DataType 定义来源
export { DataType, TYPE_CHINESE_NAMES, getTypeIdFromString, getStringFromTypeId, getChineseName } from '../constants/dataTypes.js';
