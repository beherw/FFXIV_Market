/**
 * Supabase Data Service
 * 
 * Centralized service for loading game data from Supabase.
 * Replaces all local JSON file imports.
 * 
 * ⚠️ CRITICAL PERFORMANCE RULE: NEVER LOAD ALL ITEMS AT ONCE
 * 
 * Always use targeted queries with WHERE clauses:
 * - Use getTwItemDescriptionsByIds(itemIds) instead of getTwItemDescriptions()
 * - Use getIlvlsByIds(itemIds) instead of getIlvls()
 * - Use getRaritiesByIds(itemIds) instead of getRarities()
 * - Use getItemPatchByIds(itemIds) instead of getItemPatch()
 * - Use getMarketItemsByIds(itemIds) instead of getMarketItems()
 * 
 * Functions without "ByIds" suffix load ALL data (19,000-50,000+ items) and should
 * ONLY be used as fallbacks or when you truly need all data.
 * 
 * Example workflow:
 * 1. Search database → get item IDs
 * 2. Use those IDs to fetch only needed data with *ByIds() functions
 * 3. Never load entire tables unless absolutely necessary
 * 
 * See PERFORMANCE_GUIDELINES.md for detailed best practices.
 */

import { supabase } from './supabaseClient';

// Cache for all data tables
const dataCache = {};
const loadPromises = {};

// Cache for targeted queries (by item IDs) to prevent duplicate requests
const targetedQueryCache = {
  ilvls: {},
  rarities: {},
  item_patch: {},
  market_items: {},
  tw_item_descriptions: {},
  equipment: {},
  ui_categories: {},
  itemIdsByCategories: {},
  extracts: {},
  // ObtainMethods related caches
  tw_npcs: {},
  npcs: {},
  npcs_database_pages: {},
  tw_shops: {},
  shops: {},
  shops_by_npc: {},
  tw_instances: {},
  instances: {},
  zh_instances: {},
  tw_quests: {},
  quests: {},
  zh_quests: {},
  quests_database_pages: {},
  tw_fates: {},
  fates: {},
  zh_fates: {},
  fates_database_pages: {},
  tw_achievements: {},
  tw_achievement_descriptions: {},
  achievements: {},
  tw_places: {},
  places: {}
};
const targetedQueryPromises = {
  ilvls: {},
  rarities: {},
  item_patch: {},
  market_items: {},
  tw_item_descriptions: {},
  equipment: {},
  ui_categories: {},
  tw_recipes_by_result: {},
  tw_recipes_by_ingredient: {},
  tw_recipes_by_job_level: {},
  itemIdsByCategories: {},
  extracts: {},
  // ObtainMethods related promises
  tw_npcs: {},
  npcs: {},
  npcs_database_pages: {},
  tw_shops: {},
  shops: {},
  shops_by_npc: {},
  tw_instances: {},
  instances: {},
  zh_instances: {},
  tw_quests: {},
  quests: {},
  zh_quests: {},
  quests_database_pages: {},
  tw_fates: {},
  fates: {},
  zh_fates: {},
  fates_database_pages: {},
  tw_achievements: {},
  tw_achievement_descriptions: {},
  achievements: {},
  tw_places: {},
  places: {}
};

/**
 * Generic function to load data from Supabase table
 * 
 * ⚠️ WARNING: This function loads ALL rows from the table!
 * 
 * Only use this for:
 * - Small tables (< 1000 rows) like patch_names
 * - Fallback scenarios when targeted queries fail
 * - Initial data preloading (rare)
 * 
 * For large tables, ALWAYS use targeted *ByIds() functions instead!
 * 
 * @param {string} tableName - Name of the Supabase table
 * @param {Function} transformFn - Optional function to transform data (e.g., array to object)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<any>} - Data from Supabase
 */
async function loadTableData(tableName, transformFn = null, signal = null) {
  // Return cached data if available
  if (dataCache[tableName]) {
    console.log(`[Supabase] 📦 Using cached ${tableName} (${Array.isArray(dataCache[tableName]) ? dataCache[tableName].length : Object.keys(dataCache[tableName]).length} items)`);
    return dataCache[tableName];
  }

  // If already loading, return the existing promise
  if (loadPromises[tableName]) {
    console.log(`[Supabase] ⏳ ${tableName} already loading, waiting for existing request...`);
    return loadPromises[tableName];
  }

  // Start loading from Supabase
  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading ${tableName} from Supabase...`);
  
  // ⚠️ WARNING: Loading entire table - this should be avoided for large tables!
  const largeTables = ['tw_items', 'tw_item_descriptions', 'ilvls', 'rarities', 'item_patch', 'market_items'];
  if (largeTables.includes(tableName)) {
    console.warn(`[Supabase] ⚠️ WARNING: Loading ENTIRE table "${tableName}" (may contain 10,000+ rows)!`);
    console.warn(`[Supabase] ⚠️ Consider using targeted *ByIds() function instead (e.g., get${tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}ByIds())`);
    console.trace(`[Supabase] 🔍 Stack trace for ${tableName} full table load:`);
  }
  
  loadPromises[tableName] = (async () => {
    try {
      
      // Check if already aborted
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      
      // Supabase has a default limit of 1000 rows, so we need to paginate
      const pageSize = 1000;
      let allData = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        // Check if aborted before each request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .range(from, from + pageSize - 1);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading ${tableName} from Supabase:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += pageSize;
          // If we got fewer rows than requested, we've reached the end
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Check if aborted before transforming
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      // Transform data if transform function provided
      let result = transformFn ? transformFn(allData) : allData;
      
      // Check if aborted before caching
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      
      // Cache the result
      dataCache[tableName] = result;
      
      const loadDuration = performance.now() - loadStartTime;
      const itemCount = Array.isArray(result) ? result.length : Object.keys(result).length;
      console.log(`[Supabase] ✅ Loaded ${tableName} from Supabase (${itemCount} items) in ${loadDuration.toFixed(2)}ms`);
      
      // Warn if loading large table without WHERE clause
      if (itemCount > 1000 && !signal) {
        console.warn(`[Supabase] ⚠️ Large table ${tableName} loaded (${itemCount} items). Consider using WHERE clauses for better performance.`);
      }
      
      return result;
    } catch (error) {
      // Don't log abort errors
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error; // Re-throw abort errors
      }
      console.error(`Error loading ${tableName}:`, error);
      // Return empty fallback based on expected structure
      return transformFn ? transformFn([]) : [];
    } finally {
      // Clear the loading promise
      delete loadPromises[tableName];
    }
  })();

  return loadPromises[tableName];
}

/**
 * Transform array of objects to object with id as key
 * [{id: 1, ...}, {id: 2, ...}] → {1: {...}, 2: {...}}
 */
function arrayToObjectById(data) {
  const result = {};
  data.forEach(item => {
    const id = item.id;
    if (id !== undefined && id !== null) {
      // Remove id from the object if it's the key
      const { id: _, ...rest } = item;
      result[id] = rest;
    }
  });
  return result;
}

/**
 * Transform array of objects to object, keeping id in nested object
 * [{id: 1, tw: "name"}, ...] → {1: {tw: "name"}, ...}
 */
function arrayToObjectWithId(data) {
  const result = {};
  data.forEach(item => {
    const id = item.id;
    if (id !== undefined && id !== null) {
      result[id] = item;
    }
  });
  return result;
}

/**
 * Transform array to simple object (for simple key-value pairs)
 * [{id: 1, value: 100}, ...] → {1: 100, ...}
 */
function arrayToSimpleObject(data) {
  const result = {};
  data.forEach(item => {
    const id = item.id;
    const value = item.value;
    if (id !== undefined && id !== null) {
      // Ensure we're storing the value (ilvl), not the id
      // If value is undefined or null, skip this row (shouldn't happen for ilvls/rarities tables)
      if (value !== undefined && value !== null) {
        result[id] = value;
      } else {
        console.warn(`[Supabase] Warning: ${data.length > 0 ? 'ilvls/rarities' : 'unknown'} table row for id ${id} has null/undefined value`);
      }
    }
  });
  return result;
}

// ============================================================================
// Item Data Services
// ============================================================================

/**
 * Get Traditional Chinese item names
 * 
 * ⚠️ WARNING: This loads ALL 42,679 item names from the database!
 * 
 * DO NOT USE THIS unless you truly need all items.
 * 
 * Instead, use targeted queries:
 * - searchTwItems(searchText) - Search items by name
 * - getTwItemById(itemId) - Get single item by ID
 * 
 * @returns {Promise<Object>} - {itemId: {tw: "name"}}
 * @deprecated Use searchTwItems() or getTwItemById() instead for better performance
 */
export async function getTwItems() {
  console.warn(`[Supabase] ⚠️ getTwItems() called - this loads ALL 42,679 items!`);
  console.warn(`[Supabase] ⚠️ Use searchTwItems(searchText) or getTwItemById(itemId) instead.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('tw_items', (data) => {
    const result = {};
    data.forEach(row => {
      result[row.id] = { tw: row.tw };
    });
    return result;
  });
}

/**
 * Get a single item by ID using targeted query (efficient - doesn't load all items)
 * @param {number} itemId - Item ID
 * @returns {Promise<Object|null>} - {id, tw} or null if not found
 */
export async function getTwItemById(itemId) {
  if (!itemId || itemId <= 0) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('tw_items')
      .select('id, tw')
      .eq('id', itemId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle cases where item doesn't exist
    
    if (error) {
      // Log error but don't throw - return null for missing items
      if (error.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
        // Check for network/CORS errors
        if (error.message && error.message.includes('Failed to fetch')) {
          console.warn(`[Supabase] ⚠️ Network error fetching item ${itemId}:`, error.message);
          console.warn(`[Supabase] 💡 This might be a CORS issue or Supabase server is temporarily unavailable (502 Bad Gateway)`);
        } else {
          console.error(`[Supabase] ❌ Error fetching item ${itemId} from Supabase:`, error);
        }
      }
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    return { id: data.id, tw: data.tw };
  } catch (error) {
    // Handle network errors (CORS, 502, etc.)
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      console.warn(`[Supabase] ⚠️ Network error fetching item ${itemId}:`, error.message);
      console.warn(`[Supabase] 💡 Possible causes:`);
      console.warn(`[Supabase]   1. CORS configuration issue in Supabase dashboard`);
      console.warn(`[Supabase]   2. Supabase server temporarily unavailable (502 Bad Gateway)`);
      console.warn(`[Supabase]   3. Network connectivity issue`);
    } else {
      console.error(`[Supabase] ❌ Error fetching item ${itemId} from Supabase:`, error);
    }
    return null;
  }
}

/**
 * Get Traditional Chinese item names for specific item IDs (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of item IDs to fetch names for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: {tw: "name"}}
 */
export async function getTwItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    console.log(`[getTwItemsByIds] ⚠️ No itemIds provided, returning empty object`);
    return {};
  }

  console.log(`[getTwItemsByIds] 📥 Querying ${itemIds.length} items:`, itemIds);

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
  const batchSize = 1000;
  const result = {};
  
  for (let i = 0; i < itemIds.length; i += batchSize) {
    // Check if aborted before each batch
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const batch = itemIds.slice(i, i + batchSize);
    console.log(`[getTwItemsByIds] 🔍 Querying batch ${i / batchSize + 1} with ${batch.length} items:`, batch);
    const { data, error } = await supabase
      .from('tw_items')
      .select('id, tw')
      .in('id', batch);

    // Check if aborted after request
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    if (error) {
      console.error(`[getTwItemsByIds] ❌ Error fetching tw_items for batch:`, error);
      continue; // Continue with next batch
    }

    console.log(`[getTwItemsByIds] 📋 Batch result:`, data, `count:`, data?.length || 0);

    if (data) {
      data.forEach(row => {
        if (row.tw && row.tw.trim() !== '') {
          result[row.id] = { tw: row.tw };
        } else {
          console.warn(`[getTwItemsByIds] ⚠️ Item ${row.id} has empty or missing tw field`);
        }
      });
    }
  }

  console.log(`[getTwItemsByIds] ✅ Final result:`, result, `keys:`, Object.keys(result));
  return result;
}

