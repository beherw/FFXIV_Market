/**
 * Obtainable Data Service
 *
 * Single entry point for all obtainable-methods lookup data. Loads only the domain
 * msgpacks needed for the current item's sources (npcs, shops, instances, quests, etc.).
 * Loads from local obtainable msgpacks for ObtainMethods.
 */

import { decode } from '@msgpack/msgpack';
import { getFatesByIds, getFateSourcesByItemId } from './fatesData.js';
import { getTwItemsByIds, getZhItemsByIds, getEnItemsByIds } from './itemsDatabaseMsgpack.js';

const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') + '/data';

const domainCache = {};
const domainLoadPromises = {};

function sliceById(map, ids) {
  if (!map || typeof map !== 'object') return {};
  const out = {};
  ids.forEach(id => {
    const key = typeof id === 'number' ? id : parseInt(id, 10);
    const skey = String(id);
    const v = map[key] ?? map[skey];
    if (v != null) out[skey] = v;
  });
  return out;
}

function sliceShopsByNpc(shopsByNpc, npcIds) {
  if (!shopsByNpc || typeof shopsByNpc !== 'object') return {};
  const out = {};
  npcIds.forEach(id => {
    const skey = String(id);
    const v = shopsByNpc[skey] ?? shopsByNpc[id];
    if (v != null) out[skey] = v;
  });
  return out;
}

async function loadDomain(name, signal) {
  if (domainCache[name]) return domainCache[name];
  if (domainLoadPromises[name]) return domainLoadPromises[name];
  const url = `${BASE}/${name}.msgpack`;
  const p = (async () => {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
      const buf = await res.arrayBuffer();
      const data = decode(new Uint8Array(buf));
      domainCache[name] = data;
      return data;
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      delete domainLoadPromises[name];
      throw e;
    }
  })();
  domainLoadPromises[name] = p;
  return p;
}

/**
 * Empty loadedData shape used by ObtainMethods and loadDataForRequiredIds.
 * @param {Object} [preserve] - Optional keys to preserve from previous loadedData (e.g. twPlaces, places, retainerTasksById)
 * @returns {Object} loadedData skeleton
 */
export function getEmptyLoadedData(preserve = {}) {
  return {
    twNpcs: {},
    npcs: {},
    npcsDatabasePages: {},
    twShops: {},
    shops: {},
    shopsByNpc: {},
    twInstances: {},
    instances: {},
    zhInstances: {},
    twQuests: {},
    quests: {},
    zhQuests: {},
    questsDatabasePages: {},
    fatesById: {},
    levesDatabasePages: {},
    twAchievements: {},
    twAchievementDescriptions: {},
    achievements: {},
    twPlaces: preserve.twPlaces || {},
    places: preserve.places || {},
    twItems: {},
    zhItems: {},
    items: {},
    retainerTasksById: preserve.retainerTasksById || {},
    fateSources: [],
    lootSources: []
  };
}

function emptyLoadedDataSkeleton() {
  return getEmptyLoadedData();
}

/**
 * Load obtainable lookup data for the given required IDs and options.
 * Only loads domain msgpacks that are needed; returns same shape as ObtainMethods loadedData.
 * @param {Object} requiredIds - { npcIds, shopIds, instanceIds, questIds, achievementIds, itemIds, zoneIds, fateIds }
 * @param {Object} options - { leveIds: number[], itemId: number|string, signal: AbortSignal }
 * @returns {Promise<Object>} loadedData shape
 */
