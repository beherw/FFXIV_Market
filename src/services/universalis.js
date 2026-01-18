import axios from 'axios';
import { requestManager } from '../utils/requestManager';

const UNIVERSALIS_BASE_URL = 'https://universalis.app/api/v2';

// Cache for marketable items
let marketableItemsCache = null;
let marketableItemsSet = null;

/**
 * Get the set of marketable item IDs
 * @returns {Promise<Set<number>>} - Set of marketable item IDs
 */
export async function getMarketableItems() {
  if (marketableItemsSet) {
    return marketableItemsSet;
  }

  try {
    const response = await axios.get(`${UNIVERSALIS_BASE_URL}/marketable`);
    marketableItemsCache = response.data || [];
    marketableItemsSet = new Set(marketableItemsCache);
    return marketableItemsSet;
  } catch (error) {
    console.error('Error fetching marketable items:', error);
    return new Set();
  }
}

/**
 * Check if an item is marketable
 * @param {number} itemId - Item ID to check
 * @returns {Promise<boolean>} - True if marketable
 */
export async function isItemMarketable(itemId) {
  const marketable = await getMarketableItems();
  return marketable.has(itemId);
}

/**
 * Get daily sale velocity, average price, and tradability for multiple items (DC level only)
 * @param {string} dcName - Data center name
 * @param {Array<number>} itemIds - Array of item IDs (max 100)
 * @returns {Promise<Object>} - Object with itemId as key and { velocity, averagePrice, isTradable } as value
 */
export async function getItemsVelocity(dcName, itemIds, options = {}) {
  if (options.signal && options.signal.aborted) {
    return {};
  }

  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Limit to 100 items per request
  const limitedIds = itemIds.slice(0, 100);
  const itemIdsString = limitedIds.join(',');

  try {
    const config = {};
    if (options.signal) {
      config.signal = options.signal;
    }

    const response = await axios.get(
      `${UNIVERSALIS_BASE_URL}/aggregated/${encodeURIComponent(dcName)}/${itemIdsString}`,
      config
    );

    const results = {};
    const data = response.data;

    // Track which item IDs appear in results (tradable) vs failedItems (non-tradable)
    const tradableItemIds = new Set();
    if (data && data.results) {
      data.results.forEach(item => {
        const itemId = item.itemId;
        tradableItemIds.add(itemId);
        
        // Get DC velocity - compare NQ and HQ, pick higher
        const nqVelocity = item.nq?.dailySaleVelocity?.dc?.quantity;
        const hqVelocity = item.hq?.dailySaleVelocity?.dc?.quantity;
        
        let velocity = null;
        if (nqVelocity !== undefined || hqVelocity !== undefined) {
          velocity = Math.max(nqVelocity || 0, hqVelocity || 0);
        }
        
        // Get DC average price - compare NQ and HQ, pick lower (cheaper)
        const nqAvgPrice = item.nq?.averageSalePrice?.dc?.price;
        const hqAvgPrice = item.hq?.averageSalePrice?.dc?.price;
        
        let averagePrice = null;
        if (nqAvgPrice !== undefined && hqAvgPrice !== undefined) {
          averagePrice = Math.min(nqAvgPrice, hqAvgPrice);
        } else if (hqAvgPrice !== undefined) {
          averagePrice = hqAvgPrice;
        } else if (nqAvgPrice !== undefined) {
          averagePrice = nqAvgPrice;
        }
        
        results[itemId] = {
          velocity: velocity,
          averagePrice: averagePrice !== null ? Math.round(averagePrice) : null,
          isTradable: true, // Item appears in results, so it's tradable
        };
      });
    }

    // Items that don't appear in results are non-tradable
    // Also check failedItems if present
    const failedItemIds = new Set(data?.failedItems || []);
    limitedIds.forEach(itemId => {
      if (!tradableItemIds.has(itemId) && !results[itemId]) {
        // Item not in results - check if it's in failedItems or just doesn't exist
        results[itemId] = {
          velocity: null,
          averagePrice: null,
          isTradable: false, // Not in results, so not tradable
        };
      }
    });

    return results;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || (options.signal && options.signal.aborted)) {
      return {};
    }
    console.error(`Error fetching items velocity for ${dcName}:`, error);
    return {};
  }
}

/**
 * Get most recently updated items for a data center
 * @param {string} dcName - Data center name (e.g., '陸行鳥')
 * @param {number} entries - Number of entries to return (default 20, max 200)
 * @param {Object} options - Additional options like abort signal
 * @returns {Promise<Array>} - Array of recently updated items with itemID, lastUploadTime, worldID, worldName
 */
export async function getMostRecentlyUpdatedItems(dcName, entries = 20, options = {}) {
  if (options.signal && options.signal.aborted) {
    return null;
  }

  try {
    const config = {
      params: {
        dcName: dcName,
        entries: entries,
      },
    };

    if (options.signal) {
      config.signal = options.signal;
    }

    const response = await axios.get(`${UNIVERSALIS_BASE_URL}/extra/stats/most-recently-updated`, config);
    return response.data?.items || [];
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || (options.signal && options.signal.aborted)) {
      return null;
    }
    console.error('Error fetching most recently updated items:', error);
    return [];
  }
}

