/**
 * FATEs Data Service (MessagePack)
 *
 * Single source for all FATE data: names (tw/zh/en), icon, level, zoneId, mapId, coords, reward items.
 * Loads from local fates.msgpack (tw_fates, zh_fates, fates, fate_sources).
 *
 * - Load once from public/data/fates.msgpack
 * - getFatesByIds(fateIds) -> { [fateId]: { tw, zh, en, icon, level, zoneId, mapId, x, y, items } }
 * - getFateSourcesByItemId(itemId) -> number[] (fate IDs that drop this item)
 */

import { decode } from '@msgpack/msgpack';

let dataCache = null;
let isLoading = false;
let loadPromise = null;

/**
 * Load FATEs database from MessagePack (single small file, ~267 KB)
 * @returns {Promise<{ fatesById: Object, fateSourcesByItemId: Object }>}
 */
export async function loadFatesDatabase(signal = null) {
  if (dataCache) {
    return dataCache;
  }
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}data/fates.msgpack`, { signal });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const buffer = await response.arrayBuffer();
      dataCache = decode(new Uint8Array(buffer));
      return dataCache;
    } catch (err) {
      loadPromise = null;
      if (err?.name === 'AbortError') throw err;
      console.error('[FatesData] Failed to load:', err);
      throw err;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * Get FATE data for given IDs (from pre-built msgpack; no network per call after first load).
 * @param {Array<number|string>} fateIds - FATE IDs
 * @param {AbortSignal} signal - Optional (used only during initial load)
 * @returns {Promise<Object>} - { [fateId]: { tw, zh, en, icon, level, zoneId, mapId, x, y, items } }
 */
export async function getFatesByIds(fateIds, signal = null) {
  if (!fateIds || fateIds.length === 0) return {};
  const { fatesById } = await loadFatesDatabase(signal);
  const result = {};
  fateIds.forEach(id => {
    const num = typeof id === 'number' ? id : parseInt(id, 10);
    if (isNaN(num)) return;
    const fate = fatesById[num] ?? fatesById[String(num)];
    if (fate) result[num] = fate;
  });
  return result;
}

/**
 * Get FATE IDs that reward a given item (item -> [fateIds]).
 * @param {number|string} itemId - Item ID
 * @param {AbortSignal} signal - Optional (used only during initial load)
 * @returns {Promise<number[]>} - Array of FATE IDs
 */
export async function getFateSourcesByItemId(itemId, signal = null) {
  const id = typeof itemId === 'number' ? itemId : parseInt(itemId, 10);
  if (isNaN(id)) return [];
  const { fateSourcesByItemId } = await loadFatesDatabase(signal);
  const arr = fateSourcesByItemId[String(id)] ?? fateSourcesByItemId[id];
  return Array.isArray(arr) ? arr : [];
}
