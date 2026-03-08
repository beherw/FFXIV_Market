#!/usr/bin/env node

/**
 * Build Optimized Obtainable Methods Data
 *
 * Key optimizations:
 * 1. Store only essential fields (like ffxiv-item-search-tc does)
 * 2. Output MessagePack for production (smaller + faster parse); keep JSON for debugging
 * 3. Remove redundant data and deeply nested structures
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DataType, TYPE_CHINESE_NAMES, getStringFromTypeId } from '../src/constants/dataTypes.js';
import { getTwJsonPath } from './tw-json-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTRACTS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/extracts/extracts.json');
const INSTANCES_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/instances.json');
const MAPS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/maps.json');
const PLACES_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/places.json');
const TW_PLACES_SOURCE = getTwJsonPath('tw-places.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE_MSGPACK = path.join(OUTPUT_DIR, 'obtainable-methods.msgpack');

// 使用中心化的 TYPE_CHINESE_NAMES
const TYPE_NAME_MAP = TYPE_CHINESE_NAMES;

// Instance contentType -> display name (build script only; not in dataTypes)
const INSTANCE_CONTENT_TYPE_NAMES = {
  28: '絕境戰',
  5: '大型任務',
  4: '討伐戰',
  2: '副本'
};

function loadJson(jsonPath, dataName) {
  console.log(`[Obtainable] Reading ${dataName}...`);
  if (!fs.existsSync(jsonPath)) {
    console.error(`[Obtainable] ERROR: Source file not found: ${jsonPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content);
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`[Obtainable] Loaded ${count} records`);
  return data;
}

function getInstanceTypeName(instanceIds, instancesMap) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    return TYPE_NAME_MAP[DataType.INSTANCES];
  }
  const contentTypes = new Set();
  instanceIds.forEach(id => {
    const instance = instancesMap[id] || instancesMap[String(id)];
    if (instance && instance.contentType !== undefined) {
      contentTypes.add(instance.contentType);
    }
  });
  const priority = [28, 5, 4, 2];
  for (const ct of priority) {
    if (contentTypes.has(ct)) return INSTANCE_CONTENT_TYPE_NAMES[ct];
  }
  return TYPE_NAME_MAP[DataType.INSTANCES];
}

function getPlaceNameById(placeId, twPlacesMap, placesMap) {
  if (!placeId) return '';
  const tw = twPlacesMap?.[placeId] || twPlacesMap?.[String(placeId)];
  if (tw?.tw) return tw.tw;
  const place = placesMap?.[placeId] || placesMap?.[String(placeId)];
  return place?.en || '';
}

function composeZoneDisplayName(node, mapsMap, twPlacesMap, placesMap) {
  if (!node || typeof node !== 'object') return '';

  const subName = getPlaceNameById(node.zoneId, twPlacesMap, placesMap);
  const mapId = node.map ?? node.mapId;
  const map = mapsMap?.[mapId] || mapsMap?.[String(mapId)];
  const mainName = getPlaceNameById(map?.placename_id, twPlacesMap, placesMap);

  if (!mainName) return subName;
  if (!subName || mainName === subName) return mainName;
  if (subName.startsWith(mainName)) return subName;
  return `${mainName}・${subName}`;
}

/**
 * Extract only essential fields from source data
 * Mimics ffxiv-item-search-tc's approach of storing minimal data
 */
