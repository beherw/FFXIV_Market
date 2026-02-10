#!/usr/bin/env node

/**
 * Build Optimized Obtainable Methods Data
 * 
 * This script processes Teamcraft's extracts.json and enriches it with:
 * - NPC names (Traditional Chinese)
 * - Zone/Place names (Traditional Chinese)
 * - Quest names (Traditional Chinese)
 * - Instance names (Traditional Chinese)
 * - Mob names (Traditional Chinese)
 * - Achievement names
 * - Fate names (Traditional Chinese)
 * 
 * Key optimizations:
 * 1. Store only essential fields
 * 2. Use plain JSON instead of MessagePack
 * 3. Enrich with TW locale names where available
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTwJsonPath } from './tw-json-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source paths
const TC_DATA_PATH = path.join(__dirname, '../teamcraft_git/libs/data/src/lib');
const EXTRACTS_PATH = path.join(TC_DATA_PATH, 'extracts/extracts.json');
const JSON_PATH = path.join(TC_DATA_PATH, 'json');

// Additional data files for sources that extracts.json doesn't handle well
const QUEST_SOURCES_PATH = path.join(JSON_PATH, 'quest-sources.json');

// Output paths
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE_JSON = path.join(OUTPUT_DIR, 'obtainable-methods.json');
const OUTPUT_FILE_MIN = path.join(OUTPUT_DIR, 'obtainable-methods.min.json');

// DataType enum (MUST match Teamcraft's libs/types/src/lib/list/data-type.ts)
// CRITICAL: Do NOT change these values - they are determined by TypeScript enum auto-increment
const DataType = {
  DEPRECATED: -1,    // Basic items always available
  NONE: 0,
  CRAFTED_BY: 1,
  TRADE_SOURCES: 2,
  VENDORS: 3,
  REDUCED_FROM: 4,
  DESYNTHS: 5,
  INSTANCES: 6,
  GATHERED_BY: 7,
  GARDENING: 8,      // Seeds.json - items grown from seeds
  VOYAGES: 9,        // Submarine/Airship exploration
  DROPS: 10,         // Monster drops
  ALARMS: 11,        // Timed gathering nodes (uses nodes.json)
  MASTERBOOKS: 12,   // Masterbook item IDs required
  TREASURES: 13,     // Treasure maps - uses mogstation product IDs
  FATES: 14,         // FATE event rewards (island animals!)
  VENTURES: 15,      // Retainer venture results
  TRIPLE_TRIAD_DUELS: 16,
  TRIPLE_TRIAD_PACK: 17,
  QUESTS: 18,        // Quest rewards (uses quest indices, not game IDs)
  ACHIEVEMENTS: 19,  // Achievement rewards
  REQUIREMENTS: 20,  // Requirements/restrictions
  MOGSTATION: 21,    // Cash shop items
  ISLAND_PASTURE: 22,
  ISLAND_CROP: 23
};

const TYPE_NAME_MAP = {
  [DataType.DEPRECATED]: '基礎道具',
  [DataType.CRAFTED_BY]: '製作',
  [DataType.TRADE_SOURCES]: '兌換',
  [DataType.VENDORS]: 'NPC商店',
  [DataType.REDUCED_FROM]: '精選獲得',
  [DataType.DESYNTHS]: '精製分解',
  [DataType.INSTANCES]: '副本掉落',
  [DataType.GATHERED_BY]: '採集獲得',
  [DataType.GARDENING]: '園藝種植',
  [DataType.VOYAGES]: '潛水艇/飛空艇探索',
  [DataType.DROPS]: '怪物掉落',
  [DataType.ALARMS]: '限時採集',
  [DataType.MASTERBOOKS]: '秘籍配方',
  [DataType.TREASURES]: '寶藏地圖',
  [DataType.FATES]: '危命任務',
  [DataType.VENTURES]: '雇員探險',
  [DataType.TRIPLE_TRIAD_DUELS]: '九宮幻卡對戰',
  [DataType.TRIPLE_TRIAD_PACK]: '九宮幻卡卡包',
  [DataType.QUESTS]: '任務獎勵',
  [DataType.ACHIEVEMENTS]: '成就獎勵',
  [DataType.REQUIREMENTS]: '需求條件',
  [DataType.MOGSTATION]: '商城購買',
  [DataType.ISLAND_PASTURE]: '無人島牧場',
  [DataType.ISLAND_CROP]: '無人島採集'
};

// Reference data cache
let refData = null;

// Recipe masterbook lookup: result itemId -> masterbook item ID
let recipeMasterbookMap = new Map();

/**
 * Load all reference data files
 */