/**
 * Build a search query for any language table
 * @param {string} tableName - Table name (e.g., 'tw_items', 'en_items', 'de_items')
 * @param {string} columnName - Column name (e.g., 'tw', 'en', 'de')
 * @param {Array<string>} words - Array of search words
 * @param {boolean} fuzzy - Whether to use fuzzy matching
 * @returns {Function} - Function that returns a Supabase query builder
 */
function buildSearchQuery(tableName, columnName, words, fuzzy) {
  return () => {
    let query = supabase
      .from(tableName)
      .select(`id, ${columnName}`)
      .not(columnName, 'is', null)
      .neq(columnName, '');

    // For each word, add a LIKE filter (case-insensitive)
    // Supabase chains filters with AND condition
    words.forEach(word => {
      if (fuzzy) {
        // Fuzzy matching: each character must appear in order
        // Pattern: %c1%c2%c3% matches "c1...c2...c3" in order
        const pattern = '%' + Array.from(word).join('%') + '%';
        query = query.ilike(columnName, pattern);
      } else {
        // Exact substring matching: word must appear anywhere in the name
        query = query.ilike(columnName, `%${word}%`);
      }
    });

    return query;
  };
}

/**
 * Generic search function for any language table
 * @param {string} tableName - Table name (e.g., 'tw_items', 'en_items', 'de_items')
 * @param {string} columnName - Column name (e.g., 'tw', 'en', 'de')
 * @param {string} searchText - Search text (can contain multiple words separated by spaces)
 * @param {boolean} fuzzy - Whether to use fuzzy matching (if false, uses exact substring match)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: {columnName: "name"}}
 */
async function searchLanguageItems(tableName, columnName, searchText, fuzzy = false, signal = null) {
  if (!searchText || !searchText.trim()) {
    return {};
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  const trimmedSearchText = searchText.trim();
  const hasSpaces = trimmedSearchText.includes(' ');
  const words = hasSpaces 
    ? trimmedSearchText.split(/\s+/).filter(w => w)
    : [trimmedSearchText];

  if (words.length === 0) {
    return {};
  }

  // Build query factory function
  const buildQuery = buildSearchQuery(tableName, columnName, words, fuzzy);

  // Fetch all matching rows (with pagination if needed)
  const pageSize = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    // Check if aborted before each request
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    
    // Rebuild query for each page (Supabase queries are immutable)
    const query = buildQuery();
    const { data, error } = await query.range(from, from + pageSize - 1);

    // Check if aborted after request
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    if (error) {
      console.error(`Error searching ${tableName}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Check if aborted before transforming
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Transform to same format as getTwItems
  const result = {};
  allData.forEach(row => {
    const value = row[columnName];
    if (value && value.trim() !== '') {
      result[row.id] = { [columnName]: value };
    }
  });

  return result;
}

/**
 * Search items by name using database queries (efficient - only fetches matching items)
 * @param {string} searchText - Search text (can contain multiple words separated by spaces)
 * @param {boolean} fuzzy - Whether to use fuzzy matching (if false, uses exact substring match)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: {tw: "name"}}
 */
export async function searchTwItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('tw_items', 'tw', searchText, fuzzy, signal);
}

/**
 * Search Traditional Chinese items with join to ilvl, version, and marketable status, sorted by ilvl descending
 * This function uses Supabase join to fetch item name, ilvl, version, and marketable status,
 * and sorts by ilvl descending (highest first) at the database level.
 * 
 * @param {string} searchText - Search text (can contain multiple words separated by spaces)
 * @param {boolean} fuzzy - Whether to use fuzzy matching (if false, uses exact substring match)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array>} - Array of items sorted by ilvl descending
 * 
 * Sample return format:
 * [
 *   {
 *     id: 36221,
 *     name: "精金投斧",
 *     ilvl: 665,
 *     version: 70,
 *     marketable: true
 *   },
 *   {
 *     id: 36220,
 *     name: "精金战斧",
 *     ilvl: 660,
 *     version: 70,
 *     marketable: true
 *   },
 *   {
 *     id: 12345,
 *     name: "某个物品",
 *     ilvl: null,
 *     version: 65,
 *     marketable: false
 *   }
 * ]
 */
export async function searchTwItemsWithJoin(searchText, fuzzy = false, signal = null) {
  if (!searchText || !searchText.trim()) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  const trimmedSearchText = searchText.trim();
  const hasSpaces = trimmedSearchText.includes(' ');
  const words = hasSpaces 
    ? trimmedSearchText.split(/\s+/).filter(w => w)
    : [trimmedSearchText];

  if (words.length === 0) {
    return [];
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Searching items with join (ilvl, version) sorted by ilvl DESC...`);

  try {
    // Build base query with join
    // Use left join to include items even if they don't have ilvl or version data
    let query = supabase
      .from('tw_items')
      .select(`
        id,
        tw,
        ilvls(value),
        item_patch(value)
      `)
      .not('tw', 'is', null)
      .neq('tw', '');

    // Add search filters
    words.forEach(word => {
      if (fuzzy) {
        // Fuzzy matching: each character must appear in order
        const pattern = '%' + Array.from(word).join('%') + '%';
        query = query.ilike('tw', pattern);
      } else {
        // Exact substring matching
        query = query.ilike('tw', `%${word}%`);
      }
    });

    // Order by ilvl descending (highest first)
    // Use COALESCE to handle null ilvls (put them at the end)
    // Note: Supabase may not support ordering by joined columns directly, so we'll sort in JS as fallback
    query = query.order('id', { ascending: false }); // Temporary: order by id, will sort by ilvl in JS

    // Fetch all matching rows (with pagination if needed)
    const pageSize = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      // Check if aborted before each request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      
      const { data, error } = await query.range(from, from + pageSize - 1);

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`Error searching items with join:`, error);
        // Fallback to regular search if join fails
        console.warn(`[Supabase] Falling back to regular search without join`);
        return searchLanguageItems('tw_items', 'tw', searchText, fuzzy, signal).then(result => {
          // Convert to array format
          return Object.entries(result).map(([id, data]) => ({
            id: parseInt(id, 10),
            name: data.tw,
            ilvl: null,
            version: null
          }));
        });
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Get item IDs to check marketable status
    const itemIds = allData.map(row => row.id).filter(id => id > 0);
    const marketableSet = itemIds.length > 0 
      ? await getMarketItemsByIds(itemIds, signal)
      : new Set();

    // Transform to array format: [{id, name, ilvl, version, marketable}, ...]
    // Sample return format:
    // [
    //   {
    //     id: 36221,
    //     name: "精金投斧",
    //     ilvl: 665,
    //     version: 70,
    //     marketable: true
    //   },
    //   {
    //     id: 36220,
    //     name: "精金战斧",
    //     ilvl: 660,
    //     version: 70,
    //     marketable: true
    //   },
    //   ...
    // ]
    const result = allData.map(row => ({
      id: row.id,
      name: row.tw,
      ilvl: row.ilvls && row.ilvls.length > 0 ? row.ilvls[0].value : null,
      version: row.item_patch && row.item_patch.length > 0 ? row.item_patch[0].value : null,
      marketable: marketableSet.has(row.id) || false
    }));

    // Sort by ilvl descending (highest first), then by id descending for items without ilvl
    result.sort((a, b) => {
      const aIlvl = a.ilvl;
      const bIlvl = b.ilvl;
      
      // Items with ilvl come first
      if (aIlvl !== null && bIlvl !== null) {
        return bIlvl - aIlvl; // Descending order
      }
      if (aIlvl !== null) return -1;
      if (bIlvl !== null) return 1;
      // Both null, sort by id descending
      return b.id - a.id;
    });

    const loadDuration = performance.now() - loadStartTime;
    console.log(`[Supabase] ✅ Found ${result.length} items with join (sorted by ilvl DESC) in ${loadDuration.toFixed(2)}ms`);

    return result;
  } catch (error) {
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      throw error;
    }
    console.error(`Error searching items with join:`, error);
    // Fallback: use regular search, then get ilvls and sort
    const searchResult = await searchLanguageItems('tw_items', 'tw', searchText, fuzzy, signal);
    const itemIds = Object.keys(searchResult).map(id => parseInt(id, 10));
    
    if (itemIds.length === 0) {
      return [];
    }
    
    // Get ilvls and sort
    const ilvls = await getIlvlsByIds(itemIds, signal);
    const sortedItemIds = [...itemIds].sort((a, b) => {
      const aIlvl = ilvls[a] || null;
      const bIlvl = ilvls[b] || null;
      if (aIlvl !== null && bIlvl !== null) {
        return bIlvl - aIlvl;
      }
      if (aIlvl !== null) return -1;
      if (bIlvl !== null) return 1;
      return b - a;
    });
    
    // Get patches and marketable status
    const [patches, marketableSet] = await Promise.all([
      getItemPatchByIds(sortedItemIds, signal),
      getMarketItemsByIds(sortedItemIds, signal)
    ]);
    
    return sortedItemIds.map(id => ({
      id,
      name: searchResult[id]?.tw || '',
      ilvl: ilvls[id] || null,
      version: patches[id] || null,
      marketable: marketableSet.has(id) || false
    }));
  }
}

/**
 * Search Simplified Chinese items
 */
export async function searchCnItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('cn_items', 'zh', searchText, fuzzy, signal);
}

/**
 * Search Korean items
 */
export async function searchKoItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('ko_items', 'ko', searchText, fuzzy, signal);
}

/**
 * Search English items
 */
export async function searchEnItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('en_items', 'en', searchText, fuzzy, signal);
}

/**
 * Search Japanese items
 */
export async function searchJaItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('ja_items', 'ja', searchText, fuzzy, signal);
}

/**
 * Search German items
 */
export async function searchDeItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('de_items', 'de', searchText, fuzzy, signal);
}

/**
 * Search French items
 */
export async function searchFrItems(searchText, fuzzy = false, signal = null) {
  return searchLanguageItems('fr_items', 'fr', searchText, fuzzy, signal);
}

/**
 * Get items with join to ilvl, version, and marketable status, sorted by ilvl descending
 * This function queries ilvl first, sorts item IDs by ilvl descending,
 * then fetches names, versions, and marketable status in the sorted order.
 * This ensures data is sorted at query time, not in the client.
 * 
 * @param {Array<number>} itemIds - Array of item IDs to fetch
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array>} - Array of items sorted by ilvl descending
 * 
 * Sample return format:
 * [
 *   {
 *     id: 36221,
 *     name: "精金投斧",
 *     ilvl: 665,
 *     version: 70,
 *     marketable: true
 *   },
 *   {
 *     id: 36220,
 *     name: "精金战斧",
 *     ilvl: 660,
 *     version: 70,
 *     marketable: true
 *   },
 *   {
 *     id: 12345,
 *     name: "某个物品",
 *     ilvl: null,
 *     version: 65,
 *     marketable: false
 *   }
 * ]
 */
