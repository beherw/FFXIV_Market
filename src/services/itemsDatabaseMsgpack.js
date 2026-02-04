/**
 * Items MessagePack Database Service
 * 
 * Loads tw_items and equipment data from MessagePack binary format.
 * Replaces Supabase queries for these tables.
 * 
 * Benefits:
 * - No database queries needed
 * - Instant in-memory lookups
 * - Offline support
 * - Reduced bundle size vs JSON
 */

import { decode } from '@msgpack/msgpack';

let dataCache = null;
let indexCache = null;
let isLoading = false;
let loadPromise = null;

/**
 * Load items database from MessagePack binary file
 */
export async function loadItemsDatabase() {
  // Return cached data if available
  if (dataCache && indexCache) {
    return { data: dataCache, index: indexCache };
  }

  // If already loading, wait for existing load
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  loadPromise = (async () => {
    try {
      const loadStartTime = performance.now();
      
      // Fetch MessagePack binary file (use BASE_URL for GitHub Pages)
      console.log('[Items] 📦 Loading from MessagePack...');
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}data/items.msgpack`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      // Get binary data
      const arrayBuffer = await response.arrayBuffer();
      const fetchTime = performance.now() - loadStartTime;
      console.log(`[Items] ✓ Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB in ${fetchTime.toFixed(2)}ms`);
      
      // Decode MessagePack
      const decodeStartTime = performance.now();
      dataCache = decode(new Uint8Array(arrayBuffer));
      const decodeTime = performance.now() - decodeStartTime;
      console.log(`[Items] ✓ Decoded in ${decodeTime.toFixed(2)}ms`);
      
      // Build indexes for fast lookups
      const indexStartTime = performance.now();
      indexCache = buildIndexes(dataCache);
      const indexTime = performance.now() - indexStartTime;
      console.log(`[Items] ✓ Built indexes in ${indexTime.toFixed(2)}ms`);
      
      const totalTime = performance.now() - loadStartTime;
      console.log(`[Items] ✅ Total load time: ${totalTime.toFixed(2)}ms`);

      isLoading = false;
      return { data: dataCache, index: indexCache };
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      console.error('[Items] ❌ Failed to load:', error);
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Build indexes for fast lookups
 */
function buildIndexes(data) {
  const indexes = {};
  
  // tw_items is already indexed by key (itemId)
  indexes.twItems = data.tw_items || {};
  
  // equipment is already indexed by key (itemId)
  indexes.equipment = data.equipment || {};
  
  // Build reverse index for searching
  // (Can be optimized further if needed)
  
  return indexes;
}

/**
 * Get Traditional Chinese item name by ID
 * @param {number|string} itemId - Item ID
 * @returns {Promise<string|null>} - Traditional Chinese name or null
 */
export async function getTwItemById(itemId) {
  const { index } = await loadItemsDatabase();
  const item = index.twItems[itemId];
  return item?.tw || null;
}

/**
 * Get Traditional Chinese item names by IDs
 * @param {Array<number|string>} itemIds - Array of item IDs
 * @returns {Promise<Object>} - Object mapping itemId to { tw: "name" }
 */
export async function getTwItemsByIds(itemIds) {
  const { index } = await loadItemsDatabase();
  const result = {};
  
  itemIds.forEach(id => {
    const item = index.twItems[id];
    if (item) {
      result[id] = item;
    }
  });
  
  return result;
}

/**
 * Get all Traditional Chinese items (for backward compatibility)
 * @returns {Promise<Object>} - Object mapping itemId to { tw: "name" }
 */
export async function getTwItems() {
  const { index } = await loadItemsDatabase();
  return index.twItems;
}

/**
 * Search Traditional Chinese items by name
 * @param {string} searchText - Search text
 * @param {boolean} fuzzy - Whether to use fuzzy matching (default: false)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - Object mapping itemId to { tw: "name" } for matches
 */
export async function searchTwItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') {
    return {};
  }
  
  // Check if aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  
  const { index } = await loadItemsDatabase();
  const result = {};
  
  const trimmedSearchText = searchText.trim();
  const hasSpaces = trimmedSearchText.includes(' ');
  const words = hasSpaces 
    ? trimmedSearchText.split(/\s+/).filter(w => w)
    : [trimmedSearchText];
  
  if (words.length === 0) {
    return {};
  }
  
  Object.entries(index.twItems).forEach(([itemId, item]) => {
    if (!item.tw || item.tw.trim() === '') {
      return;
    }
    
    const itemName = item.tw.toLowerCase();
    let matches = false;
    
    if (fuzzy && hasSpaces) {
      // Fuzzy matching: each character must appear in order
      matches = words.every(word => {
        const wordLower = word.toLowerCase();
        const pattern = Array.from(wordLower).join('.*?');
        const regex = new RegExp(pattern);
        return regex.test(itemName);
      });
    } else {
      // Exact substring matching: all words must appear as substrings
      matches = words.every(word => itemName.includes(word.toLowerCase()));
    }
    
    if (matches) {
      result[parseInt(itemId, 10)] = { tw: item.tw };
    }
  });
  
  return result;
}

/**
 * Get equipment data by ID
 * @param {number|string} itemId - Item ID
 * @returns {Promise<Object|null>} - Equipment data or null
 */
export async function getEquipmentById(itemId) {
  const { index } = await loadItemsDatabase();
  return index.equipment[itemId] || null;
}

/**
 * Get equipment data by IDs
 * @param {Array<number|string>} itemIds - Array of item IDs
 * @returns {Promise<Object>} - Object mapping itemId to equipment data
 */
export async function getEquipmentByIds(itemIds) {
  const { index } = await loadItemsDatabase();
  const result = {};
  
  itemIds.forEach(id => {
    const equipment = index.equipment[id];
    if (equipment) {
      result[id] = equipment;
    }
  });
  
  return result;
}

/**
 * Get all equipment data (for backward compatibility)
 * @returns {Promise<Object>} - Object mapping itemId to equipment data
 */
export async function getEquipment() {
  const { index } = await loadItemsDatabase();
  return index.equipment;
}

/**
 * Check if item is equipment
 * @param {number|string} itemId - Item ID
 * @returns {Promise<boolean>} - True if item is equipment
 */
export async function isEquipment(itemId) {
  const { index } = await loadItemsDatabase();
  return itemId in index.equipment;
}

/**
 * Get equipment by jobs (filter in-memory)
 * @param {Array<string>} jobAbbrs - Array of job abbreviations (e.g., ['PLD', 'WAR'])
 * @returns {Promise<Object>} - Object mapping itemId to equipment data
 */
export async function getEquipmentByJobs(jobAbbrs) {
  if (!jobAbbrs || jobAbbrs.length === 0) {
    return {};
  }

  const { index } = await loadItemsDatabase();
  const result = {};
  
  Object.entries(index.equipment).forEach(([itemId, equipment]) => {
    if (equipment.jobs && Array.isArray(equipment.jobs)) {
      // Check if any of the job abbrs matches
      const hasJob = jobAbbrs.some(abbr => equipment.jobs.includes(abbr));
      if (hasJob) {
        result[itemId] = equipment;
      }
    }
  });
  
  return result;
}

/**
 * Get equipment by slot categories (filter in-memory)
 * @param {Array<number>} slotCategories - Array of equipSlotCategory IDs
 * @returns {Promise<Object>} - Object mapping itemId to equipment data
 */
export async function getEquipmentBySlotCategories(slotCategories) {
  if (!slotCategories || slotCategories.length === 0) {
    return {};
  }

  const { index } = await loadItemsDatabase();
  const result = {};
  
  Object.entries(index.equipment).forEach(([itemId, equipment]) => {
    if (equipment.equipSlotCategory && slotCategories.includes(equipment.equipSlotCategory)) {
      result[itemId] = equipment;
    }
  });
  
  return result;
}

/**
 * Get equipment by level and jobs (filter in-memory)
 * Exact match on both level and jobs array (for equipment set queries)
 * @param {number} level - Equipment level
 * @param {Array<string>} jobsArray - Array of job abbreviations (must match exactly)
 * @returns {Promise<Object>} - Object mapping itemId to equipment data
 */
export async function getEquipmentByLevelAndJobs(level, jobsArray) {
  if (level == null || level < 0 || !jobsArray || !Array.isArray(jobsArray) || jobsArray.length === 0) {
    return {};
  }

  const { index } = await loadItemsDatabase();
  const result = {};
  const jobsKey = [...jobsArray].sort().join(',');
  
  Object.entries(index.equipment).forEach(([itemId, equipment]) => {
    // Match level exactly
    if (equipment.level !== level) {
      return;
    }
    
    // Match jobs array exactly (sorted comparison)
    const rowJobs = equipment.jobs || equipment.job_abbrs || [];
    const rowJobsKey = Array.isArray(rowJobs) ? [...rowJobs].sort().join(',') : '';
    
    if (rowJobsKey === jobsKey) {
      result[itemId] = equipment;
    }
  });
  
  return result;
}

/**
 * Get equipment by jobs and slot categories (filter in-memory)
 * @param {Array<string>} jobAbbrs - Array of job abbreviations
 * @param {Array<number>} slotCategories - Array of equipSlotCategory IDs
 * @returns {Promise<Object>} - Object mapping itemId to equipment data
 */
export async function getEquipmentByJobsAndSlotCategories(jobAbbrs, slotCategories) {
  if ((!jobAbbrs || jobAbbrs.length === 0) && (!slotCategories || slotCategories.length === 0)) {
    return {};
  }

  const { index } = await loadItemsDatabase();
  const result = {};
  
  Object.entries(index.equipment).forEach(([itemId, equipment]) => {
    let matchesJobs = true;
    let matchesSlots = true;
    
    // Check jobs
    if (jobAbbrs && jobAbbrs.length > 0) {
      if (equipment.jobs && Array.isArray(equipment.jobs)) {
        matchesJobs = jobAbbrs.some(abbr => equipment.jobs.includes(abbr));
      } else {
        matchesJobs = false;
      }
    }
    
    // Check slots
    if (slotCategories && slotCategories.length > 0) {
      matchesSlots = equipment.equipSlotCategory && slotCategories.includes(equipment.equipSlotCategory);
    }
    
    if (matchesJobs && matchesSlots) {
      result[itemId] = equipment;
    }
  });
  
  return result;
}
