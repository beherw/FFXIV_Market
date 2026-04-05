#!/usr/bin/env node

/**
 * Build Obtainable Domain Msgpacks
 *
 * Reads teamcraft JSON and outputs one msgpack per domain for obtainableDataService.
 * Output: npcs.msgpack, shops.msgpack, instances.msgpack, quests.msgpack,
 *         achievements.msgpack, places.msgpack, leves.msgpack, loot-sources.msgpack,
 *         voyages.msgpack (twSubmarineVoyages + twAirshipVoyages; zh fills gaps via cn→tw)
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Converter as CN2TConverter } from 'opencc-js/cn2t';
import { getTwJsonPath } from './tw-json-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_PATH = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json');
const DB_PATH = path.join(JSON_PATH, 'db');
const ZH_PATH = path.join(JSON_PATH, 'zh');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

function loadJson(relativePath, name) {
  const p = path.join(JSON_PATH, relativePath);
  if (!fs.existsSync(p)) {
    console.error(`[Obtainable] ERROR: ${name} not found: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`[Obtainable] Loaded ${name}: ${count} records`);
  return data;
}

function loadTwJson(filename, name) {
  const p = getTwJsonPath(filename);
  if (!fs.existsSync(p)) {
    console.error(`[Obtainable] ERROR: ${name} not found: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`[Obtainable] Loaded ${name}: ${count} records`);
  return data;
}

function loadDb(relativePath, name) {
  const p = path.join(DB_PATH, relativePath);
  if (!fs.existsSync(p)) {
    console.error(`[Obtainable] ERROR: ${name} not found: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  console.log(`[Obtainable] Loaded ${name}: ${Object.keys(data).length} records`);
  return data;
}

const simplifiedToTraditional = CN2TConverter({ from: 'cn', to: 't' });

/**
 * Merge TW voyage names from game TW JSON; fill missing ids from ZH (converted to Traditional).
 * @param {Record<string, object>} twMap
 * @param {Record<string, object>} zhMap - rows use `zh` key
 */
function mergeVoyageTwFromZh(twMap, zhMap) {
  const out = {};
  Object.entries(twMap || {}).forEach(([id, row]) => {
    if (!row || typeof row !== 'object') return;
    const tw = row.tw ?? row.name?.tw;
    if (tw == null || String(tw).trim() === '') return;
    out[id] = {
      tw: String(tw),
      id: row.id ?? parseInt(id, 10),
      ...(row.location != null && row.location !== '' ? { location: row.location } : {})
    };
  });
  Object.entries(zhMap || {}).forEach(([id, row]) => {
    if (!row || typeof row !== 'object') return;
    const zh = row.zh;
    if (!zh || typeof zh !== 'string' || zh.trim() === '') return;
    if (out[id]?.tw && String(out[id].tw).trim() !== '') return;
    try {
      out[id] = {
        tw: simplifiedToTraditional(zh),
        id: row.id ?? parseInt(id, 10),
        ...(row.location != null && row.location !== '' ? { location: row.location } : {})
      };
    } catch {
      out[id] = {
        tw: zh,
        id: row.id ?? parseInt(id, 10),
        ...(row.location != null && row.location !== '' ? { location: row.location } : {})
      };
    }
  });
  return out;
}

function writeMsgpack(filename, data, label) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const outPath = path.join(OUTPUT_DIR, filename);
  const packed = msgpack.encode(data);
  fs.writeFileSync(outPath, packed);
  console.log(`[Obtainable] Written ${filename}: ${(packed.length / 1024).toFixed(1)} KB`);
}

// --- NPCs ---
function buildNpcs() {
  const twNpcs = loadTwJson('tw-npcs.json', 'tw-npcs');
  const npcs = loadJson('npcs.json', 'npcs');
  const npcsDb = loadDb('npcs-database-pages.json', 'npcs-database-pages');

  const twNpcsMap = {};
  Object.entries(twNpcs).forEach(([id, row]) => {
    const name = row?.name?.tw ?? row?.tw;
    if (name != null && name !== '') twNpcsMap[id] = { tw: name };
  });

  writeMsgpack('npcs.msgpack', {
    twNpcs: twNpcsMap,
    npcs: typeof npcs === 'object' && !Array.isArray(npcs) ? npcs : {},
    npcsDatabasePages: npcsDb
  }, 'npcs');
}

// --- Shops ---
function buildShops() {
  const twShops = loadTwJson('tw-shops.json', 'tw-shops');
  const shopsArray = loadJson('shops.json', 'shops');
  const shopsByNpc = loadJson('shops-by-npc.json', 'shops-by-npc');

  const twShopsMap = {};
  Object.entries(twShops).forEach(([id, row]) => {
    const name = row?.name?.tw ?? row?.tw;
    if (name != null && name !== '') twShopsMap[id] = { tw: name };
  });

  const shopsMap = {};
  if (Array.isArray(shopsArray)) {
    shopsArray.forEach(shop => {
      if (shop && shop.id != null) shopsMap[String(shop.id)] = shop;
    });
  }

  writeMsgpack('shops.msgpack', {
    twShops: twShopsMap,
    shops: shopsMap,
    shopsByNpc: shopsByNpc
  }, 'shops');
}

