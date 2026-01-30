/**
 * Item Database Service
 * 
 * ⚠️ CRITICAL PERFORMANCE RULE: NEVER LOAD ALL ITEMS AT ONCE
 * 
 * Always use targeted queries:
 * - searchTwItems(searchText) - Search by name (returns only matches)
 * - getTwItemById(itemId) - Get single item
 * - getTwItemDescriptionsByIds(itemIds) - Get specific descriptions
 * 
 * NEVER use:
 * - loadItemDatabase() - Loads ALL 42,679 items (only for fuzzy search fallback)
 * - getTwItemDescriptions() - Loads ALL 19,032 descriptions
 * 
 * Workflow:
 * 1. Search database → get item IDs
 * 2. Use those IDs to fetch only needed data
 * 3. Never load entire tables
 */

import { convertSimplifiedToTraditional, convertTraditionalToSimplified, isTraditionalChinese, containsChinese } from '../utils/chineseConverter';
import { getTwItems, getTwItemDescriptions, searchTwItems, searchCnItems, searchKoItems, searchEnItems, searchJaItems, searchDeItems, searchFrItems } from './supabaseData';

let itemsDatabase = null;
let shopItemsDatabase = null;
let isLoading = false;
let twItemDescriptionsCache = null;

// Cache for Simplified Chinese names from CSV
const simplifiedNameCache = new Map();
let simplifiedItemsDatabase = null;
let isLoadingSimplified = false;
let simplifiedItemsAbortController = null;

/**
 * Load Simplified Chinese items database from CSV (same as old method)
 * Uses the same CSV source: https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Item.csv
 */
