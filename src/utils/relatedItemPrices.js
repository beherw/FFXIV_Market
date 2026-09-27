// Prices for the 可製品 list. Loaded when the list is opened, or ahead of time once the item page
// has nothing else left to load. Kept behind the page's own requests (see prefetchGate).

import { getAggregatedMarketData, getMarketableItemsByIds } from '../services/universalis';
import { waitForPrefetchGate } from './prefetchGate';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const cacheKey = (server, itemIds) => `${server}|${[...itemIds].sort((a, b) => a - b).join(',')}`;

/**
 * @returns {Promise<Object>} itemId -> price info from getAggregatedMarketData, or { untradeable: true }
 */
export function fetchRelatedItemPrices(server, itemIds, worlds = {}) {
  if (!server || !itemIds?.length) return Promise.resolve({});
  const key = cacheKey(server, itemIds);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;

  const promise = (async () => {
    await waitForPrefetchGate();
    const marketable = await getMarketableItemsByIds(itemIds);
    const tradeableIds = itemIds.filter(id => marketable.has(id));
    const results = {};
    itemIds.forEach(id => {
      if (!marketable.has(id)) results[id] = { untradeable: true };
    });
    for (let i = 0; i < tradeableIds.length; i += 100) {
      Object.assign(results, await getAggregatedMarketData(server, tradeableIds.slice(i, i + 100), worlds));
    }
    // A failed request comes back as {}; don't keep that for the whole TTL
    if (tradeableIds.length > 0 && !tradeableIds.some(id => results[id])) cache.delete(key);
    return results;
  })();
  cache.set(key, { promise, at: Date.now() });
  promise.catch(() => cache.delete(key));
  return promise;
}