// --- Instances ---
function buildInstances() {
  const twInstances = loadTwJson('tw-instances.json', 'tw-instances');
  const instances = loadJson('instances.json', 'instances');
  const zhInstances = loadJson('zh/zh-instances.json', 'zh-instances');

  const twMap = {};
  Object.entries(twInstances).forEach(([id, row]) => {
    const name = row?.name?.tw ?? row?.tw;
    if (name != null && name !== '') twMap[id] = { tw: name };
  });

  writeMsgpack('instances.msgpack', {
    twInstances: twMap,
    instances: typeof instances === 'object' && !Array.isArray(instances) ? instances : {},
    zhInstances: typeof zhInstances === 'object' && !Array.isArray(zhInstances) ? zhInstances : {}
  }, 'instances');
}

// --- Quests ---
function buildQuests() {
  const twQuests = loadTwJson('tw-quests.json', 'tw-quests');
  const quests = loadJson('quests.json', 'quests');
  const zhQuests = loadJson('zh/zh-quests.json', 'zh-quests');
  const questsDb = loadDb('quests-database-pages.json', 'quests-database-pages');

  const twMap = {};
  Object.entries(twQuests).forEach(([id, row]) => {
    const name = row?.name?.tw ?? row?.tw;
    if (name != null && name !== '') twMap[id] = { tw: name };
  });

  writeMsgpack('quests.msgpack', {
    twQuests: twMap,
    quests: typeof quests === 'object' && !Array.isArray(quests) ? quests : {},
    zhQuests: typeof zhQuests === 'object' && !Array.isArray(zhQuests) ? zhQuests : {},
    questsDatabasePages: questsDb
  }, 'quests');
}

// --- Achievements ---
function buildAchievements() {
  const twAchievements = loadTwJson('tw-achievements.json', 'tw-achievements');
  const twAchievementDescriptions = loadTwJson('tw-achievement-descriptions.json', 'tw-achievement-descriptions');
  const achievements = loadJson('achievements.json', 'achievements');

  const twMap = {};
  Object.entries(twAchievements).forEach(([id, row]) => {
    const name = row?.name?.tw ?? row?.tw;
    if (name != null && name !== '') twMap[id] = { tw: name };
  });

  writeMsgpack('achievements.msgpack', {
    twAchievements: twMap,
    twAchievementDescriptions: typeof twAchievementDescriptions === 'object' ? twAchievementDescriptions : {},
    achievements: typeof achievements === 'object' && !Array.isArray(achievements) ? achievements : {}
  }, 'achievements');
}

// --- Places ---
function buildPlaces() {
  const twPlaces = loadTwJson('tw-places.json', 'tw-places');
  const places = loadJson('places.json', 'places');

  const twMap = {};
  Object.entries(twPlaces).forEach(([id, row]) => {
    const name = row?.name?.tw ?? row?.tw ?? row?.name;
    if (name != null && name !== '') twMap[id] = typeof name === 'string' ? { tw: name } : { tw: name?.tw ?? name };
  });

  writeMsgpack('places.msgpack', {
    twPlaces: twMap,
    places: typeof places === 'object' && !Array.isArray(places) ? places : {}
  }, 'places');
}

// --- Leves ---
function buildLeves() {
  const levesDb = loadDb('leves-database-pages.json', 'leves-database-pages');
  writeMsgpack('leves.msgpack', { levesDatabasePages: levesDb }, 'leves');
}

// --- Loot sources ---
function buildLootSources() {
  const lootSources = loadJson('loot-sources.json', 'loot-sources');
  const lootSourcesByItemId = {};
  Object.entries(lootSources).forEach(([itemId, arr]) => {
    if (Array.isArray(arr) && arr.length > 0) {
      lootSourcesByItemId[itemId] = arr;
    }
  });
  writeMsgpack('loot-sources.msgpack', { lootSourcesByItemId }, 'loot-sources');
}

// --- Voyages (submarine + airship TW names) ---
function buildVoyages() {
  const twSub = loadTwJson('tw-submarine-voyages.json', 'tw-submarine-voyages');
  const twAir = loadTwJson('tw-airship-voyages.json', 'tw-airship-voyages');
  const zhSub = loadJson('zh/zh-submarine-voyages.json', 'zh-submarine-voyages');
  const zhAir = loadJson('zh/zh-airship-voyages.json', 'zh-airship-voyages');

  const twSubmarineVoyages = mergeVoyageTwFromZh(twSub, zhSub);
  const twAirshipVoyages = mergeVoyageTwFromZh(twAir, zhAir);

  console.log(
    `[Obtainable] Voyages: submarine ${Object.keys(twSubmarineVoyages).length}, airship ${Object.keys(twAirshipVoyages).length}`
  );
  writeMsgpack('voyages.msgpack', { twSubmarineVoyages, twAirshipVoyages }, 'voyages');
}

function main() {
  console.log('\n[Obtainable] Building domain msgpacks...\n');
  const start = Date.now();
  buildNpcs();
  buildShops();
  buildInstances();
  buildQuests();
  buildAchievements();
  buildPlaces();
  buildLeves();
  buildLootSources();
  buildVoyages();
  console.log(`\n[Obtainable] Done in ${Date.now() - start}ms\n`);
}

main();
