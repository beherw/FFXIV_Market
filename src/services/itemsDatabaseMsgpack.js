/**
 * Items MessagePack Database Service
 *
 * Per-domain lazy load: each API loads only its msgpack file (tw-items, zh-items, etc.).
 * No single 14 MB bundle. Loads from local msgpack (no remote DB).
 */

import { decode } from '@msgpack/msgpack';

const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '') + '/data';

function getDataUrl(filename) {
  return `${BASE}/${filename}`;
}

// Per-domain cache and load promise
let twItemsCache = null;
let twItemsLoadPromise = null;
let zhItemsCache = null;
let zhItemsLoadPromise = null;
let enItemsCache = null;
let enItemsLoadPromise = null;
let jaItemsCache = null;
let jaItemsLoadPromise = null;
let koItemsCache = null;
let koItemsLoadPromise = null;
let deItemsCache = null;
let deItemsLoadPromise = null;
let frItemsCache = null;
let frItemsLoadPromise = null;
let equipmentCache = null;
let equipmentLoadPromise = null;

async function loadTwItems() {
  if (twItemsCache) return twItemsCache;
  if (twItemsLoadPromise) return twItemsLoadPromise;
  twItemsLoadPromise = (async () => {
    const url = getDataUrl('tw-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch tw-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    twItemsCache = decode(new Uint8Array(buf));
    return twItemsCache;
  })();
  return twItemsLoadPromise;
}

async function loadZhItems() {
  if (zhItemsCache) return zhItemsCache;
  if (zhItemsLoadPromise) return zhItemsLoadPromise;
  zhItemsLoadPromise = (async () => {
    const url = getDataUrl('zh-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch zh-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    zhItemsCache = decode(new Uint8Array(buf));
    return zhItemsCache;
  })();
  return zhItemsLoadPromise;
}

async function loadEnItems() {
  if (enItemsCache) return enItemsCache;
  if (enItemsLoadPromise) return enItemsLoadPromise;
  enItemsLoadPromise = (async () => {
    const url = getDataUrl('en-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch en-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    enItemsCache = decode(new Uint8Array(buf));
    return enItemsCache;
  })();
  return enItemsLoadPromise;
}

async function loadJaItems() {
  if (jaItemsCache) return jaItemsCache;
  if (jaItemsLoadPromise) return jaItemsLoadPromise;
  jaItemsLoadPromise = (async () => {
    const url = getDataUrl('ja-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ja-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    jaItemsCache = decode(new Uint8Array(buf));
    return jaItemsCache;
  })();
  return jaItemsLoadPromise;
}

async function loadKoItems() {
  if (koItemsCache) return koItemsCache;
  if (koItemsLoadPromise) return koItemsLoadPromise;
  koItemsLoadPromise = (async () => {
    const url = getDataUrl('ko-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ko-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    koItemsCache = decode(new Uint8Array(buf));
    return koItemsCache;
  })();
  return koItemsLoadPromise;
}

async function loadDeItems() {
  if (deItemsCache) return deItemsCache;
  if (deItemsLoadPromise) return deItemsLoadPromise;
  deItemsLoadPromise = (async () => {
    const url = getDataUrl('de-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch de-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    deItemsCache = decode(new Uint8Array(buf));
    return deItemsCache;
  })();
  return deItemsLoadPromise;
}

async function loadFrItems() {
  if (frItemsCache) return frItemsCache;
  if (frItemsLoadPromise) return frItemsLoadPromise;
  frItemsLoadPromise = (async () => {
    const url = getDataUrl('fr-items.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch fr-items.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    frItemsCache = decode(new Uint8Array(buf));
    return frItemsCache;
  })();
  return frItemsLoadPromise;
}

async function loadEquipment() {
  if (equipmentCache) return equipmentCache;
  if (equipmentLoadPromise) return equipmentLoadPromise;
  equipmentLoadPromise = (async () => {
    const url = getDataUrl('equipment.msgpack');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch equipment.msgpack: ${res.status}`);
    const buf = await res.arrayBuffer();
    equipmentCache = decode(new Uint8Array(buf));
    return equipmentCache;
  })();
  return equipmentLoadPromise;
}

export async function getTwItemById(itemId) {
  const map = await loadTwItems();
  const item = map[itemId] || map[String(itemId)];
  return item?.tw || null;
}

export async function getTwItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadTwItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item) result[id] = item;
  });
  return result;
}

export async function getTwItems() {
  return loadTwItems();
}

export async function getZhItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadZhItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item?.zh) result[id] = { zh: item.zh };
  });
  return result;
}

export async function getEnItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadEnItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item?.en) result[id] = { en: item.en };
  });
  return result;
}

export async function getJaItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadJaItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item?.ja) result[id] = { ja: item.ja };
  });
  return result;
}

export async function getKoItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadKoItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item?.ko) result[id] = { ko: item.ko };
  });
  return result;
}

export async function getDeItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadDeItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item?.de) result[id] = { de: item.de };
  });
  return result;
}

export async function getFrItemsByIds(itemIds, signal = null) {
  if (!itemIds || itemIds.length === 0) return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadFrItems();
  const result = {};
  itemIds.forEach(id => {
    const item = map[id] || map[String(id)];
    if (item?.fr) result[id] = { fr: item.fr };
  });
  return result;
}

const LANGUAGE_ITEM_MAP = {
  cn_items: [loadZhItems, 'zh'],
  en_items: [loadEnItems, 'en'],
  ja_items: [loadJaItems, 'ja'],
  ko_items: [loadKoItems, 'ko'],
  de_items: [loadDeItems, 'de'],
  fr_items: [loadFrItems, 'fr']
};

export async function getLanguageItemById(itemId, tableName, columnName, signal = null) {
  if (!itemId || itemId <= 0) return null;
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const entry = LANGUAGE_ITEM_MAP[tableName];
  if (!entry) return null;
  const [loadFn, nameKey] = entry;
  const map = await loadFn();
  const item = map[itemId] || map[String(itemId)];
  if (!item || !item[nameKey]) return null;
  return { id: parseInt(itemId, 10), [columnName]: item[nameKey] };
}

function searchInMap(map, nameKey, searchText, fuzzy) {
  const trimmed = searchText.trim();
  const words = trimmed.includes(' ')
    ? trimmed.split(/\s+/).filter(w => w)
    : [trimmed];
  if (words.length === 0) return {};
  const result = {};
  Object.entries(map).forEach(([itemId, item]) => {
    const name = item[nameKey];
    if (!name || name.trim() === '') return;
    const itemName = name.toLowerCase();
    const matches = fuzzy && words.length > 1
      ? words.every(word => new RegExp(Array.from(word.toLowerCase()).join('.*?')).test(itemName))
      : words.every(word => itemName.includes(word.toLowerCase()));
    if (matches) result[itemId] = { [nameKey]: name };
  });
  return result;
}

export async function searchZhItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadZhItems();
  return searchInMap(map, 'zh', searchText, fuzzy);
}

export async function searchEnItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadEnItems();
  return searchInMap(map, 'en', searchText, fuzzy);
}

export async function searchJaItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadJaItems();
  return searchInMap(map, 'ja', searchText, fuzzy);
}

export async function searchKoItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadKoItems();
  return searchInMap(map, 'ko', searchText, fuzzy);
}

export async function searchDeItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadDeItems();
  return searchInMap(map, 'de', searchText, fuzzy);
}

export async function searchFrItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadFrItems();
  return searchInMap(map, 'fr', searchText, fuzzy);
}

export async function searchCnItems(searchText, fuzzy = false, signal = null) {
  return searchZhItems(searchText, fuzzy, signal);
}

export async function searchTwItems(searchText, fuzzy = false, signal = null) {
  if (!searchText || searchText.trim() === '') return {};
  if (signal && signal.aborted) throw new DOMException('Request aborted', 'AbortError');
  const map = await loadTwItems();
  const trimmed = searchText.trim();
  const words = trimmed.includes(' ')
    ? trimmed.split(/\s+/).filter(w => w)
    : [trimmed];
  if (words.length === 0) return {};
  const result = {};
  Object.entries(map).forEach(([itemId, item]) => {
    const name = item?.tw;
    if (!name || name.trim() === '') return;
    const itemName = name.toLowerCase();
    const matches = fuzzy && words.length > 1
      ? words.every(word => new RegExp(Array.from(word.toLowerCase()).join('.*?')).test(itemName))
      : words.every(word => itemName.includes(word.toLowerCase()));
    if (matches) result[parseInt(itemId, 10)] = { tw: name };
  });
  return result;
}

export async function getEquipmentById(itemId) {
  const map = await loadEquipment();
  return map[itemId] || map[String(itemId)] || null;
}

export async function getEquipmentByIds(itemIds) {
  if (!itemIds || itemIds.length === 0) return {};
  const map = await loadEquipment();
  const result = {};
  itemIds.forEach(id => {
    const eq = map[id] || map[String(id)];
    if (eq) result[id] = eq;
  });
  return result;
}

export async function getEquipment() {
  return loadEquipment();
}

export async function isEquipment(itemId) {
  const map = await loadEquipment();
  return (itemId in map) || (String(itemId) in map);
}

export async function getEquipmentByJobs(jobAbbrs) {
  if (!jobAbbrs || jobAbbrs.length === 0) return {};
  const map = await loadEquipment();
  const result = {};
  Object.entries(map).forEach(([itemId, equipment]) => {
    if (equipment.jobs && Array.isArray(equipment.jobs) && jobAbbrs.some(abbr => equipment.jobs.includes(abbr))) {
      result[itemId] = equipment;
    }
  });
  return result;
}

export async function getEquipmentBySlotCategories(slotCategories) {
  if (!slotCategories || slotCategories.length === 0) return {};
  const map = await loadEquipment();
  const result = {};
  Object.entries(map).forEach(([itemId, equipment]) => {
    if (equipment.equipSlotCategory && slotCategories.includes(equipment.equipSlotCategory)) {
      result[itemId] = equipment;
    }
  });
  return result;
}

export async function getEquipmentByLevelAndJobs(level, jobsArray) {
  if (level == null || level < 0 || !jobsArray || !Array.isArray(jobsArray) || jobsArray.length === 0) return {};
  const map = await loadEquipment();
  const result = {};
  const jobsKey = [...jobsArray].sort().join(',');
  Object.entries(map).forEach(([itemId, equipment]) => {
    if (equipment.level !== level) return;
    const rowJobs = equipment.jobs || equipment.job_abbrs || [];
    const rowJobsKey = Array.isArray(rowJobs) ? [...rowJobs].sort().join(',') : '';
    if (rowJobsKey === jobsKey) result[itemId] = equipment;
  });
  return result;
}

export async function getEquipmentByJobsAndSlotCategories(jobAbbrs, slotCategories) {
  if ((!jobAbbrs || jobAbbrs.length === 0) && (!slotCategories || slotCategories.length === 0)) return {};
  const map = await loadEquipment();
  const result = {};
  Object.entries(map).forEach(([itemId, equipment]) => {
    let matchJobs = true;
    let matchSlots = true;
    if (jobAbbrs && jobAbbrs.length > 0) {
      matchJobs = !!(equipment.jobs && Array.isArray(equipment.jobs) && jobAbbrs.some(abbr => equipment.jobs.includes(abbr)));
    }
    if (slotCategories && slotCategories.length > 0) {
      matchSlots = !!(equipment.equipSlotCategory && slotCategories.includes(equipment.equipSlotCategory));
    }
    if (matchJobs && matchSlots) result[itemId] = equipment;
  });
  return result;
}