/**
 * Get market data for an item from a specific world/server
 * @param {number} itemId - Item ID
 * @param {string} worldName - World/server name
 * @returns {Promise<Object>} - Market data for the item
 */
export async function getMarketData(server, itemId, options = {}) {
  // Don't use request manager if request is aborted
  if (options.signal && options.signal.aborted) {
    return null;
  }

  try {
    // Use request manager to handle rate limits
    const data = await requestManager.makeRequest(
      async () => {
        const params = {
          listings: options.listings || 20,
          entries: options.entries || 20,
        };
        
        if (options.hq) {
          params.hq = true;
        }

        const config = {
          params,
        };

        // Add abort signal if provided
        if (options.signal) {
          config.signal = options.signal;
        }

        const response = await axios.get(`${UNIVERSALIS_BASE_URL}/${server}/${itemId}`, config);
        return response.data;
      },
      {
        maxRetries: 2,
        onRateLimit: (attempt, delay) => {
          // This will be handled by the caller
        }
      }
    );

    return data;
  } catch (error) {
    // Don't log error if request was aborted
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || (options.signal && options.signal.aborted)) {
      return null;
    }

    // Check for rate limit errors
    if (requestManager.isRateLimitError(error)) {
      throw new Error('請求頻率過高，請稍後再試');
    }

    console.error(`Error fetching market data for ${server}:`, error);
    throw error;
  }
}

/**
 * Get market data for an item from a specific world/server (legacy function)
 */
export async function getMarketDataByWorld(itemId, worldName) {
  return getMarketData(worldName, itemId);
}

/**
 * Get market data for an item from multiple worlds/servers
 * @param {number} itemId - Item ID
 * @param {Array<string>} worldNames - Array of world/server names
 * @returns {Promise<Object>} - Object with world names as keys and market data as values
 */