function loadReferenceData() {
  console.log('[Obtainable] Loading reference data...');
  
  refData = {
    // Core data
    npcs: loadJson(path.join(JSON_PATH, 'npcs.json')),
    places: loadJson(path.join(JSON_PATH, 'places.json')),
    instances: loadJson(path.join(JSON_PATH, 'instances.json')),
    quests: loadJson(path.join(JSON_PATH, 'quests.json')),
    mobs: loadJson(path.join(JSON_PATH, 'mobs.json')),
    achievements: loadJson(path.join(JSON_PATH, 'achievements.json')),
    fates: loadJson(path.join(JSON_PATH, 'fates.json')),
    treasures: loadJson(path.join(JSON_PATH, 'treasures.json')),
    maps: loadJson(path.join(JSON_PATH, 'maps.json')),
    aetherytes: loadJson(path.join(JSON_PATH, 'aetherytes.json')),
    gatheringTypes: loadJson(path.join(JSON_PATH, 'gathering-types.json')),
    items: loadJson(path.join(JSON_PATH, 'items.json')),  // For item names
    recipes: loadJson(path.join(JSON_PATH, 'recipes.json')), // For masterbook lookup
    
    // Quest sources (canonical source for quest rewards)
    questSources: loadJson(QUEST_SOURCES_PATH),
    
    // Traditional Chinese locale data (resolved: teamcraft vs tw_dataminer by mtime)
    twNpcs: loadJson(getTwJsonPath('tw-npcs.json')),
    twPlaces: loadJson(getTwJsonPath('tw-places.json')),
    twQuests: loadJson(getTwJsonPath('tw-quests.json')),
    twMobs: loadJson(getTwJsonPath('tw-mobs.json')),
    twFates: loadJson(getTwJsonPath('tw-fates.json')),
    twItems: loadJson(getTwJsonPath('tw-items.json')),
    twAchievements: loadJson(getTwJsonPath('tw-achievements.json')),
    
    // Simplified Chinese for fallback
    zhNpcs: loadJson(path.join(JSON_PATH, 'zh/zh-npcs.json')),
    zhPlaces: loadJson(path.join(JSON_PATH, 'zh/zh-places.json')),
    zhInstances: loadJson(path.join(JSON_PATH, 'zh/zh-instances.json')),
    zhItems: loadJson(path.join(JSON_PATH, 'zh/zh-items.json')),
    zhQuests: loadJson(path.join(JSON_PATH, 'zh/zh-quests.json')),
    zhAchievements: loadJson(path.join(JSON_PATH, 'zh/zh-achievements.json')),
  };
  
  // Build recipe masterbook lookup (result itemId -> masterbook item ID)
  // This is more reliable than extracts MASTERBOOKS type which uses internal IDs
  if (Array.isArray(refData.recipes)) {
    for (const recipe of refData.recipes) {
      if (recipe.result && recipe.masterbook) {
        // Store masterbook item ID keyed by result item ID
        recipeMasterbookMap.set(recipe.result, recipe.masterbook);
      }
    }
    console.log(`  - Recipe masterbooks: ${recipeMasterbookMap.size} items require masterbooks`);
  }
  
  console.log('[Obtainable] Reference data loaded');
  console.log(`  - Quest sources (canonical): ${Object.keys(refData.questSources).length} items`);
}

/**
 * Load JSON file safely
 */
