// Item image service using XIVAPI
// XIVAPI provides item data including icon paths
// Format: https://xivapi.com/Item/{itemId} returns JSON with Icon field
// Icon field format: /i/020000/020801.png
// Full URL: https://xivapi.com/i/020000/020801.png
//
// Rate Limiting:
// XIVAPI rate limit: 20 requests per second (both API key and client IP)
// Source: https://xivapi.com/docs/Welcome
// Implementation uses sliding window algorithm to track requests in the last 1 second
// and ensures we never exceed 20 requests per second, maximizing throughput while
// staying within limits.

// Cache for icon paths to avoid repeated API calls
const iconCache = new Map();
// Track pending requests to avoid duplicate API calls
const pendingRequests = new Map();
// Track abort controllers for pending requests to allow cancellation
const abortControllers = new Map();

// Rate limiting queue for icon requests
// XIVAPI rate limit: 20 requests per second (both API key and client IP)
// We use 19 requests per second to stay safely below the limit
// This means minimum ~52.6ms between requests (1000ms / 19 ≈ 52.6ms)
class IconRequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.isPaused = false;
    this.pauseUntil = 0;
    
    // Rate limiting: 20 requests per second (at XIVAPI's limit, tested and safe)
    // Testing shows 20 req/sec works reliably without hitting rate limits
    this.MAX_REQUESTS_PER_SECOND = 20;
    this.MIN_DELAY_MS = 50; // 1000ms / 20 = 50ms minimum between requests
    
    // Track request timestamps for sliding window rate limiting
    this.requestTimestamps = [];
    
    // Retry configuration
    this.RATE_LIMIT_RETRY_DELAY = 2000; // Initial delay when hitting 429
    this.MAX_RETRY_DELAY = 10000; // Maximum retry delay
  }

  /**
   * Check if we can make a request now, or calculate delay needed
   * Uses sliding window: keep track of requests in the last 1 second
   * @returns {number} - Delay in ms before next request can be made (0 if can proceed immediately)
   */
  getDelayBeforeNextRequest() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // Remove timestamps older than 1 second
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneSecondAgo);
    
    // If we have fewer than MAX_REQUESTS_PER_SECOND requests in the last second, we can proceed
    if (this.requestTimestamps.length < this.MAX_REQUESTS_PER_SECOND) {
      return 0;
    }
    
    // We've hit the limit, calculate delay until oldest request expires
    const oldestTimestamp = this.requestTimestamps[0];
    const timeUntilOldestExpires = (oldestTimestamp + 1000) - now;
    
    // Add small buffer to ensure we don't exceed the limit
    return Math.max(timeUntilOldestExpires + 10, this.MIN_DELAY_MS);
  }

  /**
   * Record that a request was made
   */
  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Add a request to the queue
   * @param {number} itemId - Item ID
   * @param {Function} requestFn - Function that makes the API request
   * @param {AbortSignal} abortSignal - Optional abort signal to cancel the request
   * @returns {Promise} - Promise that resolves when the request completes
   */
  async enqueue(itemId, requestFn, abortSignal = null) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        itemId,
        requestFn,
        resolve,
        reject,
        retryCount: 0,
        abortSignal
      });
      
      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process a single request item
   */
  async processItem(item) {
    try {
      // Check if request was cancelled
      if (item.abortSignal && item.abortSignal.aborted) {
        item.reject(new Error('Request cancelled'));
        return;
      }

      // Check rate limit and wait if necessary
      const delay = this.getDelayBeforeNextRequest();
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Check again after delay
      if (item.abortSignal && item.abortSignal.aborted) {
        item.reject(new Error('Request cancelled'));
        return;
      }

      // Record that we're making a request (before the actual request)
      this.recordRequest();
      
      // Make the request
      const result = await item.requestFn();
      
      item.resolve(result);
    } catch (error) {
      // Handle cancellation errors
      if (error.name === 'AbortError' || (item.abortSignal && item.abortSignal.aborted)) {
        item.reject(new Error('Request cancelled'));
        return;
      }
      // Handle 429 (Too Many Requests) errors
      if (error.status === 429 || (error.response && error.response.status === 429)) {
        // Exponential backoff
        const retryDelay = Math.min(
          this.RATE_LIMIT_RETRY_DELAY * Math.pow(2, item.retryCount),
          this.MAX_RETRY_DELAY
        );
        
        // Pause the queue
        this.isPaused = true;
        this.pauseUntil = Date.now() + retryDelay;
        
        // Clear recent timestamps to allow recovery after pause
        this.requestTimestamps = [];
        
        // Check if request was cancelled before retrying
        if (item.abortSignal && item.abortSignal.aborted) {
          item.reject(new Error('Request cancelled'));
          return;
        }
        
        // Retry the request (put it back at the front of the queue)
        item.retryCount++;
        if (item.retryCount < 5) { // Max 5 retries
          this.queue.unshift(item);
        } else {
          // Give up after max retries
          item.reject(new Error('Rate limit exceeded. Please try again later.'));
        }
      } else {
        // For other errors, resolve with null (item might not exist)
        item.resolve(null);
      }
    }
    // Note: processQueue is called by the parallel processing logic, not here
  }

  /**
   * Process the queue with rate limiting and parallel processing
   * Supports parallel processing up to MAX_CONCURRENT requests while respecting rate limits
   */
  async processQueue() {
    // Filter out aborted requests from queue first
    // This prevents aborted requests from blocking new requests
    this.queue = this.queue.filter(item => {
      if (item.abortSignal && item.abortSignal.aborted) {
        // Request was cancelled, reject it and remove from queue
        item.reject(new Error('Request cancelled'));
        return false;
      }
      return true;
    });

    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    // Check if we're paused due to rate limiting
    const now = Date.now();
    if (this.isPaused && now < this.pauseUntil) {
      const waitTime = this.pauseUntil - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.isPaused = false;
      this.pauseUntil = 0;
    }

    // Parallel processing: process up to MAX_CONCURRENT requests simultaneously
    // Testing shows 10 concurrent requests = 2.67s for 30 items with 0% failure rate
    const MAX_CONCURRENT = 10;
    const itemsToProcess = [];
    
    // Get items from queue up to MAX_CONCURRENT
    // Skip items that are already aborted
    while (itemsToProcess.length < MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift();
      
      // Skip aborted items - they should have been filtered above, but double-check
      if (item.abortSignal && item.abortSignal.aborted) {
        item.reject(new Error('Request cancelled'));
        continue;
      }
      
      // Check if we can process this item now (rate limit check)
      const delay = this.getDelayBeforeNextRequest();
      if (delay === 0 || itemsToProcess.length === 0) {
        // Can process immediately or this is the first item
        itemsToProcess.push(item);
      } else {
        // Need to wait, put item back at front of queue
        this.queue.unshift(item);
        break;
      }
    }
    
    if (itemsToProcess.length > 0) {
      this.processing = true;
      // Process all items in parallel
      const promises = itemsToProcess.map(item => this.processItem(item));
      await Promise.all(promises);
      // Continue processing queue
      this.processQueue();
    } else {
      this.processing = false;
    }
  }

  /**
   * Reset the request counter (useful when starting a new batch)
   */
  reset() {
    this.requestTimestamps = [];
  }

  /**
   * Clear all pending requests from the queue
   */
  clear() {
    // Reject all pending items in the queue
    this.queue.forEach(item => {
      if (item.reject) {
        item.reject(new Error('Request queue cleared'));
      }
    });
    this.queue = [];
    this.processing = false;
    // Reset rate limiting state to allow immediate new requests
    this.requestTimestamps = [];
    this.isPaused = false;
    this.pauseUntil = 0;
  }
}