export async function getItemsWithJoinByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading ${itemIds.length} items with join (ilvl, version) sorted by ilvl DESC...`);

  try {
    // Remove duplicates and filter invalid IDs
    const uniqueIds = [...new Set(itemIds.filter(id => id && id > 0))];
    if (uniqueIds.length === 0) {
      return [];
    }

    // Step 1: Get ilvls first and sort item IDs by ilvl descending
    const ilvls = await getIlvlsByIds(uniqueIds, signal);
    
    // Sort item IDs by ilvl descending (highest first)
    const sortedItemIds = [...uniqueIds].sort((a, b) => {
      const aIlvl = ilvls[a] || null;
      const bIlvl = ilvls[b] || null;
      
      // Items with ilvl come first
      if (aIlvl !== null && bIlvl !== null) {
        return bIlvl - aIlvl; // Descending order
      }
      if (aIlvl !== null) return -1;
      if (bIlvl !== null) return 1;
      // Both null, sort by id descending
      return b - a;
    });

    // Step 2: Fetch names, versions, and marketable status in parallel (already sorted order)
    const [names, patches, marketableSet] = await Promise.all([
      getTwItemsByIds(sortedItemIds, signal),
      getItemPatchByIds(sortedItemIds, signal),
      getMarketItemsByIds(sortedItemIds, signal)
    ]);

    // Step 3: Build result array in sorted order
    // Sample return format:
    // [
    //   {
    //     id: 36221,
    //     name: "精金投斧",
    //     ilvl: 665,
    //     version: 70,
    //     marketable: true
    //   },
    //   {
    //     id: 36220,
    //     name: "精金战斧",
    //     ilvl: 660,
    //     version: 70,
    //     marketable: true
    //   },
    //   ...
    // ]
    const result = sortedItemIds.map(id => ({
      id,
      name: names[id]?.tw || '',
      ilvl: ilvls[id] || null,
      version: patches[id] || null,
      marketable: marketableSet.has(id) || false
    }));

    const loadDuration = performance.now() - loadStartTime;
    console.log(`[Supabase] ✅ Loaded ${result.length} items with join (sorted by ilvl DESC) in ${loadDuration.toFixed(2)}ms`);

    return result;
  } catch (error) {
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      throw error;
    }
    console.error(`Error loading items with join:`, error);
    // Fallback: return empty array or try basic query
    return [];
  }
}

/**
 * Get Traditional Chinese item descriptions
 * 
 * ⚠️ WARNING: This loads ALL 19,032 item descriptions from the database!
 * 
 * DO NOT USE THIS unless you truly need all descriptions.
 * 
 * Instead, use: getTwItemDescriptionsByIds(itemIds) to load only specific items.
 * 
 * @returns {Promise<Object>} - {itemId: {tw: "description"}}
 * @deprecated Use getTwItemDescriptionsByIds() instead for better performance
 */
export async function getTwItemDescriptions() {
  // Log stack trace to identify where this is being called from (should rarely be called)
  console.warn(`[Supabase] ⚠️ getTwItemDescriptions() called - this loads ALL 19,032 descriptions!`);
  console.warn(`[Supabase] ⚠️ Use getTwItemDescriptionsByIds(itemIds) instead to load only what you need.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('tw_item_descriptions', (data) => {
    const result = {};
    data.forEach(row => {
      result[row.id] = { tw: row.tw };
    });
    return result;
  });
}

/**
 * Get Traditional Chinese item descriptions for specific item IDs (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of item IDs to fetch descriptions for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: {tw: "description"}}
 */