export async function getMarketDataMultiple(itemId, worldNames) {
  const results = {};
  
  // Fetch data for all worlds in parallel
  const promises = worldNames.map(async (worldName) => {
    const data = await getMarketData(itemId, worldName);
    if (data) {
      results[worldName] = data;
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Get market data for an item from an entire data center
 * @param {number} itemId - Item ID
 * @param {string} dataCenter - Data center name
 * @returns {Promise<Object>} - Market data aggregated by data center
 */
export async function getMarketDataByDataCenter(itemId, dataCenter) {
  try {
    const response = await axios.get(`${UNIVERSALIS_BASE_URL}/${dataCenter}/${itemId}`, {
      params: {
        listings: 20,
        entries: 20,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching market data for ${dataCenter}:`, error);
    return null;
  }
}

/**
 * Get aggregated market data for multiple items (up to 100) - uses cached values, faster
 * - DC selected: Returns MIN LISTING PRICE with server name (cheapest current listing)
 * - Specific server selected: Returns AVERAGE SALE PRICE (based on last 4 days of sales)
 * @param {string|number} worldDcRegion - World ID (number) or DC/region name (string)
 * @param {Array<number>} itemIds - Array of item IDs (max 100)
 * @param {Object} worlds - World ID to name mapping
 * @param {Object} options - Additional options like abort signal
 * @returns {Promise<Object>} - Object with itemId as key and { price, isHQ, worldName?, priceType } as value
 */
export async function getAggregatedMarketData(worldDcRegion, itemIds, worlds = {}, options = {}) {
  if (options.signal && options.signal.aborted) {
    return {};
  }

  if (!itemIds || itemIds.length === 0) {
    return {};
  }

  // Limit to 100 items per request
  const limitedIds = itemIds.slice(0, 100);
  const itemIdsString = limitedIds.join(',');

  // Determine if we're querying a specific world (number) or a DC (string)
  const isSpecificWorld = typeof worldDcRegion === 'number' || 
    (typeof worldDcRegion === 'string' && !isNaN(Number(worldDcRegion)));

  try {
    const config = {};
    if (options.signal) {
      config.signal = options.signal;
    }

    const response = await axios.get(
      `${UNIVERSALIS_BASE_URL}/aggregated/${encodeURIComponent(worldDcRegion)}/${itemIdsString}`,
      config
    );

    const results = {};
    const data = response.data;

    if (data && data.results) {
      data.results.forEach(item => {
        const itemId = item.itemId;
        
        let bestPrice = null;
        let isHQ = false;
        let worldName = null;
        let priceType = 'average'; // 'average' or 'minListing'

        if (isSpecificWorld) {
          // When querying specific world, use AVERAGE SALE PRICE (world level)
          const nqAvgPrice = item.nq?.averageSalePrice?.world?.price;
          const hqAvgPrice = item.hq?.averageSalePrice?.world?.price;
          
          priceType = 'average';

          // Compare NQ and HQ average prices, pick the cheaper one
          if (nqAvgPrice && hqAvgPrice) {
            if (hqAvgPrice <= nqAvgPrice) {
              bestPrice = Math.round(hqAvgPrice);
              isHQ = true;
            } else {
              bestPrice = Math.round(nqAvgPrice);
              isHQ = false;
            }
          } else if (hqAvgPrice) {
            bestPrice = Math.round(hqAvgPrice);
            isHQ = true;
          } else if (nqAvgPrice) {
            bestPrice = Math.round(nqAvgPrice);
            isHQ = false;
          }
        } else {
          // When querying DC, use MIN LISTING PRICE with server name
          const nqMinListing = item.nq?.minListing?.dc;
          const hqMinListing = item.hq?.minListing?.dc;
          
          priceType = 'minListing';

          // Compare NQ and HQ min listing prices, pick the cheaper one
          if (nqMinListing?.price && hqMinListing?.price) {
            if (hqMinListing.price <= nqMinListing.price) {
              bestPrice = hqMinListing.price;
              isHQ = true;
              worldName = worlds[hqMinListing.worldId] || `伺服器 ${hqMinListing.worldId}`;
            } else {
              bestPrice = nqMinListing.price;
              isHQ = false;
              worldName = worlds[nqMinListing.worldId] || `伺服器 ${nqMinListing.worldId}`;
            }
          } else if (hqMinListing?.price) {
            bestPrice = hqMinListing.price;
            isHQ = true;
            worldName = worlds[hqMinListing.worldId] || `伺服器 ${hqMinListing.worldId}`;
          } else if (nqMinListing?.price) {
            bestPrice = nqMinListing.price;
            isHQ = false;
            worldName = worlds[nqMinListing.worldId] || `伺服器 ${nqMinListing.worldId}`;
          }
        }

        // Get daily sale velocity - compare NQ and HQ, pick the higher one
        let velocityWorld = null;
        let velocityDc = null;
        
        const nqVelocityWorld = item.nq?.dailySaleVelocity?.world?.quantity;
        const hqVelocityWorld = item.hq?.dailySaleVelocity?.world?.quantity;
        const nqVelocityDc = item.nq?.dailySaleVelocity?.dc?.quantity;
        const hqVelocityDc = item.hq?.dailySaleVelocity?.dc?.quantity;
        
        // Pick higher velocity between NQ and HQ for world
        if (nqVelocityWorld !== undefined || hqVelocityWorld !== undefined) {
          velocityWorld = Math.max(nqVelocityWorld || 0, hqVelocityWorld || 0);
        }
        
        // Pick higher velocity between NQ and HQ for DC
        if (nqVelocityDc !== undefined || hqVelocityDc !== undefined) {
          velocityDc = Math.max(nqVelocityDc || 0, hqVelocityDc || 0);
        }

        if (bestPrice !== null) {
          const result = {
            price: bestPrice,
            isHQ: isHQ,
            priceType: priceType,
          };
          // Only include worldName for DC queries (minListing)
          if (worldName) {
            result.worldName = worldName;
          }
          // Include velocity data
          if (velocityWorld !== null) {
            result.velocityWorld = velocityWorld;
          }
          if (velocityDc !== null) {
            result.velocityDc = velocityDc;
          }
          results[itemId] = result;
        }
      });
    }

    return results;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || (options.signal && options.signal.aborted)) {
      return {};
    }
    console.error(`Error fetching aggregated market data for ${worldDcRegion}:`, error);
    return {};
  }
}

/**
 * Format market data for display
 * @param {Object} marketData - Raw market data from Universalis
 * @returns {Object} - Formatted market data
 */
export function formatMarketData(marketData) {
  if (!marketData) return null;

  const listings = marketData.listings || [];
  const recentHistory = marketData.recentHistory || [];

  // Get current listings with prices
  const currentListings = listings
    .map(listing => ({
      price: listing.pricePerUnit,
      quantity: listing.quantity,
      total: listing.total,
      hq: listing.hq || false,
      worldName: listing.worldName,
      retainerName: listing.retainerName,
    }))
    .sort((a, b) => a.price - b.price);

  // Get recent sales
  const recentSales = recentHistory
    .map(entry => ({
      price: entry.pricePerUnit,
      quantity: entry.quantity,
      total: entry.total,
      hq: entry.hq || false,
      timestamp: entry.timestamp,
      buyerName: entry.buyerName,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  // Calculate statistics
  const prices = currentListings.map(l => l.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
  const avgPrice = prices.length > 0 
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : null;

  return {
    worldName: marketData.worldName || marketData.dcName,
    currentListings,
    recentSales,
    minPrice,
    maxPrice,
    avgPrice,
    lastUploadTime: marketData.lastUploadTime,
    lastCheckTime: marketData.lastCheckTime,
  };
}
