/**
 * Obtainable Methods Database Service
 *
 * Loads prebuilt obtain-method sources from optimized JSON format.
 * Now 70% smaller than MessagePack version!
 */

import { DataType, getTypeIdFromString } from '../constants/dataTypes.js';

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

  // Return sources with type converted from string to numeric DataType
  // Keep all other properties intact - renderers now access them directly (not via data field)
  return sources.map(source => ({
    ...source,
    type: getTypeIdFromString(source.type)
  }));
}

// End of file