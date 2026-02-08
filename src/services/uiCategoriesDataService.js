/**
 * UI categories data service - loads from local ui_categories.msgpack.
 * Loads from local ui_categories.msgpack.
 */

import { decode } from '@msgpack/msgpack';

const MSGPACK_URL = '/data/ui_categories.msgpack';
let cached = null;
let loadPromise = null;

async function load() {
  if (cached) return cached;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const base = import.meta.env.BASE_URL || '/';
    const res = await fetch(`${base}${MSGPACK_URL.replace(/^\//, '')}`);
    if (!res.ok) throw new Error(`Failed to fetch ui_categories: ${res.status}`);
    const buf = await res.arrayBuffer();
    cached = decode(new Uint8Array(buf));
    return cached;
  })();
  return loadPromise;
}

/**
 * Get UI category IDs for given item IDs.
 * @param {Array<number>} itemIds
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} - { itemId: categoryId }
 */
export async function getUICategoriesByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  const data = await load();
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const itemIdToCategory = data.itemIdToCategory || {};
  const result = {};
  const idSet = new Set(itemIds.map(id => String(id)));
  idSet.forEach(id => {
    if (itemIdToCategory[id] !== undefined) result[id] = itemIdToCategory[id];
  });
  return result;
}

/**
 * Get item IDs that belong to any of the given category IDs.
 * @param {Array<number>} categoryIds
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<number>>}
 */
export async function getItemIdsByCategories(categoryIds, signal = null) {
  if (!categoryIds || categoryIds.length === 0) return [];
  const data = await load();
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const itemIdsByCategory = data.itemIdsByCategory || {};
  const set = new Set();
  categoryIds.forEach(catId => {
    const list = itemIdsByCategory[String(catId)];
    if (Array.isArray(list)) list.forEach(id => set.add(id));
  });
  return Array.from(set);
}

/**
 * Get TW names for all UI categories (categoryId -> { tw: name }).
 * @returns {Promise<Object>}
 */
export async function getTwItemUICategories() {
  const data = await load();
  return data.twItemUICategories || {};
}

/**
 * Get full itemId -> categoryId map (for deprecated getUICategories compatibility).
 * @returns {Promise<Object>}
 */
export async function getFullUICategories() {
  const data = await load();
  return data.itemIdToCategory || {};
}