export async function getTwItemDescriptionsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache and filter out already-cached items
  const cacheKey = itemIds.sort((a, b) => a - b).join(',');
  const cached = targetedQueryCache.tw_item_descriptions[cacheKey];
  if (cached) {
    // Only log cache hits for multi-item queries to reduce console noise
    if (itemIds.length > 1) {
      console.log(`[Supabase] 📦 Using cached tw_item_descriptions for ${itemIds.length} items`);
    }
    return cached;
  }

  // Check if same query is already in progress
  const existingPromise = targetedQueryPromises.tw_item_descriptions[cacheKey];
  if (existingPromise) {
    // Only log for multi-item queries to reduce console noise
    if (itemIds.length > 1) {
      console.log(`[Supabase] ⏳ tw_item_descriptions for ${itemIds.length} items already loading, waiting...`);
    }
    return existingPromise;
  }

  const loadStartTime = performance.now();
  // Only log for multi-item queries to reduce console noise
  if (itemIds.length > 1) {
    console.log(`[Supabase] 📥 Loading tw_item_descriptions for ${itemIds.length} items from Supabase...`);
  }

  // Create promise and store it immediately to prevent race conditions
  const promise = (async () => {
    try {
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      const result = {};
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = itemIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('tw_item_descriptions')
          .select('id, tw')
          .in('id', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading tw_item_descriptions for items:`, error);
          throw error;
        }

        if (data) {
          data.forEach(row => {
            result[row.id] = { tw: row.tw };
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      const loadedCount = Object.keys(result).length;
      // Only log for multi-item queries to reduce console noise
      // Single-item queries are very fast and common, so we skip logging them
      if (itemIds.length > 1 && loadedCount > 0) {
        console.log(`[Supabase] ✅ Loaded tw_item_descriptions for ${loadedCount} items in ${loadDuration.toFixed(2)}ms`);
      }
      
      // Merge into the shared cache so getTwItemDescriptions() can use it
      // This prevents loading all descriptions if someone calls getTwItemDescriptions() later
      if (!dataCache['tw_item_descriptions']) {
        dataCache['tw_item_descriptions'] = {};
      }
      Object.assign(dataCache['tw_item_descriptions'], result);
      
      // Cache the result for this specific query
      targetedQueryCache.tw_item_descriptions[cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading tw_item_descriptions by IDs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.tw_item_descriptions[cacheKey];
    }
  })();

  // Store promise immediately to prevent race conditions
  // Check again in case another call stored it while we were creating this one
  const raceCheck = targetedQueryPromises.tw_item_descriptions[cacheKey];
  if (raceCheck && raceCheck !== promise) {
    // Another call beat us to it, use their promise
    return raceCheck;
  }
  
  // Store our promise
  targetedQueryPromises.tw_item_descriptions[cacheKey] = promise;
  return promise;
}

/**
 * Get marketable item IDs
 * 
 * ⚠️ WARNING: This loads ALL 16,670 marketable item IDs from the database!
 * 
 * DO NOT USE THIS unless you truly need all marketable items.
 * 
 * Instead, use: getMarketItemsByIds(itemIds) to check only specific items.
 * 
 * @returns {Promise<Array<number>>} - Array of marketable item IDs
 * @deprecated Use getMarketItemsByIds() instead for better performance
 */
export async function getMarketItems() {
  console.warn(`[Supabase] ⚠️ getMarketItems() called - this loads ALL 16,670 marketable items!`);
  console.warn(`[Supabase] ⚠️ Use getMarketItemsByIds(itemIds) instead to check only what you need.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('market_items', (data) => {
    return data.map(row => parseInt(row.id, 10)).filter(id => !isNaN(id));
  });
}

/**
 * Check which items from a list are marketable (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of item IDs to check
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Set<number>>} - Set of marketable item IDs from the provided list
 */
export async function getMarketItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return new Set();
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache and filter out already-cached items
  const cacheKey = itemIds.sort((a, b) => a - b).join(',');
  const cached = targetedQueryCache.market_items[cacheKey];
  if (cached) {
    console.log(`[Supabase] 📦 Using cached marketability check for ${itemIds.length} items`);
    return cached;
  }

  // Check if same query is already in progress
  const existingPromise = targetedQueryPromises.market_items[cacheKey];
  if (existingPromise) {
    console.log(`[Supabase] ⏳ Marketability check for ${itemIds.length} items already in progress, waiting...`);
    return existingPromise;
  }

      const loadStartTime = performance.now();
      console.log(`[Supabase] 📥 Checking marketability for ${itemIds.length} items from Supabase...`);
      console.log(`[Supabase] 📥 Sample itemIds: ${itemIds.slice(0, 10).join(', ')}${itemIds.length > 10 ? '...' : ''}`);

      // Create promise and store it
      const promise = (async () => {
        try {
          const marketableSet = new Set();
          
          // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
          const batchSize = 1000;
          
          for (let i = 0; i < itemIds.length; i += batchSize) {
            // Check if aborted before each batch
            if (signal && signal.aborted) {
              throw new DOMException('Request aborted', 'AbortError');
            }

            const batch = itemIds.slice(i, i + batchSize);
            const { data, error } = await supabase
              .from('market_items')
              .select('id')
              .in('id', batch);

            // Check if aborted after request
            if (signal && signal.aborted) {
              throw new DOMException('Request aborted', 'AbortError');
            }
            
            if (error) {
              console.error(`[Supabase] Error checking marketability for batch ${i / batchSize + 1}:`, error);
              throw error;
            }
            
            if (data && data.length > 0) {
              data.forEach(row => {
                const id = parseInt(row.id, 10);
                if (!isNaN(id)) {
                  marketableSet.add(id);
                }
              });
              console.log(`[Supabase] Batch ${i / batchSize + 1}: Found ${data.length} marketable items out of ${batch.length} checked`);
            } else {
              console.log(`[Supabase] Batch ${i / batchSize + 1}: Found 0 marketable items out of ${batch.length} checked`);
            }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Found ${marketableSet.size} marketable items out of ${itemIds.length} in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.market_items[cacheKey] = marketableSet;
      
      return marketableSet;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error checking marketability by IDs:`, error);
      return new Set();
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.market_items[cacheKey];
    }
  })();

  targetedQueryPromises.market_items[cacheKey] = promise;
  return promise;
}

/**
 * Get equipment data
 * 
 * ⚠️ WARNING: This loads ALL 24,098 equipment items from the database!
 * 
 * DO NOT USE THIS unless you truly need all equipment data.
 * 
 * Instead, use:
 * - getEquipmentByIds(itemIds) to load only specific items
 * - getEquipmentByJobs(jobAbbrs) to load equipment matching specific jobs
 * 
 * @returns {Promise<Object>} - {itemId: {equipSlotCategory, jobs, ...}}
 * @deprecated Use getEquipmentByIds() or getEquipmentByJobs() instead for better performance
 */
export async function getEquipment() {
  console.warn('[Supabase] ⚠️ Loading all equipment (24,098 items). Consider using getEquipmentByIds() or getEquipmentByJobs() for better performance.');
  console.trace('[Supabase] Full equipment table load called from:');
  return loadTableData('equipment', arrayToObjectWithId);
}

/**
 * Get equipment data for specific item IDs (targeted query - efficient)
 * @param {Array<number>} itemIds - Array of item IDs
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: {equipSlotCategory, jobs, level, ...}}
 */
export async function getEquipmentByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Remove duplicates and filter invalid IDs
  const uniqueIds = [...new Set(itemIds.filter(id => id && id > 0))];
  if (uniqueIds.length === 0) {
    return {};
  }

  // Create cache key from sorted IDs
  const cacheKey = uniqueIds.sort((a, b) => a - b).join(',');

  // Check cache first
  if (targetedQueryCache.equipment && targetedQueryCache.equipment[cacheKey]) {
    console.log(`[Supabase] 📦 Using cached equipment for ${uniqueIds.length} items`);
    return targetedQueryCache.equipment[cacheKey];
  }

  // Check if there's already a pending request for these IDs
  if (targetedQueryPromises.equipment && targetedQueryPromises.equipment[cacheKey]) {
    return targetedQueryPromises.equipment[cacheKey];
  }

  // Initialize cache if needed
  if (!targetedQueryCache.equipment) {
    targetedQueryCache.equipment = {};
  }
  if (!targetedQueryPromises.equipment) {
    targetedQueryPromises.equipment = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading equipment for ${uniqueIds.length} items from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const result = {};
      
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      
      for (let i = 0; i < uniqueIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = uniqueIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('equipment')
          .select('*')
          .in('id', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading equipment for items:`, error);
          throw error;
        }

        if (data) {
          data.forEach(row => {
            const id = row.id;
            if (id !== undefined && id !== null) {
              result[id] = row;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded equipment for ${Object.keys(result).length} items in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.equipment[cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading equipment by IDs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.equipment[cacheKey];
    }
  })();

  targetedQueryPromises.equipment[cacheKey] = promise;
  return promise;
}

/**
 * Get equipment data matching specific job abbreviations (targeted query - efficient)
 * Uses Supabase array overlap operator to find equipment where jobs array contains any of the specified job abbreviations
 * @param {Array<string>} jobAbbrs - Array of job abbreviations (e.g., ['PLD', 'WAR', 'CRP'])
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: {equipSlotCategory, jobs, level, ...}}
 */
export async function getEquipmentByJobs(jobAbbrs, signal = null) {
  if (!jobAbbrs || jobAbbrs.length === 0) {
    return {};
  }

  // Remove duplicates
  const uniqueJobAbbrs = [...new Set(jobAbbrs.filter(abbr => abbr))];
  if (uniqueJobAbbrs.length === 0) {
    return {};
  }

  // Create cache key from sorted job abbreviations
  const cacheKey = uniqueJobAbbrs.sort().join(',');

  // Check cache first
  if (targetedQueryCache.equipment && targetedQueryCache.equipment[`jobs:${cacheKey}`]) {
    console.log(`[Supabase] 📦 Using cached equipment for jobs: ${uniqueJobAbbrs.join(', ')}`);
    return targetedQueryCache.equipment[`jobs:${cacheKey}`];
  }

  // Check if there's already a pending request for these jobs
  if (targetedQueryPromises.equipment && targetedQueryPromises.equipment[`jobs:${cacheKey}`]) {
    return targetedQueryPromises.equipment[`jobs:${cacheKey}`];
  }

  // Initialize cache if needed
  if (!targetedQueryCache.equipment) {
    targetedQueryCache.equipment = {};
  }
  if (!targetedQueryPromises.equipment) {
    targetedQueryPromises.equipment = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading equipment for jobs: ${uniqueJobAbbrs.join(', ')} from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const result = {};
      
      // Query each job separately and merge results
      // This is more reliable than trying to use complex OR conditions with array contains
      // Supabase's .contains() works for single values, so we query each job and deduplicate
      for (const abbr of uniqueJobAbbrs) {
        // Check if aborted before each request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        
        // Use .filter() with 'cs' (contains) operator and JSON array syntax for JSONB
        // Format: filter('jobs', 'cs', '["DNC"]') checks if jobs JSONB array contains 'DNC'
        const { data: jobData, error: jobError } = await supabase
          .from('equipment')
          .select('*')
          .filter('jobs', 'cs', JSON.stringify([abbr]));
        
        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        
        if (jobError) {
          console.error(`Error loading equipment for job ${abbr}:`, jobError);
          // Continue with other jobs even if one fails
          continue;
        }
        
        if (jobData) {
          jobData.forEach(row => {
            const id = row.id;
            if (id !== undefined && id !== null) {
              // Merge into result (deduplication happens automatically since we use id as key)
              result[id] = row;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded equipment for ${Object.keys(result).length} items (${uniqueJobAbbrs.length} jobs) in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.equipment[`jobs:${cacheKey}`] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading equipment by jobs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.equipment[`jobs:${cacheKey}`];
    }
  })();

  targetedQueryPromises.equipment[`jobs:${cacheKey}`] = promise;
  return promise;
}

/**
 * Get item levels
 * 
 * ⚠️ WARNING: This loads ALL 50,900 item levels from the database!
 * 
 * DO NOT USE THIS unless you truly need all ilvls.
 * 
 * Instead, use: getIlvlsByIds(itemIds) to load only specific items.
 * 
 * @returns {Promise<Object>} - {itemId: ilvl}
 * @deprecated Use getIlvlsByIds() instead for better performance
 */
export async function getIlvls() {
  console.warn(`[Supabase] ⚠️ getIlvls() called - this loads ALL 50,900 ilvls!`);
  console.warn(`[Supabase] ⚠️ Use getIlvlsByIds(itemIds) instead to load only what you need.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('ilvls', arrayToSimpleObject);
}

/**
 * Get item levels for specific item IDs (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of item IDs to fetch ilvls for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: ilvl}
 */
export async function getIlvlsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache and filter out already-cached items
  const cacheKey = itemIds.sort((a, b) => a - b).join(',');
  const cached = targetedQueryCache.ilvls[cacheKey];
  if (cached) {
    console.log(`[Supabase] 📦 Using cached ilvls for ${itemIds.length} items`);
    return cached;
  }

  // Check if same query is already in progress
  const existingPromise = targetedQueryPromises.ilvls[cacheKey];
  if (existingPromise) {
    console.log(`[Supabase] ⏳ ilvls for ${itemIds.length} items already loading, waiting...`);
    return existingPromise;
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading ilvls for ${itemIds.length} items from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const result = {};
      
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = itemIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('ilvls')
          .select('id, value')
          .in('id', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading ilvls for items:`, error);
          throw error;
        }

        if (data) {
          data.forEach(row => {
            const id = row.id;
            const ilvlValue = row.value;
            if (id !== undefined && id !== null) {
              // Ensure we're storing the ilvl value, not the id
              // If value is undefined or null, skip this row (shouldn't happen for ilvls table)
              if (ilvlValue !== undefined && ilvlValue !== null) {
                // Debug: Check if value equals id (which would indicate swapped columns)
                if (ilvlValue === id && data.length > 0) {
                  console.error(`[Supabase] ERROR: ilvls table appears to have swapped columns! Row id=${id}, value=${ilvlValue} (value equals id - this is wrong!)`);
                  console.error(`[Supabase] Row data:`, row);
                }
                result[id] = ilvlValue;
              } else {
                console.warn(`[Supabase] Warning: ilvls table row for id ${id} has null/undefined value`);
              }
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded ilvls for ${Object.keys(result).length} items in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.ilvls[cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading ilvls by IDs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.ilvls[cacheKey];
    }
  })();

  targetedQueryPromises.ilvls[cacheKey] = promise;
  return promise;
}

/**
 * Get item IDs by ilvl value (reverse lookup - find items with specific ilvl)
 * @param {number} ilvlValue - The ilvl value to search for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array<number>>} - Array of item IDs with matching ilvl
 */
export async function getItemIdsByIlvl(ilvlValue, signal = null) {
  if (!ilvlValue || ilvlValue < 1) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Create cache key
  const cacheKey = `ilvl_${ilvlValue}`;
  
  // Check cache
  if (targetedQueryCache.ilvls && targetedQueryCache.ilvls[cacheKey]) {
    console.log(`[Supabase] 📦 Using cached item IDs for ilvl ${ilvlValue}`);
    return targetedQueryCache.ilvls[cacheKey];
  }

  // Check if same query is already in progress
  if (targetedQueryPromises.ilvls && targetedQueryPromises.ilvls[cacheKey]) {
    console.log(`[Supabase] ⏳ Item IDs for ilvl ${ilvlValue} already loading, waiting...`);
    return targetedQueryPromises.ilvls[cacheKey];
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Querying item IDs for ilvl ${ilvlValue} from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      // Query ilvls table where value equals the target ilvl
      const { data, error } = await supabase
        .from('ilvls')
        .select('id')
        .eq('value', ilvlValue);

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`Error querying item IDs by ilvl:`, error);
        throw error;
      }

      const itemIds = data ? data.map(row => row.id).filter(id => id !== undefined && id !== null) : [];

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Found ${itemIds.length} items with ilvl ${ilvlValue} in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result
      if (!targetedQueryCache.ilvls) {
        targetedQueryCache.ilvls = {};
      }
      targetedQueryCache.ilvls[cacheKey] = itemIds;
      
      return itemIds;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error querying item IDs by ilvl:`, error);
      return [];
    } finally {
      // Remove promise from cache
      if (targetedQueryPromises.ilvls) {
        delete targetedQueryPromises.ilvls[cacheKey];
      }
    }
  })();

  if (!targetedQueryPromises.ilvls) {
    targetedQueryPromises.ilvls = {};
  }
  targetedQueryPromises.ilvls[cacheKey] = promise;
  return promise;
}

/**
 * Get item IDs by ilvl range (targeted query - efficient)
 * @param {number} minIlvl - Minimum ilvl value
 * @param {number} maxIlvl - Maximum ilvl value
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array<number>>} - Array of item IDs with ilvl in the specified range
 */
export async function getItemIdsByIlvlRange(minIlvl, maxIlvl, signal = null) {
  if (!minIlvl || minIlvl < 1 || !maxIlvl || maxIlvl < minIlvl) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Create cache key
  const cacheKey = `ilvl_range_${minIlvl}_${maxIlvl}`;
  
  // Check cache
  if (targetedQueryCache.ilvls && targetedQueryCache.ilvls[cacheKey]) {
    console.log(`[Supabase] 📦 Using cached item IDs for ilvl range ${minIlvl}-${maxIlvl}`);
    return targetedQueryCache.ilvls[cacheKey];
  }

  // Check if same query is already in progress
  if (targetedQueryPromises.ilvls && targetedQueryPromises.ilvls[cacheKey]) {
    console.log(`[Supabase] ⏳ Item IDs for ilvl range ${minIlvl}-${maxIlvl} already loading, waiting...`);
    return targetedQueryPromises.ilvls[cacheKey];
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Querying item IDs for ilvl range ${minIlvl}-${maxIlvl} from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      // Query ilvls table where value is between minIlvl and maxIlvl
      const { data, error } = await supabase
        .from('ilvls')
        .select('id')
        .gte('value', minIlvl)
        .lte('value', maxIlvl);

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`Error querying item IDs by ilvl range:`, error);
        throw error;
      }

      const itemIds = data ? data.map(row => row.id).filter(id => id !== undefined && id !== null) : [];

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Found ${itemIds.length} items with ilvl range ${minIlvl}-${maxIlvl} in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result
      if (!targetedQueryCache.ilvls) {
        targetedQueryCache.ilvls = {};
      }
      targetedQueryCache.ilvls[cacheKey] = itemIds;
      
      return itemIds;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error querying item IDs by ilvl range:`, error);
      return [];
    } finally {
      // Remove promise from cache
      if (targetedQueryPromises.ilvls) {
        delete targetedQueryPromises.ilvls[cacheKey];
      }
    }
  })();

  if (!targetedQueryPromises.ilvls) {
    targetedQueryPromises.ilvls = {};
  }
  targetedQueryPromises.ilvls[cacheKey] = promise;
  return promise;
}

/**
 * Get the maximum ilvl value from the database
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<number|null>} - Maximum ilvl value, or null if not found
 */
export async function getMaxIlvl(signal = null) {
  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Cache key for max ilvl (should be constant)
  const cacheKey = 'max_ilvl';
  
  // Check cache
  if (targetedQueryCache.ilvls && targetedQueryCache.ilvls[cacheKey] !== undefined) {
    console.log(`[Supabase] 📦 Using cached max ilvl: ${targetedQueryCache.ilvls[cacheKey]}`);
    return targetedQueryCache.ilvls[cacheKey];
  }

  // Check if same query is already in progress
  if (targetedQueryPromises.ilvls && targetedQueryPromises.ilvls[cacheKey]) {
    console.log(`[Supabase] ⏳ Max ilvl query already in progress, waiting...`);
    return targetedQueryPromises.ilvls[cacheKey];
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Querying maximum ilvl from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      // Query ilvls table for maximum value
      const { data, error } = await supabase
        .from('ilvls')
        .select('value')
        .order('value', { ascending: false })
        .limit(1);

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`Error querying max ilvl:`, error);
        throw error;
      }

      const maxIlvl = data && data.length > 0 ? data[0].value : null;

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Found max ilvl: ${maxIlvl} in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result
      if (!targetedQueryCache.ilvls) {
        targetedQueryCache.ilvls = {};
      }
      targetedQueryCache.ilvls[cacheKey] = maxIlvl;
      
      return maxIlvl;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error querying max ilvl:`, error);
      return null;
    } finally {
      // Remove promise from cache
      if (targetedQueryPromises.ilvls) {
        delete targetedQueryPromises.ilvls[cacheKey];
      }
    }
  })();

  if (!targetedQueryPromises.ilvls) {
    targetedQueryPromises.ilvls = {};
  }
  targetedQueryPromises.ilvls[cacheKey] = promise;
  return promise;
}

/**
 * Get item rarities
 * 
 * ⚠️ WARNING: This loads ALL 50,900 item rarities from the database!
 * 
 * DO NOT USE THIS unless you truly need all rarities.
 * 
 * Instead, use: getRaritiesByIds(itemIds) to load only specific items.
 * 
 * @returns {Promise<Object>} - {itemId: rarity}
 * @deprecated Use getRaritiesByIds() instead for better performance
 */
export async function getRarities() {
  console.warn(`[Supabase] ⚠️ getRarities() called - this loads ALL 50,900 rarities!`);
  console.warn(`[Supabase] ⚠️ Use getRaritiesByIds(itemIds) instead to load only what you need.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('rarities', arrayToSimpleObject);
}

/**
 * Get item rarities for specific item IDs (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of item IDs to fetch rarities for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: rarity}
 */
export async function getRaritiesByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache
  const cacheKey = itemIds.sort((a, b) => a - b).join(',');
  const cached = targetedQueryCache.rarities[cacheKey];
  if (cached) {
    console.log(`[Supabase] 📦 Using cached rarities for ${itemIds.length} items`);
    return cached;
  }

  // Check if same query is already in progress
  const existingPromise = targetedQueryPromises.rarities[cacheKey];
  if (existingPromise) {
    console.log(`[Supabase] ⏳ rarities for ${itemIds.length} items already loading, waiting...`);
    return existingPromise;
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading rarities for ${itemIds.length} items from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const result = {};
      
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = itemIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('rarities')
          .select('id, value')
          .in('id', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading rarities for items:`, error);
          throw error;
        }

        if (data) {
          data.forEach(row => {
            const id = row.id;
            if (id !== undefined && id !== null) {
              result[id] = row.value;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded rarities for ${Object.keys(result).length} items in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.rarities[cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading rarities by IDs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.rarities[cacheKey];
    }
  })();

  targetedQueryPromises.rarities[cacheKey] = promise;
  return promise;
}

/**
 * Get item patch versions
 * 
 * ⚠️ WARNING: This loads ALL 48,455 item patch versions from the database!
 * 
 * DO NOT USE THIS unless you truly need all patch data.
 * 
 * Instead, use: getItemPatchByIds(itemIds) to load only specific items.
 * 
 * @returns {Promise<Object>} - {itemId: patchId}
 * @deprecated Use getItemPatchByIds() instead for better performance
 */
export async function getItemPatch() {
  console.warn(`[Supabase] ⚠️ getItemPatch() called - this loads ALL 48,455 patch versions!`);
  console.warn(`[Supabase] ⚠️ Use getItemPatchByIds(itemIds) instead to load only what you need.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('item_patch', arrayToSimpleObject);
}

/**
 * Get item patch versions for specific item IDs (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of item IDs to fetch patch data for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: patchId}
 */
export async function getItemPatchByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache
  const cacheKey = itemIds.sort((a, b) => a - b).join(',');
  const cached = targetedQueryCache.item_patch[cacheKey];
  if (cached) {
    console.log(`[Supabase] 📦 Using cached item_patch for ${itemIds.length} items`);
    return cached;
  }

  // Check if same query is already in progress
  const existingPromise = targetedQueryPromises.item_patch[cacheKey];
  if (existingPromise) {
    console.log(`[Supabase] ⏳ item_patch for ${itemIds.length} items already loading, waiting...`);
    return existingPromise;
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading item_patch for ${itemIds.length} items from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const result = {};
      
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = itemIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('item_patch')
          .select('id, value')
          .in('id', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading item_patch for items:`, error);
          throw error;
        }

        if (data) {
          data.forEach(row => {
            const id = row.id;
            if (id !== undefined && id !== null) {
              result[id] = row.value;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded item_patch for ${Object.keys(result).length} items in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.item_patch[cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading item_patch by IDs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.item_patch[cacheKey];
    }
  })();

  targetedQueryPromises.item_patch[cacheKey] = promise;
  return promise;
}

/**
 * Get patch names
 * @returns {Promise<Object>} - {patchId: {name, ...}}
 */
export async function getPatchNames() {
  return loadTableData('patch_names', arrayToObjectWithId);
}

// ============================================================================
// Recipe Data Services
// ============================================================================

/**
 * Get crafting recipes
 * 
 * ⚠️ WARNING: This loads ALL 11,605 recipes from the database!
 * 
 * DO NOT USE THIS unless you truly need all recipes (e.g., for searching by ingredient).
 * 
 * Instead, use: getTwRecipesByResultIds(itemIds) to load only recipes for specific items.
 * 
 * @returns {Promise<Array>} - Array of recipe objects
 * @deprecated Use getTwRecipesByResultIds() instead for better performance
 */
export async function getTwRecipes() {
  console.warn(`[Supabase] ⚠️ getTwRecipes() called - this loads ALL 11,605 recipes!`);
  console.warn(`[Supabase] ⚠️ Use getTwRecipesByResultIds(itemIds) instead to load only what you need.`);
  console.trace(`[Supabase] 🔍 Stack trace - find and replace with targeted query:`);
  return loadTableData('tw_recipes');
}

/**
 * Get crafting recipes for specific result item IDs (efficient - uses WHERE IN)
 * @param {Array<number>} itemIds - Array of result item IDs to fetch recipes for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array>} - Array of recipe objects that produce these items
 */
export async function getTwRecipesByResultIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache
  const cacheKey = itemIds.sort((a, b) => a - b).join(',');
  const cache = dataCache['tw_recipes_by_result'] || {};
  const cached = cache[cacheKey];
  if (cached) {
    return cached;
  }

  // Check if same query is already in progress
  const promiseCache = targetedQueryPromises.tw_recipes_by_result || {};
  const existingPromise = promiseCache[cacheKey];
  if (existingPromise) {
    return existingPromise;
  }

  const loadStartTime = performance.now();

  // Create promise and store it
  const promise = (async () => {
    try {
      // Supabase supports up to 1000 items in an IN clause
      const batchSize = 1000;
      const result = [];
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = itemIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('tw_recipes')
          .select('*')
          .in('result', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading tw_recipes for result items:`, error);
          throw error;
        }

        if (data) {
          result.push(...data);
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      if (result.length > 0) {
        console.log(`[Supabase] ✅ Loaded ${result.length} recipes for ${itemIds.length} items in ${loadDuration.toFixed(2)}ms`);
      }
      
      // Cache the result
      if (!dataCache['tw_recipes_by_result']) {
        dataCache['tw_recipes_by_result'] = {};
      }
      dataCache['tw_recipes_by_result'][cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading tw_recipes by result IDs:`, error);
      return [];
    } finally {
      // Remove promise from cache
      if (promiseCache[cacheKey]) {
        delete promiseCache[cacheKey];
      }
    }
  })();

  // Store promise
  if (!targetedQueryPromises.tw_recipes_by_result) {
    targetedQueryPromises.tw_recipes_by_result = {};
  }
  targetedQueryPromises.tw_recipes_by_result[cacheKey] = promise;
  return promise;
}

/**
 * Get crafting recipes that use specific item IDs as ingredients (efficient - uses JSONB query)
 * @param {number} ingredientId - The ingredient item ID to search for
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array>} - Array of recipe objects that use this item as an ingredient
 */
export async function getTwRecipesByIngredientId(ingredientId, signal = null) {
  if (!ingredientId || ingredientId <= 0) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache
  const cacheKey = `ingredient_${ingredientId}`;
  const cache = dataCache['tw_recipes_by_ingredient'] || {};
  const cached = cache[cacheKey];
  if (cached) {
    return cached;
  }

  // Check if same query is already in progress
  const promiseCache = targetedQueryPromises.tw_recipes_by_ingredient || {};
  const existingPromise = promiseCache[cacheKey];
  if (existingPromise) {
    return existingPromise;
  }

  const loadStartTime = performance.now();

  // Create promise and store it
  const promise = (async () => {
    try {
      // Query recipes where ingredients JSONB array contains an object with this id
      // Using Supabase's filter with 'cs' (contains) operator for JSONB
      // Format: ingredients @> '[{"id": ingredientId}]'
      const ingredientFilter = JSON.stringify([{ id: ingredientId }]);
      
      const { data, error } = await supabase
        .from('tw_recipes')
        .select('*')
        .filter('ingredients', 'cs', ingredientFilter);

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`Error loading tw_recipes by ingredient ID:`, error);
        // If JSONB filter doesn't work, fallback to loading all (shouldn't happen, but safety)
        console.warn(`[Supabase] ⚠️ JSONB query failed, this is unexpected. Error:`, error.message);
        return [];
      }

      const result = data || [];
      const loadDuration = performance.now() - loadStartTime;
      if (result.length > 0) {
        console.log(`[Supabase] ✅ Loaded ${result.length} recipes using ingredient ${ingredientId} in ${loadDuration.toFixed(2)}ms`);
      }
      
      // Cache the result
      if (!dataCache['tw_recipes_by_ingredient']) {
        dataCache['tw_recipes_by_ingredient'] = {};
      }
      dataCache['tw_recipes_by_ingredient'][cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading tw_recipes by ingredient ID:`, error);
      return [];
    } finally {
      // Remove promise from cache
      if (promiseCache[cacheKey]) {
        delete promiseCache[cacheKey];
      }
    }
  })();

  // Store promise
  if (!targetedQueryPromises.tw_recipes_by_ingredient) {
    targetedQueryPromises.tw_recipes_by_ingredient = {};
  }
  targetedQueryPromises.tw_recipes_by_ingredient[cacheKey] = promise;
  return promise;
}

/**
 * Get crafting recipes filtered by job and level range (efficient - uses WHERE clauses)
 * @param {Array<number>} jobs - Array of job IDs to filter by (optional, empty array = all jobs)
 * @param {number} minLevel - Minimum level (optional, default 1)
 * @param {number} maxLevel - Maximum level (optional, default 100)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array>} - Array of recipe objects matching the filters
 */
export async function getTwRecipesByJobAndLevel(jobs = [], minLevel = 1, maxLevel = 100, signal = null) {
  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Create cache key from parameters
  const cacheKey = `jobs_${jobs.sort((a, b) => a - b).join(',')}_lvl_${minLevel}_${maxLevel}`;
  const cache = dataCache['tw_recipes_by_job_level'] || {};
  const cached = cache[cacheKey];
  if (cached) {
    console.log(`[Supabase] 📦 Using cached recipes for jobs [${jobs.join(',')}] level ${minLevel}-${maxLevel} (${cached.length} recipes)`);
    return cached;
  }

  // Check if same query is already in progress
  const promiseCache = targetedQueryPromises.tw_recipes_by_job_level || {};
  const existingPromise = promiseCache[cacheKey];
  if (existingPromise) {
    console.log(`[Supabase] ⏳ Recipe query for jobs [${jobs.join(',')}] level ${minLevel}-${maxLevel} already in progress, waiting...`);
    return existingPromise;
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading recipes for jobs [${jobs.length > 0 ? jobs.join(',') : 'all'}] level ${minLevel}-${maxLevel} from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      let query = supabase
        .from('tw_recipes')
        .select('*')
        .gte('lvl', minLevel)
        .lte('lvl', maxLevel);

      // Filter by jobs if provided
      if (jobs.length > 0) {
        query = query.in('job', jobs);
      }

      // Check if aborted before request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      const { data, error } = await query;

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`Error loading tw_recipes by job and level:`, error);
        throw error;
      }

      const result = data || [];
      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded ${result.length} recipes for jobs [${jobs.length > 0 ? jobs.join(',') : 'all'}] level ${minLevel}-${maxLevel} in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result
      if (!dataCache['tw_recipes_by_job_level']) {
        dataCache['tw_recipes_by_job_level'] = {};
      }
      dataCache['tw_recipes_by_job_level'][cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading tw_recipes by job and level:`, error);
      return [];
    } finally {
      // Remove promise from cache
      if (promiseCache[cacheKey]) {
        delete promiseCache[cacheKey];
      }
    }
  })();

  // Store promise
  if (!targetedQueryPromises.tw_recipes_by_job_level) {
    targetedQueryPromises.tw_recipes_by_job_level = {};
  }
  targetedQueryPromises.tw_recipes_by_job_level[cacheKey] = promise;
  return promise;
}

// ============================================================================
// Category/UI Data Services
// ============================================================================

/**
 * Get Traditional Chinese UI category names
 * @returns {Promise<Object>} - {categoryId: {tw: "name"}}
 */
export async function getTwItemUICategories() {
  return loadTableData('tw_item_ui_categories', (data) => {
    const result = {};
    data.forEach(row => {
      result[row.id] = { tw: row.tw };
    });
    return result;
  });
}

/**
 * Get UI category data
 * 
 * ⚠️ WARNING: This loads ALL 50,900 ui_categories from the database!
 * 
 * DO NOT USE THIS unless you truly need all ui_categories data.
 * 
 * Instead, use: getUICategoriesByIds(itemIds) to load only specific items.
 * 
 * @returns {Promise<Object>} - {itemId: categoryId} (assuming id is itemId and category is categoryId)
 * @deprecated Use getUICategoriesByIds() instead for better performance
 */
export async function getUICategories() {
  console.warn('[Supabase] ⚠️ Loading all ui_categories (50,900 items). Consider using getUICategoriesByIds() for better performance.');
  console.trace('[Supabase] Full ui_categories table load called from:');
  return loadTableData('ui_categories', (data) => {
    // Transform to {itemId: categoryId} mapping
    const result = {};
    data.forEach(item => {
      const itemId = item.id;
      const categoryId = item.category;
      if (itemId !== undefined && itemId !== null) {
        result[itemId] = categoryId;
      }
    });
    return result;
  });
}

/**
 * Get UI category data for specific item IDs (targeted query - efficient)
 * Returns mapping of itemId to categoryId
 * @param {Array<number>} itemIds - Array of item IDs
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - {itemId: categoryId}
 */
export async function getUICategoriesByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Remove duplicates and filter invalid IDs
  const uniqueIds = [...new Set(itemIds.filter(id => id && id > 0))];
  if (uniqueIds.length === 0) {
    return {};
  }

  // Create cache key from sorted IDs
  const cacheKey = uniqueIds.sort((a, b) => a - b).join(',');

  // Check cache first
  if (targetedQueryCache.ui_categories && targetedQueryCache.ui_categories[cacheKey]) {
    console.log(`[Supabase] 📦 Using cached ui_categories for ${uniqueIds.length} items`);
    return targetedQueryCache.ui_categories[cacheKey];
  }

  // Check if there's already a pending request for these IDs
  if (targetedQueryPromises.ui_categories && targetedQueryPromises.ui_categories[cacheKey]) {
    return targetedQueryPromises.ui_categories[cacheKey];
  }

  // Initialize cache if needed
  if (!targetedQueryCache.ui_categories) {
    targetedQueryCache.ui_categories = {};
  }
  if (!targetedQueryPromises.ui_categories) {
    targetedQueryPromises.ui_categories = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading ui_categories for ${uniqueIds.length} items from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const result = {};
      
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      
      for (let i = 0; i < uniqueIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = uniqueIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('ui_categories')
          .select('id, category')
          .in('id', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading ui_categories for items:`, error);
          throw error;
        }

        if (data) {
          data.forEach(row => {
            const itemId = row.id;
            const categoryId = row.category;
            if (itemId !== undefined && itemId !== null) {
              result[itemId] = categoryId;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded ui_categories for ${Object.keys(result).length} items in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.ui_categories[cacheKey] = result;
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading ui_categories by IDs:`, error);
      return {};
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.ui_categories[cacheKey];
    }
  })();

  targetedQueryPromises.ui_categories[cacheKey] = promise;
  return promise;
}

/**
 * Get item IDs by UI category IDs (targeted query - efficient)
 * This allows filtering items by category without loading all items first
 * @param {Array<number>} categoryIds - Array of category IDs to filter by
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array<number>>} - Array of item IDs matching the categories
 */
export async function getItemIdsByCategories(categoryIds, signal = null) {
  if (!categoryIds || categoryIds.length === 0) {
    return [];
  }

  // Remove duplicates and filter invalid IDs
  const uniqueCategoryIds = [...new Set(categoryIds.filter(id => id && id > 0))];
  if (uniqueCategoryIds.length === 0) {
    return [];
  }

  // Create cache key from sorted category IDs
  const cacheKey = uniqueCategoryIds.sort((a, b) => a - b).join(',');

  // Check cache first
  if (targetedQueryCache.itemIdsByCategories && targetedQueryCache.itemIdsByCategories[cacheKey]) {
    console.log(`[Supabase] 📦 Using cached itemIds for categories: ${uniqueCategoryIds.join(', ')}`);
    return targetedQueryCache.itemIdsByCategories[cacheKey];
  }

  // Check if there's already a pending request for these categories
  if (targetedQueryPromises.itemIdsByCategories && targetedQueryPromises.itemIdsByCategories[cacheKey]) {
    return targetedQueryPromises.itemIdsByCategories[cacheKey];
  }

  // Initialize cache if needed
  if (!targetedQueryCache.itemIdsByCategories) {
    targetedQueryCache.itemIdsByCategories = {};
  }
  if (!targetedQueryPromises.itemIdsByCategories) {
    targetedQueryPromises.itemIdsByCategories = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Querying itemIds by categories: ${uniqueCategoryIds.join(', ')} from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      const itemIds = new Set();
      
      // Supabase supports up to 1000 items in an IN clause, so we need to batch if needed
      const batchSize = 1000;
      
      for (let i = 0; i < uniqueCategoryIds.length; i += batchSize) {
        // Check if aborted before each batch
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = uniqueCategoryIds.slice(i, i + batchSize);
        console.log(`[Supabase] Querying batch ${i / batchSize + 1}: categories ${batch.slice(0, 10).join(', ')}${batch.length > 10 ? '...' : ''}`);
        const { data, error } = await supabase
          .from('ui_categories')
          .select('id')
          .in('category', batch);

        // Check if aborted after request
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error querying itemIds by categories:`, error);
          console.error(`Error details:`, JSON.stringify(error, null, 2));
          throw error;
        }

        if (data) {
          console.log(`[Supabase] Batch ${i / batchSize + 1} returned ${data.length} items`);
          data.forEach(row => {
            const itemId = row.id;
            if (itemId !== undefined && itemId !== null) {
              itemIds.add(itemId);
            }
          });
        } else {
          console.log(`[Supabase] Batch ${i / batchSize + 1} returned no data`);
        }
      }

      const itemIdsArray = Array.from(itemIds);
      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Found ${itemIdsArray.length} items for categories ${uniqueCategoryIds.join(', ')} in ${loadDuration.toFixed(2)}ms`);
      
      // Cache the result for this specific query
      targetedQueryCache.itemIdsByCategories[cacheKey] = itemIdsArray;
      
      return itemIdsArray;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error querying itemIds by categories:`, error);
      return [];
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.itemIdsByCategories[cacheKey];
    }
  })();

  targetedQueryPromises.itemIdsByCategories[cacheKey] = promise;
  return promise;
}

