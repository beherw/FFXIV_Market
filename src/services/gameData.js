/**
 * Game Data Service - single facade for all game data (msgpack + JSON only).
 * No Supabase. Use itemsDatabaseMsgpack, uiCategoriesDataService, and local JSON.
 */

import * as itemsDb from './itemsDatabaseMsgpack.js';
import * as uiCategories from './uiCategoriesDataService.js';
import ilvlsJson from '../../teamcraft_git/libs/data/src/lib/json/ilvls.json';
import raritiesJson from '../../teamcraft_git/libs/data/src/lib/json/rarities.json';
import itemPatchJson from '../../teamcraft_git/libs/data/src/lib/json/item-patch.json';
import marketItemsJson from '../../teamcraft_git/libs/data/src/lib/json/market-items.json';
import patchNamesJson from '../../teamcraft_git/libs/data/src/lib/json/patch-names.json';
import equipSlotCategoriesJson from '../../teamcraft_git/libs/data/src/lib/json/equip-slot-categories.json';
import twJobAbbrJson from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';

// In-memory caches (JSON)
let ilvlsCache = null;
let raritiesCache = null;
let itemPatchCache = null;
let marketItemsCache = null;

async function loadIlvlsCache() {
  if (ilvlsCache) return ilvlsCache;
  ilvlsCache = {};
  Object.entries(ilvlsJson).forEach(([id, ilvl]) => {
    if (ilvl !== undefined && ilvl !== null) {
      ilvlsCache[parseInt(id, 10)] = ilvl;
    }
  });
  return ilvlsCache;
}

async function loadRaritiesCache() {
  if (raritiesCache) return raritiesCache;
  raritiesCache = {};
  Object.entries(raritiesJson).forEach(([id, rarity]) => {
    if (rarity !== undefined && rarity !== null) {
      raritiesCache[parseInt(id, 10)] = rarity;
    }
  });
  return raritiesCache;
}

async function loadItemPatchCache() {
  if (itemPatchCache) return itemPatchCache;
  itemPatchCache = {};
  Object.entries(itemPatchJson).forEach(([id, patchId]) => {
    if (patchId !== undefined && patchId !== null) {
      itemPatchCache[parseInt(id, 10)] = patchId;
    }
  });
  return itemPatchCache;
}

async function loadMarketItemsCache() {
  if (marketItemsCache) return marketItemsCache;
  marketItemsCache = new Set(marketItemsJson.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
  return marketItemsCache;
}

// ---------- Items (msgpack) ----------
export async function getTwItems() {
  return itemsDb.getTwItems();
}

export async function getTwItemById(itemId) {
  return itemsDb.getTwItemById(itemId);
}

/**
 * @param {Array<number|string>} itemIds
 * @param {AbortSignal|null} signal
 * @param {{ includeEquipLevel?: boolean }} [options] - Set includeEquipLevel: false for names-only (e.g. history) to avoid loading equipment.msgpack
 */
export async function getTwItemsByIds(itemIds, signal = null, options = {}) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const includeEquipLevel = options.includeEquipLevel !== false;
  const names = await itemsDb.getTwItemsByIds(itemIds, signal);
  const result = {};
  const ids = Object.keys(names).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (ids.length === 0) return {};
  const ilvls = await getIlvlsByIds(ids, signal);
  const equipment = includeEquipLevel ? await getEquipmentByIds(ids, signal) : {};
  ids.forEach(id => {
    const item = names[id];
    if (item && item.tw && item.tw.trim() !== '') {
      result[id] = {
        tw: item.tw,
        ilvl: ilvls[id] ?? null,
        equipLevel: equipment[id]?.level ?? null
      };
    }
  });
  return result;
}

export async function getZhItemsByIds(itemIds, signal = null) {
  return itemsDb.getZhItemsByIds(itemIds, signal);
}

export async function getEnItemsByIds(itemIds, signal = null) {
  return itemsDb.getEnItemsByIds(itemIds, signal);
}

export async function getLanguageItemById(itemId, tableName, columnName, signal = null) {
  return itemsDb.getLanguageItemById(itemId, tableName, columnName, signal);
}

export async function searchTwItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchTwItems(searchText, fuzzy, signal);
}

