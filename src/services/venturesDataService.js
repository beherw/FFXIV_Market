/**
 * Ventures Data Service
 * Loads retainer venture tasks from MessagePack.
 *
 * tasks tuple: [id, lvl, cost, itemId, maxQty, reqGathering, reqIlvl, category]
 *
 * Category mapping (game constants):
 *   17 = 採礦筹集 (Mining)
 *   18 = 採伐筹集 (Botany/Logging)
 *   19 = 捕魚筹集 (Fishing)
 *   34 = 狩獵筹集 (Hunting/Combat)
 */

import { decode } from '@msgpack/msgpack';

export const VENTURE_CATEGORIES = {
  HUNTING: 34,
  MINING: 17,
  BOTANY: 18,
  FISHING: 19,
};

export const COLLECTION_TABS = [
  { key: 'hunting', category: 34, label: '狩獵筹集', icon: '⚔' },
  { key: 'mining',  category: 17, label: '採礦筹集', icon: '⛏' },
  { key: 'botany',  category: 18, label: '採伐筹集', icon: '🌿' },
  { key: 'fishing', category: 19, label: '捕魚筹集', icon: '🎣' },
];

let cache = null;
let loadPromise = null;

export async function loadVenturesData() {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}data/ventures-data.msgpack`);
    if (!response.ok) throw new Error(`Ventures fetch failed: ${response.status}`);
    const buf = await response.arrayBuffer();
    const raw = decode(new Uint8Array(buf));

    const tasks = raw.tasks.map(([id, lvl, cost, itemId, maxQty, reqGathering, reqIlvl, category]) => ({
      id, lvl, cost, itemId, maxQty, reqGathering, reqIlvl, category,
    }));

    cache = { tasks, explorationItemIds: raw.exploration || [] };
    return cache;
  })();

  return loadPromise;
}

/**
 * For a given category, return Map<itemId, { lvl, maxQty, reqGathering, reqIlvl }>
 * using best (highest maxQty) task per item, filtered to lvl <= maxLevel.
 */
export function getItemsForCategory(tasks, category, maxLevel) {
  const map = new Map();
  for (const t of tasks) {
    if (t.category !== category) continue;
    if (t.lvl > maxLevel) continue;
    const existing = map.get(t.itemId);
    if (!existing || t.maxQty > existing.maxQty) {
      map.set(t.itemId, { lvl: t.lvl, maxQty: t.maxQty, reqGathering: t.reqGathering, reqIlvl: t.reqIlvl });
    }
  }
  return map;
}
