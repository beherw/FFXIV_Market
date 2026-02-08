/**
 * Source processing for obtainable methods: drops merge, ISLAND_PASTURE→FATES,
 * FATE validation, merge FATEs from table, zone ID collection.
 * Used by ObtainMethods in the main load effect.
 */

import { DataType } from '../constants/dataTypes.js';

export function getDropInfoScore(drop) {
  if (!drop || typeof drop !== 'object') return 0;
  const hasZone = drop.zoneid != null;
  const hasMap = drop.mapid != null;
  const hasPosition = drop.position && typeof drop.position === 'object';
  const hasZonePositions = Array.isArray(drop.zonePositions) && drop.zonePositions.length > 0;
  const hasLevel = (drop.minLevel != null) || (drop.maxLevel != null) || (drop.lvl != null);
  return (hasZone ? 2 : 0) + (hasMap ? 1 : 0) + (hasPosition ? 3 : 0) + (hasZonePositions ? 3 : 0) + (hasLevel ? 1 : 0);
}

export function mergeDropSources(existingDrops, newDrops) {
  const byKey = new Map();
  const order = [];
  const mobHasSpecific = new Set();

  const ingest = (drop) => {
    if (drop == null) return;
    const normalized = typeof drop === 'number' ? { id: drop } : drop;
    const mobId = normalized.id ?? normalized.mobId;
    if (!mobId) return;
    const zoneid = normalized.zoneid ?? normalized.zoneId ?? normalized.position?.zoneid;
    const mapid = normalized.mapid ?? normalized.mapId;
    const key = `${mobId}|${zoneid ?? 'none'}|${mapid ?? 'none'}`;
    const score = getDropInfoScore(normalized);
    const isSpecific = (zoneid != null) || (mapid != null) || (Array.isArray(normalized.zonePositions) && normalized.zonePositions.length > 0) || !!normalized.position;
    if (isSpecific) mobHasSpecific.add(String(mobId));
    if (!byKey.has(key)) {
      byKey.set(key, { drop: normalized, score, mobId: String(mobId), isSpecific });
      order.push(key);
      return;
    }
    const existing = byKey.get(key);
    if (score > existing.score) byKey.set(key, { drop: normalized, score, mobId: String(mobId), isSpecific });
  };

  existingDrops.forEach(ingest);
  newDrops.forEach(ingest);
  return order
    .map(k => byKey.get(k))
    .filter(entry => !(entry && !entry.isSpecific && mobHasSpecific.has(entry.mobId)))
    .map(entry => entry.drop);
}

/**
 * Build drop objects from dropSourcesData and monstersData for an item.
 * @param {string|number} itemId
 * @param {Object} dropSourcesData - drop-sources.json (itemId -> monster IDs)
 * @param {Object} monstersData - monsters.json
 * @param {Function} [onWarn] - optional (msg) => {}
 * @returns {Array} drop objects
 */
export function buildDropObjectsFromDropSources(itemId, dropSourcesData, monstersData, onWarn) {
  const monsterIds = dropSourcesData[itemId] || dropSourcesData[String(itemId)];
  if (!Array.isArray(monsterIds) || monsterIds.length === 0) return [];

  const dropObjects = [];
  monsterIds.forEach(monsterId => {
    const monster = monstersData[monsterId] || monstersData[String(monsterId)];
    if (monster && Array.isArray(monster.positions) && monster.positions.length > 0) {
      const positionsByZone = {};
      monster.positions.forEach(position => {
        const zoneid = position.zoneid;
        if (!positionsByZone[zoneid]) positionsByZone[zoneid] = [];
        positionsByZone[zoneid].push(position);
      });
      Object.keys(positionsByZone).forEach(zoneid => {
        const zonePositions = positionsByZone[zoneid];
        const firstPosition = zonePositions[0];
        const mapid = firstPosition.map;
        let avgX = 0, avgY = 0;
        zonePositions.forEach(p => { avgX += p.x; avgY += p.y; });
        avgX /= zonePositions.length;
        avgY /= zonePositions.length;
        const spreadX = Math.max(...zonePositions.map(p => p.x)) - Math.min(...zonePositions.map(p => p.x));
        const spreadY = Math.max(...zonePositions.map(p => p.y)) - Math.min(...zonePositions.map(p => p.y));
        const maxRadius = Math.max(spreadX, spreadY) * 41 || 100;
        const levels = zonePositions.map(p => p.level).filter(l => l > 0);
        const minLevel = levels.length > 0 ? Math.min(...levels) : null;
        const maxLevel = levels.length > 0 ? Math.max(...levels) : null;
        dropObjects.push({
          id: monsterId,
          mapid,
          zoneid: parseInt(zoneid, 10),
          lvl: minLevel,
          minLevel,
          maxLevel,
          zonePositions,
          position: { x: avgX, y: avgY, radius: maxRadius, zoneid: parseInt(zoneid, 10) }
        });
      });
    } else {
      if (onWarn) onWarn(`Monster ${monsterId} has no position data`);
      dropObjects.push({
        id: monsterId,
        zoneid: null,
        mapid: null,
        minLevel: null,
        maxLevel: null,
        zonePositions: []
      });
    }
  });
  return dropObjects;
}

