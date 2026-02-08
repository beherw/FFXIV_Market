#!/usr/bin/env node

/**
 * Build Items Data - Converts JSON to per-domain MessagePack files
 *
 * Outputs nine files: tw-items.msgpack, zh-items.msgpack, en-items.msgpack,
 * ja-items.msgpack, ko-items.msgpack, de-items.msgpack, fr-items.msgpack,
 * equipment.msgpack. No single items.msgpack (split for lazy loading).
 * tw_items: names only (id → { tw }); ilvl/equipLevel merged at runtime.
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TW_ITEMS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/tw/tw-items.json');
const ZH_ITEMS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/zh/zh-items.json');
const EN_ITEMS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/items.json');
const KO_ITEMS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/ko/ko-items.json');
const EQUIPMENT_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/equipment.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

/**
 * Load data from JSON source file
 */
function loadDataFromJSON(jsonPath, dataName) {
  console.log(`[Items] Reading ${dataName}...`);
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`[Items] ERROR: JSON source file not found: ${jsonPath}`);
    console.error(`[Items] Please ensure teamcraft submodule is initialized`);
    console.error(`[Items] Run: git submodule update --init --recursive`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content);
  
  // Validate data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.error(`[Items] ERROR: ${dataName} JSON file is empty or invalid`);
    process.exit(1);
  }
  
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`[Items] Loaded ${count} records from ${dataName}`);
  return data;
}

/**
 * Optimize data structure for smaller size
 */
function optimizeData(data, dataName) {
  console.log(`[Items] Optimizing ${dataName} structure...`);
  
  let optimized;
  
  if (Array.isArray(data)) {
    // Array: Remove empty values
    optimized = data.map(item => {
      const cleaned = {};
      Object.keys(item).forEach(key => {
        const value = item[key];
        if (value !== null && value !== undefined && value !== '') {
          cleaned[key] = value;
        }
      });
      return cleaned;
    });
  } else {
    // Object: Remove empty values
    optimized = {};
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== null && value !== undefined && value !== '') {
        // For nested objects (like tw-items)
        if (typeof value === 'object' && !Array.isArray(value)) {
          const cleaned = {};
          Object.keys(value).forEach(innerKey => {
            const innerValue = value[innerKey];
            if (innerValue !== null && innerValue !== undefined && innerValue !== '') {
              cleaned[innerKey] = innerValue;
            }
          });
          if (Object.keys(cleaned).length > 0) {
            optimized[key] = cleaned;
          }
        } else {
          optimized[key] = value;
        }
      }
    });
  }
  
  const count = Array.isArray(optimized) ? optimized.length : Object.keys(optimized).length;
  console.log(`[Items] Optimized ${count} records in ${dataName}`);
  return optimized;
}

/**
 * Main build function
 */
function buildItemsData() {
  console.log('\n[Items] Building Items Data (JSON -> MessagePack)');
  
  const startTime = Date.now();
  
  // Step 1: Load data from JSON sources
  const twItems = loadDataFromJSON(TW_ITEMS_SOURCE, 'tw_items');
  const zhItems = loadDataFromJSON(ZH_ITEMS_SOURCE, 'zh_items');
  const enItemsRaw = loadDataFromJSON(EN_ITEMS_SOURCE, 'items (en)');
  const koItems = loadDataFromJSON(KO_ITEMS_SOURCE, 'ko_items');
  const equipment = loadDataFromJSON(EQUIPMENT_SOURCE, 'equipment');

  // Step 2: Optimize structures (en/ja/de/fr from items.json; ko from ko-items.json)
  const optimizedTwItems = optimizeData(twItems, 'tw_items');
  const optimizedZhItems = optimizeData(zhItems, 'zh_items');
  const optimizedEnItems = {};
  const optimizedJaItems = {};
  const optimizedDeItems = {};
  const optimizedFrItems = {};
  Object.entries(enItemsRaw).forEach(([id, row]) => {
    if (!row) return;
    if (row.en != null && row.en !== '') optimizedEnItems[id] = { en: row.en };
    if (row.ja != null && row.ja !== '') optimizedJaItems[id] = { ja: row.ja };
    if (row.de != null && row.de !== '') optimizedDeItems[id] = { de: row.de };
    if (row.fr != null && row.fr !== '') optimizedFrItems[id] = { fr: row.fr };
  });
  console.log(`[Items] Optimized en_items: ${Object.keys(optimizedEnItems).length}, ja: ${Object.keys(optimizedJaItems).length}, de: ${Object.keys(optimizedDeItems).length}, fr: ${Object.keys(optimizedFrItems).length} records`);
  const optimizedKoItems = optimizeData(koItems, 'ko_items');
  const optimizedEquipment = optimizeData(equipment, 'equipment');

  // Step 3: tw_items = names only (no ilvl/equipLevel in file; merged at runtime)
  const twItemsNamesOnly = optimizedTwItems;

  // Step 4: Ensure output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Step 5: Write nine MessagePack files
  const files = [
    ['tw-items.msgpack', twItemsNamesOnly],
    ['zh-items.msgpack', optimizedZhItems],
    ['en-items.msgpack', optimizedEnItems],
    ['ja-items.msgpack', optimizedJaItems],
    ['ko-items.msgpack', optimizedKoItems],
    ['de-items.msgpack', optimizedDeItems],
    ['fr-items.msgpack', optimizedFrItems],
    ['equipment.msgpack', optimizedEquipment]
  ];

  console.log(`[Items] Encoding and writing ${files.length} MessagePack files...`);
  let totalBytes = 0;
  for (const [filename, data] of files) {
    const packed = msgpack.encode(data);
    const outPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outPath, packed);
    const mb = (packed.length / 1024 / 1024).toFixed(2);
    totalBytes += packed.length;
    console.log(`[Items]   ${filename}: ${mb} MB`);
  }

  const buildTime = Date.now() - startTime;
  console.log(`[Items] Complete - ${(totalBytes / 1024 / 1024).toFixed(2)} MB total in ${files.length} files, ${buildTime}ms\n`);
}

// Run build
try {
  buildItemsData();
} catch (error) {
  console.error('[Items] ERROR: Build failed -', error.message);
  process.exit(1);
}