export async function searchTwItemsWithJoin(searchText, fuzzy = false, signal = null) {
  const items = await itemsDb.searchTwItems(searchText, fuzzy, signal);
  const itemIds = Object.keys(items).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (itemIds.length === 0) return [];
  const ilvls = await getIlvlsByIds(itemIds, signal);
  const sorted = [...itemIds].sort((a, b) => {
    const aIlvl = ilvls[a] ?? null;
    const bIlvl = ilvls[b] ?? null;
    if (aIlvl !== null && bIlvl !== null) return bIlvl - aIlvl;
    if (aIlvl !== null) return -1;
    if (bIlvl !== null) return 1;
    return b - a;
  });
  return sorted.map(id => ({ id, ...items[id], ilvl: ilvls[id] ?? null }));
}

export async function searchCnItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchCnItems(searchText, fuzzy, signal);
}

export async function searchKoItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchKoItems(searchText, fuzzy, signal);
}

export async function searchEnItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchEnItems(searchText, fuzzy, signal);
}

export async function searchJaItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchJaItems(searchText, fuzzy, signal);
}

export async function searchDeItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchDeItems(searchText, fuzzy, signal);
}

export async function searchFrItems(searchText, fuzzy = false, signal = null) {
  return itemsDb.searchFrItems(searchText, fuzzy, signal);
}

export async function getItemsWithJoinByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return [];
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const uniqueIds = [...new Set(itemIds.filter(id => id && id > 0))];
  if (uniqueIds.length === 0) return [];

  const ilvls = await getIlvlsByIds(uniqueIds, signal);
  const sortedItemIds = [...uniqueIds].sort((a, b) => {
    const aIlvl = ilvls[a] ?? null;
    const bIlvl = ilvls[b] ?? null;
    if (aIlvl !== null && bIlvl !== null) return bIlvl - aIlvl;
    if (aIlvl !== null) return -1;
    if (bIlvl !== null) return 1;
    return b - a;
  });

  const [names, patches, marketableSet] = await Promise.all([
    getTwItemsByIds(sortedItemIds, signal),
    getItemPatchByIds(sortedItemIds, signal),
    getMarketItemsByIds(sortedItemIds, signal)
  ]);

  return sortedItemIds.map(id => ({
    id,
    name: names[id]?.tw || '',
    ilvl: ilvls[id] ?? null,
    version: patches[id] ?? null,
    marketable: marketableSet.has(id) || false
  }));
}

// ---------- Market items (JSON) ----------
export async function getMarketItems() {
  return loadMarketItemsCache();
}

export async function getMarketItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return new Set();
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!marketItemsCache) await loadMarketItemsCache();
  const marketableSet = new Set();
  itemIds.forEach(itemId => {
    if (marketItemsCache.has(itemId)) marketableSet.add(itemId);
  });
  return marketableSet;
}

// ---------- Equipment (msgpack) ----------
export async function getEquipment() {
  return itemsDb.getEquipment();
}

export async function getEquipmentByIds(itemIds, signal = null) {
  return itemsDb.getEquipmentByIds(itemIds, signal);
}

export async function getEquipmentBySlotCategories(slotCategories, signal = null) {
  return itemsDb.getEquipmentBySlotCategories(slotCategories, signal);
}

export async function getEquipmentByJobsAndSlotCategories(jobAbbrs, slotCategories, signal = null) {
  return itemsDb.getEquipmentByJobsAndSlotCategories(jobAbbrs, slotCategories, signal);
}

export async function getEquipmentByJobs(jobAbbrs, signal = null) {
  return itemsDb.getEquipmentByJobs(jobAbbrs, signal);
}

export async function getEquipmentByLevelAndJobs(level, jobsArray, signal = null) {
  return itemsDb.getEquipmentByLevelAndJobs(level, jobsArray, signal);
}

// ---------- Item set (equipment + ilvl + patch) ----------
const EQUIP_SLOT_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const itemSetCache = {};
const itemSetPromises = {};

