/**
 * Item Database Service
 * 
 * ⚠️ CRITICAL PERFORMANCE RULE: NEVER LOAD ALL ITEMS AT ONCE
 * 
 * Always use targeted queries:
 * - searchTwItems(searchText) - Search by name (returns only matches)
 * - getTwItemById(itemId) - Get single item
 * 
 * NEVER use:
 * - loadItemDatabase() - Loads ALL 42,679 items (only for fuzzy search fallback)
 * 
 * Workflow:
 * 1. Search database → get item IDs
 * 2. Use those IDs to fetch only needed data
 * 3. Never load entire tables
 */

import { convertSimplifiedToTraditional, convertTraditionalToSimplified, isTraditionalChinese, containsChinese } from '../utils/chineseConverter';
import { getTwItems, searchTwItems, searchCnItems, searchKoItems, searchEnItems, searchJaItems, searchDeItems, searchFrItems } from './supabaseData';

let itemsDatabase = null;
let shopItemsDatabase = null;
let isLoading = false;

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
 * @param {boolean} isOCRFuzzySearch - If true, this is a legitimate OCR fuzzy search fallback (less alarming logs)
 */
export async function loadItemDatabase(isOCRFuzzySearch = false) {
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
  
  if (isOCRFuzzySearch) {
    // OCR fuzzy search is a legitimate fallback scenario - use info level logging
    console.log(`[ItemDB] 🔍 Loading full item database for OCR fuzzy search (all 42,679 items)`);
    console.log(`[ItemDB] ℹ️ This is expected when OCR text doesn't match exactly - using fuzzy matching fallback`);
  } else {
    // Unexpected usage - warn about it
    console.warn(`[ItemDB] ⚠️ Loading FULL item database (all 42,679 items)!`);
    console.warn(`[ItemDB] ⚠️ This should ONLY happen for fuzzy search or fallback scenarios.`);
    console.warn(`[ItemDB] ⚠️ For normal operations, use targeted queries: searchTwItems(), getTwItemById(), etc.`);
    console.trace(`[ItemDB] 🔍 Stack trace - find and replace with targeted query:`);
  }

  try {
    // Load items from JSON (in-memory, fast)
    const twItemsData = await getTwItems();
    
    // Convert the JSON data structure to an array of items matching the CSV format
    // JSON structure: { "13589": { "tw": "堅鋼投斧" }, ... }
    // We need to convert to: [{ "key: #": "13589", "9: Name": "堅鋼投斧", ... }, ...]
    const items = Object.entries(twItemsData).map(([id, data]) => {
      const itemName = data.tw || '';
      // Transform to match the expected CSV format
      return {
        'key: #': id.toString(),
        '9: Name': itemName, // Traditional Chinese name from JSON
        '0: Singular': itemName, // Use same as fallback
        '11: Level{Item}': '', // Not available in JSON
        '25: Price{Mid}': '', // Not available in JSON
        '8: Description': '', // Not available in JSON
        '22: IsUntradable': 'False', // Default to tradeable (we can't determine from JSON)
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
 * @param {boolean} skipTradeabilityFilter - If true, return all items regardless of tradeability (default: false)
 * @returns {Array} Search results
 */
function performSearch(items, shopItems, shopItemIds, searchText, fuzzy = false, marketItems = null, skipTradeabilityFilter = false) {
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
      // UNLESS skipTradeabilityFilter is true (for main search to get all items for separation)
      if (!skipTradeabilityFilter && isUntradable) {
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

      // Check if item is tradable (opposite of untradable)
      const untradableValue = (item['22: IsUntradable'] || '').toString().trim();
      const isUntradable = untradableValue === 'True' || 
                          untradableValue === 'true' || 
                          untradableValue === 'TRUE' ||
                          untradableValue === '1';
      const isTradable = !isUntradable;

      // Items are already in Traditional Chinese, no conversion needed
      // Remove any quotes that might be in the name
      const cleanName = name.replace(/^["']|["']$/g, '').trim();

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
    
    // Do fuzzy search - return ALL items (both marketable and non-marketable) for proper separation
    const tempResults = performSearch(items, shopItems, shopItemIds, trimmedSearchText, true, null, true);
    
    // Check marketability for fuzzy search results
    if (tempResults.length > 0) {
      const resultIds = tempResults.map(r => r.id).filter(id => id > 0);
      if (resultIds.length > 0) {
        marketItems = await checkMarketabilityForItems(resultIds, signal);
      }
    }
    
    // Return ALL results (both marketable and non-marketable) - App.jsx will separate them
    results = tempResults;
    
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
      }
    }
    
    // CRITICAL: Pass skipTradeabilityFilter=true to get ALL items (both marketable and non-marketable)
    // This allows App.jsx to separate them properly for the toggle button
    results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, false, marketItems, true);
    
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
    // Return ALL items (both marketable and non-marketable) for proper separation
    results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, false, marketItems, true);
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
        }
      }
      // Return ALL items (both marketable and non-marketable) for proper separation
      results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, true, marketItems, true);
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
          // Return ALL items (both marketable and non-marketable) for proper separation
          results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, false, marketItems, true);
          
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
            // Return ALL items (both marketable and non-marketable) for proper separation
            results = performSearch(fuzzyItems, shopItems, shopItemIds, trimmedSearchText, true, marketItems, true);
            
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
    // Return ALL items (both marketable and non-marketable) for proper separation
    results = performSearch(items, shopItems, shopItemIds, trimmedSearchText, true, marketItems, true);
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
        // Return ALL items (both marketable and non-marketable) for proper separation
        results = performSearch(items, shopItems, shopItemIds, traditionalSearchText, false, marketItems, true);
      } catch (error) {
        // Don't fallback if aborted
        if (error.name === 'AbortError' || (signal && signal.aborted)) {
          throw error;
        }
        console.error('Error in database search (converted), falling back to full load:', error);
        const { items } = await loadItemDatabase();
        // Return ALL items (both marketable and non-marketable) for proper separation
        results = performSearch(items, shopItems, shopItemIds, traditionalSearchText, false, marketItems, true);
      }
      
      // Step 3b: If still no results AND converted text has spaces, try fuzzy search with converted traditional Chinese
      // Note: Fuzzy search requires full database load
      if (results.length === 0 && convertedHasSpaces) {
        const { items } = await loadItemDatabase();
        // Return ALL items (both marketable and non-marketable) for proper separation
        results = performSearch(items, shopItems, shopItemIds, traditionalSearchText, true, marketItems, true);
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

            // Clean name
            const cleanName = name.replace(/^["']|["']$/g, '').trim();

            return {
              id: parseInt(id, 10) || 0,
              name: cleanName,
              nameSimplified: cleanName,
              itemLevel: itemLevel,
              shopPrice: shopPrice,
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
 * Tries to get Traditional Chinese name first, falls back to other languages if not available
 * @param {number} itemId - Item ID
 * @returns {Promise<Object|null>} - Item object or null if not found in any language
 */
export async function getItemById(itemId) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  // Use targeted query instead of loading all items
  try {
    const { getTwItemById, getLanguageItemById } = await import('./supabaseData');
    
    // Try to get Traditional Chinese name first
    const twItemData = await getTwItemById(itemId);
    
    if (twItemData && twItemData.tw) {
      // Found Traditional Chinese name
      const cleanName = twItemData.tw.replace(/^["']|["']$/g, '').trim();
      return {
        id: itemId,
        name: cleanName,
        nameTW: cleanName,
        searchLanguageName: null,
        itemLevel: '',
        shopPrice: '',
        inShop: false,
        canBeHQ: true,
        isTradable: true,
      };
    }
    
    // No Traditional Chinese name found, try other languages in order: EN, JA, KO, ZH, DE, FR
    const languageFallbacks = [
      { table: 'en_items', column: 'en' },
      { table: 'ja_items', column: 'ja' },
      { table: 'ko_items', column: 'ko' },
      { table: 'cn_items', column: 'zh' },
      { table: 'de_items', column: 'de' },
      { table: 'fr_items', column: 'fr' },
    ];
    
    for (const lang of languageFallbacks) {
      try {
        const langItemData = await getLanguageItemById(itemId, lang.table, lang.column);
        if (langItemData && langItemData[lang.column]) {
          // Found name in this language
          const cleanName = langItemData[lang.column].replace(/^["']|["']$/g, '').trim();
          return {
            id: itemId,
            name: cleanName,
            nameTW: null, // No Traditional Chinese name available
            searchLanguageName: cleanName, // Store the found language name
            itemLevel: '',
            shopPrice: '',
            inShop: false,
            canBeHQ: true,
            isTradable: true,
          };
        }
      } catch (err) {
        // Continue to next language if this one fails
        continue;
      }
    }
    
    // No name found in any language
    return null;
  } catch (error) {
    console.error(`Error fetching item ${itemId} from Supabase:`, error);
    // Don't fallback to full database load - it's too expensive
    // Just return null if the targeted query fails
    console.warn(`[ItemDB] ⚠️ Failed to fetch item ${itemId} - returning null (no fallback to avoid loading all items)`);
    return null;
  }
}

// ==================== OCR Fuzzy Search Functions ====================

/**
 * Generate n-grams from text (character-level for Chinese)
 * @param {string} text - Input text
 * @param {number} n - N-gram size (default: 2)
 * @returns {string[]} - Array of n-grams
 */
function toNgrams(text, n = 2) {
  const chars = [...text]; // Correctly handle Unicode
  const res = [];
  for (let i = 0; i <= chars.length - n; i++) {
    res.push(chars.slice(i, i + n).join(''));
  }
  return res;
}

/**
 * Normalize OCR text: remove noise, convert simplified to traditional, etc.
 * @param {string} text - OCR text
 * @returns {string} - Normalized text
 */
function normalizeOCRText(text) {
  if (!text) return '';
  
  // Remove noise characters (dots, commas, dashes, etc.)
  let normalized = text.replace(/[.,\-_]/g, '');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Convert simplified Chinese to traditional (if needed)
  // The text from OCR is already filtered to traditional Chinese only,
  // but we can still normalize variations
  if (containsChinese(normalized)) {
    // If it looks like simplified, convert to traditional
    if (!isTraditionalChinese(normalized)) {
      normalized = convertSimplifiedToTraditional(normalized);
    }
  }
  
  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings (character-level)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculate position similarity score (how many characters match at same positions)
 * @param {string} query - Query text
 * @param {string} name - Item name
 * @returns {number} - Position similarity score (0-1)
 */
function positionMatchScore(query, name) {
  const minLen = Math.min(query.length, name.length);
  if (minLen === 0) return 0;
  
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (query[i] === name[i]) {
      matches++;
    }
  }
  
  return matches / Math.max(query.length, name.length);
}

/**
 * Calculate n-gram overlap score
 * @param {string} query - Query text
 * @param {string} name - Item name
 * @param {number} n - N-gram size (default: 2)
 * @returns {number} - Overlap score (0-1)
 */
function ngramOverlapScore(query, name, n = 2) {
  const queryNgrams = new Set(toNgrams(query, n));
  const nameNgrams = new Set(toNgrams(name, n));
  
  if (queryNgrams.size === 0 && nameNgrams.size === 0) return 1;
  if (queryNgrams.size === 0 || nameNgrams.size === 0) return 0;
  
  let overlap = 0;
  for (const ng of queryNgrams) {
    if (nameNgrams.has(ng)) {
      overlap++;
    }
  }
  
  return overlap / Math.max(queryNgrams.size, nameNgrams.size);
}

/**
 * Calculate OCR-friendly similarity score
 * @param {string} query - OCR query text
 * @param {string} name - Item name
 * @returns {number} - Similarity score (0-1)
 */
function calcOcrFriendlySimilarity(query, name) {
  if (!query || !name) return 0;
  
  // Calculate component scores
  const overlapScore = ngramOverlapScore(query, name, 2);
  const maxLen = Math.max(query.length, name.length);
  const editDist = levenshteinDistance(query, name);
  const edScore = maxLen > 0 ? 1 - (editDist / maxLen) : 0;
  const posScore = positionMatchScore(query, name);
  
  // Weighted combination
  // w1: ngram overlap (0.4) - captures partial matches
  // w2: edit distance (0.4) - captures overall similarity
  // w3: position match (0.2) - captures order preservation
  const w1 = 0.4;
  const w2 = 0.4;
  const w3 = 0.2;
  
  const score = w1 * overlapScore + w2 * edScore + w3 * posScore;
  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}

/**
 * Build n-gram index from items (lazy initialization)
 * @param {Array} items - Items array
 * @param {number} n - N-gram size (default: 2)
 * @returns {Map<string, Set<string>>} - N-gram index (ngram -> Set<itemId>)
 */
function buildNgramIndex(items, n = 2) {
  const index = new Map();
  
  for (const item of items) {
    const itemId = item['key: #'] || '';
    if (!itemId) continue;
    
    // Get item name
    let rawName = item['9: Name'] || '';
    if (!rawName || rawName.trim() === '') {
      rawName = item['0: Singular'] || '';
    }
    
    if (!rawName || rawName.trim() === '') continue;
    
    // Clean name
    const cleanName = rawName.replace(/^["']+|["']+$/g, '').trim();
    if (!cleanName) continue;
    
    // Generate n-grams
    const ngrams = toNgrams(cleanName, n);
    for (const ng of ngrams) {
      if (!index.has(ng)) {
        index.set(ng, new Set());
      }
      index.get(ng).add(itemId);
    }
  }
  
  return index;
}

/**
 * OCR fuzzy search - uses n-gram indexing and OCR-friendly similarity scoring
 * @param {string} query - OCR query text
 * @param {Array} items - Items array (must be loaded)
 * @param {Map<string, Set<string>>} ngramIndex - Pre-built n-gram index (optional, will build if not provided)
 * @param {number} topK - Number of top results to return (default: 50)
 * @param {number} minScore - Minimum similarity score threshold (default: 0.4)
 * @param {number} ocrConfidence - OCR confidence score (0-100, optional, used for adaptive search)
 * @returns {Array} - Array of { item, score } objects, sorted by score descending
 */
function ocrFuzzySearch(query, items, ngramIndex = null, topK = 50, minScore = 0.4, ocrConfidence = null) {
  if (!query || !query.trim()) {
    return [];
  }
  
  const normalizedQuery = normalizeOCRText(query.trim());
  if (!normalizedQuery) {
    return [];
  }
  
  // 置信度加權：如果置信度低，使用更寬鬆的搜索參數
  let effectiveTopK = topK;
  let effectiveMinScore = minScore;
  
  if (ocrConfidence !== null && ocrConfidence !== undefined) {
    // 置信度低於 50，使用更寬鬆的參數
    if (ocrConfidence < 50) {
      effectiveTopK = Math.min(100, topK * 2); // 增加候選數量
      effectiveMinScore = Math.max(0.3, minScore - 0.1); // 降低最低分數閾值
    } else if (ocrConfidence < 70) {
      // 中等置信度，適度放寬
      effectiveTopK = Math.min(75, Math.floor(topK * 1.5));
      effectiveMinScore = Math.max(0.35, minScore - 0.05);
    }
    // 高置信度（>= 70）使用默認參數
  }
  
  // Build n-gram index if not provided
  if (!ngramIndex) {
    ngramIndex = buildNgramIndex(items, 2);
  }
  
  // Step 1: Use n-gram index to find candidate items
  const queryNgrams = toNgrams(normalizedQuery, 2);
  const candidateScore = new Map(); // itemId -> ngram overlap count
  
  for (const ng of queryNgrams) {
    const itemIds = ngramIndex.get(ng);
    if (!itemIds) continue;
    
    for (const itemId of itemIds) {
      candidateScore.set(itemId, (candidateScore.get(itemId) || 0) + 1);
    }
  }
  
  // Step 2: Filter candidates (at least 1 n-gram match)
  const candidates = Array.from(candidateScore.entries())
    .filter(([itemId, count]) => count >= 1)
    .map(([itemId]) => itemId);
  
  if (candidates.length === 0) {
    return [];
  }
  
  // Step 3: Calculate OCR-friendly similarity for each candidate
  const scored = [];
  
  for (const itemId of candidates) {
    const item = items.find(i => (i['key: #'] || '') === itemId);
    if (!item) continue;
    
    // Get item name
    let rawName = item['9: Name'] || '';
    if (!rawName || rawName.trim() === '') {
      rawName = item['0: Singular'] || '';
    }
    
    if (!rawName || rawName.trim() === '') continue;
    
    // Clean name
    const cleanName = rawName.replace(/^["']+|["']+$/g, '').trim();
    if (!cleanName) continue;
    
    // Calculate similarity score
    let score = calcOcrFriendlySimilarity(normalizedQuery, cleanName);
    
    // 置信度加權：低置信度時，對高相似度結果給予額外加分
    if (ocrConfidence !== null && ocrConfidence !== undefined && ocrConfidence < 70) {
      // 如果相似度已經很高（> 0.7），給予額外加分
      if (score > 0.7) {
        score = Math.min(1.0, score + (1 - ocrConfidence / 100) * 0.1);
      }
    }
    
    if (score >= effectiveMinScore) {
      scored.push({ item, score });
    }
  }
  
  // Step 4: Sort by score descending and return top K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, effectiveTopK);
}

/**
 * Search items with OCR-friendly fuzzy matching
 * This function is specifically designed for OCR text recognition results.
 * It first tries exact/substring matching, then falls back to OCR fuzzy search.
 * 
 * @param {string} searchText - OCR recognized text
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Object>} - Search results with OCR-specific metadata
 */
export async function searchItemsOCR(searchText, signal = null) {
  if (!searchText || searchText.trim() === '') {
    return {
      results: [],
      converted: false,
      originalText: '',
      convertedText: null,
      searchedSimplified: false,
      isOCRSearch: true
    };
  }

  const trimmedSearchText = searchText.trim();
  let results = [];
  let converted = false;
  let originalText = trimmedSearchText;
  let convertedText = null;
  let searchedSimplified = false;

  // Normalize OCR text
  const normalizedQuery = normalizeOCRText(trimmedSearchText);

  // Step 1: Try exact/substring match first (same as regular search)
  try {
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    
    // Try exact match with normalized query
    const searchResults = await searchTwItems(normalizedQuery, false, signal);
    if (signal && signal.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    
    const shopItems = [];
    const shopItemIds = new Set();
    const items = transformSearchResultsToItems(searchResults, shopItems, shopItemIds, null);
    
    // Check marketability
    let marketItems = null;
    if (items.length > 0) {
      const itemIds = items.map(item => parseInt(item['key: #'], 10)).filter(id => !isNaN(id));
      if (itemIds.length > 0) {
        try {
          const { getMarketItemsByIds } = await import('./supabaseData');
          marketItems = await getMarketItemsByIds(itemIds, signal);
        } catch (error) {
          console.warn(`[ItemDB] ⚠️ Failed to check marketability:`, error);
          marketItems = null;
        }
      }
    }
    
    // Return ALL items (both marketable and non-marketable) for proper separation
    results = performSearch(items, shopItems, shopItemIds, normalizedQuery, false, marketItems, true);
    
    // Load ilvl and version data
    if (results.length > 0) {
      await loadIlvlAndVersionForResults(results, signal);
    }
  } catch (error) {
    if (error.name === 'AbortError' || (signal && signal.aborted)) {
      throw error;
    }
    console.error('Error in OCR exact search:', error);
  }

  // Step 2: If no results, try OCR fuzzy search
  if (results.length === 0) {
    try {
      // Load full database for fuzzy search (required for n-gram indexing)
      // Pass isOCRFuzzySearch=true to indicate this is a legitimate OCR fallback scenario
      const { items } = await loadItemDatabase(true);
      
      if (signal && signal.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      
      // Build n-gram index
      const ngramIndex = buildNgramIndex(items, 2);
      
      // Perform OCR fuzzy search
      const ocrResults = ocrFuzzySearch(normalizedQuery, items, ngramIndex, 50, 0.4);
      
      if (ocrResults.length > 0) {
        // Transform OCR fuzzy results to standard format
        const shopItems = [];
        const shopItemIds = new Set();
        
        // Check marketability for OCR results
        let marketItems = null;
        const itemIds = ocrResults.map(({ item }) => parseInt(item['key: #'], 10)).filter(id => !isNaN(id));
        if (itemIds.length > 0) {
          try {
            const { getMarketItemsByIds } = await import('./supabaseData');
            marketItems = await getMarketItemsByIds(itemIds, signal);
          } catch (error) {
            console.warn(`[ItemDB] ⚠️ Failed to check marketability for OCR results:`, error);
            marketItems = null;
          }
        }
        
        // Transform to result format
        results = ocrResults.map(({ item, score }) => {
          const id = item['key: #'];
          let name = item['9: Name'] || '';
          if (!name || name.trim() === '') {
            name = item['0: Singular'] || '';
          }
          const itemLevel = item['11: Level{Item}'] || '';
          const shopPrice = item['25: Price{Mid}'] || '';
          const canBeHQ = item['27: CanBeHq'] !== 'False';
          const inShop = shopItemIds.has(id);
          
          // Check if item is tradable
          let isTradable;
          if (marketItems !== null) {
            const itemIdNum = parseInt(id, 10);
            isTradable = marketItems.has(itemIdNum);
          } else {
            const untradableValue = (item['22: IsUntradable'] || '').toString().trim();
            const isUntradable = untradableValue === 'True' || 
                                untradableValue === 'true' || 
                                untradableValue === 'TRUE' ||
                                untradableValue === '1';
            isTradable = !isUntradable;
          }
          
          const cleanName = name.replace(/^["']|["']$/g, '').trim();
          
          return {
            id: parseInt(id, 10) || 0,
            name: cleanName,
            nameTW: cleanName,
            nameSimplified: cleanName,
            itemLevel: itemLevel,
            shopPrice: shopPrice,
            inShop: inShop,
            canBeHQ: canBeHQ,
            isTradable: isTradable,
            ocrScore: score, // Add OCR similarity score
          };
        }).filter(item => item.id > 0);
        
        // Sort by OCR score descending, then by tradability
        results.sort((a, b) => {
          const scoreDiff = (b.ocrScore || 0) - (a.ocrScore || 0);
          if (scoreDiff !== 0) return scoreDiff;
          const tradableDiff = (b.isTradable ? 1 : 0) - (a.isTradable ? 1 : 0);
          if (tradableDiff !== 0) return tradableDiff;
          return a.id - b.id;
        });
        
        // Load ilvl and version data
        if (results.length > 0) {
          await loadIlvlAndVersionForResults(results, signal);
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || (signal && signal.aborted)) {
        throw error;
      }
      console.error('Error in OCR fuzzy search:', error);
    }
  }

  // Return results with OCR-specific metadata
  return {
    results,
    converted,
    originalText,
    convertedText,
    searchedSimplified,
    isOCRSearch: true
  };
}
