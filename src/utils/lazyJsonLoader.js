/**
 * Generic cached lazy loader for JSON modules.
 * Same "wait while loading" semantics; single implementation for tw-quests, tw-leves, retainer-tasks, etc.
 */

const cache = {};
const loadPromises = {};

/**
 * Load a JSON module once and cache. If another load is in progress for the same key, waits for it.
 * @param {string} key - Cache key (e.g. 'tw-quests', 'tw-leves')
 * @param {() => Promise<{ default?: unknown }>} importFn - Dynamic import, e.g. () => import('...json')
 * @param {*} defaultEmpty - Value to return on error (e.g. {} or [])
 * @returns {Promise<*>} Parsed data or defaultEmpty on error
 */
export async function loadJsonOnce(key, importFn, defaultEmpty = {}) {
  if (cache[key] !== undefined) return cache[key];
  if (loadPromises[key]) {
    while (loadPromises[key]) {
      await new Promise(r => setTimeout(r, 50));
    }
    return cache[key] !== undefined ? cache[key] : defaultEmpty;
  }
  loadPromises[key] = (async () => {
    try {
      const module = await importFn();
      const data = module.default ?? module;
      cache[key] = data;
      return data;
    } catch (err) {
      console.error(`[lazyJsonLoader] Failed to load ${key}:`, err);
      cache[key] = defaultEmpty;
      return defaultEmpty;
    } finally {
      loadPromises[key] = null;
    }
  })();
  const result = await loadPromises[key];
  return cache[key] !== undefined ? cache[key] : defaultEmpty;
}