export async function getItemSetFromDB(itemId, signal = null) {
  if (!itemId || itemId <= 0) {
    return { setItemIds: [], seedItemId: itemId, isEquipmentSet: false };
  }
  if (itemSetCache[itemId]) return itemSetCache[itemId];
  if (itemSetPromises[itemId]) return itemSetPromises[itemId];

  const promise = (async () => {
    try {
      const seedEquipMap = await getEquipmentByIds([itemId], signal);
      const seedEquip = seedEquipMap[itemId];
      if (!seedEquip) {
        const result = { setItemIds: [itemId], seedItemId: itemId, isEquipmentSet: false };
        itemSetCache[itemId] = result;
        return result;
      }

      const seedLevel = seedEquip.level;
      const seedJobs = seedEquip.jobs || seedEquip.job_abbrs || [];
      const candidatesMap = await getEquipmentByLevelAndJobs(seedLevel, seedJobs, signal);
      const candidateIds = Object.keys(candidatesMap).map(id => parseInt(id, 10));

      if (candidateIds.length === 0) {
        const result = { setItemIds: [itemId], seedItemId: itemId, isEquipmentSet: true, ilvl: undefined, patch: undefined, level: seedLevel };
        itemSetCache[itemId] = result;
        return result;
      }

      const allIds = [itemId, ...candidateIds];
      const [ilvlsMap, patchMap] = await Promise.all([
        getIlvlsByIds(allIds, signal),
        getItemPatchByIds(allIds, signal)
      ]);
      const seedIlvl = ilvlsMap[itemId];
      const seedPatch = patchMap[itemId];

      const setItemIds = candidateIds.filter(id => ilvlsMap[id] === seedIlvl && patchMap[id] === seedPatch);
      if (!setItemIds.includes(itemId)) setItemIds.unshift(itemId);
      const equipById = { ...candidatesMap, [itemId]: seedEquip };
      setItemIds.sort((a, b) => {
        const rowA = equipById[a] || {};
        const rowB = equipById[b] || {};
        const slotA = rowA.equipSlotCategory ?? rowA.equip_slot_category ?? 99;
        const slotB = rowB.equipSlotCategory ?? rowB.equip_slot_category ?? 99;
        const orderA = EQUIP_SLOT_ORDER.indexOf(slotA);
        const orderB = EQUIP_SLOT_ORDER.indexOf(slotB);
        const oA = orderA === -1 ? 99 : orderA;
        const oB = orderB === -1 ? 99 : orderB;
        if (oA !== oB) return oA - oB;
        return a - b;
      });

      const result = { setItemIds, seedItemId: itemId, isEquipmentSet: true, ilvl: seedIlvl, patch: seedPatch, level: seedLevel };
      itemSetCache[itemId] = result;
      return result;
    } catch (err) {
      if (err.name === 'AbortError' || (signal && signal.aborted)) throw err;
      return { setItemIds: [itemId], seedItemId: itemId, isEquipmentSet: false };
    } finally {
      delete itemSetPromises[itemId];
    }
  })();
  itemSetPromises[itemId] = promise;
  return promise;
}

// ---------- Ilvls (JSON) ----------
export async function getIlvls() {
  return loadIlvlsCache();
}

export async function getIlvlsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!ilvlsCache) await loadIlvlsCache();
  const result = {};
  itemIds.forEach(itemId => {
    const ilvl = ilvlsCache[itemId];
    if (ilvl !== undefined && ilvl !== null) result[itemId] = ilvl;
  });
  return result;
}

export async function getItemIdsByIlvl(ilvlValue, signal = null) {
  if (!ilvlValue || ilvlValue < 1) return [];
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!ilvlsCache) await loadIlvlsCache();
  return Object.keys(ilvlsCache)
    .map(id => parseInt(id, 10))
    .filter(id => !isNaN(id) && ilvlsCache[id] === ilvlValue);
}

export async function getItemIdsByIlvlRange(minIlvl, maxIlvl, signal = null) {
  if (!minIlvl || minIlvl < 1 || !maxIlvl || maxIlvl < minIlvl) return [];
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!ilvlsCache) await loadIlvlsCache();
  return Object.keys(ilvlsCache)
    .map(id => parseInt(id, 10))
    .filter(id => {
      if (isNaN(id)) return false;
      const ilvl = ilvlsCache[id];
      return ilvl !== undefined && ilvl !== null && ilvl >= minIlvl && ilvl <= maxIlvl;
    });
}

export async function getMaxIlvl(signal = null) {
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!ilvlsCache) await loadIlvlsCache();
  const values = Object.values(ilvlsCache).filter(v => v !== undefined && v !== null);
  return values.length === 0 ? null : Math.max(...values);
}

