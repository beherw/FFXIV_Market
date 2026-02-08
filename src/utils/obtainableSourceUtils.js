/**
 * Source filtering and sorting for obtainable methods.
 * Pure functions for filter/sort logic; used by ObtainMethods.
 */

import { DataType } from '../constants/dataTypes.js';

const CLEAN_NAME_REGEX = /[\uE000-\uF8FF\u200B-\u200D\uFEFF]/g;

/**
 * Get display item count for a source (used for sorting).
 * @param {Object} source - Source object with type and data
 * @returns {number}
 */
export function getSourceItemCount(source) {
  const { type, data } = source;
  if (!data) return 0;

  if (Array.isArray(data)) {
    if (type === DataType.VENDORS) {
      const uniqueNpcs = new Set(data.map(v => v.npcId));
      return uniqueNpcs.size;
    }
    if (type === DataType.TRADE_SOURCES) {
      if (Array.isArray(source.npcIds)) return source.npcIds.length;
      const uniqueNpcs = new Set();
      data.forEach(tradeSource => {
        tradeSource.npcs?.forEach(npc => {
          const npcId = typeof npc === 'object' ? npc.id : npc;
          if (npcId) uniqueNpcs.add(npcId);
        });
      });
      return uniqueNpcs.size;
    }
    if (type === DataType.REQUIREMENTS) return data.length;
    return data.length;
  }

  if (typeof data === 'object') {
    if (type === DataType.GATHERED_BY && data.nodes) return data.nodes.length;
    if (type === DataType.ALARMS && Array.isArray(data)) return data.length;
    if (type === DataType.ISLAND_CROP && 'seed' in data) return 1;
    return 1;
  }

  return 0;
}

/**
 * Check if a QUESTS source only contains levequests (would render empty in 任務獎勵).
 * @param {Object} source - Source with type and data
 * @param {Object} loadedData - Current loadedData (twQuests, quests)
 * @param {Object} twQuestsStaticData - Lazy-loaded tw-quests.json
 * @param {Object} twLevesStaticData - Lazy-loaded tw-leves.json
 * @returns {boolean} true if source should be treated as empty
 */
export function isQuestsSourceEmpty(source, loadedData, twQuestsStaticData, twLevesStaticData) {
  if (source.type !== DataType.QUESTS || !Array.isArray(source.data)) return false;

  const questIds = source.data
    .map(item => (typeof item === 'object' && item !== null && 'id' in item ? item.id : item))
    .filter(questId => questId !== null && questId !== undefined);

  if (questIds.length === 0) return true;

  const allAreLevequests = questIds.every(questId => {
    const questData =
      loadedData?.twQuests?.[questId] ||
      loadedData?.twQuests?.[String(questId)] ||
      (twQuestsStaticData && (twQuestsStaticData[questId] || twQuestsStaticData[String(questId)]));
    let questNameRaw = questData?.tw;
    if (!questNameRaw) {
      const questEn = loadedData?.quests?.[questId] || loadedData?.quests?.[String(questId)];
      questNameRaw = questEn?.en;
    }
    const questName = questNameRaw ? questNameRaw.replace(CLEAN_NAME_REGEX, '').trim() : null;
    if (!questName) {
      const leveData = twLevesStaticData && (twLevesStaticData[questId] || twLevesStaticData[String(questId)]);
      const leveNameRaw = leveData?.tw;
      const leveName = leveNameRaw ? leveNameRaw.replace(CLEAN_NAME_REGEX, '').trim() : null;
      return !!leveName;
    }
    return false;
  });

  return allAreLevequests;
}

/**
 * Filter and sort sources: remove empty QUESTS, ALARMS, DESYNTHS; sort DROPS first, then by item count.
 * @param {Array} sources - Raw sources array
 * @param {Object} options - { loadedData, twQuestsStaticData, twLevesStaticData }
 * @returns {Array} Filtered and sorted sources
 */
export function filterAndSortSources(sources, options = {}) {
  const { loadedData = {}, twQuestsStaticData = null, twLevesStaticData = null } = options;

  const filtered = sources.filter(source => {
    if (source.type === DataType.QUESTS) {
      return !isQuestsSourceEmpty(source, loadedData, twQuestsStaticData, twLevesStaticData);
    }
    if (source.type === DataType.ALARMS || source.typeName === '鬧鐘提醒' || source.typeName === '時間限定') return false;
    if (source.type === DataType.DESYNTHS) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.type === DataType.DROPS && b.type !== DataType.DROPS) return -1;
    if (a.type !== DataType.DROPS && b.type === DataType.DROPS) return 1;
    const countA = getSourceItemCount(a);
    const countB = getSourceItemCount(b);
    return countB - countA;
  });
}