function extractEssentialData(type, rawData, instancesMap, mapsMap, twPlacesMap, placesMap) {
  const typeName = type === DataType.INSTANCES 
    ? getInstanceTypeName(rawData, instancesMap)
    : (TYPE_NAME_MAP[type] || '未知');

  const result = {
    type: getStringFromTypeId(type),
    typeName: typeName
  };

  // Only extract fields that are actually used in the UI
  switch (type) {
    case DataType.VENDORS:
      if (Array.isArray(rawData) && rawData.length > 0) {
        // Store full vendor data array to preserve all NPC information
        result.data = rawData.map(v => ({
          npcId: v.npcId,
          price: v.price,
          shopName: v.shopName,
          coords: v.coords,
          zoneId: v.zoneId,
          mapId: v.mapId,
          festival: v.festival
        }));
      }
      break;

    case DataType.TRADE_SOURCES:
      // Emit one entry per unique exchange (currency+amount+HQ); merge NPCs from all shops that offer the same trade.
      // So e.g. item 36244 with same "26807 x2 → 36244" in 3 shops becomes 1 entry with 3 NPCs (like item 44123).
      if (Array.isArray(rawData) && rawData.length > 0) {
        const tradeResults = [];
        rawData.forEach(shop => {
          const npcIds = (shop.npcs && Array.isArray(shop.npcs))
            ? shop.npcs.map(npc => (typeof npc === 'object' ? npc.id : npc)).filter(id => id != null)
            : [];
          const trades = shop.trades || [];
          trades.forEach(trade => {
            const currency = trade?.currencies?.[0];
            if (!currency) return;
            tradeResults.push({
              type: getStringFromTypeId(DataType.TRADE_SOURCES),
              typeName: TYPE_NAME_MAP[DataType.TRADE_SOURCES] || '兌換',
              currencyItemId: currency.id,
              currencyAmount: currency.amount,
              requiresHQ: currency.hq === true || undefined,
              currency: currency.currency || 'item',
              shopId: shop.id,
              shopName: shop.shopName,
              npcIds
            });
          });
        });
        // Merge entries with same exchange (same currency+amount+HQ): combine npcIds, keep first shopId/shopName
        if (tradeResults.length > 0) {
          const key = (e) => `${e.currencyItemId}|${e.currencyAmount}|${!!e.requiresHQ}|${e.currency || 'item'}`;
          const merged = new Map();
          tradeResults.forEach(entry => {
            const k = key(entry);
            if (!merged.has(k)) {
              merged.set(k, {
                ...entry,
                npcIds: [...entry.npcIds]
              });
            } else {
              const existing = merged.get(k);
              const seen = new Set(existing.npcIds);
              entry.npcIds.forEach(id => { if (!seen.has(id)) { seen.add(id); existing.npcIds.push(id); } });
            }
          });
          result._tradeResults = Array.from(merged.values());
        }
      }
      break;

    case DataType.INSTANCES:
      if (Array.isArray(rawData)) {
        result.instanceNames = rawData.map(id => {
          const instance = instancesMap[id] || instancesMap[String(id)];
          return instance?.name?.zh || instance?.name?.en || `Instance ${id}`;
        });
        result.instanceContentTypes = [...new Set(rawData.map(id => {
          const instance = instancesMap[id] || instancesMap[String(id)];
          return instance?.contentType;
        }).filter(ct => ct !== undefined))];
        result.totalInstances = rawData.length;
        // Provide instance IDs for frontend rendering and lookups
        result.data = rawData;
      }
      break;

    case DataType.QUESTS:
      if (Array.isArray(rawData) && rawData[0]) {
        result.questId = rawData[0].id;
        result.questName = rawData[0].name || '';
        // Preserve full quest list for frontend rendering
        result.data = rawData;
      }
      break;

    case DataType.FATES:
      if (Array.isArray(rawData) && rawData[0]) {
        result.fateId = rawData[0].id;
        result.fateName = rawData[0].name || '';
        result.level = rawData[0].level;
        result.zoneId = rawData[0].zoneId;
        // Preserve full fate list for frontend rendering and enrich zone names
        result.data = rawData.map(fate => {
          if (!fate || typeof fate !== 'object') return fate;
          return {
            ...fate,
            zoneName: composeZoneDisplayName(fate, mapsMap, twPlacesMap, placesMap)
          };
        });
      }
      break;

    case DataType.VOYAGES:
      if (Array.isArray(rawData)) {
        result.voyages = rawData.map(v => ({
          type: v.type, // 1 = submarine, 0 = airship
          id: v.name?.id || v.id,
          name: v.name
        }));
        result.totalVoyages = rawData.length;
        // Provide data for frontend rendering
        result.data = result.voyages;
      }
      break;

    case DataType.VENTURES:
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.tasks = rawData.map(task => ({
          id: task.id,
          level: task.lvl,
          reqGathering: task.reqGathering,
          reqIlvl: task.reqIlvl,
          exp: task.exp,
          quantities: task.quantities,
          category: task.category
        }));
        // Provide data for frontend rendering
        result.data = result.tasks;
      }
      break;

    case DataType.ACHIEVEMENTS:
      if (Array.isArray(rawData)) {
        result.achievementIds = rawData;
        result.count = rawData.length;
        // Provide data for frontend rendering
        result.data = rawData;
      }
      break;

    case DataType.GATHERED_BY:
      // rawData is an object with nodes array: { level, nodes: [...], type }
      if (rawData && rawData.nodes && Array.isArray(rawData.nodes)) {
        result.gatheringType = rawData.type || 0;
        result.level = rawData.level;
        result.nodes = rawData.nodes.map(node => ({
          level: node.level,
          zoneId: node.zoneId,
          mapId: node.map,
          zoneName: composeZoneDisplayName(node, mapsMap, twPlacesMap, placesMap),
          x: node.x,
          y: node.y,
          nodeId: node.id,
          limited: node.limited,
          ephemeral: node.ephemeral,
          spawns: node.spawns,
          duration: node.duration,
          radius: node.radius
        }));
        // Provide data for frontend rendering
        result.data = {
          type: result.gatheringType,
          level: result.level,
          nodes: result.nodes
        };
      }
      break;

    case DataType.DROPS:
      if (Array.isArray(rawData)) {
        result.monsters = rawData.map(m => ({
          name: m.name || '',
          zoneName: m.zoneName || ''
        }));
        // Preserve raw drop data for frontend rendering (includes IDs)
        result.data = rawData;
      }
      break;

    case DataType.GARDENING:
      // rawData is an object {seedItemId, duration, crossBreeds}
      if (rawData && rawData.seedItemId) {
        result.seedItemId = rawData.seedItemId;
        result.duration = rawData.duration;
        if (rawData.crossBreeds && rawData.crossBreeds.length > 0) {
          result.crossBreeds = rawData.crossBreeds;
        }
        // Provide data for frontend rendering
        result.data = {
          seedItemId: result.seedItemId,
          duration: result.duration,
          crossBreeds: result.crossBreeds
        };
      }
      break;

    case DataType.ALARMS:
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.nodes = rawData.map(alarm => ({
          nodeId: alarm.nodeId,
          zoneId: alarm.zoneId,
          mapId: alarm.mapId,
          zoneName: composeZoneDisplayName(alarm, mapsMap, twPlacesMap, placesMap),
          x: alarm.coords?.x,
          y: alarm.coords?.y,
          spawns: alarm.spawns,
          duration: alarm.duration
        }));
        // Provide data for frontend rendering
        result.data = result.nodes;
      }
      break;

    case DataType.MASTERBOOKS:
      if (Array.isArray(rawData)) {
        result.masterbookItemIds = rawData;
        result.count = rawData.length;
        // Provide data for frontend rendering
        result.data = rawData;
      }
      break;

    case DataType.TREASURES:
      if (Array.isArray(rawData)) {
        result.productIds = rawData;
        result.count = rawData.length;
        // Provide data for frontend rendering
        result.data = rawData;
      }
      break;

    case DataType.REQUIREMENTS:
      // This is actually mob drops with quantities
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.drops = rawData.map(drop => ({
          id: drop.id,
          amount: drop.amount || 1
        }));
        // Provide data for frontend rendering
        result.data = result.drops;
      }
      break;

    case DataType.MOGSTATION:
      // rawData is an object {price, id}
      if (rawData && rawData.id) {
        result.productId = rawData.id;
        result.price = rawData.price;
        // Provide data for frontend rendering
        result.data = { id: result.productId, price: result.price };
      }
      break;

    case DataType.ISLAND_CROP:
      // rawData is an object {seed}
      if (rawData && rawData.seed) {
        result.seedItemId = rawData.seed;
        // Provide data for frontend rendering
        result.data = { seed: result.seedItemId };
      }
      break;

    case DataType.CRAFTED_BY:
      if (Array.isArray(rawData) && rawData[0]) {
        result.recipeId = rawData[0].recipeId || rawData[0].id;
        result.job = rawData[0].job;
        result.level = rawData[0].level;
        // Preserve raw data for crafting tree and ingredient lookups
        result.data = rawData;
      }
      break;

    case DataType.REDUCED_FROM:
    case DataType.DESYNTHS:
      if (Array.isArray(rawData)) {
        result.data = rawData;
        result.count = rawData.length;
      }
      break;

    default:
      // For other types, store minimal data
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.count = rawData.length;
      }
  }

  return result;
}

