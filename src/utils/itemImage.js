// Item image service using XIVAPI
// XIVAPI provides item data including icon paths
// Format: https://xivapi.com/Item/{itemId} returns JSON with Icon field
// Icon field format: /i/020000/020801.png
// Full URL: https://xivapi.com/i/020000/020801.png

// Cache for icon paths to avoid repeated API calls
const iconCache = new Map();
// Track pending requests to avoid duplicate API calls
const pendingRequests = new Map();

/**
 * Calculate icon path from item ID (common pattern in FFXIV)
 * Format: /i/{folder}/{iconId}.png where folder is usually 6 digits and iconId is 6 digits
 * This is a fallback method - may not work for all items
 * @param {number} itemId - Item ID
 * @returns {string} - Calculated icon path
 */
function calculateIconPath(itemId) {
  // Convert item ID to 6-digit string with leading zeros
  const iconId = itemId.toString().padStart(6, '0');
  // Most items use folder 020000, but this may vary
  // Try common folder patterns
  const folders = ['020000', '021000', '022000', '023000', '024000'];
  return folders.map(folder => `https://xivapi.com/i/${folder}/${iconId}.png`);
}

/**
 * Get item icon path from XIVAPI
 * @param {number} itemId - Item ID
 * @returns {Promise<string|null>} - Icon URL or null if not found
 */
async function fetchIconPathFromAPI(itemId) {
  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Use columns parameter to only fetch Icon field (faster)
    const response = await fetch(`https://xivapi.com/Item/${itemId}?columns=Icon`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        // Item not found
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.Icon) {
      // Icon path is relative, e.g., /i/020000/020801.png
      const iconUrl = `https://xivapi.com${data.Icon}`;
      // Cache the result
      iconCache.set(itemId, iconUrl);
      return iconUrl;
    }
    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Timeout fetching icon for item ${itemId}`);
    } else {
      console.error(`Failed to fetch icon for item ${itemId}:`, error);
    }
    return null;
  }
}

/**
 * Get item image URL from XIVAPI with caching
 * @param {number} itemId - Item ID
 * @returns {Promise<string|null>} - Item image URL or null
 */
export async function getItemImageUrl(itemId) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  // Check cache first
  if (iconCache.has(itemId)) {
    return iconCache.get(itemId);
  }

  // Check if there's already a pending request for this item
  if (pendingRequests.has(itemId)) {
    return await pendingRequests.get(itemId);
  }

  // Create new request
  const requestPromise = fetchIconPathFromAPI(itemId)
    .finally(() => {
      // Remove from pending requests when done
      pendingRequests.delete(itemId);
    });

  pendingRequests.set(itemId, requestPromise);
  return await requestPromise;
}

/**
 * Get item image URL synchronously (returns cached value or null)
 * For use in components that need immediate value
 * @param {number} itemId - Item ID
 * @returns {string|null} - Cached icon URL or null
 */
export function getItemImageUrlSync(itemId) {
  if (!itemId || itemId <= 0) {
    return null;
  }
  return iconCache.get(itemId) || null;
}

/**
 * Get calculated icon URLs (fallback method, may not work for all items)
 * @param {number} itemId - Item ID
 * @returns {Array<string>} - Array of calculated icon URLs to try
 */
export function getCalculatedIconUrls(itemId) {
  if (!itemId || itemId <= 0) {
    return [];
  }
  return calculateIconPath(itemId);
}

/**
 * Preload icon for an item (useful for batch loading)
 * @param {number} itemId - Item ID
 * @returns {Promise<string|null>} - Icon URL or null
 */
export async function preloadItemIcon(itemId) {
  return await getItemImageUrl(itemId);
}

/**
 * Clear the icon cache
 */
export function clearIconCache() {
  iconCache.clear();
  pendingRequests.clear();
}