/**
 * Advanced search with join queries - combines multiple filters efficiently
 * This function performs a single join query instead of multiple separate queries
 * @param {Object} filters - Filter options
 * @param {Array<string>} filters.jobAbbrs - Array of job abbreviations (e.g., ['PLD', 'WAR'])
 * @param {Array<number>} filters.categoryIds - Array of category IDs
 * @param {number} filters.minLevel - Minimum equipment level (optional)
 * @param {number} filters.maxLevel - Maximum equipment level (optional)
 * @param {number} filters.minIlvl - Minimum ilvl (optional)
 * @param {number} filters.maxIlvl - Maximum ilvl (optional)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array<number>>} - Array of item IDs matching all filters
 */
export async function advancedSearchWithJoin(filters, signal = null) {
  const { jobAbbrs = [], categoryIds = [], minLevel = 1, maxLevel = 999, minIlvl = null, maxIlvl = null } = filters;
  
  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Advanced search with join:`, { jobAbbrs, categoryIds, minLevel, maxLevel, minIlvl, maxIlvl });

  try {
    let itemIds = new Set();
    
    // STEP 1: Filter by categories (if selected)
    if (categoryIds.length > 0) {
      const categoryItemIds = await getItemIdsByCategories(categoryIds, signal);
      categoryItemIds.forEach(id => itemIds.add(id));
      console.log(`[AdvancedSearch] After category filter: ${itemIds.size} items`);
    }
    
    // STEP 2: Filter by jobs (if selected)
    if (jobAbbrs.length > 0) {
      const equipmentData = await getEquipmentByJobs(jobAbbrs, signal);
      const jobItemIds = Object.keys(equipmentData).map(id => parseInt(id, 10));
      
      if (itemIds.size > 0) {
        // Intersect with category results
        const intersection = new Set();
        itemIds.forEach(id => {
          if (jobItemIds.includes(id)) {
            intersection.add(id);
          }
        });
        itemIds = intersection;
        console.log(`[AdvancedSearch] After category + job intersection: ${itemIds.size} items`);
      } else {
        // Only jobs selected, use job results
        jobItemIds.forEach(id => itemIds.add(id));
        console.log(`[AdvancedSearch] After job filter: ${itemIds.size} items`);
      }
    }
    
    // STEP 3: Filter by ilvl range (if specified)
    if (minIlvl !== null && maxIlvl !== null && minIlvl >= 1 && maxIlvl >= minIlvl) {
      const ilvlItemIds = await getItemIdsByIlvlRange(minIlvl, maxIlvl, signal);
      const ilvlSet = new Set(ilvlItemIds);
      
      if (itemIds.size > 0) {
        // Intersect with existing results
        const intersection = new Set();
        itemIds.forEach(id => {
          if (ilvlSet.has(id)) {
            intersection.add(id);
          }
        });
        itemIds = intersection;
        console.log(`[AdvancedSearch] After ilvl filter: ${itemIds.size} items`);
      } else {
        // Only ilvl selected, use ilvl results
        ilvlItemIds.forEach(id => itemIds.add(id));
        console.log(`[AdvancedSearch] After ilvl filter: ${itemIds.size} items`);
      }
    }
    
    // STEP 4: Filter by equipment level range (if specified and not default)
    if ((minLevel > 1 || maxLevel < 999) && itemIds.size > 0) {
      const itemIdsArray = Array.from(itemIds);
      const equipmentData = await getEquipmentByIds(itemIdsArray, signal);
      const filteredByLevel = new Set();
      
      itemIds.forEach(itemId => {
        const equipment = equipmentData[itemId];
        if (!equipment || equipment.level === undefined || equipment.level === null) {
          // Include items without equipment level if range is default
          if (minLevel === 1 && maxLevel === 999) {
            filteredByLevel.add(itemId);
          }
        } else {
          // Include items within equipment level range
          if (equipment.level >= minLevel && equipment.level <= maxLevel) {
            filteredByLevel.add(itemId);
          }
        }
      });
      
      itemIds = filteredByLevel;
      console.log(`[AdvancedSearch] After equipment level filter: ${itemIds.size} items`);
    }
    
    const itemIdsArray = Array.from(itemIds);
    const loadDuration = performance.now() - loadStartTime;
    console.log(`[Supabase] ✅ Advanced search completed: ${itemIdsArray.length} items in ${loadDuration.toFixed(2)}ms`);
    
    return itemIdsArray;
  } catch (error) {
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      throw error;
    }
    console.error(`Error in advanced search:`, error);
    return [];
  }
}

/**
 * Get equipment slot category definitions
 * @returns {Promise<Object>} - {slotId: {...}}
 */
export async function getEquipSlotCategories() {
  return loadTableData('equip_slot_categories', arrayToObjectWithId);
}

// ============================================================================
// Job Data Services
// ============================================================================

/**
 * Get Traditional Chinese job abbreviations
 * @returns {Promise<Object>} - {jobId: {tw: "abbr"}}
 */
export async function getTwJobAbbr() {
  return loadTableData('tw_job_abbr', (data) => {
    const result = {};
    data.forEach(row => {
      result[row.id] = { tw: row.tw };
    });
    return result;
  });
}

// ============================================================================
// Extracts Data Services (Item Acquisition Methods)
// ============================================================================

/**
 * Get item sources (acquisition methods) for a specific item ID from Supabase
 * This is the optimized version - only queries for the specific item, never loads all data
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Array>} Array of source objects with type and data, or empty array if not found
 */
export async function getItemSourcesById(itemId, signal = null) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  const itemIdNum = parseInt(itemId, 10);
  if (isNaN(itemIdNum)) {
    return [];
  }

  // Check if already aborted
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  // Check cache first
  if (targetedQueryCache.extracts && targetedQueryCache.extracts[itemIdNum]) {
    console.log(`[Supabase] 📦 Using cached extracts for item ${itemIdNum}`);
    return targetedQueryCache.extracts[itemIdNum];
  }

  // Check if there's already a pending request for this item
  if (targetedQueryPromises.extracts && targetedQueryPromises.extracts[itemIdNum]) {
    console.log(`[Supabase] ⏳ Extracts for item ${itemIdNum} already loading, waiting...`);
    return targetedQueryPromises.extracts[itemIdNum];
  }

  // Initialize cache if needed
  if (!targetedQueryCache.extracts) {
    targetedQueryCache.extracts = {};
  }
  if (!targetedQueryPromises.extracts) {
    targetedQueryPromises.extracts = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading extracts for item ${itemIdNum} from Supabase...`);

  // Create promise and store it
  const promise = (async () => {
    try {
      // Query Supabase for this specific item ID only
      const { data, error } = await supabase
        .from('extracts')
        .select('id, sources')
        .eq('id', itemIdNum)
        .maybeSingle(); // Use maybeSingle() to handle cases where item doesn't exist

      // Check if aborted after request
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        // Log error but don't throw - return empty array for missing items
        if (error.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
          console.error(`Error fetching extracts for item ${itemIdNum} from Supabase:`, error);
        }
        return [];
      }

      if (!data || !data.sources) {
        console.log(`[Supabase] 📋 Raw database response for item ${itemIdNum}:`, JSON.stringify(data, null, 2));
        return [];
      }

      // Log raw database response
      console.log(`[Supabase] 📋 Raw database response for item ${itemIdNum}:`, JSON.stringify(data, null, 2));

      // Parse sources if it's a JSON string (from CSV import)
      let sources = data.sources;
      if (typeof sources === 'string') {
        console.log(`[Supabase] 📋 Sources is a string, parsing JSON for item ${itemIdNum}...`);
        try {
          sources = JSON.parse(sources);
        } catch (parseError) {
          console.error(`Error parsing sources JSON for item ${itemIdNum}:`, parseError);
          return [];
        }
      }

      // Ensure sources is an array
      if (!Array.isArray(sources)) {
        console.warn(`[Supabase] Sources for item ${itemIdNum} is not an array:`, typeof sources);
        console.log(`[Supabase] 📋 Sources value:`, sources);
        return [];
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded extracts for item ${itemIdNum} (${sources.length} sources) in ${loadDuration.toFixed(2)}ms`);
      console.log(`[Supabase] 📋 Parsed sources data for item ${itemIdNum}:`, JSON.stringify(sources, null, 2));

      // Cache the result
      targetedQueryCache.extracts[itemIdNum] = sources;

      return sources;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading extracts for item ${itemIdNum}:`, error);
      return [];
    } finally {
      // Remove promise from cache
      delete targetedQueryPromises.extracts[itemIdNum];
    }
  })();

  targetedQueryPromises.extracts[itemIdNum] = promise;
  return promise;
}