/**
 * Merge drop objects into processedSources (mutates).
 */
export function applyDropsToProcessedSources(processedSources, dropObjects) {
  if (dropObjects.length === 0) return;
  const existingDropIndex = processedSources.findIndex(s => s.type === DataType.DROPS);
  if (existingDropIndex >= 0) {
    const existing = processedSources[existingDropIndex];
    const existingData = Array.isArray(existing.data) ? existing.data : [];
    processedSources[existingDropIndex] = { ...existing, data: mergeDropSources(existingData, dropObjects) };
  } else {
    processedSources.push({ type: DataType.DROPS, data: dropObjects });
  }
}

/**
 * Convert ISLAND_PASTURE sources that look like FATEs to FATES, and collect fate zone IDs.
 * Mutates processedSources. Returns { fateZoneIds: Set, existingFateIdsFromSources: Set }.
 */
export function convertIslandPastureToFates(processedSources) {
  const fateZoneIds = new Set();
  const existingFateIdsFromSources = new Set();
  const islandPastureFates = [];

  const filtered = processedSources.filter(source => {
    if (source.type === DataType.ISLAND_PASTURE && Array.isArray(source.data)) {
      const looksLikeFate = source.data.some(item =>
        typeof item === 'object' && item.id && typeof item.id === 'number' &&
        (item.level !== undefined || item.zoneId !== undefined || item.coords !== undefined)
      );
      if (looksLikeFate) {
        islandPastureFates.push({
          type: DataType.FATES,
          data: source.data.map(fate => {
            if (typeof fate === 'object' && fate.id) {
              existingFateIdsFromSources.add(fate.id);
              if (fate.zoneId) fateZoneIds.add(fate.zoneId);
            }
            return fate;
          })
        });
        return false;
      }
    }
    if (source.type === DataType.FATES && Array.isArray(source.data)) {
      source.data.forEach(fate => {
        if (typeof fate === 'object' && fate.id) {
          existingFateIdsFromSources.add(fate.id);
          if (fate.zoneId) fateZoneIds.add(fate.zoneId);
        }
      });
    }
    return source.type !== DataType.ISLAND_PASTURE;
  });

  if (islandPastureFates.length > 0) {
    const existingFates = filtered.find(s => s.type === DataType.FATES);
    if (existingFates) {
      islandPastureFates.forEach(fs => { existingFates.data = [...(existingFates.data || []), ...(fs.data || [])]; });
    } else {
      filtered.push(...islandPastureFates);
    }
  }

  processedSources.length = 0;
  processedSources.push(...filtered);
  return { fateZoneIds, existingFateIdsFromSources };
}

/**
 * Filter out FATE sources that are actually gathering nodes (no valid numeric fate id).
 * Mutates processedSources in place (filters array).
 */
export function filterInvalidFates(processedSources) {
  const filtered = processedSources.filter(source => {
    if (source.type !== DataType.FATES || !Array.isArray(source.data)) return true;
    const hasValidFate = source.data.some(fate => {
      if (typeof fate === 'object' && (fate.nodeId !== undefined || fate.itemId !== undefined) && fate.id === undefined) return false;
      const fateId = typeof fate === 'object' ? fate.id : fate;
      return fateId && typeof fateId === 'number';
    });
    return hasValidFate;
  });
  processedSources.length = 0;
  processedSources.push(...filtered);
}

/**
 * Merge FATEs from fate_sources table into processedSources. Mutates processedSources and fateZoneIds.
 * @param {Set} [existingFateIdsFromSources] - FATE IDs already present from ISLAND_PASTURE conversion
 */