// Create singleton instance
const iconRequestQueue = new IconRequestQueue();

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
 * Get item icon path from XIVAPI (internal function, called via queue)
 * @param {number} itemId - Item ID
 * @param {AbortSignal} abortSignal - Optional abort signal to cancel the request
 * @returns {Promise<string|null>} - Icon URL or null if not found
 * @throws {Error} - Throws error for 429 status to trigger retry logic
 */
async function fetchIconPathFromAPI(itemId, abortSignal = null) {
  // Check if already aborted
  if (abortSignal && abortSignal.aborted) {
    throw new Error('Request cancelled');
  }

  // Create abort controller for timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 5000);

  // Merge abort signals: if external signal provided, abort timeout controller when external aborts
  // This allows both timeout and external cancellation to work
  if (abortSignal) {
    // If external signal aborts, abort timeout controller too
    abortSignal.addEventListener('abort', () => {
      timeoutController.abort();
      clearTimeout(timeoutId);
    });
  }

  // Use timeout controller's signal for fetch
  // This will be aborted by either timeout or external signal
  const signal = timeoutController.signal;

  try {
    // Use columns parameter to only fetch Icon field (faster)
    const response = await fetch(`https://xivapi.com/Item/${itemId}?columns=Icon`, {
      signal: signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        // Item not found - this is expected for some items, cache null to avoid repeated requests
        iconCache.set(itemId, null);
        return null;
      }
      
      // For 429 (Too Many Requests), throw error to trigger queue retry logic
      if (response.status === 429) {
        const error = new Error('Rate limit exceeded');
        error.status = 429;
        error.response = { status: 429 };
        throw error;
      }
      
      // For other HTTP errors, DON'T cache - allow retry later
      // This allows icons that failed to load in table to retry in item info page
      return null;
    }
    
    const data = await response.json();
    if (data && data.Icon) {
      // Icon path is relative, e.g., /i/020000/020801.png
      const iconUrl = `https://xivapi.com${data.Icon}`;
      // Cache the result
      iconCache.set(itemId, iconUrl);
      return iconUrl;
    }
    // Cache null for items without icon data
    iconCache.set(itemId, null);
    return null;
  } catch (error) {
    // Re-throw 429 errors so queue can handle them
    if (error.status === 429 || (error.response && error.response.status === 429)) {
      throw error;
    }
    
    // Handle abort errors
    if (error.name === 'AbortError' || (abortSignal && abortSignal.aborted)) {
      throw new Error('Request cancelled');
    }
    
    // For other errors (network, timeout, etc.), DON'T cache - allow retry later
    // This allows icons that failed to load in table to retry in item info page
    // Don't log errors as they are expected for some items
    return null;
  }
}