// ============================================================================
// ObtainMethods Data Services - Batch Query Functions
// ============================================================================

/**
 * Generic batch query function for any table
 * @param {string} tableName - Table name
 * @param {Array<number>} ids - Array of IDs to query
 * @param {string} idColumn - ID column name (default: 'id')
 * @param {AbortSignal} signal - Optional abort signal
 * @param {string} cacheKey - Cache key for this query type
 * @returns {Promise<Object>} - {id: rowData}
 */
async function batchQueryByIds(tableName, ids, idColumn = 'id', signal = null, cacheKey = null) {
  if (!ids || ids.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(ids.filter(id => id && id > 0))];
  if (uniqueIds.length === 0) {
    return {};
  }

  const sortedIds = uniqueIds.sort((a, b) => a - b);
  // CRITICAL FIX: cacheKeyStr must always be based on sortedIds, not cacheKey
  // cacheKey is used to index the cache object (e.g., 'tw_npcs'), while cacheKeyStr
  // must be unique per set of IDs to prevent cache collisions
  const cacheKeyStr = `${tableName}_${sortedIds.join(',')}`;
  const cacheIndex = cacheKey || tableName;

  // Check cache
  if (targetedQueryCache[cacheIndex] && targetedQueryCache[cacheIndex][cacheKeyStr]) {
    return targetedQueryCache[cacheIndex][cacheKeyStr];
  }

  // Check pending promises
  if (targetedQueryPromises[cacheIndex] && targetedQueryPromises[cacheIndex][cacheKeyStr]) {
    return targetedQueryPromises[cacheIndex][cacheKeyStr];
  }

  // Initialize cache if needed
  if (!targetedQueryCache[cacheIndex]) {
    targetedQueryCache[cacheIndex] = {};
  }
  if (!targetedQueryPromises[cacheIndex]) {
    targetedQueryPromises[cacheIndex] = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading ${tableName} for ${uniqueIds.length} IDs...`);

  const promise = (async () => {
    try {
      const result = {};
      const batchSize = 1000;

      for (let i = 0; i < sortedIds.length; i += batchSize) {
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = sortedIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .in(idColumn, batch);

        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading ${tableName} batch:`, error);
          continue; // Continue with next batch
        }

        if (data) {
          data.forEach(row => {
            const id = row[idColumn];
            if (id !== undefined && id !== null) {
              result[id] = row;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded ${tableName} for ${Object.keys(result).length} IDs in ${loadDuration.toFixed(2)}ms`);

      targetedQueryCache[cacheIndex][cacheKeyStr] = result;
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading ${tableName} by IDs:`, error);
      return {};
    } finally {
      delete targetedQueryPromises[cacheIndex][cacheKeyStr];
    }
  })();

  targetedQueryPromises[cacheIndex][cacheKeyStr] = promise;
  return promise;
}

