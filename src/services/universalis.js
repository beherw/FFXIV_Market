import axios from 'axios';
import { requestManager } from '../utils/requestManager';

const UNIVERSALIS_BASE_URL = 'https://universalis.app/api/v2';

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
