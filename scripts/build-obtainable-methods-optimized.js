#!/usr/bin/env node

/**
 * Build Optimized Obtainable Methods Data
 * 
 * Key optimizations:
 * 1. Store only essential fields (like ffxiv-item-search-tc does)
 * 2. Use plain JSON instead of MessagePack (better compression for this data shape)
 * 3. Remove redundant data and deeply nested structures
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTRACTS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/extracts/extracts.json');
const INSTANCES_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/instances.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE_JSON = path.join(OUTPUT_DIR, 'obtainable-methods.json');
const OUTPUT_FILE_MIN = path.join(OUTPUT_DIR, 'obtainable-methods.min.json');

// DataType enum
const DataType = {
  DEPRECATED: 0,
  CRAFTED_BY: 1,
  TRADE_SOURCES: 2,
  VENDORS: 3,
  REDUCED_FROM: 4,
  DESYNTHS: 5,
  INSTANCES: 6,
  GATHERED_BY: 7,
  VENTURES: 8,
  TREASURES: 9,
  QUESTS: 10,
  FATES: 11,
  GARDENING: 12,
  MOGSTATION: 13,
  ISLAND_PASTURE: 14,
  ISLAND_CROP: 15,
  VOYAGES: 16,
  REQUIREMENTS: 17,
  MASTERBOOKS: 18,
  ALARMS: 19,
  DROPS: 20,
  ACHIEVEMENTS: 22,
  TRIPLE_TRIAD_DUELS: 23,
  TRIPLE_TRIAD_PACK: 24
};

const TYPE_NAME_MAP = {
  [DataType.CRAFTED_BY]: '製作',
  [DataType.TRADE_SOURCES]: '兌換',
  [DataType.VENDORS]: 'NPC商店',
  [DataType.TREASURES]: '寶箱/容器',
  [DataType.INSTANCES]: '副本掉落',
  [DataType.DESYNTHS]: '精製獲得',
  [DataType.QUESTS]: '任務獎勵',
  [DataType.FATES]: '危命任務',
  [DataType.GATHERED_BY]: '採集獲得',
  [DataType.REDUCED_FROM]: '分解獲得',
  [DataType.VENTURES]: '遠征獲得',
  [DataType.GARDENING]: '園藝獲得',
  [DataType.MOGSTATION]: '商城購買',
  [DataType.ISLAND_PASTURE]: '無人島牧場',
  [DataType.ISLAND_CROP]: '無人島農作',
  [DataType.VOYAGES]: '遠航探索',
  [DataType.REQUIREMENTS]: '需求',
  [DataType.MASTERBOOKS]: '製作書',
  [DataType.ALARMS]: '鬧鐘提醒',
  [DataType.DROPS]: '怪物掉落',
  [DataType.ACHIEVEMENTS]: '成就獎勵',
  [DataType.TRIPLE_TRIAD_DUELS]: '三重幻卡對戰',
  [DataType.TRIPLE_TRIAD_PACK]: '三重幻卡包'
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
  if (contentTypes.has(28)) return '絕境戰';
  if (contentTypes.has(5)) return '大型任務';
  if (contentTypes.has(4)) return '討伐戰';
  if (contentTypes.has(2)) return '迷宮挑戰';
  return TYPE_NAME_MAP[DataType.INSTANCES];
}

/**
 * Extract only essential fields from source data
 * Mimics ffxiv-item-search-tc's approach of storing minimal data
 */
