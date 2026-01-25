// Item database service - loads Traditional Chinese item data from local tw-items.json
// Items are already in Traditional Chinese, so no translation needed for item names

import { convertSimplifiedToTraditional, convertTraditionalToSimplified, isTraditionalChinese } from '../utils/chineseConverter';
import twItemsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-items.json';
import twItemDescriptionsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-item-descriptions.json';

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
 * Load items database from local tw-items.json
 * Items are already in Traditional Chinese format
 */
export async function loadItemDatabase() {
  if (itemsDatabase && shopItemsDatabase) {
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  }

  isLoading = true;

  try {
    // Items are already loaded from the JSON import
    // Convert the JSON structure to an array of items matching the CSV format
    // JSON structure: { "13589": { "tw": "堅鋼投斧" }, ... }
    // We need to convert to: [{ "key: #": "13589", "9: Name": "堅鋼投斧", ... }, ...]
    const items = Object.entries(twItemsData).map(([id, data]) => {
      const itemName = data.tw || '';
      // Transform to match the expected CSV format
      return {
        'key: #': id,
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
    shopItemsDatabase = []; // Shop items not available in JSON, keep empty array

    isLoading = false;
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  } catch (error) {
    isLoading = false;
    console.error('Failed to load item database:', error);
    throw error;
  }
}

/**
 * Internal helper function to perform the actual search with a given search text
 * @param {Array} items - Items array from database
 * @param {Array} shopItems - Shop items array
 * @param {Set} shopItemIds - Set of shop item IDs
 * @param {string} searchText - Search text to use
 * @returns {Array} Search results
 */
function performSearch(items, shopItems, shopItemIds, searchText) {
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
      const untradableValue = (item['22: IsUntradable'] || '').toString().trim();
      const isUntradable = untradableValue === 'True' || 
                          untradableValue === 'true' || 
                          untradableValue === 'TRUE' ||
                          untradableValue === '1';
      const itemId = item['key: #'] || '';
      
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
      const matches = words.every(word => {
        return cleanName.includes(word);
      });
      
      // Debug: log matches for item 10636
      if (process.env.NODE_ENV === 'development' && itemId === '10636') {
        console.log('Item 10636 search check:', {
          itemId,
          rawName,
          cleanName,
          searchText,
          words,
          matches,
          isUntradable,
          untradableValue
        });
      }
      
      if (matches) {
        matchCount++;
      } else if (hasMapInName || cleanName.includes('地圖')) {
        itemsWithMapButFiltered++;
      }
      
      // Debug: log matches for "地圖" search
      if (process.env.NODE_ENV === 'development' && trimmedSearchText.includes('地圖')) {
        if (cleanName.includes('地圖') || cleanName.includes('鞣革')) {
          console.log('Potential match:', { 
            cleanName, 
            rawName,
            words, 
            matches,
            includesMap: cleanName.includes('地圖'),
            includesLeather: cleanName.includes('鞣革')
          });
        }
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

      // Get description from tw-item-descriptions.json
      const descriptionData = twItemDescriptionsData[id];
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

      return {
        id: parseInt(id, 10) || 0,
        name: cleanName, // Already in Traditional Chinese, no conversion needed
        nameSimplified: cleanName, // Keep same for compatibility (not used for matching)
        itemLevel: itemLevel,
        shopPrice: shopPrice,
        description: cleanDescription, // From tw-item-descriptions.json
        inShop: inShop,
        canBeHQ: canBeHQ,
        isTradable: isTradable, // Add tradable status
      };
    })
    .filter(item => item.id > 0) // Ensure valid ID
    .sort((a, b) => {
      // Primary sort: Tradable items first (true before false)
      // Convert boolean to number: true=1, false=0
      // b.isTradable - a.isTradable gives: tradable items (1) before non-tradable (0)
      const tradableDiff = (b.isTradable ? 1 : 0) - (a.isTradable ? 1 : 0);
      if (tradableDiff !== 0) {
        return tradableDiff;
      }
      // Secondary sort: By item ID (ascending)
      return a.id - b.id;
    });

  // Debug: log results
  if (process.env.NODE_ENV === 'development') {
    console.log('Search results:', { 
      searchText, 
      words, 
      matchCount, 
      resultCount: results.length,
      filteredByUntradable,
      filteredByEmptyName,
      itemsWithMap,
      itemsWithMapButFiltered,
      sampleResults: results.slice(0, 5).map(r => r.name)
    });
  }

  return results;
}

/**
 * Search items - replicates ObservableHQ's SQL query
 * Query: select items."key: #" as id, "9: Name" as name, "11: Level{Item}" as itemLevel, 
 *        "25: Price{Mid}" as shopPrice, "8: Description" as description, 
 *        IF(shop_items."0: Item" is null, false, true) as inShop, 
 *        IF("27: CanBeHq" = 'False', false, true) as canBeHQ 
 *        from items left join shop_items on items."key: #" = shop_items."0: Item" 
 *        where name != '' and "22: IsUntradable" = 'False' and name like ? [for each word]
 * 
 * First searches with the original query. If no results are found, converts Traditional/Simplified
 * Chinese and searches again.
 */
export async function searchItems(searchText) {
  if (!searchText || searchText.trim() === '') {
    return {
      results: [],
      converted: false,
      originalText: '',
      convertedText: null
    };
  }

  const { items, shopItems } = await loadItemDatabase();

  // Create shop items lookup
  const shopItemIds = new Set();
  shopItems.forEach(item => {
    const itemId = item['0: Item'];
    if (itemId) {
      shopItemIds.add(itemId);
    }
  });

  // Debug: log search terms (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Search terms (original):', { original: searchText });
    console.log('Total items in database:', items.length);
    // Debug: Check if item 10636 exists
    const item10636 = items.find(item => item['key: #'] === '10636');
    if (item10636) {
      console.log('Item 10636 found:', {
        id: item10636['key: #'],
        name: item10636['9: Name'],
        isUntradable: item10636['22: IsUntradable']
      });
    } else {
      console.log('Item 10636 NOT found in items array');
    }
  }

  // First, try searching with the original text (as-is)
  const trimmedSearchText = searchText.trim();
  let results = performSearch(items, shopItems, shopItemIds, trimmedSearchText);
  let converted = false;
  let originalText = trimmedSearchText;
  let convertedText = null;

  // If no results found, try converting Traditional/Simplified Chinese and search again
  if (results.length === 0) {
    // Check if input is already Traditional Chinese - if so, convert to Simplified
    // Otherwise, convert from Simplified to Traditional
    const traditionalSearchText = isTraditionalChinese(trimmedSearchText) 
      ? convertTraditionalToSimplified(trimmedSearchText)
      : convertSimplifiedToTraditional(trimmedSearchText);
    
    // Only retry if the converted text is different from the original
    if (traditionalSearchText !== trimmedSearchText) {
      if (process.env.NODE_ENV === 'development') {
        console.log('No results with original text, trying converted:', { 
          original: trimmedSearchText, 
          converted: traditionalSearchText 
        });
      }
      
      converted = true;
      convertedText = traditionalSearchText;
      results = performSearch(items, shopItems, shopItemIds, traditionalSearchText);
    }
  }

  // Return results with conversion info
  return {
    results,
    converted,
    originalText,
    convertedText
  };
}

/**
 * Get item by ID
 * @param {number} itemId - Item ID
 * @returns {Promise<Object|null>} - Item object or null if not found
 */
export async function getItemById(itemId) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  const { items, shopItems } = await loadItemDatabase();

  // Create shop items lookup
  const shopItemIds = new Set();
  shopItems.forEach(item => {
    const id = item['0: Item'];
    if (id) {
      shopItemIds.add(id);
    }
  });

  // Find item by ID
  const item = items.find(item => {
    const id = item['key: #'];
    return id && parseInt(id, 10) === itemId;
  });

  if (!item) {
    return null;
  }

  const id = item['key: #'];
  // Use "9: Name" as primary, fallback to "0: Singular" if empty
  let name = item['9: Name'] || '';
  if (!name || name.trim() === '') {
    name = item['0: Singular'] || '';
  }
  const itemLevel = item['11: Level{Item}'] || '';
  const shopPrice = item['25: Price{Mid}'] || '';
  const canBeHQ = item['27: CanBeHq'] !== 'False';
  const inShop = shopItemIds.has(id);

  // Get description from tw-item-descriptions.json
  const descriptionData = twItemDescriptionsData[id];
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

  return {
    id: parseInt(id, 10) || 0,
    name: cleanName, // Already in Traditional Chinese, no conversion needed
    nameSimplified: cleanName, // Keep same for compatibility
    itemLevel: itemLevel,
    shopPrice: shopPrice,
    description: cleanDescription, // From tw-item-descriptions.json
    inShop: inShop,
    canBeHQ: canBeHQ,
    isTradable: isTradable, // Add tradable status
  };
}