function buildOptimizedData() {
  console.log('\n[Obtainable] Building Optimized Obtainable Methods Data');

  const startTime = Date.now();

  const extracts = loadJson(EXTRACTS_SOURCE, 'extracts');
  const instances = loadJson(INSTANCES_SOURCE, 'instances');
  const maps = loadJson(MAPS_SOURCE, 'maps');
  const places = loadJson(PLACES_SOURCE, 'places');
  const twPlaces = loadJson(TW_PLACES_SOURCE, 'tw-places');

  console.log('[Obtainable] Processing and optimizing data...');
  const result = {};
  let sourceCount = 0;
  let itemCount = 0;
  let skippedCount = 0;

  Object.entries(extracts).forEach(([itemId, row]) => {
    if (!row || !row.sources || !Array.isArray(row.sources) || row.sources.length === 0) {
      return;
    }

    const sources = [];

    row.sources.forEach(source => {
      if (!source || source.type === undefined || source.type === DataType.DEPRECATED) {
        return;
      }

      if (!source.data || (Array.isArray(source.data) && source.data.length === 0)) {
        skippedCount++;
        return;
      }

      try {
        const optimizedSource = extractEssentialData(source.type, source.data, instances, maps, twPlaces, places);
        if (optimizedSource._tradeResults && Array.isArray(optimizedSource._tradeResults)) {
          optimizedSource._tradeResults.forEach(s => sources.push(s));
        } else {
          sources.push(optimizedSource);
        }
      } catch (err) {
        console.warn(`[Obtainable] Warning: Error processing item ${itemId}, type ${source.type}:`, err.message);
        skippedCount++;
      }
    });

    if (sources.length > 0) {
      result[itemId] = sources;
      itemCount++;
      sourceCount += sources.length;
    }
  });

  console.log(`[Obtainable] Processed ${itemCount} items`);
  console.log(`[Obtainable] Total sources: ${sourceCount}`);
  console.log(`[Obtainable] Skipped empty/invalid: ${skippedCount}`);

  // Save MessagePack (production - smaller and faster to parse)
  console.log('[Obtainable] Saving msgpack...');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const msgpackBytes = msgpack.encode(result);
  fs.writeFileSync(OUTPUT_FILE_MSGPACK, new Uint8Array(msgpackBytes));
  const msgpackSize = msgpackBytes.length;
  console.log(`[Obtainable] Saved obtainable-methods.msgpack (${(msgpackSize / 1024 / 1024).toFixed(2)} MB)`);

  const extractsSize = fs.statSync(EXTRACTS_SOURCE).size;
  const buildTime = Date.now() - startTime;

  console.log(`[Obtainable] Complete - msgpack ${(msgpackSize / 1024 / 1024).toFixed(2)} MB (reduced ${((1 - msgpackSize / extractsSize) * 100).toFixed(1)}%) in ${buildTime}ms\n`);
}

try {
  buildOptimizedData();
} catch (error) {
  console.error('[Obtainable] ERROR: Build failed -', error.message);
  process.exit(1);
}