function extractEssentialData(type, rawData, instancesMap) {
  const typeName = type === DataType.INSTANCES 
    ? getInstanceTypeName(rawData, instancesMap)
    : (TYPE_NAME_MAP[type] || '未知');

  const result = {
    type: getTypeString(type),
    typeName: typeName
  };

  // Only extract fields that are actually used in the UI
  switch (type) {
    case DataType.VENDORS:
      if (Array.isArray(rawData) && rawData[0]) {
        result.price = rawData[0].price;
        if (rawData[0].npcName) result.vendors = rawData.map(v => ({
          npcName: v.npcName,
          zoneName: v.zoneName || '',
          x: v.x,
          y: v.y,
          aetheryteName: v.aetheryteName || ''
        }));
      }
      break;

    case DataType.TRADE_SOURCES:
      if (Array.isArray(rawData) && rawData[0]) {
        const shop = rawData[0];
        result.price = shop.cost?.[0]?.amount || shop.price;
        if (shop.cost?.[0]?.id) result.currencyItemId = shop.cost[0].id;
        else if (shop.currencyId) result.currencyItemId = shop.currencyId;
        
        result.currency = shop.cost?.[0]?.currency || shop.currency || 'item';
        
        if (shop.npcs && Array.isArray(shop.npcs)) {
          result.vendors = shop.npcs.map(npc => ({
            npcName: npc.name || '',
            zoneName: npc.zoneName || '',
            x: npc.coords?.x || npc.x,
            y: npc.coords?.y || npc.y,
            aetheryteName: npc.aetheryteName || ''
          }));
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
      }
      break;

    case DataType.QUESTS:
      if (Array.isArray(rawData) && rawData[0]) {
        result.questId = rawData[0].id;
        result.questName = rawData[0].name || '';
      }
      break;

    case DataType.FATES:
      if (Array.isArray(rawData) && rawData[0]) {
        result.fateName = rawData[0].name || '';
        result.zoneName = rawData[0].zoneName || '';
      }
      break;

    case DataType.VOYAGES:
      if (Array.isArray(rawData)) {
        result.voyageNames = rawData.map(v => v.name || '').filter(Boolean);
        result.totalVoyages = rawData.length;
      }
      break;

    case DataType.ACHIEVEMENTS:
      if (Array.isArray(rawData) && rawData[0]) {
        result.achievementId = rawData[0].id;
        result.achievementName = rawData[0].name || '';
      }
      break;

    case DataType.GATHERED_BY:
      if (Array.isArray(rawData) && rawData[0]) {
        result.gatheringType = rawData[0].type || 0;
        result.nodes = rawData.map(node => ({
          level: node.level,
          zoneName: node.zoneName || '',
          x: node.coords?.x || node.x,
          y: node.coords?.y || node.y
        }));
      }
      break;

    case DataType.DROPS:
      if (Array.isArray(rawData)) {
        result.monsters = rawData.map(m => ({
          name: m.name || '',
          zoneName: m.zoneName || ''
        }));
      }
      break;

    case DataType.CRAFTED_BY:
      if (Array.isArray(rawData) && rawData[0]) {
        result.recipeId = rawData[0].recipeId || rawData[0].id;
        result.job = rawData[0].job;
        result.level = rawData[0].level;
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

function getTypeString(typeId) {
  const typeNames = {
    [DataType.CRAFTED_BY]: 'craft',
    [DataType.TRADE_SOURCES]: 'specialshop',
    [DataType.VENDORS]: 'vendor',
    [DataType.INSTANCES]: 'instance',
    [DataType.QUESTS]: 'quest',
    [DataType.FATES]: 'fate',
    [DataType.GATHERED_BY]: 'gathering',
    [DataType.DROPS]: 'drop',
    [DataType.ACHIEVEMENTS]: 'achievement',
    [DataType.VOYAGES]: 'voyage',
    [DataType.REDUCED_FROM]: 'reduction',
    [DataType.DESYNTHS]: 'desynth',
    [DataType.GARDENING]: 'gardening',
    [DataType.VENTURES]: 'venture',
    [DataType.TREASURES]: 'treasure',
    [DataType.MOGSTATION]: 'mogstation',
    [DataType.ISLAND_PASTURE]: 'islandpasture',
    [DataType.ISLAND_CROP]: 'islandcrop',
    [DataType.ALARMS]: 'alarm',
    [DataType.REQUIREMENTS]: 'requirement',
    [DataType.MASTERBOOKS]: 'masterbook',
    [DataType.TRIPLE_TRIAD_DUELS]: 'tripleTriadDuel',
    [DataType.TRIPLE_TRIAD_PACK]: 'tripleTriadPack'
  };
  return typeNames[typeId] || `type_${typeId}`;
}

function buildOptimizedData() {
  console.log('\n[Obtainable] Building Optimized Obtainable Methods Data');

  const startTime = Date.now();

  const extracts = loadJson(EXTRACTS_SOURCE, 'extracts');
  const instances = loadJson(INSTANCES_SOURCE, 'instances');

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
        const optimizedSource = extractEssentialData(source.type, source.data, instances);
        sources.push(optimizedSource);
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

  // Save regular JSON (for debugging)
  console.log('[Obtainable] Saving JSON files...');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const jsonString = JSON.stringify(result, null, 2);
  fs.writeFileSync(OUTPUT_FILE_JSON, jsonString);
  const jsonSize = Buffer.byteLength(jsonString);
  console.log(`[Obtainable] Saved obtainable-methods.json (${(jsonSize / 1024 / 1024).toFixed(2)} MB)`);

  // Save minified JSON (production)
  const minString = JSON.stringify(result);
  fs.writeFileSync(OUTPUT_FILE_MIN, minString);
  const minSize = Buffer.byteLength(minString);
  console.log(`[Obtainable] Saved obtainable-methods.min.json (${(minSize / 1024 / 1024).toFixed(2)} MB)`);

  const extractsSize = fs.statSync(EXTRACTS_SOURCE).size;
  const buildTime = Date.now() - startTime;

  console.log(`[Obtainable] Complete - ${(minSize / 1024 / 1024).toFixed(2)} MB (reduced ${((1 - minSize / extractsSize) * 100).toFixed(1)}%) in ${buildTime}ms\n`);
}

try {
  buildOptimizedData();
} catch (error) {
  console.error('[Obtainable] ERROR: Build failed -', error.message);
  process.exit(1);
}