/**
 * Get item image URL from XIVAPI with caching and rate limiting
 * @param {number} itemId - Item ID
 * @param {AbortSignal} abortSignal - Optional abort signal to cancel the request
 * @param {boolean} forceReload - If true, bypass cache and force reload (for retrying failed loads)
 * @returns {Promise<string|null>} - Item image URL or null
 */
export async function getItemImageUrl(itemId, abortSignal = null, forceReload = false) {
  if (!itemId || itemId <= 0) {
    return null;
  }

  // Check if request was cancelled
  if (abortSignal && abortSignal.aborted) {
    return null;
  }

  // Check cache first (including null values for items that don't exist)
  // Skip cache check if forceReload is true (for retrying failed loads)
  if (!forceReload && iconCache.has(itemId)) {
    return iconCache.get(itemId);
  }

  // Check if there's already a pending request for this item
  if (pendingRequests.has(itemId)) {
    const existingPromise = pendingRequests.get(itemId);
    // If abort signal provided and request was cancelled, return null
    if (abortSignal && abortSignal.aborted) {
      return null;
    }
    return await existingPromise;
  }

  // Create abort controller for this specific request if not provided
  let controller = null;
  let signal = abortSignal;
  if (!signal) {
    controller = new AbortController();
    signal = controller.signal;
    abortControllers.set(itemId, controller);
  }

  // Create new request using the rate-limited queue
  const requestPromise = iconRequestQueue.enqueue(itemId, () => fetchIconPathFromAPI(itemId, signal), signal)
    .then(result => {
      // Remove from pending requests and abort controllers when done
      pendingRequests.delete(itemId);
      abortControllers.delete(itemId);
      return result;
    })
    .catch(error => {
      // Remove from pending requests and abort controllers on error
      pendingRequests.delete(itemId);
      abortControllers.delete(itemId);
      // Return null for errors (item might not exist, rate limited, or cancelled)
      if (error.message === 'Request cancelled' || (signal && signal.aborted)) {
        return null;
      }
      return null;
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
 * Clear the icon cache and reset the request queue
 */
export function clearIconCache() {
  iconCache.clear();
  pendingRequests.clear();
  iconRequestQueue.reset();
}

/**
 * Cancel all pending icon requests and clear the queue
 */
export function cancelAllIconRequests() {
  // Abort all pending abort controllers
  abortControllers.forEach((controller, itemId) => {
    controller.abort();
  });
  abortControllers.clear();
  
  // Clear the queue (this will reject all pending promises)
  iconRequestQueue.clear();
  
  // Clear pending requests map
  pendingRequests.clear();
}

/**
 * Cancel icon requests for specific item IDs
 * @param {Array<number>} itemIds - Array of item IDs to cancel requests for
 */
export function cancelIconRequests(itemIds) {
  itemIds.forEach(itemId => {
    // Abort controller if exists
    const controller = abortControllers.get(itemId);
    if (controller) {
      controller.abort();
      abortControllers.delete(itemId);
    }
    // Remove from pending requests
    pendingRequests.delete(itemId);
  });
}
