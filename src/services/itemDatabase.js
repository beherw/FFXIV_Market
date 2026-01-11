// Item database service - replicates ObservableHQ's local database approach
// Loads Chinese item data from GitHub and provides search functionality

import { convertTraditionalToSimplified, convertSimplifiedToTraditional } from '../utils/chineseConverter';

let itemsDatabase = null;
let shopItemsDatabase = null;
let isLoading = false;

/**
 * Load Chinese items database from GitHub
 * ObservableHQ uses: https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Item.csv
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
    // Load Item.csv (Chinese items)
    const itemsResponse = await fetch('https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Item.csv');
    const itemsText = await itemsResponse.text();
    
    // Parse CSV (same format as ObservableHQ)
    const itemsData = parseCSV(itemsText);
    itemsDatabase = itemsData;

    // Load GilShopItem.csv (shop items)
    const shopResponse = await fetch('https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/GilShopItem.csv');
    const shopText = await shopResponse.text();
    const shopData = parseCSV(shopText);
    shopItemsDatabase = shopData;

    isLoading = false;
    return { items: itemsDatabase, shopItems: shopItemsDatabase };
  } catch (error) {
    isLoading = false;
    console.error('Failed to load item database:', error);
    throw error;
  }
}

/**
 * Parse CSV in the format used by ObservableHQ
 * Format: key,0,1... (first line), #, Name, ... (second line), int,str,... (third line), data... (fourth line+)
 */
function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  if (lines.length < 4) {
    console.error('Invalid CSV format');
    return [];
  }

  // First line: key,0,1,2...
  const idxes = lines[0].split(',');
  
  // Second line: #, Name, Description, ...
  const labels = lines[1].split(',');
  
  // Third line: int,str,str,... (type info, we skip this)
  
  // Fourth line onwards: actual data
  const dataLines = lines.slice(3);
  
  const data = dataLines.map(line => {
    // Handle CSV with quoted values that may contain commas
    const values = parseCSVLine(line);
    const obj = {};
    idxes.forEach((idx, i) => {
      if (i < labels.length) {
        const key = `${idx}: ${labels[i]}`;
        // Preserve the value as-is (including empty strings), similar to d3.csvParseRows
        // d3.csvParseRows returns the raw value, which could be empty string
        // Use the value from array if available, otherwise empty string
        obj[key] = (i < values.length && values[i] !== undefined) ? values[i] : '';
      }
    });
    return obj;
  }).filter(obj => Object.keys(obj).length > 0);

  return data;
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
      // Toggle quote state
      inQuotes = !inQuotes;
      // Don't add the quote to the value
    } else if (char === ',' && !inQuotes) {
      // End of field - preserve empty strings (don't use || '' which would convert falsy values)
      // This matches d3.csvParseRows behavior
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current);
  
  // Trim all values (but preserve empty strings as empty strings, not undefined)
  return values.map(v => v.trim());
}

/**
 * Search items - replicates ObservableHQ's SQL query
 * Query: select items."key: #" as id, "9: Name" as name, "11: Level{Item}" as itemLevel, 
 *        "25: Price{Mid}" as shopPrice, "8: Description" as description, 
 *        IF(shop_items."0: Item" is null, false, true) as inShop, 
 *        IF("27: CanBeHq" = 'False', false, true) as canBeHQ 
 *        from items left join shop_items on items."key: #" = shop_items."0: Item" 
 *        where name != '' and "22: IsUntradable" = 'False' and name like ? [for each word]
 */
export async function searchItems(searchText) {
  if (!searchText || searchText.trim() === '') {
    return [];
  }

  const { items, shopItems } = await loadItemDatabase();

  // Convert user input (Traditional or Simplified) to Simplified for search
  // Database is in Simplified Chinese, so we need to search with Simplified
  const simplifiedSearchText = convertTraditionalToSimplified(searchText.trim());
  
  // Observable's behavior: if search text has spaces, split into words (AND condition)
  // If no spaces, search the entire string as-is
  // This matches Observable's SQL: "name like ? [for each word]"
  const hasSpaces = simplifiedSearchText.includes(' ');
  const words = hasSpaces 
    ? simplifiedSearchText.split(/\s+/).filter(w => w)
    : [simplifiedSearchText]; // Single word, search entire string
  
  // Debug: log search terms (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Search terms:', { original: searchText, simplified: simplifiedSearchText, words });
    console.log('Total items in database:', items.length);
  }

  // Create shop items lookup
  const shopItemIds = new Set();
  shopItems.forEach(item => {
    const itemId = item['0: Item'];
    if (itemId) {
      shopItemIds.add(itemId);
    }
  });

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
      
      if (matches) {
        matchCount++;
      } else if (hasMapInName || cleanName.includes('地图')) {
        itemsWithMapButFiltered++;
      }
      
      // Debug: log matches for "地图" search
      if (process.env.NODE_ENV === 'development' && simplifiedSearchText.includes('地图')) {
        if (cleanName.includes('地图') || cleanName.includes('鞣革')) {
          console.log('Potential match:', { 
            cleanName, 
            rawName,
            words, 
            matches,
            includesMap: cleanName.includes('地图'),
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
      const description = item['8: Description'] || '';
      const canBeHQ = item['27: CanBeHq'] !== 'False';
      const inShop = shopItemIds.has(id);

      // Convert Simplified Chinese names to Traditional for display
      // Remove any quotes that might be in the name/description
      const cleanName = name.replace(/^["']|["']$/g, '').trim();
      const cleanDescription = description.replace(/^["']|["']$/g, '').trim();
      
      const traditionalName = convertSimplifiedToTraditional(cleanName);
      const traditionalDescription = convertSimplifiedToTraditional(cleanDescription);

      return {
        id: parseInt(id, 10) || 0,
        name: traditionalName, // Display in Traditional Chinese
        nameSimplified: cleanName, // Simplified Chinese name for links
        itemLevel: itemLevel,
        shopPrice: shopPrice,
        description: traditionalDescription, // Display in Traditional Chinese
        inShop: inShop,
        canBeHQ: canBeHQ,
      };
    })
    .filter(item => item.id > 0); // Ensure valid ID

  // Debug: log results
  if (process.env.NODE_ENV === 'development') {
    console.log('Search results:', { 
      searchText, 
      simplifiedSearchText, 
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
  const description = item['8: Description'] || '';
  const canBeHQ = item['27: CanBeHq'] !== 'False';
  const inShop = shopItemIds.has(id);

  // Convert Simplified Chinese names to Traditional for display
  // Remove any quotes that might be in the name/description
  const cleanName = name.replace(/^["']|["']$/g, '').trim();
  const cleanDescription = description.replace(/^["']|["']$/g, '').trim();
  
  const traditionalName = convertSimplifiedToTraditional(cleanName);
  const traditionalDescription = convertSimplifiedToTraditional(cleanDescription);

  return {
    id: parseInt(id, 10) || 0,
    name: traditionalName, // Display in Traditional Chinese
    nameSimplified: cleanName, // Simplified Chinese name for links
    itemLevel: itemLevel,
    shopPrice: shopPrice,
    description: traditionalDescription, // Display in Traditional Chinese
    inShop: inShop,
    canBeHQ: canBeHQ,
  };
}