function loadJson(jsonPath) {
  try {
    if (!fs.existsSync(jsonPath)) {
      console.warn(`[Obtainable] Warning: File not found: ${jsonPath}`);
      return {};
    }
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[Obtainable] Warning: Failed to load ${jsonPath}:`, error.message);
    return {};
  }
}

/**
 * Get NPC name with TW locale preference
 */
function getNpcName(npcId) {
  const id = String(npcId);
  
  // Try TW first
  const twData = refData.twNpcs[id];
  if (twData?.tw) return twData.tw;
  
  // Try ZH
  const zhData = refData.zhNpcs[id];
  if (zhData?.zh) return zhData.zh;
  
  // Fallback to EN/JA from npcs.json
  const npcData = refData.npcs[id];
  if (npcData) {
    return npcData.en || npcData.ja || '';
  }
  
  return '';
}

/**
 * Get place name with TW locale preference
 */
function getPlaceName(placeId) {
  const id = String(placeId);
  
  // Try TW first
  const twData = refData.twPlaces[id];
  if (twData?.tw) return twData.tw;
  
  // Try ZH
  const zhData = refData.zhPlaces[id];
  if (zhData?.zh) return zhData.zh;
  
  // Fallback to EN/JA from places.json
  const placeData = refData.places[id];
  if (placeData) {
    return placeData.en || placeData.ja || '';
  }
  
  return '';
}

/**
 * Get quest name with TW locale preference
 * questId should be in 65536+ format (the actual game quest ID)
 */
function getQuestName(questId) {
  const id = String(questId);
  
  // Try TW first
  const twData = refData.twQuests[id];
  if (twData?.tw) return twData.tw;
  
  // Try ZH fallback
  const zhData = refData.zhQuests[id];
  if (zhData?.zh) return zhData.zh;
  
  // Fallback to EN/JA from quests.json
  const questData = refData.quests[id];
  if (questData?.name) {
    return questData.name.ja || questData.name.en || '';
  }
  
  return '';
}

/**
 * Get instance name with TW/ZH locale preference
 */
function getInstanceName(instanceId) {
  const id = String(instanceId);
  
  // Try ZH first (has more coverage)
  const zhData = refData.zhInstances[id];
  if (zhData?.zh) return zhData.zh;
  
  // Fallback to EN/JA from instances.json
  const instanceData = refData.instances[id];
  if (instanceData) {
    return instanceData.en || instanceData.ja || '';
  }
  
  return '';
}

/**
 * Get mob name with TW locale preference
 */
function getMobName(mobId) {
  const id = String(mobId);
  
  // Try TW first
  const twData = refData.twMobs[id];
  if (twData?.tw) return twData.tw;
  
  // Fallback to EN/JA from mobs.json
  const mobData = refData.mobs[id];
  if (mobData) {
    return mobData.en || mobData.ja || '';
  }
  
  return '';
}

/**
 * Get achievement name with TW locale preference
 */
function getAchievementName(achievementId) {
  const id = String(achievementId);
  
  // Try TW first
  const twData = refData.twAchievements[id];
  if (twData?.tw) return twData.tw;
  
  // Try ZH fallback
  const zhData = refData.zhAchievements[id];
  if (zhData?.zh) return zhData.zh;
  
  // Fallback to achievements.json (EN/JA)
  const data = refData.achievements[id];
  if (data) {
    return data.ja || data.en || '';
  }
  return '';
}

/**
 * Get FATE name with TW locale preference
 */
function getFateName(fateId) {
  const id = String(fateId);
  
  // Try TW first
  const twData = refData.twFates[id];
  if (twData?.name?.tw) return twData.name.tw;
  
  // Fallback to EN/JA from fates.json
  const fateData = refData.fates[id];
  if (fateData?.name) {
    return fateData.name.en || fateData.name.ja || '';
  }
  
  return '';
}

/**
 * Get item name with TW locale preference
 */
function getItemName(itemId) {
  const id = String(itemId);
  
  // Try TW first
  const twData = refData.twItems[id];
  if (twData?.tw) return twData.tw;
  
  // Try ZH fallback
  const zhData = refData.zhItems[id];
  if (zhData?.zh) return zhData.zh;
  
  // Fallback to items.json (EN/JA)
  const itemData = refData.items[id];
  if (itemData) {
    return itemData.ja || itemData.en || '';
  }
  
  return '';
}

/**
 * Get nearest aetheryte to coordinates
 */
function getNearestAetheryte(mapId, x, y) {
  const aetheryteList = Object.values(refData.aetherytes);
  let nearest = null;
  let minDist = Infinity;
  
  for (const aetheryte of aetheryteList) {
    if (aetheryte.map !== mapId) continue;
    
    const dx = (aetheryte.x || 0) - x;
    const dy = (aetheryte.y || 0) - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < minDist) {
      minDist = dist;
      nearest = aetheryte;
    }
  }
  
  if (nearest) {
    return getPlaceName(nearest.nameid) || '';
  }
  
  return '';
}

/**
 * Get instance type name based on content type
 */
function getInstanceTypeName(instanceIds) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    return TYPE_NAME_MAP[DataType.INSTANCES];
  }
  
  const contentTypes = new Set();
  instanceIds.forEach(id => {
    const instance = refData.instances[id] || refData.instances[String(id)];
    if (instance?.contentType !== undefined) {
      contentTypes.add(instance.contentType);
    }
  });
  
  // Priority order for display
  if (contentTypes.has(28)) return '絕境戰';
  if (contentTypes.has(5)) return '大型任務';
  if (contentTypes.has(4)) return '討伐戰';
  if (contentTypes.has(2)) return '副本';
  
  return TYPE_NAME_MAP[DataType.INSTANCES];
}

/**
 * Get type string for output
 */
function getTypeString(typeId) {
  const typeNames = {
    [DataType.CRAFTED_BY]: 'craft',
    [DataType.TRADE_SOURCES]: 'specialshop',
    [DataType.VENDORS]: 'vendor',
    [DataType.INSTANCES]: 'instance',
    [DataType.QUESTS]: 'quest',
    [DataType.FATES]: 'fate',  // FATE event rewards
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
    [DataType.REQUIREMENTS]: 'mobdrop',  // This is actually mob drops with {id, amount}
    [DataType.MASTERBOOKS]: 'masterbook',
    [DataType.TRIPLE_TRIAD_DUELS]: 'tripleTriadDuel',
    [DataType.TRIPLE_TRIAD_PACK]: 'tripleTriadPack',
    [DataType.DEPRECATED]: 'basic',
    [-1]: 'basic'
  };
  return typeNames[typeId] || `type_${typeId}`;
}

/**
 * Extract and enrich essential data from source
 */
function extractEssentialData(type, rawData) {
  const typeName = TYPE_NAME_MAP[type] || '未知';
  
  const result = {
    type: getTypeString(type),
    typeName: typeName
  };

  switch (type) {
    case DataType.VENDORS:
      if (Array.isArray(rawData) && rawData.length > 0) {
        const firstVendor = rawData[0];
        result.price = firstVendor.price;
        result.currency = 'gil';
        
        // Enrich vendor data with names
        result.vendors = rawData.slice(0, 5).map(v => {
          const npcName = getNpcName(v.npcId);
          const zoneName = getPlaceName(v.zoneId);
          const aetheryteName = v.coords ? getNearestAetheryte(v.mapId, v.coords.x, v.coords.y) : '';
          
          return {
            npcId: v.npcId,
            npcName: npcName,
            zoneName: zoneName,
            x: v.coords?.x,
            y: v.coords?.y,
            aetheryteName: aetheryteName
          };
        }).filter(v => v.npcName); // Only include vendors with names
      }
      break;

    case DataType.TRADE_SOURCES:
      if (Array.isArray(rawData) && rawData.length > 0) {
        const shop = rawData[0];
        
        // Get currency info from trades
        if (shop.trades && shop.trades.length > 0) {
          const trade = shop.trades[0];
          if (trade.currencies && trade.currencies.length > 0) {
            const currency = trade.currencies[0];
            result.price = currency.amount;
            result.currencyItemId = currency.id;
            result.currencyName = getItemName(currency.id);
          }
        }
        
        result.currency = 'item';
        result.shopName = shop.shopName?.en || shop.shopName?.ja || '';
        
        // Enrich NPC data
        if (shop.npcs && Array.isArray(shop.npcs)) {
          result.vendors = shop.npcs.slice(0, 5).map(npc => {
            const npcName = getNpcName(npc.id);
            const zoneName = npc.zoneId ? getPlaceName(npc.zoneId) : '';
            const aetheryteName = npc.coords && npc.mapId ? getNearestAetheryte(npc.mapId, npc.coords.x, npc.coords.y) : '';
            
            return {
              npcId: npc.id,
              npcName: npcName,
              zoneName: zoneName,
              x: npc.coords?.x,
              y: npc.coords?.y,
              aetheryteName: aetheryteName
            };
          }).filter(v => v.npcName);
        }
      }
      break;

    case DataType.INSTANCES:
      if (Array.isArray(rawData) && rawData.length > 0) {
        // rawData is array of instance IDs
        result.typeName = getInstanceTypeName(rawData);
        result.instanceIds = rawData.slice(0, 10);
        result.instanceNames = rawData.slice(0, 10).map(id => getInstanceName(id)).filter(Boolean);
        result.totalInstances = rawData.length;
        
        // Get content types for filtering
        const contentTypes = new Set();
        rawData.forEach(id => {
          const instance = refData.instances[id] || refData.instances[String(id)];
          if (instance?.contentType) contentTypes.add(instance.contentType);
        });
        result.contentTypes = [...contentTypes];
      }
      break;

    case DataType.QUESTS:
      // NOTE: Extracts.json quest IDs are internal indices, not actual quest IDs!
      // We will handle quests separately using quest-sources.json
      // This case is a fallback that will be enriched later
      if (Array.isArray(rawData) && rawData.length > 0) {
        const quest = rawData[0];
        result.questId = quest.id;
        // Quest name lookup will likely fail here since quest.id is an internal index
        // The correct quest data will be added in post-processing
        if (quest.zoneid) {
          result.zoneName = getPlaceName(quest.zoneid);
        }
      }
      break;

    case DataType.DROPS:
      // Type 10: Loot location data with mob spawns
      // Structure: [{id: mobId, mapid, zoneid, position: {x, y, radius}}]
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.monsters = rawData.slice(0, 10).map(drop => ({
          mobId: drop.id,
          name: getMobName(drop.id),
          zoneName: getPlaceName(drop.zoneid),
          x: drop.position?.x,
          y: drop.position?.y
        })).filter(m => m.mobId);
        result.totalMonsters = rawData.length;
      }
      break;

    case DataType.REQUIREMENTS:
      // Type 20: Monster drop requirements with {id: mobId, amount}
      // This contains actual mob drops with amount
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.monsters = rawData.slice(0, 10).map(drop => ({
          mobId: drop.id,
          name: getMobName(drop.id),
          amount: drop.amount || 1
        })).filter(m => m.mobId);
        result.totalMonsters = rawData.length;
      }
      break;

    case DataType.ACHIEVEMENTS:
      // Type 19: Achievement rewards - array of achievement IDs (integers)
      if (Array.isArray(rawData) && rawData.length > 0) {
        const achievementId = rawData[0]; // It's just an int, not an object
        result.achievementId = achievementId;
        result.achievementName = getAchievementName(achievementId);
      }
      break;

    case DataType.FATES:
      // Type 14: FATE/Island animal data - [{id, level, zoneId, mapId, coords}]
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.fates = rawData.slice(0, 5).map(fate => ({
          fateId: fate.id,
          level: fate.level,
          zoneName: getPlaceName(fate.zoneId),
          x: fate.coords?.x,
          y: fate.coords?.y
        }));
        result.totalFates = rawData.length;
      }
      break;

    case DataType.GATHERED_BY:
      if (rawData && rawData.nodes && Array.isArray(rawData.nodes)) {
        result.level = rawData.level;
        result.gatheringType = rawData.type;
        result.nodes = rawData.nodes.slice(0, 5).map(node => ({
          level: node.level,
          zoneName: getPlaceName(node.zoneId),
          x: node.x,
          y: node.y,
          spawns: node.spawns,
          duration: node.duration,
          limited: node.limited,
          legendary: node.legendary,
          ephemeral: node.ephemeral
        }));
        result.totalNodes = rawData.nodes.length;
      }
      break;

    case DataType.TREASURES:
      // Type 13: Array of mogstation/treasure product IDs (integers)
      // These are mogstation product IDs, not map names
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.productIds = rawData.slice(0, 10);
        result.totalProducts = rawData.length;
      }
      break;

    case DataType.VOYAGES:
      // Type 9: Submarine/Airship exploration routes
      // Structure: [{type: 0/1, name: {en, ja, de, fr, id, location}}]
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.voyages = rawData.slice(0, 5).map(voyage => ({
          type: voyage.type, // 0 = airship, 1 = submarine
          name: voyage.name?.en || voyage.name?.ja || '',
          routeId: voyage.name?.id,
          location: voyage.name?.location
        }));
        result.totalVoyages = rawData.length;
      }
      break;

    case DataType.DESYNTHS:
      if (Array.isArray(rawData) && rawData.length > 0) {
        // rawData is array of item IDs that can be desynthed
        result.sourceItems = rawData.slice(0, 10).map(id => ({
          itemId: id,
          itemName: getItemName(id)
        }));
        result.totalSources = rawData.length;
      }
      break;

    case DataType.REDUCED_FROM:
      if (Array.isArray(rawData) && rawData.length > 0) {
        // rawData is array of item IDs that can be reduced
        result.sourceItems = rawData.slice(0, 10).map(id => ({
          itemId: id,
          itemName: getItemName(id)
        }));
        result.totalSources = rawData.length;
      }
      break;

    case DataType.VENTURES:
      // Type 15: Retainer venture results - array of venture data objects
      // Structure: [{id, exp, reqGathering, reqIlvl, lvl, cost, item, quantities, category}]
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.ventures = rawData.slice(0, 5).map(v => ({
          ventureId: v.id,
          level: v.lvl,
          cost: v.cost,
          quantities: v.quantities
        }));
        result.totalVentures = rawData.length;
      }
      break;

    case DataType.GARDENING:
      // Type 8: Single object with {seedItemId, duration, crossBreeds}
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        result.seedItemId = rawData.seedItemId;
        result.seedName = getItemName(rawData.seedItemId);
        result.duration = rawData.duration;
        if (rawData.crossBreeds && rawData.crossBreeds.length > 0) {
          result.crossBreeds = rawData.crossBreeds.slice(0, 5).map(cb => ({
            seedId: cb,
            seedName: getItemName(cb)
          }));
        }
      }
      break;

    case DataType.MASTERBOOKS:
      // Type 12: Array of {id} objects where id is masterbook ITEM ID (not internal SecretRecipeBook ID)
      // These ARE actual item IDs that can be looked up in items.json
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.books = rawData.slice(0, 5).map(book => ({
          bookId: book.id,
          bookName: getItemName(book.id)
        }));
        result.totalBooks = rawData.length;
      }
      break;

    case DataType.ALARMS:
      // Type 11: Timed gathering nodes with rich data
      // Structure: [{itemId, nodeId, duration, mapId, zoneId, areaId, type, coords, spawns, ephemeral, ...}]
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.alarms = rawData.slice(0, 5).map(alarm => ({
          nodeId: alarm.nodeId,
          zoneName: getPlaceName(alarm.zoneId),
          x: alarm.coords?.x,
          y: alarm.coords?.y,
          spawns: alarm.spawns,
          duration: alarm.duration,
          ephemeral: alarm.ephemeral
        }));
        result.totalAlarms = rawData.length;
      }
      break;

    case DataType.ISLAND_CROP:
      // Type 23: Island sanctuary crop - single object {seed: itemId}
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        result.seedItemId = rawData.seed;
        result.seedName = getItemName(rawData.seed);
      }
      break;

    case DataType.ISLAND_PASTURE:
      // Type 22: Island sanctuary animals - array of {id}
      if (Array.isArray(rawData) && rawData.length > 0) {
        result.animals = rawData.slice(0, 5).map(animal => ({
          animalId: animal.id
        }));
        result.totalAnimals = rawData.length;
      }
      break;

    case DataType.MOGSTATION:
      // Type 21: Mogstation items - single object {price, id}
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        result.price = rawData.price;
        result.productId = rawData.id;
      }
      break;

    case DataType.TRIPLE_TRIAD_DUELS:
      // Type 16: Triple Triad duel rewards
      if (rawData) {
        result.seed = rawData.seed;
      }
      break;

    case DataType.TRIPLE_TRIAD_PACK:
      // Type 17: Triple Triad card packs
      if (rawData) {
        result.packId = rawData;
      }
      break;

    case DataType.CRAFTED_BY:
      if (Array.isArray(rawData) && rawData.length > 0) {
        const recipe = rawData[0];
        result.recipeId = recipe.recipeId || recipe.id;
        result.job = recipe.job;
        result.level = recipe.level;
        result.stars = recipe.stars;
        result.totalRecipes = rawData.length;
      }
      break;

    case DataType.DEPRECATED:
    case -1:
      // Type -1 = basic/always available
      result.typeName = '基礎道具';
      break;

    default:
      // For unknown types, store basic info
      if (Array.isArray(rawData)) {
        result.count = rawData.length;
      } else if (typeof rawData === 'object' && rawData !== null) {
        result.data = rawData;
      }
  }

  return result;
}

/**
 * Create quest source from quest-sources.json (canonical)
 */
function createQuestSource(itemId) {
  const questIds = refData.questSources[itemId];
  if (!questIds || !Array.isArray(questIds) || questIds.length === 0) {
    return null;
  }
  
  // Get first quest info
  const questId = questIds[0];
  const questName = getQuestName(questId);
  
  return {
    type: 'quest',
    typeName: TYPE_NAME_MAP[DataType.QUESTS],
    questId: questId,
    questName: questName,
    totalQuests: questIds.length
  };
}

/**
 * Enrich masterbook source with actual item info from recipes.json
 * This is a fallback for cases where extracts.json MASTERBOOKS doesn't have data
 * but recipes.json indicates the item requires a masterbook
 */
function enrichMasterbookSource(itemId, sources) {
  // Check if item requires a masterbook to craft (from recipes.json)
  const masterbookItemId = recipeMasterbookMap.get(parseInt(itemId));
  if (!masterbookItemId) {
    return; // No masterbook required
  }
  
  // Find existing masterbook source
  const masterbookSource = sources.find(s => s.type === 'masterbook');
  if (masterbookSource) {
    // If it already has books, don't overwrite
    if (masterbookSource.books && masterbookSource.books.length > 0) {
      return;
    }
    // Add the actual item info from recipes.json
    masterbookSource.books = [{
      bookId: masterbookItemId,
      bookName: getItemName(masterbookItemId)
    }];
  } else {
    // No masterbook source from extracts, but recipe requires one - add it
    sources.push({
      type: 'masterbook',
      typeName: TYPE_NAME_MAP[DataType.MASTERBOOKS],
      books: [{
        bookId: masterbookItemId,
        bookName: getItemName(masterbookItemId)
      }],
      totalBooks: 1
    });
  }
}

/**
 * Main build function
 */
function buildOptimizedData() {
  console.log('\n[Obtainable] ========================================');
  console.log('[Obtainable] Building Optimized Obtainable Methods Data');
  console.log('[Obtainable] ========================================\n');

  const startTime = Date.now();

  // Load reference data first
  loadReferenceData();

  // Load extracts
  console.log('[Obtainable] Loading extracts.json...');
  if (!fs.existsSync(EXTRACTS_PATH)) {
    console.error(`[Obtainable] ERROR: extracts.json not found at ${EXTRACTS_PATH}`);
    process.exit(1);
  }
  const extracts = JSON.parse(fs.readFileSync(EXTRACTS_PATH, 'utf-8'));
  console.log(`[Obtainable] Loaded ${Object.keys(extracts).length} items from extracts`);

  console.log('[Obtainable] Processing items...');
  const result = {};
  let sourceCount = 0;
  let itemCount = 0;
  let skippedCount = 0;
  const typeStats = {};

  Object.entries(extracts).forEach(([itemId, row]) => {
    if (!row || !row.sources || !Array.isArray(row.sources) || row.sources.length === 0) {
      return;
    }

    const sources = [];
    let hasQuestFromExtracts = false;

    row.sources.forEach(source => {
      const type = source.type;
      
      if (type === undefined || type === DataType.DEPRECATED) {
        return;
      }

      // Skip QUESTS type from extracts - we'll use quest-sources.json instead
      if (type === DataType.QUESTS) {
        hasQuestFromExtracts = true;
        return;
      }

      if (!source.data) {
        skippedCount++;
        return;
      }

      // Skip empty arrays
      if (Array.isArray(source.data) && source.data.length === 0) {
        skippedCount++;
        return;
      }

      try {
        const optimizedSource = extractEssentialData(type, source.data);
        sources.push(optimizedSource);
        
        // Track type statistics
        const typeKey = getTypeString(type);
        typeStats[typeKey] = (typeStats[typeKey] || 0) + 1;
      } catch (err) {
        console.warn(`[Obtainable] Warning: Error processing item ${itemId}, type ${type}:`, err.message);
        skippedCount++;
      }
    });

    // Add quest source from quest-sources.json (canonical source)
    const questSource = createQuestSource(itemId);
    if (questSource) {
      sources.push(questSource);
      typeStats['quest'] = (typeStats['quest'] || 0) + 1;
    }
    
    // Enrich masterbook source with actual item info from recipes.json
    enrichMasterbookSource(itemId, sources);

    if (sources.length > 0) {
      result[itemId] = sources;
      itemCount++;
      sourceCount += sources.length;
    }
  });

  console.log(`\n[Obtainable] Processing complete:`);
  console.log(`  - Items processed: ${itemCount}`);
  console.log(`  - Total sources: ${sourceCount}`);
  console.log(`  - Skipped empty/invalid: ${skippedCount}`);
  
  console.log(`\n[Obtainable] Type distribution:`);
  Object.entries(typeStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

  // Save output files
  console.log('\n[Obtainable] Saving output files...');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Regular JSON (for debugging)
  const jsonString = JSON.stringify(result, null, 2);
  fs.writeFileSync(OUTPUT_FILE_JSON, jsonString);
  const jsonSize = Buffer.byteLength(jsonString);
  console.log(`[Obtainable] Saved obtainable-methods.json (${(jsonSize / 1024 / 1024).toFixed(2)} MB)`);

  // Minified JSON (production)
  const minString = JSON.stringify(result);
  fs.writeFileSync(OUTPUT_FILE_MIN, minString);
  const minSize = Buffer.byteLength(minString);
  console.log(`[Obtainable] Saved obtainable-methods.min.json (${(minSize / 1024 / 1024).toFixed(2)} MB)`);

  const buildTime = Date.now() - startTime;
  console.log(`\n[Obtainable] ✅ Build complete in ${buildTime}ms`);
}

// Run
try {
  buildOptimizedData();
} catch (error) {
  console.error('[Obtainable] ERROR: Build failed -', error);
  process.exit(1);
}