// ============================================================================
// NPC Data Services
// ============================================================================

/**
 * Get Traditional Chinese NPC names for specific NPC IDs
 * @param {Array<number>} npcIds - Array of NPC IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {npcId: {tw: "name"}}
 */
export async function getTwNpcsByIds(npcIds, signal = null) {
  const result = await batchQueryByIds('tw_npcs', npcIds, 'id', signal, 'tw_npcs');
  // Transform to expected format
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get NPC data for specific NPC IDs
 * @param {Array<number>} npcIds - Array of NPC IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {npcId: {en, ja, title, position, ...}}
 */
export async function getNpcsByIds(npcIds, signal = null) {
  return batchQueryByIds('npcs', npcIds, 'id', signal, 'npcs');
}

/**
 * Get NPC database pages for specific NPC IDs
 * @param {Array<number>} npcIds - Array of NPC IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {npcId: {title, position, ...}}
 */
export async function getNpcsDatabasePagesByIds(npcIds, signal = null) {
  return batchQueryByIds('npcs_database_pages', npcIds, 'id', signal, 'npcs_database_pages');
}

// ============================================================================
// Shop Data Services
// ============================================================================

/**
 * Get Traditional Chinese shop names for specific shop IDs
 * @param {Array<number>} shopIds - Array of shop IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {shopId: {tw: "name"}}
 */
export async function getTwShopsByIds(shopIds, signal = null) {
  const result = await batchQueryByIds('tw_shops', shopIds, 'id', signal, 'tw_shops');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get shop data for specific shop IDs
 * @param {Array<number>} shopIds - Array of shop IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {shopId: {type, npcs, trades, ...}}
 */
export async function getShopsByIds(shopIds, signal = null) {
  return batchQueryByIds('shops', shopIds, 'id', signal, 'shops');
}

/**
 * Get shops by NPC IDs
 * @param {Array<number>} npcIds - Array of NPC IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {npcId: {shopId: {...}, ...}}
 */
export async function getShopsByNpcIds(npcIds, signal = null) {
  if (!npcIds || npcIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(npcIds.filter(id => id && id > 0))];
  if (uniqueIds.length === 0) {
    return {};
  }

  const sortedIds = uniqueIds.sort((a, b) => a - b);
  const cacheKeyStr = `shops_by_npc_${sortedIds.join(',')}`;

  if (targetedQueryCache.shops_by_npc && targetedQueryCache.shops_by_npc[cacheKeyStr]) {
    return targetedQueryCache.shops_by_npc[cacheKeyStr];
  }

  if (!targetedQueryCache.shops_by_npc) {
    targetedQueryCache.shops_by_npc = {};
  }
  if (!targetedQueryPromises.shops_by_npc) {
    targetedQueryPromises.shops_by_npc = {};
  }

  const loadStartTime = performance.now();
  console.log(`[Supabase] 📥 Loading shops_by_npc for ${uniqueIds.length} NPC IDs...`);

  const promise = (async () => {
    try {
      const result = {};
      const batchSize = 1000;

      for (let i = 0; i < sortedIds.length; i += batchSize) {
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        const batch = sortedIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('shops_by_npc')
          .select('*')
          .in('id', batch); // shops_by_npc uses 'id' column for NPC ID

        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }

        if (error) {
          console.error(`Error loading shops_by_npc batch:`, error);
          continue;
        }

        if (data) {
          data.forEach(row => {
            const npcId = row.id;
            if (npcId !== undefined && npcId !== null) {
              // Parse shops data if it's JSON string
              let shops = row.shops || row;
              if (typeof shops === 'string') {
                try {
                  shops = JSON.parse(shops);
                } catch (e) {
                  shops = {};
                }
              }
              result[npcId] = shops;
            }
          });
        }
      }

      const loadDuration = performance.now() - loadStartTime;
      console.log(`[Supabase] ✅ Loaded shops_by_npc for ${Object.keys(result).length} NPCs in ${loadDuration.toFixed(2)}ms`);

      targetedQueryCache.shops_by_npc[cacheKeyStr] = result;
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading shops_by_npc by NPC IDs:`, error);
      return {};
    } finally {
      delete targetedQueryPromises.shops_by_npc[cacheKeyStr];
    }
  })();

  targetedQueryPromises.shops_by_npc[cacheKeyStr] = promise;
  return promise;
}

// ============================================================================
// Instance Data Services
// ============================================================================

/**
 * Get Traditional Chinese instance names for specific instance IDs
 * @param {Array<number>} instanceIds - Array of instance IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {instanceId: {tw: "name"}}
 */
export async function getTwInstancesByIds(instanceIds, signal = null) {
  const result = await batchQueryByIds('tw_instances', instanceIds, 'id', signal, 'tw_instances');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get instance data for specific instance IDs
 * @param {Array<number>} instanceIds - Array of instance IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {instanceId: {en, ja, icon, ...}}
 */
export async function getInstancesByIds(instanceIds, signal = null) {
  return batchQueryByIds('instances', instanceIds, 'id', signal, 'instances');
}

/**
 * Get Simplified Chinese instance names for specific instance IDs
 * @param {Array<number>} instanceIds - Array of instance IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {instanceId: {zh: "name"}}
 */
export async function getZhInstancesByIds(instanceIds, signal = null) {
  const result = await batchQueryByIds('zh_instances', instanceIds, 'id', signal, 'zh_instances');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { zh: row.zh };
  });
  return transformed;
}

// ============================================================================
// Quest Data Services
// ============================================================================

/**
 * Get Traditional Chinese quest names for specific quest IDs
 * @param {Array<number>} questIds - Array of quest IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {questId: {tw: "name"}}
 */
export async function getTwQuestsByIds(questIds, signal = null) {
  const result = await batchQueryByIds('tw_quests', questIds, 'id', signal, 'tw_quests');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get quest data for specific quest IDs
 * @param {Array<number>} questIds - Array of quest IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {questId: {name, icon, rewards, ...}}
 */
export async function getQuestsByIds(questIds, signal = null) {
  return batchQueryByIds('quests', questIds, 'id', signal, 'quests');
}

/**
 * Get Simplified Chinese quest names for specific quest IDs
 * @param {Array<number>} questIds - Array of quest IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {questId: {zh: "name"}}
 */
export async function getZhQuestsByIds(questIds, signal = null) {
  const result = await batchQueryByIds('zh_quests', questIds, 'id', signal, 'zh_quests');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { zh: row.zh };
  });
  return transformed;
}

/**
 * Get quest database pages for specific quest IDs
 * @param {Array<number>} questIds - Array of quest IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {questId: {title, ...}}
 */
export async function getQuestsDatabasePagesByIds(questIds, signal = null) {
  return batchQueryByIds('quests_database_pages', questIds, 'id', signal, 'quests_database_pages');
}

// ============================================================================
// FATE Data Services
// ============================================================================

/**
 * Get Traditional Chinese FATE names for specific FATE IDs
 * @param {Array<number>} fateIds - Array of FATE IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {fateId: {name: {tw: "name"}, description: {tw: "..."}, icon}}
 */
export async function getTwFatesByIds(fateIds, signal = null) {
  return batchQueryByIds('tw_fates', fateIds, 'id', signal, 'tw_fates');
}

/**
 * Get FATE data for specific FATE IDs
 * @param {Array<number>} fateIds - Array of FATE IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {fateId: {name, description, level, location, ...}}
 */
export async function getFatesByIds(fateIds, signal = null) {
  return batchQueryByIds('fates', fateIds, 'id', signal, 'fates');
}

/**
 * Get Simplified Chinese FATE names for specific FATE IDs
 * @param {Array<number>} fateIds - Array of FATE IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {fateId: {zh: "name"}}
 */
export async function getZhFatesByIds(fateIds, signal = null) {
  const result = await batchQueryByIds('zh_fates', fateIds, 'id', signal, 'zh_fates');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    // zh_fates table structure: { name: { zh: "..." } }
    transformed[id] = { 
      zh: row.name?.zh || row.zh || null,
      name: row.name || { zh: row.zh || null }
    };
  });
  return transformed;
}

/**
 * Get FATE database pages for specific FATE IDs
 * @param {Array<number>} fateIds - Array of FATE IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {fateId: {lvl, zoneid, x, y, map, ...}}
 */
export async function getFatesDatabasePagesByIds(fateIds, signal = null) {
  return batchQueryByIds('fates_database_pages', fateIds, 'id', signal, 'fates_database_pages');
}

// ============================================================================
// Achievement Data Services
// ============================================================================

/**
 * Get Traditional Chinese achievement names for specific achievement IDs
 * @param {Array<number>} achievementIds - Array of achievement IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {achievementId: {tw: "name"}}
 */
export async function getTwAchievementsByIds(achievementIds, signal = null) {
  const result = await batchQueryByIds('tw_achievements', achievementIds, 'id', signal, 'tw_achievements');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get Traditional Chinese achievement descriptions for specific achievement IDs
 * @param {Array<number>} achievementIds - Array of achievement IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {achievementId: {tw: "description"}}
 */
export async function getTwAchievementDescriptionsByIds(achievementIds, signal = null) {
  const result = await batchQueryByIds('tw_achievement_descriptions', achievementIds, 'id', signal, 'tw_achievement_descriptions');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get achievement data for specific achievement IDs
 * @param {Array<number>} achievementIds - Array of achievement IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {achievementId: {en, ja, icon, itemReward, ...}}
 */
export async function getAchievementsByIds(achievementIds, signal = null) {
  return batchQueryByIds('achievements', achievementIds, 'id', signal, 'achievements');
}

// ============================================================================
// Place/Zone Data Services
// ============================================================================

/**
 * Get Traditional Chinese place/zone names for specific zone IDs
 * @param {Array<number>} zoneIds - Array of zone IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {zoneId: {tw: "name"}}
 */
export async function getTwPlacesByIds(zoneIds, signal = null) {
  const result = await batchQueryByIds('tw_places', zoneIds, 'id', signal, 'tw_places');
  const transformed = {};
  Object.entries(result).forEach(([id, row]) => {
    transformed[id] = { tw: row.tw };
  });
  return transformed;
}

/**
 * Get place/zone data for specific zone IDs
 * @param {Array<number>} zoneIds - Array of zone IDs
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - {zoneId: {en, ja, ...}}
 */
export async function getPlacesByIds(zoneIds, signal = null) {
  return batchQueryByIds('places', zoneIds, 'id', signal, 'places');
}

// ============================================================================
// Special Sources Data Services
// ============================================================================

/**
 * Get FATE sources for a specific item ID
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Array<number>>} - Array of FATE IDs
 */
export async function getFateSourcesByItemId(itemId, signal = null) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  const itemIdNum = parseInt(itemId, 10);
  if (isNaN(itemIdNum)) {
    return [];
  }

  const cacheKey = `fate_sources_${itemIdNum}`;
  if (targetedQueryCache.fate_sources && targetedQueryCache.fate_sources[cacheKey]) {
    console.log(`[Supabase] 📦 Using cached fate_sources for item ${itemIdNum}:`, targetedQueryCache.fate_sources[cacheKey]);
    return targetedQueryCache.fate_sources[cacheKey];
  }

  if (!targetedQueryCache.fate_sources) {
    targetedQueryCache.fate_sources = {};
  }
  if (!targetedQueryPromises.fate_sources) {
    targetedQueryPromises.fate_sources = {};
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('fate_sources')
        .select('*')
        .eq('id', itemIdNum)
        .maybeSingle();

      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error) {
        console.error(`[Supabase] Error loading fate_sources for item ${itemIdNum}:`, error);
        return [];
      }

      if (!data) {
        console.log(`[Supabase] No fate_sources data found for item ${itemIdNum}`);
        return [];
      }

      console.log(`[Supabase] Raw fate_sources data for item ${itemIdNum}:`, data);
      console.log(`[Supabase] Data keys:`, Object.keys(data));

      // Parse sources - fate_sources table structure: { '0': fateId1, '1': fateId2, ..., id: itemId }
      let sources = [];
      
      // Try to get from sources or fates field first
      if (data.sources) {
        sources = data.sources;
        console.log(`[Supabase] Found sources field:`, sources);
      } else if (data.fates) {
        sources = data.fates;
        console.log(`[Supabase] Found fates field:`, sources);
      } else {
        // Extract FATE IDs from object keys (excluding 'id' key)
        const numericKeys = Object.keys(data).filter(key => key !== 'id' && !isNaN(parseInt(key, 10)));
        console.log(`[Supabase] Extracting from numeric keys:`, numericKeys);
        sources = numericKeys.map(key => {
          const fateId = data[key];
          const parsedId = typeof fateId === 'number' ? fateId : parseInt(fateId, 10);
          console.log(`[Supabase] Key ${key} -> FATE ID:`, fateId, 'parsed:', parsedId);
          return parsedId;
        }).filter(id => !isNaN(id) && id > 0);
        console.log(`[Supabase] Extracted FATE IDs:`, sources);
      }
      
      // Handle string format
      if (typeof sources === 'string') {
        try {
          sources = JSON.parse(sources);
        } catch (e) {
          console.error(`[Supabase] Failed to parse sources string:`, e);
          sources = [];
        }
      }

      // Ensure it's an array
      if (!Array.isArray(sources)) {
        console.warn(`[Supabase] Sources is not an array:`, typeof sources, sources);
        sources = [];
      }

      console.log(`[Supabase] Final FATE sources for item ${itemIdNum}:`, sources);
      targetedQueryCache.fate_sources[cacheKey] = sources;
      return sources;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading fate_sources for item ${itemIdNum}:`, error);
      return [];
    } finally {
      delete targetedQueryPromises.fate_sources[cacheKey];
    }
  })();

  targetedQueryPromises.fate_sources[cacheKey] = promise;
  return promise;
}

