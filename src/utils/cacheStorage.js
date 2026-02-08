/**
 * Versioned localStorage cache for loaded-data only (e.g. msgpack-derived state).
 * Do not use for history or search recommendations (those are IDs/keywords only).
 * Stored as { data, timestamp }; invalid if no timestamp or before CACHE_MIN_VALID_TIMESTAMP.
 */

import { CACHE_MIN_VALID_TIMESTAMP } from '../constants/version.js';

/**
 * Read cached value from localStorage. Returns null if key is missing, value
 * is not valid JSON, or cache has no timestamp or timestamp is before
 * CACHE_MIN_VALID_TIMESTAMP.
 * @param {string} key - localStorage key
 * @returns {*} The cached data, or null if invalid/missing
 */
export function getValidatedCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object') return null;
    if (typeof parsed.timestamp !== 'number' || parsed.timestamp < CACHE_MIN_VALID_TIMESTAMP) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Write value to localStorage with current timestamp so it passes validation
 * until CACHE_MIN_VALID_TIMESTAMP is bumped.
 * @param {string} key - localStorage key
 * @param {*} data - Value to cache (will be JSON-serialized)
 */
export function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (err) {
    console.error('Failed to write cache:', key, err);
  }
}

/**
 * Remove a cache entry (e.g. on user clear). Use this for consistency.
 * @param {string} key - localStorage key
 */
export function removeCache(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
