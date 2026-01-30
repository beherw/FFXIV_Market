// Service to load and parse extracts.json for item acquisition methods
// extracts.json is now chunked at build time for efficient lazy loading
// Chunks are loaded on-demand based on item ID lookup


// Cache for index and chunks
let extractsIndexCache = null;
let extractsIndexLoadPromise = null;
const chunkCache = new Map(); // Map<chunkIndex, chunkData>
const chunkLoadPromises = new Map(); // Map<chunkIndex, Promise>

/**
 * Load extracts index file (small metadata file)
 * @returns {Promise<Object>} Index object with chunkSize, totalRecords, chunkCount, idRanges
 */
export async function loadExtractsIndex() {
  // DISABLED - extracts.json loading removed
  // Return empty index to prevent loading
  return { chunkCount: 0, totalRecords: 0, idRanges: [] };
  /* DISABLED CODE
  // #region agent log
  const { logDebug } = await import('../utils/debugLogger');
  const loadStartTime = performance.now();
  logDebug('extractsService.js:15', 'loadExtractsIndex START', { 
    hasCache: !!extractsIndexCache,
    hasPromise: !!extractsIndexLoadPromise
  }, 'G');
  // #endregion
  
  if (extractsIndexCache) {
    // #region agent log
    logDebug('extractsService.js:17', 'loadExtractsIndex END (cached)', { duration: performance.now() - loadStartTime }, 'G');
    // #endregion
    return extractsIndexCache;
  }

  // If there's already a load in progress, wait for it
  if (extractsIndexLoadPromise) {
    // #region agent log
    logDebug('extractsService.js:22', 'loadExtractsIndex WAITING for existing load', {}, 'G');
    // #endregion
    try {
      const result = await extractsIndexLoadPromise;
      // #region agent log
      logDebug('extractsService.js:22', 'loadExtractsIndex END (from wait)', { duration: performance.now() - loadStartTime }, 'G');
      // #endregion
      return result;
    } catch (error) {
      extractsIndexLoadPromise = null;
      throw error;
    }
  }

  // BASE_URL from Vite already includes trailing slash (e.g., '/' or '/FFXIV_Market/')
  const basePath = import.meta.env.BASE_URL || '/';
  // Construct path and normalize any double slashes
  const indexPath = `${basePath}data/extracts-index.json`.replace(/([^:]\/)\/+/g, '$1');

  extractsIndexLoadPromise = (async () => {
    try {
      // #region agent log
      const fetchStartTime = performance.now();
      logDebug('extractsService.js:35', 'loadExtractsIndex FETCH START', { path: indexPath }, 'G');
      // #endregion
      console.log(`[extractsService] Loading index from: ${indexPath}`);
      const response = await fetch(indexPath, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        const errorMsg = `Failed to load extracts index: HTTP ${response.status} from ${indexPath}`;
        console.error(`[extractsService] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const index = await response.json();
      extractsIndexCache = index;
      // #region agent log
      logDebug('extractsService.js:50', 'loadExtractsIndex FETCH COMPLETE', { 
        fetchDuration: performance.now() - fetchStartTime,
        chunkCount: index.chunkCount,
        totalRecords: index.totalRecords
      }, 'G');
      // #endregion
      console.log(`[extractsService] Index loaded successfully: ${index.chunkCount} chunks, ${index.totalRecords} records`);
      return index;
    } catch (error) {
      extractsIndexLoadPromise = null;
      console.error('[extractsService] Index load error:', error);
      throw error;
    }
  })();

  try {
    return await extractsIndexLoadPromise;
  } catch (error) {
    extractsIndexLoadPromise = null;
    throw error;
  }
  */
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
 * @param {number} chunkIndex - Chunk index to load
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} Chunk data (object keyed by item ID)
 */