// ---------- Rarities (JSON) ----------
export async function getRarities() {
  return loadRaritiesCache();
}

export async function getRaritiesByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!raritiesCache) await loadRaritiesCache();
  const result = {};
  itemIds.forEach(itemId => {
    const rarity = raritiesCache[itemId];
    if (rarity !== undefined && rarity !== null) result[itemId] = rarity;
  });
  return result;
}

// ---------- Item patch (JSON) ----------
export async function getItemPatch() {
  return loadItemPatchCache();
}

export async function getItemPatchByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  if (!itemPatchCache) await loadItemPatchCache();
  const result = {};
  itemIds.forEach(itemId => {
    const patchId = itemPatchCache[itemId];
    if (patchId !== undefined && patchId !== null) result[itemId] = patchId;
  });
  return result;
}

// ---------- Patch names, equip slots, job abbr (JSON) ----------
export async function getPatchNames() {
  return Promise.resolve(patchNamesJson && typeof patchNamesJson === 'object' ? patchNamesJson : {});
}

export async function getEquipSlotCategories() {
  return Promise.resolve(equipSlotCategoriesJson && typeof equipSlotCategoriesJson === 'object' ? equipSlotCategoriesJson : {});
}

export async function getTwJobAbbr() {
  return Promise.resolve(twJobAbbrJson && typeof twJobAbbrJson === 'object' ? twJobAbbrJson : {});
}

// ---------- UI categories (msgpack) ----------
export async function getTwItemUICategories() {
  return uiCategories.getTwItemUICategories();
}

export async function getUICategories() {
  return uiCategories.getFullUICategories();
}

export async function getUICategoriesByIds(itemIds, signal = null) {
  return uiCategories.getUICategoriesByIds(itemIds, signal);
}

export async function getItemIdsByCategories(categoryIds, signal = null) {
  return uiCategories.getItemIdsByCategories(categoryIds, signal);
}

// ---------- Advanced search ----------
export async function advancedSearchWithJoin(filters, signal = null) {
  const { jobAbbrs = [], categoryIds = [], minLevel = 1, maxLevel = 999, minIlvl = null, maxIlvl = null } = filters;

  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');

  let itemIds = new Set();

  if (categoryIds.length > 0) {
    const categoryItemIds = await getItemIdsByCategories(categoryIds, signal);
    categoryItemIds.forEach(id => itemIds.add(id));
  }

  if (jobAbbrs.length > 0) {
    const equipmentData = await getEquipmentByJobs(jobAbbrs, signal);
    const jobItemIds = Object.keys(equipmentData).map(id => parseInt(id, 10));
    if (itemIds.size > 0) {
      const intersection = new Set();
      itemIds.forEach(id => { if (jobItemIds.includes(id)) intersection.add(id); });
      itemIds = intersection;
    } else {
      jobItemIds.forEach(id => itemIds.add(id));
    }
  }

  if (minIlvl !== null && maxIlvl !== null && minIlvl >= 1 && maxIlvl >= minIlvl) {
    const ilvlItemIds = await getItemIdsByIlvlRange(minIlvl, maxIlvl, signal);
    const ilvlSet = new Set(ilvlItemIds);
    if (itemIds.size > 0) {
      const intersection = new Set();
      itemIds.forEach(id => { if (ilvlSet.has(id)) intersection.add(id); });
      itemIds = intersection;
    } else {
      ilvlItemIds.forEach(id => itemIds.add(id));
    }
  }

  if ((minLevel > 1 || maxLevel < 999) && itemIds.size > 0) {
    const itemIdsArray = Array.from(itemIds);
    const equipmentData = await getEquipmentByIds(itemIdsArray, signal);
    const filteredByLevel = new Set();
    itemIds.forEach(itemId => {
      const equipment = equipmentData[itemId];
      if (!equipment || equipment.level === undefined || equipment.level === null) {
        if (minLevel === 1 && maxLevel === 999) filteredByLevel.add(itemId);
      } else if (equipment.level >= minLevel && equipment.level <= maxLevel) {
        filteredByLevel.add(itemId);
      }
    });
    itemIds = filteredByLevel;
  }

  return Array.from(itemIds);
}