/**
 * Get loot sources for a specific item ID
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Array<number>>} - Array of container/item IDs
 */
export async function getLootSourcesByItemId(itemId, signal = null) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  const itemIdNum = parseInt(itemId, 10);
  if (isNaN(itemIdNum)) {
    return [];
  }

  const cacheKey = `loot_sources_${itemIdNum}`;
  if (targetedQueryCache.loot_sources && targetedQueryCache.loot_sources[cacheKey]) {
    return targetedQueryCache.loot_sources[cacheKey];
  }

  if (!targetedQueryCache.loot_sources) {
    targetedQueryCache.loot_sources = {};
  }
  if (!targetedQueryPromises.loot_sources) {
    targetedQueryPromises.loot_sources = {};
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('loot_sources')
        .select('*')
        .eq('id', itemIdNum)
        .maybeSingle();

      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error || !data) {
        return [];
      }

      // Parse sources if it's JSON string
      let sources = data.sources || data.items || [];
      if (typeof sources === 'string') {
        try {
          sources = JSON.parse(sources);
        } catch (e) {
          sources = [];
        }
      }

      if (!Array.isArray(sources)) {
        sources = [];
      }

      targetedQueryCache.loot_sources[cacheKey] = sources;
      return sources;
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error(`Error loading loot_sources for item ${itemIdNum}:`, error);
      return [];
    } finally {
      delete targetedQueryPromises.loot_sources[cacheKey];
    }
  })();

  targetedQueryPromises.loot_sources[cacheKey] = promise;
  return promise;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all cached data (useful for testing or forced refresh)
 * 
 * ⚠️ NOTE: After clearing cache, make sure to use targeted queries (*ByIds functions)
 * instead of loading all data again.
 */
export function clearCache() {
  Object.keys(dataCache).forEach(key => delete dataCache[key]);
  Object.keys(loadPromises).forEach(key => delete loadPromises[key]);
  // Also clear targeted query caches
  Object.keys(targetedQueryCache).forEach(table => {
    Object.keys(targetedQueryCache[table]).forEach(key => delete targetedQueryCache[table][key]);
  });
  Object.keys(targetedQueryPromises).forEach(table => {
    Object.keys(targetedQueryPromises[table]).forEach(key => delete targetedQueryPromises[table][key]);
  });
}

/**
 * Preload all data tables (useful for initial app load)
 * 
 * ⚠️ WARNING: This loads ALL data from ALL tables (100,000+ items)!
 * 
 * DO NOT USE THIS in production - it will severely impact performance.
 * 
 * Only use for:
 * - Development/testing
 * - Offline mode preparation
 * - One-time data migration
 * 
 * For normal operations, load data on-demand using targeted queries.
 * 
 * @deprecated Do not use in production - loads too much data at once
 */
export async function preloadAllData() {
  console.error(`[Supabase] ❌ CRITICAL: preloadAllData() called - this loads ALL data (100,000+ items)!`);
  console.error(`[Supabase] ❌ This should NOT be used in production. Load data on-demand instead.`);
  console.trace(`[Supabase] 🔍 Stack trace - remove this call:`);
  
  const tables = [
    getTwItems(),
    getTwItemDescriptions(),
    getMarketItems(),
    getEquipment(),
    getIlvls(),
    getRarities(),
    getItemPatch(),
    getPatchNames(),
    getTwRecipes(),
    getTwItemUICategories(),
    getUICategories(),
    getEquipSlotCategories(),
    getTwJobAbbr(),
  ];
  
  await Promise.allSettled(tables);
  console.log('All data preloaded from Supabase');
}