async function loadSimplifiedItemDatabase(signal = null) {
  if (simplifiedItemsDatabase) {
    return simplifiedItemsDatabase;
  }

  if (isLoadingSimplified) {
    // Wait for existing load to complete
    while (isLoadingSimplified) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return simplifiedItemsDatabase;
  }

  isLoadingSimplified = true;

  try {
    // Cancel previous request if exists and no signal provided
    if (!signal && simplifiedItemsAbortController) {
      simplifiedItemsAbortController.abort();
    }
    
    // Use provided signal or create new abort controller
    let abortController;
    let fetchSignal;
    if (signal) {
      // Use provided signal
      fetchSignal = signal;
    } else {
      // Create new abort controller
      abortController = new AbortController();
      simplifiedItemsAbortController = abortController;
      fetchSignal = abortController.signal;
    }

    // Fetch CSV from the same source as old method
    const response = await fetch(
      'https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Item.csv',
      { signal: fetchSignal }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    
    // Parse CSV using the same method as old code
    const lineend0 = text.indexOf('\n'); // key,0,1 ...
    const lineend1 = text.indexOf('\n', lineend0 + 1); // #, Name, ...
    const lineend2 = text.indexOf('\n', lineend1 + 1); // int,str, ...
    const lineend3 = text.indexOf('\n', lineend2 + 1); // 0, '', ...
    
    const idxes = text.slice(0, lineend0).split(',');
    const labels = text.slice(lineend0 + 1, lineend1).split(',');
    
    // Parse CSV rows
    const dataLines = text.slice(lineend3 + 1).split('\n').filter(line => line.trim());
    
    const items = dataLines.map(line => {
      // Handle CSV with quoted values that may contain commas
      const values = parseCSVLine(line);
      const obj = {};
      idxes.forEach((idx, i) => {
        if (i < labels.length) {
          const key = `${idx}: ${labels[i]}`;
          obj[key] = (i < values.length && values[i] !== undefined) ? values[i] : '';
        }
      });
      return obj;
    }).filter(obj => Object.keys(obj).length > 0);

    simplifiedItemsDatabase = items;
    isLoadingSimplified = false;
    if (!signal) {
      simplifiedItemsAbortController = null;
    }
    return simplifiedItemsDatabase;
  } catch (error) {
    isLoadingSimplified = false;
    if (!signal) {
      simplifiedItemsAbortController = null;
    }
    if (error.name === 'AbortError') {
      // Request was cancelled, return null
      return null;
    }
    console.error('Failed to load Simplified Chinese item database:', error);
    throw error;
  }
}

/**
 * Parse a CSV line, handling quoted values
 * Removes quotes from field values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values.map(v => v.trim());
}

/**
 * Get Simplified Chinese name from CSV (same method as old implementation)
 * @param {number} itemId - Item ID
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<string|null>} - Simplified Chinese name or null if not found
 */
export async function getSimplifiedChineseName(itemId, signal = null) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  // Check cache first
  if (simplifiedNameCache.has(itemId)) {
    return simplifiedNameCache.get(itemId);
  }

  try {
    // Load Simplified Chinese items database from CSV
    const items = await loadSimplifiedItemDatabase(signal);
    
    // Check if request was cancelled
    if (!items) {
      return null;
    }
    
    // Find the item by ID
    const item = items.find(item => {
      const id = item['key: #'];
      return id && parseInt(id, 10) === itemId;
    });

    if (!item) {
      return null;
    }

    // Get Simplified Chinese name from "9: Name" field (same as old method)
    let simplifiedName = item['9: Name'] || '';
    if (!simplifiedName || simplifiedName.trim() === '') {
      simplifiedName = item['0: Singular'] || '';
    }

    if (!simplifiedName || simplifiedName.trim() === '') {
      return null;
    }

    // Clean the name (remove quotes)
    const cleanName = simplifiedName.replace(/^["']|["']$/g, '').trim();

    // Cache the result
    if (cleanName) {
      simplifiedNameCache.set(itemId, cleanName);
    }

    return cleanName;
  } catch (error) {
    if (error.name === 'AbortError') {
      // Request was cancelled, return null
      return null;
    }
    console.error(`Failed to get Simplified Chinese name for item ${itemId}:`, error);
    return null;
  }
}

/**
 * Cancel any pending Simplified Chinese name fetches
 */
export function cancelSimplifiedNameFetch() {
  if (simplifiedItemsAbortController) {
    simplifiedItemsAbortController.abort();
    simplifiedItemsAbortController = null;
    isLoadingSimplified = false;
  }
}

/**
 * Search simplified Chinese database by name and return matching item IDs
 * This is used as a fallback when main search returns no results
 * IMPORTANT: This function ONLY uses precise search (exact substring matching), NEVER fuzzy search
 * @param {string} searchText - Search text in Simplified Chinese
 * @returns {Promise<Array<number>>} - Array of item IDs that match the search
 */
async function searchSimplifiedDatabaseByName(searchText) {
  if (!searchText || searchText.trim() === '') {
    return [];
  }

  try {
    // Load Simplified Chinese items database
    const items = await loadSimplifiedItemDatabase();
    
    if (!items) {
      return [];
    }

    const trimmedSearchText = searchText.trim();
    
    // Split search text into words (same logic as performSearch)
    const hasSpaces = trimmedSearchText.includes(' ');
    const words = hasSpaces 
      ? trimmedSearchText.split(/\s+/).filter(w => w)
      : [trimmedSearchText];

    // Find items matching the search text
    // NOTE: This function ONLY uses precise search (exact substring matching), never fuzzy search
    const matchingItemIds = items
      .filter(item => {
        // Get Simplified Chinese name from "9: Name" field
        let rawName = item['9: Name'] || '';
        if (!rawName || rawName.trim() === '') {
          rawName = item['0: Singular'] || '';
        }

        if (!rawName || rawName.trim() === '') {
          return false;
        }

        // Clean name for search
        const cleanName = rawName.replace(/^["']+|["']+$/g, '').trim();
        
        if (!cleanName) {
          return false;
        }

        // Precise search only: Match all words using exact substring matching (AND condition)
        // For words without spaces, require exact substring match (respects character order)
        // For words with spaces, each word must appear as exact substring
        // This ensures "精金" only matches if "精金" appears as a substring, not if "金" appears before "精"
        const matches = words.every(word => {
          // Precise search: check if word appears as exact substring (no fuzzy matching)
          return cleanName.includes(word);
        });

        return matches;
      })
      .map(item => {
        const id = item['key: #'];
        return id ? parseInt(id, 10) : null;
      })
      .filter(id => id !== null && id > 0);

    return matchingItemIds;
  } catch (error) {
    console.error('Failed to search simplified database:', error);
    return [];
  }
}

/**
 * Load items database from local tw-items.json
 * Items are already in Traditional Chinese format
 */
export async function loadItemDatabase() {
  if (itemsDatabase && shopItemsDatabase) {
    console.log(`[ItemDB] 📦 Using cached item database (${itemsDatabase.length} items)`);
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  }

  if (isLoading) {
    console.log(`[ItemDB] ⏳ Item database already loading, waiting...`);
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  }

  isLoading = true;
  const loadStartTime = performance.now();
  console.error(`[ItemDB] ❌ CRITICAL: Loading FULL item database (all 42,679 items)!`);
  console.error(`[ItemDB] ❌ This should ONLY happen for fuzzy search or fallback scenarios.`);
  console.error(`[ItemDB] ❌ For normal operations, use targeted queries: searchTwItems(), getTwItemById(), etc.`);
  console.trace(`[ItemDB] 🔍 Stack trace - find and replace with targeted query:`);

  try {
    // Load items from Supabase
    const twItemsData = await getTwItems();
    
    // Convert the Supabase data structure to an array of items matching the CSV format
    // Supabase structure: { "13589": { "tw": "堅鋼投斧" }, ... }
    // We need to convert to: [{ "key: #": "13589", "9: Name": "堅鋼投斧", ... }, ...]
    const items = Object.entries(twItemsData).map(([id, data]) => {
      const itemName = data.tw || '';
      // Transform to match the expected CSV format
      return {
        'key: #': id,
        '9: Name': itemName, // Traditional Chinese name from Supabase
        '0: Singular': itemName, // Use same as fallback
        '11: Level{Item}': '', // Not available in Supabase
        '25: Price{Mid}': '', // Not available in Supabase
        '8: Description': '', // Not available in Supabase
        '22: IsUntradable': 'False', // Default to tradeable (we can't determine from Supabase)
        '27: CanBeHq': 'True', // Default to true (most items can be HQ)
      };
    }).filter(item => item['key: #'] && item['9: Name'].trim() !== '');

    itemsDatabase = items;
    shopItemsDatabase = []; // Shop items not available in Supabase, keep empty array

    const loadDuration = performance.now() - loadStartTime;
    console.log(`[ItemDB] ✅ Loaded full item database (${itemsDatabase.length} items) in ${loadDuration.toFixed(2)}ms`);
    isLoading = false;
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  } catch (error) {
    isLoading = false;
    console.error('Failed to load item database:', error);
    throw error;
  }
}

/**
 * Fuzzy matching function for Chinese text that respects character order
 * Characters must appear in the same order as in the search text (no jumping back)
 * Returns a similarity score (0-1) where 1 is exact match
 */
function fuzzyMatch(searchText, itemName) {
  const searchChars = Array.from(searchText.toLowerCase());
  const itemChars = Array.from(itemName.toLowerCase());
  
  // If exact substring match, return 1.0
  if (itemName.toLowerCase().includes(searchText.toLowerCase())) {
    return 1.0;
  }
  
  // Check if all search characters appear in item name IN ORDER (strict order)
  // This ensures "精金" won't match "鉍金精準指環" because 金 appears before 精
  let itemIndex = 0;
  let matchedChars = 0;
  
  for (let i = 0; i < searchChars.length; i++) {
    const searchChar = searchChars[i];
    let found = false;
    
    // Only search forward from current position (strict order)
    for (let j = itemIndex; j < itemChars.length; j++) {
      if (itemChars[j] === searchChar) {
        matchedChars++;
        found = true;
        itemIndex = j + 1; // Move forward, never go back
        break;
      }
    }
    
    // If character not found in order, return 0 (no match)
    if (!found) {
      return 0;
    }
  }
  
  // All characters found in order
  // Calculate similarity score based on how many characters matched
  const charMatchRatio = matchedChars / searchChars.length;
  
  // Only return matches if all characters matched in order
  return charMatchRatio === 1.0 ? 1.0 : 0;
}

/**
 * Internal helper function to perform the actual search with a given search text
 * @param {Array} items - Items array from database
 * @param {Array} shopItems - Shop items array
 * @param {Set} shopItemIds - Set of shop item IDs
 * @param {string} searchText - Search text to use
 * @param {boolean} fuzzy - Whether to use fuzzy matching (default: false)
 * @param {Set} marketItems - Optional Set of marketable item IDs (from market_items table)
 * @returns {Array} Search results
 */
function performSearch(items, shopItems, shopItemIds, searchText, fuzzy = false, marketItems = null) {
  const trimmedSearchText = searchText.trim();
  
  // Observable's behavior: if search text has spaces, split into words (AND condition)
  // If no spaces, search the entire string as-is
  // This matches Observable's SQL: "name like ? [for each word]"
  const hasSpaces = trimmedSearchText.includes(' ');
  const words = hasSpaces 
    ? trimmedSearchText.split(/\s+/).filter(w => w)
    : [trimmedSearchText]; // Single word, search entire string

  // Filter items
  let matchCount = 0;
  let filteredByUntradable = 0;
  let filteredByEmptyName = 0;
  let itemsWithMap = 0;
  let itemsWithMapButFiltered = 0;
  const results = items
    .filter(item => {
      // Observable uses "9: Name" as name, but if it's empty, use "0: Singular" as fallback
      // This matches how DuckDB/SQL might handle COALESCE or similar functions
      let rawName = item['9: Name'] || '';
      if (!rawName || rawName.trim() === '') {
        // Fallback to "0: Singular" if "9: Name" is empty
        rawName = item['0: Singular'] || '';
      }
      
      // Check if item is untradeable - handle case variations and different formats
      // Observable's SQL: where "22: IsUntradable" = 'False' (only show tradeable items)
      // If marketItems is provided, use it as the source of truth for tradeability
      const itemId = item['key: #'] || '';
      const itemIdNum = parseInt(itemId, 10);
      
      let isUntradable;
      if (marketItems !== null) {
        // Use market_items table as source of truth
        isUntradable = !marketItems.has(itemIdNum);
      } else {
        // Fallback to IsUntradable field if marketItems not provided
        const untradableValue = (item['22: IsUntradable'] || '').toString().trim();
        isUntradable = untradableValue === 'True' || 
                      untradableValue === 'true' || 
                      untradableValue === 'TRUE' ||
                      untradableValue === '1';
      }
      
      // Track items with "地图" in name
      const hasMapInName = rawName.includes('地图');
      if (hasMapInName) {
        itemsWithMap++;
      }
      
      // Observable's SQL: where name != '' and "22: IsUntradable" = 'False'
      // Must have name (not empty) and be tradable
      if (!rawName || rawName.trim() === '') {
        filteredByEmptyName++;
        return false;
      }
      
      // Filter out untradeable items - only show items where IsUntradable is 'False' or empty
      if (isUntradable) {
        filteredByUntradable++;
        return false;
      }

      // Clean name for search (remove quotes and trim)
      // Also remove any leading/trailing whitespace and normalize
      let cleanName = rawName.replace(/^["']+|["']+$/g, '').trim();
      
      // Skip if name is empty after cleaning
      if (!cleanName) {
        filteredByEmptyName++;
        return false;
      }
      
      // Observable's SQL query: name like ? [for each word]
      // It only searches in name field, not description
      // Match all words (AND condition) - search in cleaned name
      // Observable's SQL: name like '%word%' for each word
      let matches = false;
      
      // Only use fuzzy matching if:
      // 1. fuzzy=true is explicitly requested AND
      // 2. The search text contains spaces (user put spaces between words)
      // If no spaces, only do exact substring matching (no fuzzy)
      if (fuzzy && hasSpaces) {
        // Fuzzy matching: check if all words have fuzzy matches (respecting character order)
        const fuzzyScores = words.map(word => fuzzyMatch(word, cleanName));
        matches = fuzzyScores.every(score => score > 0);
      } else {
        // Exact matching: check if all words are substrings
        matches = words.every(word => {
          return cleanName.includes(word);
        });
      }
      
      if (matches) {
        matchCount++;
      } else if (hasMapInName || cleanName.includes('地圖')) {
        itemsWithMapButFiltered++;
      }
      
      return matches;
    })
    .map(item => {
      const id = item['key: #'];
      // Use "9: Name" as primary, fallback to "0: Singular" if empty (matches Observable behavior)
      let name = item['9: Name'] || '';
      if (!name || name.trim() === '') {
        name = item['0: Singular'] || '';
      }
      const itemLevel = item['11: Level{Item}'] || '';
      const shopPrice = item['25: Price{Mid}'] || '';
      const canBeHQ = item['27: CanBeHq'] !== 'False';
      const inShop = shopItemIds.has(id);

      // Get description from Supabase (cached - should be pre-loaded)
      const descriptionData = twItemDescriptionsCache?.[id];
      const description = descriptionData?.tw || '';

      // Check if item is tradable (opposite of untradable)
      const untradableValue = (item['22: IsUntradable'] || '').toString().trim();
      const isUntradable = untradableValue === 'True' || 
                          untradableValue === 'true' || 
                          untradableValue === 'TRUE' ||
                          untradableValue === '1';
      const isTradable = !isUntradable;

      // Items are already in Traditional Chinese, no conversion needed
      // Remove any quotes that might be in the name/description
      const cleanName = name.replace(/^["']|["']$/g, '').trim();
      const cleanDescription = description.replace(/^["']|["']$/g, '').trim();

      // Check if this name is from a non-TW language search
      // If _twName exists and is different from the search name, it's a non-TW search
      const searchLanguageName = item['9: Name'] || '';
      const twNameRaw = item['_twName'] || '';
      const twNameClean = twNameRaw ? twNameRaw.replace(/^["']|["']$/g, '').trim() : '';
      const isNonTWSearch = twNameClean && searchLanguageName && twNameClean !== searchLanguageName;

      return {
        id: parseInt(id, 10) || 0,
        name: cleanName, // Display name (search language name if non-TW search, otherwise TW)
        nameTW: isNonTWSearch ? twNameClean : cleanName, // TW name (always available)
        searchLanguageName: isNonTWSearch ? cleanName : null, // Original search language name if different from TW
        nameSimplified: cleanName, // Keep same for compatibility (not used for matching)
        itemLevel: itemLevel,
        shopPrice: shopPrice,
        description: cleanDescription, // From tw-item-descriptions.json
        inShop: inShop,
        canBeHQ: canBeHQ,
        isTradable: isTradable, // Add tradable status
      };
    })
    .filter(item => item.id > 0); // Ensure valid ID

  // Sort results by ilvl descending (highest first)
  // First, get ilvls for all result items
  const resultIds = results.map(item => item.id).filter(id => id > 0);
  let ilvlsData = null;
  
  // Try to get ilvls data (async, but we'll sort synchronously if available)
  // For now, we'll sort by ilvl if available in a separate async step
  // This will be handled by the caller or ItemTable component
  
  // Sort by tradable first, then by ilvl descending, then by id descending
  results.sort((a, b) => {
    // Primary sort: Tradable items first (true before false)
    const tradableDiff = (b.isTradable ? 1 : 0) - (a.isTradable ? 1 : 0);
    if (tradableDiff !== 0) {
      return tradableDiff;
    }
    
    // Secondary sort: By ilvl descending (if available)
    // Note: ilvl data will be loaded separately and sorted in ItemTable or caller
    // For now, sort by ID descending as fallback
    return b.id - a.id;
  });

  return results;
}

/**
 * Load ilvl and version data for search results and sort by ilvl descending
 * @param {Array} results - Search results array with id field
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<void>}
 */
async function loadIlvlAndVersionForResults(results, signal = null) {
  if (results.length === 0) return;
  
  const resultIds = results.map(r => r.id).filter(id => id > 0);
  if (resultIds.length === 0) return;
  
  try {
    const { getIlvlsByIds, getItemPatchByIds } = await import('./supabaseData');
    const [ilvls, patches] = await Promise.all([
      getIlvlsByIds(resultIds, signal),
      getItemPatchByIds(resultIds, signal)
    ]);
    
    // Attach ilvl and version to each result item
    results.forEach(item => {
      item.ilvl = ilvls[item.id] || null;
      item.version = patches[item.id] || null; // version is patch ID
    });
    
    // Sort results by ilvl descending
    results.sort((a, b) => {
      // Primary sort: Tradable items first
      const tradableDiff = (b.isTradable ? 1 : 0) - (a.isTradable ? 1 : 0);
      if (tradableDiff !== 0) {
        return tradableDiff;
      }
      
      // Secondary sort: By ilvl descending (highest first)
      const aIlvl = a.ilvl || null;
      const bIlvl = b.ilvl || null;
      
      if (aIlvl !== null && bIlvl !== null) {
        return bIlvl - aIlvl; // Descending order
      }
      if (aIlvl !== null) return -1;
      if (bIlvl !== null) return 1;
      // Both null, sort by id descending
      return b.id - a.id;
    });
  } catch (error) {
    console.warn(`[ItemDB] ⚠️ Failed to load ilvl/version:`, error);
    // Continue even if ilvl/version loading fails
  }
}

/**
 * Transform Supabase search results to the format expected by performSearch
 * @param {Object} searchResults - Results from search functions: {itemId: {tw: "name"}} or {itemId: {en: "name"}}, etc.
 * @param {Array} shopItems - Shop items array
 * @param {Set} shopItemIds - Set of shop item IDs
 * @param {Set} marketItems - Optional Set of marketable item IDs (from market_items table)
 * @param {Object} twNamesCache - Optional cache of TW names {itemId: {tw: "name"}} - if provided, will use it to get TW names
 * @returns {Array} - Items in the format expected by performSearch
 */
function transformSearchResultsToItems(searchResults, shopItems, shopItemIds, marketItems = null, twNamesCache = null) {
  return Object.entries(searchResults).map(([id, data]) => {
    // Extract item name from any language field (tw, zh, ko, en, ja, de, fr)
    const itemName = data.tw || data.zh || data.ko || data.en || data.ja || data.de || data.fr || '';
    const itemIdNum = parseInt(id, 10);
    
    // Determine if this is a non-TW search result
    const isTWSearch = !!data.tw;
    
    // Get TW name if available (for non-TW searches, we'll fetch it later)
    let twName = data.tw || '';
    if (!isTWSearch && twNamesCache) {
      const twData = twNamesCache[id];
      twName = twData?.tw || '';
    }
    
    // Use market_items table to determine tradeability
    // If marketItems is provided, check if item is in it
    // If not provided, default to tradeable (for backward compatibility)
    const isTradeable = marketItems ? marketItems.has(itemIdNum) : true;
    return {
      'key: #': id,
      '9: Name': itemName, // Search language name (or TW if TW search)
      '0: Singular': itemName,
      '_twName': twName || itemName, // Store TW name separately (will be fetched if missing)
      '_isNonTWSearch': !isTWSearch, // Flag to indicate if we need to fetch TW name
      '11: Level{Item}': '',
      '25: Price{Mid}': '',
      '8: Description': '',
      '22: IsUntradable': isTradeable ? 'False' : 'True', // Set based on market_items
      '27: CanBeHq': 'True',
    };
  }).filter(item => item['key: #'] && item['9: Name'].trim() !== '');
}

/**
 * Search items - replicates ObservableHQ's SQL query
 * Uses database queries for efficient searching (only fetches matching items)
 * Falls back to full database load only when needed (fuzzy matching, etc.)
 * 
 * Query: select items."key: #" as id, "9: Name" as name, "11: Level{Item}" as itemLevel, 
 *        "25: Price{Mid}" as shopPrice, "8: Description" as description, 
 *        IF(shop_items."0: Item" is null, false, true) as inShop, 
 *        IF("27: CanBeHq" = 'False', false, true) as canBeHQ 
 *        from items left join shop_items on items."key: #" = shop_items."0: Item" 
 *        where name != '' and "22: IsUntradable" = 'False' and name like ? [for each word]
 * 
 * Search order (when fuzzy parameter is false or undefined):
 * 1. Precise search with TW names (original input) - uses database query
 * 2. Fuzzy search with TW names (original input) - uses full load (character-order checking)
 * 3. Convert user input to traditional Chinese, then do steps 1 and 2 again - uses database query
 * 4. Use simplified database API - convert to simplified, search simplified database by name to get item ID
 * 
 * When fuzzy=true is explicitly passed, skip precise search and go straight to fuzzy (for AdvancedSearch compatibility)
 * 
 * @param {string} searchText - Search text
 * @param {boolean} fuzzy - If true, skip precise search and use fuzzy only (for AdvancedSearch). If false/undefined, follow full order.
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 */
export async function searchItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') {
    return {
      results: [],
      converted: false,
      originalText: '',
      convertedText: null,
      searchedSimplified: false
    };
  }

  // Don't pre-load descriptions - load lazily only when needed (when displaying item details)
  // This avoids loading 19,032 descriptions on every search

  // Shop items are always empty in Supabase (not available), so create empty Set directly
  // This avoids loading all 42,679 items just to get an empty array
  const shopItems = [];
  const shopItemIds = new Set();

  // Don't load all marketable items upfront - check marketability only for search results
  // This avoids loading 16,670 items on every search
  // We'll check marketability for result items after search completes
  let marketItems = null;
  
  // Helper function to check marketability for item IDs
  const checkMarketabilityForItems = async (itemIds, signal) => {
    if (!itemIds || itemIds.length === 0) {
      return null;
    }
    try {
      const { getMarketItemsByIds } = await import('./supabaseData');
      return await getMarketItemsByIds(itemIds, signal);
    } catch (error) {
      console.warn(`[ItemDB] ⚠️ Failed to check marketability, will use IsUntradable field as fallback:`, error);
      return null;
    }
  };

  const trimmedSearchText = searchText.trim();
  let results = [];
  let converted = false;
  let originalText = trimmedSearchText;
  let convertedText = null;
  let searchedSimplified = false;

  // If fuzzy=true is explicitly passed, skip precise search (for AdvancedSearch compatibility)
  // Fuzzy search requires full database load for character-order checking
  if (fuzzy === true) {
    const { items } = await loadItemDatabase();
    // Check if search text has spaces - fuzzy search only works with spaces
    const hasSpaces = trimmedSearchText.includes(' ');
    
    // Do fuzzy search first without marketability filtering
    const tempResults = performSearch(items, shopItems, shopItemIds, trimmedSearchText, true, null);
    
    // Check marketability for fuzzy search results
    if (tempResults.length > 0) {
      const resultIds = tempResults.map(r => r.id).filter(id => id > 0);
      if (resultIds.length > 0) {
        marketItems = await checkMarketabilityForItems(resultIds, signal);
      }
    }
    
    // Filter results by marketability
    results = tempResults.filter(r => {
      if (marketItems) {
        return marketItems.has(r.id);
      }
      // Fallback to IsUntradable field if marketability check failed
      return true; // Keep all results if we can't check marketability
    });
    
    // Load descriptions ONLY for matching item IDs from fuzzy search results (efficient)
    if (results.length > 0) {
      const resultIds = results.map(r => r.id).filter(id => id > 0);
      if (resultIds.length > 0) {
        const missingIds = resultIds.filter(id => !twItemDescriptionsCache?.[id]);
        if (missingIds.length > 0) {
          const { getTwItemDescriptionsByIds } = await import('./supabaseData');
          const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
          if (!twItemDescriptionsCache) {
            twItemDescriptionsCache = {};
          }
          Object.assign(twItemDescriptionsCache, descriptions);
          // Update results with descriptions
          results = results.map(r => {
            const desc = twItemDescriptionsCache?.[r.id];
            return {
              ...r,
              description: desc?.tw ? desc.tw.replace(/^["']|["']$/g, '').trim() : r.description
            };
          });
        }
      }
    }
    
    // Return early - don't do conversion or simplified database search for explicit fuzzy mode
    return {
      results,
      converted: false,
      originalText: trimmedSearchText,
      convertedText: null,
      searchedSimplified: false
    };
  }

  // Check if search text has spaces (for fuzzy search condition)
  const hasSpaces = trimmedSearchText.includes(' ');

  // Full search order (for main search bar):
  // Step 1: Precise search with TW names (original input) - USE DATABASE QUERY
  try {
    // Check if aborted before query
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    const searchResults = await searchTwItems(trimmedSearchText, false, signal);
    // Check if aborted after query
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    
    // Transform search results without marketability filtering first
    const items = transformSearchResultsToItems(searchResults, shopItems, shopItemIds, null);
    
    // Get item IDs from search results to check marketability
    if (items.length > 0) {
      const itemIds = items.map(item => parseInt(item['key: #'], 10)).filter(id => !isNaN(id));
      if (itemIds.length > 0) {
        // Check marketability for search results only (efficient - uses WHERE IN)
        try {
          const { getMarketItemsByIds } = await import('./supabaseData');
          marketItems = await getMarketItemsByIds(itemIds, signal);
        } catch (error) {
          console.warn(`[ItemDB] ⚠️ Failed to check marketability, will use IsUntradable field as fallback:`, error);
          marketItems = null;
        }
        
        // Load descriptions ONLY for matching item IDs (efficient - uses WHERE IN)
        const missingIds = itemIds.filter(id => !twItemDescriptionsCache?.[id]);
        if (missingIds.length > 0) {
          const { getTwItemDescriptionsByIds } = await import('./supabaseData');
          const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
          // Merge into cache
          if (!twItemDescriptionsCache) {
            twItemDescriptionsCache = {};
          }
          Object.assign(twItemDescriptionsCache, descriptions);
        }
      }
    }
    
    results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, false, marketItems);
    
    // Sort results by ilvl descending (highest first) at query time
    // Also attach ilvl and version data to items for display
    await loadIlvlAndVersionForResults(results, signal);
  } catch (error) {
    // Don't fallback if aborted
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      throw error;
    }
    console.error('Error in database search, falling back to full load:', error);
    // Fallback to full database load if query fails
    const { items } = await loadItemDatabase();
    
    // Fallback: Load full database (fuzzy search or error fallback)
    // For fuzzy search, we need all items, so descriptions are loaded for all matching items after performSearch
    // For error fallback, try to load descriptions for matching items if possible
    results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, false, marketItems);
    
    // Load descriptions for result items if we have results
    if (results.length > 0) {
      const resultIds = results.map(r => r.id).filter(id => id > 0);
      if (resultIds.length > 0) {
        const missingIds = resultIds.filter(id => !twItemDescriptionsCache?.[id]);
        if (missingIds.length > 0) {
          const { getTwItemDescriptionsByIds } = await import('./supabaseData');
          const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
          if (!twItemDescriptionsCache) {
            twItemDescriptionsCache = {};
          }
          Object.assign(twItemDescriptionsCache, descriptions);
          // Update results with descriptions
          results = results.map(r => {
            const desc = twItemDescriptionsCache?.[r.id];
            return {
              ...r,
              description: desc?.tw ? desc.tw.replace(/^["']|["']$/g, '').trim() : r.description
            };
          });
        }
      }
    }
  }
  
  // Step 2: If no results AND search text has spaces, try fuzzy search with TW names (original input)
  // Fuzzy search only works when user put spaces between words
  // Note: Fuzzy search requires full database load for character-order checking
  if (results.length === 0 && hasSpaces) {
    try {
      const searchResults = await searchTwItems(trimmedSearchText, true, signal);
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      const items = transformSearchResultsToItems(searchResults, shopItems, shopItemIds, null);
      if (items.length > 0) {
        const itemIds = items.map(item => parseInt(item['key: #'], 10)).filter(id => !isNaN(id));
        if (itemIds.length > 0) {
          // Check marketability for search results
          marketItems = await checkMarketabilityForItems(itemIds, signal);
          
          const missingIds = itemIds.filter(id => !twItemDescriptionsCache?.[id]);
          if (missingIds.length > 0) {
            const { getTwItemDescriptionsByIds } = await import('./supabaseData');
            const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
            if (!twItemDescriptionsCache) {
              twItemDescriptionsCache = {};
            }
            Object.assign(twItemDescriptionsCache, descriptions);
          }
        }
      }
      results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, true, marketItems);
    } catch (error) {
      if (error.name !== 'AbortError' && (!signal || !signal.aborted)) {
        console.error('Error in fuzzy TW search:', error);
      }
    }
  }

  // Step 2b: If still no results, search other languages (CN, EN, JA, KO, DE, FR) in order
  // Search order: TW (done) -> CN -> EN -> JA -> KO -> DE -> FR -> rest
  if (results.length === 0) {
    const languageSearches = [
      { func: searchCnItems, name: 'CN' },
      { func: searchEnItems, name: 'EN' },
      { func: searchJaItems, name: 'JA' },
      { func: searchKoItems, name: 'KO' },
      { func: searchDeItems, name: 'DE' },
      { func: searchFrItems, name: 'FR' }
    ];

    for (const langSearch of languageSearches) {
      if (results.length > 0) break; // Stop if we found results
      if (signal && signal.aborted) break;

      try {
        // Try strict search first
        const searchResults = await langSearch.func(trimmedSearchText, false, signal);
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        
        // Fetch TW names for non-TW search results
        let twNamesCache = null;
        const itemIds = Object.keys(searchResults).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (itemIds.length > 0) {
          const { getTwItemsByIds } = await import('./supabaseData');
          twNamesCache = await getTwItemsByIds(itemIds, signal);
        }
        
        const items = transformSearchResultsToItems(searchResults, shopItems, shopItemIds, marketItems, twNamesCache);
        
        if (items.length > 0) {
          // Load descriptions for matching items
          if (itemIds.length > 0) {
            const missingIds = itemIds.filter(id => !twItemDescriptionsCache?.[id]);
            if (missingIds.length > 0) {
              const { getTwItemDescriptionsByIds } = await import('./supabaseData');
              const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
              if (!twItemDescriptionsCache) {
                twItemDescriptionsCache = {};
              }
              Object.assign(twItemDescriptionsCache, descriptions);
            }
          }
          results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, false, marketItems);
          
          // Load ilvl and version data for non-TW search results (same as TW search)
          if (results.length > 0) {
            await loadIlvlAndVersionForResults(results, signal);
            break;
          }
        }

        // If no results and has spaces, try fuzzy search for this language
        if (results.length === 0 && hasSpaces) {
          const fuzzyResults = await langSearch.func(trimmedSearchText, true, signal);
          if (signal && signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
          }
          
          // Fetch TW names for fuzzy search results
          const fuzzyItemIds = Object.keys(fuzzyResults).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
          if (fuzzyItemIds.length > 0) {
            const { getTwItemsByIds } = await import('./supabaseData');
            twNamesCache = await getTwItemsByIds(fuzzyItemIds, signal);
          }
          
          const fuzzyItems = transformSearchResultsToItems(fuzzyResults, shopItems, shopItemIds, marketItems, twNamesCache);
          if (fuzzyItems.length > 0) {
            if (fuzzyItemIds.length > 0) {
              const missingIds = fuzzyItemIds.filter(id => !twItemDescriptionsCache?.[id]);
              if (missingIds.length > 0) {
                const { getTwItemDescriptionsByIds } = await import('./supabaseData');
                const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
                if (!twItemDescriptionsCache) {
                  twItemDescriptionsCache = {};
                }
                Object.assign(twItemDescriptionsCache, descriptions);
              }
            }
            results = performSearch(fuzzyItems, shopItems, shopItemIds, trimmedSearchText, true, marketItems);
            
            // Load ilvl and version data for non-TW fuzzy search results (same as TW search)
            if (results.length > 0) {
              await loadIlvlAndVersionForResults(results, signal);
              break;
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError' && (!signal || !signal.aborted)) {
          console.error(`Error searching ${langSearch.name} items:`, error);
        }
        // Continue to next language
      }
    }
  }

  // Step 2c: Legacy fuzzy search fallback (if still no results and has spaces)
  if (results.length === 0 && hasSpaces) {
    const { items } = await loadItemDatabase();
    
    results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, true, marketItems);
    
    // Load descriptions ONLY for matching item IDs from fuzzy search results
    if (results.length > 0) {
      const resultIds = results.map(r => r.id).filter(id => id > 0);
      if (resultIds.length > 0) {
        const missingIds = resultIds.filter(id => !twItemDescriptionsCache?.[id]);
        if (missingIds.length > 0) {
          const { getTwItemDescriptionsByIds } = await import('./supabaseData');
          const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
          if (!twItemDescriptionsCache) {
            twItemDescriptionsCache = {};
          }
          Object.assign(twItemDescriptionsCache, descriptions);
          // Update results with descriptions
          results = results.map(r => {
            const desc = twItemDescriptionsCache?.[r.id];
            return {
              ...r,
              description: desc?.tw ? desc.tw.replace(/^["']|["']$/g, '').trim() : r.description
            };
          });
        }
      }
    }
  }

  // Step 3: If still no results, convert user input to traditional Chinese and try again
  if (results.length === 0) {
    // Convert to traditional Chinese (if input is simplified, convert to traditional)
    // If input is already traditional, convert to simplified first, then back to traditional
    // This handles cases where input might be in simplified Chinese
    let traditionalSearchText;
    if (isTraditionalChinese(trimmedSearchText)) {
      // Already traditional, but try converting to simplified then back to traditional
      // to normalize variations
      const simplified = convertTraditionalToSimplified(trimmedSearchText);
      traditionalSearchText = convertSimplifiedToTraditional(simplified);
    } else {
      // Convert from simplified to traditional
      traditionalSearchText = convertSimplifiedToTraditional(trimmedSearchText);
    }
    
    // Only retry if the converted text is different from the original
    if (traditionalSearchText !== trimmedSearchText && containsChinese(traditionalSearchText)) {
      converted = true;
      convertedText = traditionalSearchText;
      
      // Check if converted text has spaces
      const convertedHasSpaces = traditionalSearchText.includes(' ');
      
      // Step 3a: Precise search with converted traditional Chinese - USE DATABASE QUERY
      try {
        // Check if aborted before query
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        const searchResults = await searchTwItems(traditionalSearchText, false, signal);
        // Check if aborted after query
        if (signal && signal.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        const items = transformSearchResultsToItems(searchResults, shopItems, shopItemIds, marketItems);
        
        // Load descriptions ONLY for matching item IDs (efficient - uses WHERE IN)
        if (items.length > 0) {
          const itemIds = items.map(item => parseInt(item['key: #'], 10)).filter(id => !isNaN(id));
          if (itemIds.length > 0) {
            const missingIds = itemIds.filter(id => !twItemDescriptionsCache?.[id]);
            if (missingIds.length > 0) {
              const { getTwItemDescriptionsByIds } = await import('./supabaseData');
              const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
              if (!twItemDescriptionsCache) {
                twItemDescriptionsCache = {};
              }
              Object.assign(twItemDescriptionsCache, descriptions);
            }
          }
        }
        
        results = performSearch(items, shopItems, shopItemIds, traditionalSearchText, false, marketItems);
      } catch (error) {
        // Don't fallback if aborted
        if (error.name === 'AbortError' || (signal && signal.aborted)) {
          throw error;
        }
        console.error('Error in database search (converted), falling back to full load:', error);
        const { items } = await loadItemDatabase();
        
        results = performSearch(items, shopItems, shopItemIds, traditionalSearchText, false, marketItems);
        
        // Load descriptions for result items
        if (results.length > 0) {
          const resultIds = results.map(r => r.id).filter(id => id > 0);
          if (resultIds.length > 0) {
            const missingIds = resultIds.filter(id => !twItemDescriptionsCache?.[id]);
            if (missingIds.length > 0) {
              const { getTwItemDescriptionsByIds } = await import('./supabaseData');
              const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
              if (!twItemDescriptionsCache) {
                twItemDescriptionsCache = {};
              }
              Object.assign(twItemDescriptionsCache, descriptions);
              results = results.map(r => {
                const desc = twItemDescriptionsCache?.[r.id];
                return {
                  ...r,
                  description: desc?.tw ? desc.tw.replace(/^["']|["']$/g, '').trim() : r.description
                };
              });
            }
          }
        }
      }
      
      // Step 3b: If still no results AND converted text has spaces, try fuzzy search with converted traditional Chinese
      // Note: Fuzzy search requires full database load
      if (results.length === 0 && convertedHasSpaces) {
        const { items } = await loadItemDatabase();
        
        results = performSearch(items, shopItems, shopItemIds, traditionalSearchText, true, marketItems);
        
        // Load descriptions ONLY for matching item IDs from fuzzy search results
        if (results.length > 0) {
          const resultIds = results.map(r => r.id).filter(id => id > 0);
          if (resultIds.length > 0) {
            const missingIds = resultIds.filter(id => !twItemDescriptionsCache?.[id]);
            if (missingIds.length > 0) {
              const { getTwItemDescriptionsByIds } = await import('./supabaseData');
              const descriptions = await getTwItemDescriptionsByIds(missingIds, signal);
              if (!twItemDescriptionsCache) {
                twItemDescriptionsCache = {};
              }
              Object.assign(twItemDescriptionsCache, descriptions);
              results = results.map(r => {
                const desc = twItemDescriptionsCache?.[r.id];
                return {
                  ...r,
                  description: desc?.tw ? desc.tw.replace(/^["']|["']$/g, '').trim() : r.description
                };
              });
            }
          }
        }
      }
    }
  }

  // Step 4: If still no results, use simplified database API (like wiki button but reverse)
  if (results.length === 0) {
    // Convert to simplified Chinese for searching in simplified database
    const simplifiedSearchText = isTraditionalChinese(trimmedSearchText)
      ? convertTraditionalToSimplified(trimmedSearchText)
      : trimmedSearchText; // If already simplified or not Chinese, use as-is
    
    // Only search simplified database if the text contains Chinese characters
    if (containsChinese(simplifiedSearchText)) {
      const matchingItemIds = await searchSimplifiedDatabaseByName(simplifiedSearchText);
      
      if (matchingItemIds.length > 0) {
        searchedSimplified = true;
        if (!converted) {
          converted = true;
          convertedText = simplifiedSearchText;
        }
        
        // Fetch items by ID from Traditional Chinese database using targeted queries
        // Don't load full database - use getTwItemById for each item
        const itemsById = await Promise.all(
          matchingItemIds.map(async (itemId) => {
            try {
              const { getTwItemById } = await import('./supabaseData');
              const itemData = await getTwItemById(itemId);
              if (!itemData) {
                return null;
              }
              return {
                'key: #': itemId.toString(),
                '9: Name': itemData.tw || '',
                '0: Singular': itemData.tw || '',
                '11: Level{Item}': '',
                '25: Price{Mid}': '',
                '8: Description': '',
                '22: IsUntradable': marketItems && marketItems.has(itemId) ? 'False' : 'True',
                '27: CanBeHq': 'True',
              };
            } catch (error) {
              console.error(`Failed to fetch item ${itemId} for simplified search:`, error);
              return null;
            }
          })
        );
        
        const validItems = itemsById.filter(item => item !== null && item['9: Name'].trim() !== '');

        // Convert items to result format (same as performSearch)
        // NOTE: Do NOT filter by tradeability here - return ALL matching items
        // Tradeability filtering will be done in handleSearch after search completes
        // This allows us to track untradeable items and show them via button
        results = validItems
          .map(item => {
            const id = item['key: #'];
            let name = item['9: Name'] || '';
            if (!name || name.trim() === '') {
              name = item['0: Singular'] || '';
            }
            const itemLevel = item['11: Level{Item}'] || '';
            const shopPrice = item['25: Price{Mid}'] || '';
            const canBeHQ = item['27: CanBeHq'] !== 'False';
            const inShop = shopItemIds.has(id);

            // Get description from Supabase (cached)
            const descriptionData = twItemDescriptionsCache?.[id];
            const description = descriptionData?.tw || '';

            // Check if item is tradable (use marketItems if available)
            let isTradable;
            if (marketItems !== null) {
              const itemIdNum = parseInt(id, 10);
              isTradable = marketItems.has(itemIdNum);
            } else {
              // Fallback to IsUntradable field
              const untradableValue = (item['22: IsUntradable'] || '').toString().trim();
              const isUntradable = untradableValue === 'True' || 
                                  untradableValue === 'true' || 
                                  untradableValue === 'TRUE' ||
                                  untradableValue === '1';
              isTradable = !isUntradable;
            }

            // Clean name and description
            const cleanName = name.replace(/^["']|["']$/g, '').trim();
            const cleanDescription = description.replace(/^["']|["']$/g, '').trim();

            return {
              id: parseInt(id, 10) || 0,
              name: cleanName,
              nameSimplified: cleanName,
              itemLevel: itemLevel,
              shopPrice: shopPrice,
              description: cleanDescription,
              inShop: inShop,
              canBeHQ: canBeHQ,
              isTradable: isTradable,
            };
          })
          .filter(item => item.id > 0)
        .sort((a, b) => {
          // Primary sort: Tradable items first
          const tradableDiff = (b.isTradable ? 1 : 0) - (a.isTradable ? 1 : 0);
          if (tradableDiff !== 0) {
            return tradableDiff;
          }
          // Secondary sort: By item ID (ascending)
          return a.id - b.id;
        });
      }
    }
  }

  // Return results with conversion info
  return {
    results,
    converted,
    originalText,
    convertedText,
    searchedSimplified
  };
}

/**
 * Get item by ID using targeted database query (efficient - doesn't load all items)
 * @param {number} itemId - Item ID
 * @param {boolean} includeDescription - Whether to load description (default: true, set to false for performance)
 * @returns {Promise<Object|null>} - Item object or null if not found
 */
export async function getItemById(itemId, includeDescription = true) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  // Use targeted query instead of loading all items
  try {
    const { getTwItemById } = await import('./supabaseData');
    const itemData = await getTwItemById(itemId);
    
    if (!itemData) {
      return null;
    }
    
    const itemName = itemData.tw || '';
    let description = '';
    
    // Only load descriptions if requested (lazy loading - use targeted query)
    if (includeDescription) {
      // Check cache first
      if (twItemDescriptionsCache?.[itemId]) {
        const descriptionData = twItemDescriptionsCache[itemId];
        description = descriptionData?.tw || '';
      } else {
        // Load description using getTwItemDescriptionsByIds (which has its own promise deduplication)
        const { getTwItemDescriptionsByIds } = await import('./supabaseData');
        const descriptions = await getTwItemDescriptionsByIds([itemId]);
        
        // Update local cache
        if (!twItemDescriptionsCache) {
          twItemDescriptionsCache = {};
        }
        Object.assign(twItemDescriptionsCache, descriptions);
        
        const descriptionData = twItemDescriptionsCache[itemId];
        description = descriptionData?.tw || '';
      }
    }
    
    // Create item object matching expected format
    const cleanName = itemName.replace(/^["']|["']$/g, '').trim();
    return {
      id: itemId,
      name: cleanName,
      nameTW: cleanName, // TW name (same as name for getItemById since it's always TW)
      searchLanguageName: null, // No search language name for direct ID lookup
      description: description.replace(/^["']|["']$/g, '').trim(),
      itemLevel: '',
      shopPrice: '',
      inShop: false,
      canBeHQ: true,
      isTradable: true,
    };
  } catch (error) {
    console.error(`Error fetching item ${itemId} from Supabase:`, error);
    // Don't fallback to full database load - it's too expensive
    // Just return null if the targeted query fails
    console.warn(`[ItemDB] ⚠️ Failed to fetch item ${itemId} - returning null (no fallback to avoid loading all items)`);
    return null;
  }
}