export async function loadChunk(chunkIndex, signal = null) {
  // DISABLED - extracts.json loading removed
  // Return empty object to prevent loading
  return {};
  /* DISABLED CODE
  // #region agent log
  const { logDebug } = await import('../utils/debugLogger');
  const loadStartTime = performance.now();
  logDebug('extractsService.js:117', 'loadChunk START', { 
    chunkIndex,
    hasCache: chunkCache.has(chunkIndex),
    hasPromise: chunkLoadPromises.has(chunkIndex)
  }, 'G');
  // #endregion
  
  // Check cache first
  if (chunkCache.has(chunkIndex)) {
    // #region agent log
    logDebug('extractsService.js:119', 'loadChunk END (cached)', { 
      chunkIndex,
      duration: performance.now() - loadStartTime
    }, 'G');
    // #endregion
    return chunkCache.get(chunkIndex);
  }

  // If there's already a load in progress, wait for it
  if (chunkLoadPromises.has(chunkIndex)) {
    // #region agent log
    logDebug('extractsService.js:124', 'loadChunk WAITING for existing load', { chunkIndex }, 'G');
    // #endregion
    try {
      const result = await chunkLoadPromises.get(chunkIndex);
      // #region agent log
      logDebug('extractsService.js:124', 'loadChunk END (from wait)', { 
        chunkIndex,
        duration: performance.now() - loadStartTime
      }, 'G');
      // #endregion
      return result;
    } catch (error) {
      chunkLoadPromises.delete(chunkIndex);
      throw error;
    }
  }

  // BASE_URL from Vite already includes trailing slash (e.g., '/' or '/FFXIV_Market/')
  const basePath = import.meta.env.BASE_URL || '/';
  // Construct path and normalize any double slashes
  const chunkPath = `${basePath}data/extracts-chunk-${chunkIndex}.json`.replace(/([^:]\/)\/+/g, '$1');

  const loadPromise = (async () => {
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    // Set fetch timeout (10 seconds per chunk)
    const fetchTimeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // #region agent log
      const fetchStartTime = performance.now();
      logDebug('extractsService.js:148', 'loadChunk FETCH START', { chunkIndex, path: chunkPath }, 'G');
      // #endregion
      console.log(`[extractsService] Loading chunk ${chunkIndex} from: ${chunkPath}`);
      const response = await fetch(chunkPath, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });

      clearTimeout(fetchTimeoutId);

      if (!response.ok) {
        const errorMsg = `Failed to load chunk ${chunkIndex}: HTTP ${response.status} from ${chunkPath}`;
        console.error(`[extractsService] ${errorMsg}`);
        if (response.status === 404) {
          throw new Error(`Chunk ${chunkIndex} not found (404) - check if chunk files exist in public/data/`);
        }
        throw new Error(errorMsg);
      }

      const parseStartTime = performance.now();
      const chunk = await response.json();
      const chunkSize = Object.keys(chunk).length;
      chunkCache.set(chunkIndex, chunk);
      // #region agent log
      logDebug('extractsService.js:227', 'loadChunk FETCH COMPLETE', { 
        chunkIndex,
        fetchDuration: parseStartTime - fetchStartTime,
        parseDuration: performance.now() - parseStartTime,
        totalDuration: performance.now() - loadStartTime,
        chunkSize
      }, 'G');
      // #endregion
      console.log(`[extractsService] Chunk ${chunkIndex} loaded successfully: ${chunkSize} items`);
      return chunk;
    } catch (fetchError) {
      clearTimeout(fetchTimeoutId);
      if (fetchError.name === 'AbortError') {
        const errorMsg = `Chunk ${chunkIndex} load timeout or cancelled`;
        console.error(`[extractsService] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      console.error(`[extractsService] Chunk ${chunkIndex} load error:`, fetchError);
      throw fetchError;
    } finally {
      chunkLoadPromises.delete(chunkIndex);
    }
  })();

  chunkLoadPromises.set(chunkIndex, loadPromise);

  try {
    return await loadPromise;
  } catch (error) {
    chunkLoadPromises.delete(chunkIndex);
    throw error;
  }
}

/**
 * Load extracts data (acquisition methods for items)
 * This function is kept for backward compatibility but now uses chunked loading
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Object>} Extracts data indexed by item ID
 * @deprecated Use getItemSources() instead for better performance
 */
export async function loadExtracts(signal = null) {
  // DISABLED - extracts.json loading removed
  // Return empty object to prevent loading
  return {};
  /* DISABLED CODE
  // For backward compatibility, we need to load all chunks
  // This is inefficient but maintains API compatibility
  // Components should use getItemSources() instead
  try {
    const index = await loadExtractsIndex();
    const chunks = [];

    // Load all chunks in parallel
    const chunkPromises = [];
    for (let i = 0; i < index.chunkCount; i++) {
      chunkPromises.push(loadChunk(i, signal));
    }

    const loadedChunks = await Promise.all(chunkPromises);

    // Merge all chunks into a single object
    const extracts = {};
    loadedChunks.forEach(chunk => {
      Object.assign(extracts, chunk);
    });

    return extracts;
  } catch (error) {
    console.error('Failed to load extracts:', error);
    throw error;
  }
  */
}

/**
 * Get acquisition sources for an item by ID
 * This is the preferred method - only loads the chunk containing the item
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @returns {Promise<Array>} Array of source objects with type and data
 */
export async function getItemSources(itemId, signal = null) {
  try {
    // Load index if not cached
    const index = await loadExtractsIndex();

    // Find which chunk contains this item ID
    const chunkIndex = getChunkIndex(itemId, index);
    if (chunkIndex === null) {
      // Item ID not found in any chunk - this is normal for some items
      console.log(`[extractsService] Item ${itemId} not found in any chunk`);
      return [];
    }

    // Load the specific chunk
    const chunk = await loadChunk(chunkIndex, signal);
    const itemExtract = chunk[String(itemId)];

    if (!itemExtract || !itemExtract.sources) {
      return [];
    }

    return itemExtract.sources || [];
  } catch (error) {
    // If loading fails, log the error but return empty array to prevent UI crash
    console.error(`[extractsService] Failed to load item sources for item ${itemId}:`, error);
    console.error('[extractsService] Error details:', {
      message: error.message,
      stack: error.stack,
      baseURL: import.meta.env.BASE_URL
    });
    return [];
  }
}

/**
 * Get all chunks for searching through all items
 * Used by RelatedItems component for finding exchangeable/desynthable items
 * @param {AbortSignal} signal - Optional abort signal for cancellation
 * @param {Function} onChunkLoaded - Optional callback called when each chunk loads (chunkIndex, chunk)
 * @returns {Promise<Array<Object>>} Array of chunk objects
 */
export async function loadAllChunks(signal = null, onChunkLoaded = null) {
  // DISABLED - extracts.json loading removed
  // Return empty array to prevent loading
  return [];
  /* DISABLED CODE
  try {
    const index = await loadExtractsIndex();
    const chunkPromises = [];

    // Load all chunks in parallel, but call callback as each completes
    for (let i = 0; i < index.chunkCount; i++) {
      const chunkPromise = loadChunk(i, signal).then(chunk => {
        if (onChunkLoaded) {
          onChunkLoaded(i, chunk);
        }
        return chunk;
      });
      chunkPromises.push(chunkPromise);
    }

    return await Promise.all(chunkPromises);
  } catch (error) {
    console.error('Failed to load all chunks:', error);
    return [];
  }
  */
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