export function mergeFateSourcesFromTable(processedSources, fateSourcesForItem, loadedData, fateZoneIds, existingFateIdsFromSources, onWarn) {
  if (!fateSourcesForItem || fateSourcesForItem.length === 0) return;
  const hasFates = processedSources.some(s => s.type === DataType.FATES);
  const existingFateIds = new Set();
  if (hasFates) {
    const fatesSource = processedSources.find(s => s.type === DataType.FATES);
    if (fatesSource && Array.isArray(fatesSource.data)) {
      fatesSource.data.forEach(fate => {
        const fateId = typeof fate === 'object' ? fate.id : fate;
        if (fateId) existingFateIds.add(fateId);
        if (typeof fate === 'object' && fate.zoneId) fateZoneIds.add(fate.zoneId);
      });
    }
  }
  const missingFateIds = fateSourcesForItem.filter(id => !existingFateIds.has(id) && !(existingFateIdsFromSources && existingFateIdsFromSources.has(id)));
  if (missingFateIds.length === 0) return;

  const fatesById = loadedData.fatesById || {};
  const newFateSources = missingFateIds.map(fateId => {
    const fate = fatesById[fateId] || fatesById[String(fateId)];
    if (!fate) {
      if (onWarn) onWarn(`No data found for FATE ${fateId}`);
      return null;
    }
    const zoneId = fate.zoneId ?? null;
    if (zoneId) fateZoneIds.add(zoneId);
    return {
      id: fateId,
      level: fate.level ?? 0,
      zoneId,
      mapId: fate.mapId ?? null,
      coords: (fate.x != null && fate.y != null) ? { x: fate.x, y: fate.y } : null
    };
  }).filter(Boolean);

  if (newFateSources.length === 0) return;
  if (hasFates) {
    const fatesSource = processedSources.find(s => s.type === DataType.FATES);
    if (fatesSource) fatesSource.data = [...(fatesSource.data || []), ...newFateSources];
  } else {
    processedSources.push({ type: DataType.FATES, data: newFateSources });
  }
}

/**
 * Collect all zone IDs used by any obtainable method (for place data loading).
 * @param {Array} processedSources
 * @param {Object} loadedData
 * @param {Object} requiredIds - from extractIdsFromSources
 * @param {Set} fateZoneIds - from convertIslandPastureToFates / mergeFateSourcesFromTable
 * @returns {Set} allZoneIds
 */
export function collectAllZoneIds(processedSources, loadedData, requiredIds, fateZoneIds) {
  const allZoneIds = new Set();
  if (requiredIds && requiredIds.zoneIds) requiredIds.zoneIds.forEach(id => allZoneIds.add(id));
  if (fateZoneIds) fateZoneIds.forEach(id => allZoneIds.add(id));

  const instances = loadedData.instances || {};
  Object.values(instances).forEach(instance => {
    if (instance?.position?.zoneid) allZoneIds.add(instance.position.zoneid);
  });
  const instancesSource = processedSources.find(s => s.type === DataType.INSTANCES);
  if (instancesSource && Array.isArray(instancesSource.data)) {
    instancesSource.data.forEach(entry => {
      if (typeof entry === 'object' && entry.zoneId) allZoneIds.add(entry.zoneId);
    });
  }

  const questsDb = loadedData.questsDatabasePages || {};
  Object.values(questsDb).forEach(questDb => {
    if (questDb?.startingPoint?.zoneid) allZoneIds.add(questDb.startingPoint.zoneid);
  });

  const npcs = loadedData.npcs || {};
  Object.values(npcs).forEach(npc => { if (npc?.position?.zoneid) allZoneIds.add(npc.position.zoneid); });
  const npcsDb = loadedData.npcsDatabasePages || {};
  Object.values(npcsDb).forEach(npcDb => { if (npcDb?.position?.zoneid) allZoneIds.add(npcDb.position.zoneid); });

  const gatheredBy = processedSources.find(s => s.type === DataType.GATHERED_BY);
  if (gatheredBy?.data?.nodes) gatheredBy.data.nodes.forEach(node => { if (node?.zoneId) allZoneIds.add(node.zoneId); });

  const alarms = processedSources.find(s => s.type === DataType.ALARMS);
  if (alarms && Array.isArray(alarms.data)) alarms.data.forEach(alarm => { if (alarm?.zoneId) allZoneIds.add(alarm.zoneId); });

  const vendors = processedSources.find(s => s.type === DataType.VENDORS);
  if (vendors && Array.isArray(vendors.data)) vendors.data.forEach(v => { if (v?.zoneId) allZoneIds.add(v.zoneId); });

  const tradeSources = processedSources.find(s => s.type === DataType.TRADE_SOURCES);
  if (tradeSources && Array.isArray(tradeSources.data)) {
    tradeSources.data.forEach(ts => {
      (ts.npcs || []).forEach(npc => { if (typeof npc === 'object' && npc.zoneId) allZoneIds.add(npc.zoneId); });
    });
  }

  return allZoneIds;
}
