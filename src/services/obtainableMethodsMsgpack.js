/**
 * Obtainable Methods Database Service
 *
 * Loads prebuilt obtain-method sources from optimized JSON format.
 * Now 70% smaller than MessagePack version!
 */

import { DataType, getTypeIdFromString, getChineseName } from '../constants/dataTypes.js';

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
function normalizeSource(source) {
  const normalized = { ...source };

  const typeId = typeof normalized.type === 'string'
    ? getTypeIdFromString(normalized.type)
    : normalized.type;

  normalized.type = typeId;

  if (!normalized.typeName && typeId !== undefined && typeId !== null) {
    normalized.typeName = getChineseName(typeId);
  }

  if (normalized.data === undefined || normalized.data === null) {
    switch (typeId) {
      case DataType.TREASURES:
        if (Array.isArray(normalized.productIds)) {
          normalized.data = normalized.productIds;
        }
        break;

      case DataType.INSTANCES:
        if (Array.isArray(normalized.instanceIds)) {
          normalized.data = normalized.instanceIds;
        } else if (Array.isArray(normalized.instanceNames)) {
          normalized.data = normalized.instanceNames.map(name => ({ name }));
        }
        break;

      case DataType.QUESTS:
        if (normalized.questId) {
          normalized.data = [{
            id: normalized.questId,
            name: normalized.questName
          }];
        }
        break;

      case DataType.FATES:
        if (normalized.fateId) {
          normalized.data = [{
            id: normalized.fateId,
            name: normalized.fateName,
            level: normalized.level,
            zoneId: normalized.zoneId
          }];
        }
        break;

      case DataType.ACHIEVEMENTS:
        if (Array.isArray(normalized.achievementIds)) {
          normalized.data = normalized.achievementIds;
        }
        break;

      case DataType.MASTERBOOKS:
        if (Array.isArray(normalized.masterbookItemIds)) {
          normalized.data = normalized.masterbookItemIds;
        }
        break;

      case DataType.GATHERED_BY:
        if (Array.isArray(normalized.nodes)) {
          normalized.data = {
            level: normalized.level,
            type: normalized.gatheringType,
            nodes: normalized.nodes
          };
        }
        break;

      case DataType.ALARMS:
        if (Array.isArray(normalized.nodes)) {
          normalized.data = normalized.nodes;
        }
        break;

      case DataType.VENTURES:
        if (Array.isArray(normalized.tasks)) {
          normalized.data = normalized.tasks;
        }
        break;

      case DataType.VOYAGES:
        if (Array.isArray(normalized.voyages)) {
          normalized.data = normalized.voyages;
        }
        break;

      case DataType.GARDENING:
        if (normalized.seedItemId) {
          normalized.data = {
            seedItemId: normalized.seedItemId,
            duration: normalized.duration,
            crossBreeds: normalized.crossBreeds
          };
        }
        break;

      case DataType.DROPS:
        if (Array.isArray(normalized.monsters)) {
          normalized.data = normalized.monsters;
        }
        break;

      case DataType.REQUIREMENTS:
        if (Array.isArray(normalized.drops)) {
          normalized.data = normalized.drops;
        }
        break;

      case DataType.MOGSTATION:
        if (normalized.productId) {
          normalized.data = {
            id: normalized.productId,
            price: normalized.price
          };
        }
        break;

      case DataType.ISLAND_CROP:
        if (normalized.seedItemId) {
          normalized.data = { seed: normalized.seedItemId };
        }
        break;

      default:
        break;
    }
  }

  return normalized;
}

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

  // Normalize sources: convert type string to DataType, hydrate missing data fields
  return sources.map(normalizeSource);
}

// End of file