export async function loadDataForRequiredIds(requiredIds, options = {}) {
  const { leveIds = [], itemId, signal } = options;
  const out = emptyLoadedDataSkeleton();

  const loaders = [];

  if (requiredIds.npcIds && requiredIds.npcIds.length > 0) {
    loaders.push(
      loadDomain('npcs', signal).then(data => {
        out.twNpcs = sliceById(data.twNpcs || {}, requiredIds.npcIds);
        out.npcs = sliceById(data.npcs || {}, requiredIds.npcIds);
        out.npcsDatabasePages = sliceById(data.npcsDatabasePages || {}, requiredIds.npcIds);
      })
    );
  }

  const needShops = (requiredIds.shopIds && requiredIds.shopIds.length > 0) || (requiredIds.npcIds && requiredIds.npcIds.length > 0);
  if (needShops) {
    loaders.push(
      loadDomain('shops', signal).then(data => {
        if (requiredIds.shopIds && requiredIds.shopIds.length > 0) {
          out.twShops = sliceById(data.twShops || {}, requiredIds.shopIds);
          out.shops = sliceById(data.shops || {}, requiredIds.shopIds);
        }
        if (requiredIds.npcIds && requiredIds.npcIds.length > 0) {
          out.shopsByNpc = sliceShopsByNpc(data.shopsByNpc || {}, requiredIds.npcIds);
        }
      })
    );
  }

  if (requiredIds.instanceIds && requiredIds.instanceIds.length > 0) {
    loaders.push(
      loadDomain('instances', signal).then(data => {
        out.twInstances = sliceById(data.twInstances || {}, requiredIds.instanceIds);
        out.instances = sliceById(data.instances || {}, requiredIds.instanceIds);
        out.zhInstances = sliceById(data.zhInstances || {}, requiredIds.instanceIds);
      })
    );
  }

  if (requiredIds.questIds && requiredIds.questIds.length > 0) {
    loaders.push(
      loadDomain('quests', signal).then(data => {
        out.twQuests = sliceById(data.twQuests || {}, requiredIds.questIds);
        out.quests = sliceById(data.quests || {}, requiredIds.questIds);
        out.zhQuests = sliceById(data.zhQuests || {}, requiredIds.questIds);
        out.questsDatabasePages = sliceById(data.questsDatabasePages || {}, requiredIds.questIds);
      })
    );
  }

  if (requiredIds.fateIds && requiredIds.fateIds.length > 0) {
    loaders.push(
      getFatesByIds(requiredIds.fateIds, signal).then(data => {
        out.fatesById = data || {};
      })
    );
  }

  if (leveIds && leveIds.length > 0) {
    loaders.push(
      loadDomain('leves', signal).then(data => {
        const pages = data.levesDatabasePages || data.leveDatabasePages || {};
        out.levesDatabasePages = sliceById(pages, leveIds);
      })
    );
  }

  if (requiredIds.achievementIds && requiredIds.achievementIds.length > 0) {
    loaders.push(
      loadDomain('achievements', signal).then(data => {
        out.twAchievements = sliceById(data.twAchievements || {}, requiredIds.achievementIds);
        out.twAchievementDescriptions = sliceById(data.twAchievementDescriptions || {}, requiredIds.achievementIds);
        out.achievements = sliceById(data.achievements || {}, requiredIds.achievementIds);
      })
    );
  }

  if (requiredIds.itemIds && requiredIds.itemIds.length > 0) {
    loaders.push(
      Promise.all([
        getTwItemsByIds(requiredIds.itemIds, signal),
        getZhItemsByIds(requiredIds.itemIds, signal),
        getEnItemsByIds(requiredIds.itemIds, signal)
      ]).then(([tw, zh, en]) => {
        out.twItems = tw || {};
        out.zhItems = zh || {};
        out.items = en || {};
      })
    );
  }

  if (itemId != null && itemId !== '') {
    loaders.push(
      getFateSourcesByItemId(itemId, signal).then(arr => {
        out.fateSources = Array.isArray(arr) ? arr : [];
      })
    );
    loaders.push(
      loadDomain('loot-sources', signal).then(data => {
        const byItem = data.lootSourcesByItemId || {};
        const id = String(itemId);
        const arr = byItem[id] ?? byItem[parseInt(itemId, 10)];
        out.lootSources = Array.isArray(arr) ? arr : [];
      })
    );
  }

  await Promise.all(loaders);

  return out;
}

/**
 * Load place data for the given zone IDs (phase 2).
 * @param {number[]} zoneIds
 * @param {AbortSignal} signal
 * @returns {Promise<{ twPlaces: Object, places: Object }>}
 */
export async function loadPlaceDataForZoneIds(zoneIds, signal = null) {
  if (!zoneIds || zoneIds.length === 0) {
    return { twPlaces: {}, places: {} };
  }
  const data = await loadDomain('places', signal);
  return {
    twPlaces: sliceById(data.twPlaces || {}, zoneIds),
    places: sliceById(data.places || {}, zoneIds)
  };
}
