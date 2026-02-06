#!/usr/bin/env node

/**
 * Build Obtainable Methods Data - Converts extracts.json to MessagePack binary format
 *
 * This script:
 * 1. Reads Teamcraft extracts.json and instances.json
 * 2. Builds a compact, localized (Chinese) obtain-methods dataset
 * 3. Saves to public/data/obtainable-methods.msgpack
 *
 * Goals:
 * - Smaller payload
 * - Keep all required raw source data
 * - Precompute Chinese method names (no runtime translation)
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTRACTS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/extracts/extracts.json');
const INSTANCES_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/instances.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'obtainable-methods.msgpack');

// DataType values used by current app (src/services/extractsService.js)
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
  console.log(`\n📖 Reading ${dataName} from: ${jsonPath}`);
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON source file not found: ${jsonPath}`);
    console.error(`\nPlease ensure teamcraft submodule is initialized:`);
    console.error(`  git submodule update --init --recursive\n`);
    process.exit(1);
  }
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.error(`❌ ${dataName} JSON file is empty or invalid`);
    process.exit(1);
  }
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`✓ Loaded ${count} records from ${dataName}`);
  return data;
}

function cleanValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    const cleanedArray = value
      .map(item => cleanValue(item))
      .filter(item => item !== null && item !== undefined);
    return cleanedArray.length > 0 ? cleanedArray : null;
  }
  if (typeof value === 'object') {
    const cleaned = {};
    Object.keys(value).forEach(key => {
      const cleanedValue = cleanValue(value[key]);
      if (cleanedValue !== null && cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }
  return value;
}

function getInstanceTypeName(instanceIds, instancesMap) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    return TYPE_NAME_MAP[DataType.INSTANCES];
  }
  const contentTypes = new Set();
  instanceIds.forEach(id => {
    const instance = instancesMap[id] || instancesMap[String(id)];
    if (instance && instance.contentType !== undefined && instance.contentType !== null) {
      contentTypes.add(instance.contentType);
    }
  });
  if (contentTypes.has(28)) return '絕境戰';
  if (contentTypes.has(5)) return '大型任務';
  if (contentTypes.has(4)) return '討伐戰';
  if (contentTypes.has(2)) return '副本';
  return TYPE_NAME_MAP[DataType.INSTANCES];
}

function getTypeName(type, data, instancesMap) {
  if (type === DataType.INSTANCES) {
    return getInstanceTypeName(data, instancesMap);
  }
  return TYPE_NAME_MAP[type] || '未知';
}

function buildObtainableMethodsData() {
  console.log('🏗️  Building Obtainable Methods Data (JSON → MessagePack)\n');
  console.log('='.repeat(60));

  const startTime = Date.now();

  const extracts = loadJson(EXTRACTS_SOURCE, 'extracts');
  const instances = loadJson(INSTANCES_SOURCE, 'instances');

  console.log(`\n🔧 Building compact data structure...`);
  const items = {};
  let sourceCount = 0;
  let itemCount = 0;

  Object.entries(extracts).forEach(([itemId, row]) => {
    if (!row || !row.sources || !Array.isArray(row.sources) || row.sources.length === 0) {
      return;
    }

    const sources = [];

    row.sources.forEach(source => {
      if (!source || source.type === undefined || source.type === null) return;
      if (source.type === DataType.DEPRECATED) return;

      const cleanedData = cleanValue(source.data);
      if (cleanedData === null || (Array.isArray(cleanedData) && cleanedData.length === 0)) {
        return;
      }

      const typeName = getTypeName(source.type, source.data, instances);

      sources.push({
        t: source.type,
        n: typeName,
        d: cleanedData
      });
    });

    if (sources.length > 0) {
      items[itemId] = sources;
      itemCount++;
      sourceCount += sources.length;
    }
  });

  console.log(`✓ Prepared ${itemCount} items with ${sourceCount} sources`);

  const payload = {
    v: 1,
    i: items
  };

  console.log(`\n📦 Encoding to MessagePack...`);
  const packed = msgpack.encode(payload);

  console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, packed);

  const extractsSize = fs.statSync(EXTRACTS_SOURCE).size;
  const msgpackSize = packed.length;
  const jsonSize = JSON.stringify(payload).length;
  const buildTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('✅ Build Complete!\n');
  console.log('📊 Size Comparison:');
  console.log(`   Extracts Source: ${(extractsSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   JSON (stringified): ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   MessagePack: ${(msgpackSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Savings:    ${((1 - msgpackSize / extractsSize) * 100).toFixed(1)}% vs source`);
  console.log(`\n⏱️  Build Time: ${buildTime}ms`);
  console.log(`📍 Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60) + '\n');
}

try {
  buildObtainableMethodsData();
} catch (error) {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
}
