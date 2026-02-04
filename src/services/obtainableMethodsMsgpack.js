/**
 * Obtainable Methods Database Service
 *
 * Loads prebuilt obtain-method sources from optimized JSON format.
 * Now 70% smaller than MessagePack version!
 */

let dataCache = null;
let isLoading = false;
let loadPromise = null;

/**
 * Load obtainable methods database from optimized JSON file
 */
export async function loadObtainableMethodsDatabase() {
  if (dataCache) {
    return dataCache;
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  loadPromise = (async () => {
    try {
      const loadStartTime = performance.now();

      console.log('[Obtainable] 📦 Loading optimized database...');
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}data/obtainable-methods.min.json`);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const fetchTime = performance.now() - loadStartTime;
      
      const parseStartTime = performance.now();
      const data = await response.json();
      const parseTime = performance.now() - parseStartTime;
      
      // Calculate size from Content-Length header
      const sizeBytes = parseInt(response.headers.get('content-length') || '0', 10);
      const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
      
      console.log(`[Obtainable] ✓ Fetched ${sizeMB} MB in ${fetchTime.toFixed(2)}ms`);
      console.log(`[Obtainable] ✓ Parsed in ${parseTime.toFixed(2)}ms`);

      dataCache = data;

      const totalTime = performance.now() - loadStartTime;
      console.log(`[Obtainable] ✅ Total load time: ${totalTime.toFixed(2)}ms`);

      isLoading = false;
      return dataCache;
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      console.error('[Obtainable] ❌ Failed to load:', error);
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Get obtain-method sources by item ID
 */
export async function getObtainableSourcesById(itemId) {
  const data = await loadObtainableMethodsDatabase();
  const key = String(itemId);
  const hasKey = Object.prototype.hasOwnProperty.call(data, key)
    || Object.prototype.hasOwnProperty.call(data, itemId);
  if (!hasKey) {
    return null;
  }

  const sources = data[key] || data[itemId] || [];

  if (!Array.isArray(sources)) {
    return [];
  }

  // New optimized format already has the correct structure
  // Just convert 'type' string to numeric DataType for backward compatibility
  return sources.map(source => ({
    type: getTypeIdFromString(source.type),
    typeName: source.typeName,
    data: convertToLegacyFormat(source)
  }));
}

/**
 * Convert type string to DataType enum value
 */
function getTypeIdFromString(typeStr) {
  const typeMap = {
    'craft': 1,
    'specialshop': 2,
    'vendor': 3,
    'reduction': 4,
    'desynth': 5,
    'instance': 6,
    'gathering': 7,
    'venture': 8,
    'treasure': 9,
    'quest': 10,
    'fate': 11,
    'gardening': 12,
    'mogstation': 13,
    'islandpasture': 14,
    'islandcrop': 15,
    'voyage': 16,
    'requirement': 17,
    'masterbook': 18,
    'alarm': 19,
    'drop': 20,
    'achievement': 22,
    'tripleTriadDuel': 23,
    'tripleTriadPack': 24
  };
  if (typeStr && typeMap[typeStr]) {
    return typeMap[typeStr];
  }
  if (typeof typeStr === 'string' && typeStr.startsWith('type_')) {
    const parsed = Number.parseInt(typeStr.slice(5), 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}

/**
 * Convert optimized source format back to legacy format expected by UI
 */
function convertToLegacyFormat(source) {
  const { type, typeName, ...rest } = source;
  
  // For vendors and shops, the data is already in the correct format
  if (type === 'vendor' || type === 'specialshop') {
    if (rest.vendors) {
      return rest.vendors.map(v => ({
        npcName: v.npcName,
        zoneName: v.zoneName,
        x: v.x,
        y: v.y,
        aetheryteName: v.aetheryteName,
        price: rest.price,
        currencyId: rest.currencyItemId,
        currency: rest.currency
      }));
    }
  }
  
  // For instances
  if (type === 'instance') {
    return rest.instanceNames || [];
  }
  
  // For quests
  if (type === 'quest') {
    return [{ id: rest.questId, name: rest.questName }];
  }
  
  // For gathering
  if (type === 'gathering') {
    return rest.nodes || [];
  }
  
  // For voyages
  if (type === 'voyage') {
    return rest.voyageNames || [];
  }

  // For mogstation, any non-empty array is sufficient for renderers
  if (type === 'mogstation' || type === 'type_13') {
    const count = Number.isFinite(rest.count) ? rest.count : 1;
    return Array.from({ length: Math.max(1, count) }, () => 0);
  }
  
  // For most other types, return the entire rest object as an array
  return [rest];
}
