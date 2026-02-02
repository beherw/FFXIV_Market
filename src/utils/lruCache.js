/**
 * LRU Cache for Item Images
 * Prevents unbounded memory growth by maintaining a maximum cache size
 * Uses Least Recently Used (LRU) eviction policy
 */

export class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of items to store in cache (default: 1000)
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = []; // Track access order for LRU eviction
  }

  /**
   * Get value from cache
   * @param {*} key - Cache key
   * @returns {*|undefined} - Cached value or undefined if not found
   */
  get(key) {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
      return this.cache.get(key);
    }
    return undefined;
  }

  /**
   * Set value in cache
   * @param {*} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // If key already exists, remove it first
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    // If cache is full, evict least recently used item
    if (this.accessOrder.length >= this.maxSize) {
      const lruKey = this.accessOrder.shift();
      this.cache.delete(lruKey);
    }

    // Add new item
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists in cache
   * @param {*} key - Cache key
   * @returns {boolean} - True if key exists in cache
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   * @returns {number} - Number of items in cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {object} - {size: current size, maxSize: maximum size, fillPercentage: percentage}
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      fillPercentage: Math.round((this.cache.size / this.maxSize) * 100)
    };
  }
}
