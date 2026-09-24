#!/usr/bin/env node

/**
 * Build Data Shards
 *
 * Splits the large id-keyed domain msgpacks in public/data into small shards so the item page only
 * downloads the records it needs (e.g. a few NPCs instead of the 20MB npcs.msgpack).
 * Also builds the drop-monsters domain (monsters referenced by drop-sources.json only).
 *
 * Output: public/data/shards/<domain>/<shard>.msgpack  (layout in src/constants/dataShards.js)
 * Run after build-obtainable-methods-optimized.js and build-obtainable-domains.js.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encode, decode } from '@msgpack/msgpack';
import { SHARDED_DOMAINS, shardOf } from '../src/constants/dataShards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public/data');
const OUT_DIR = path.join(DATA_DIR, 'shards');
const TC_JSON_DIR = path.join(ROOT, 'teamcraft_git/libs/data/src/lib/json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(TC_JSON_DIR, file), 'utf8'));
}

function loadDomainSource(name) {
  if (name === 'drop-monsters') {
    const dropSources = readJson('drop-sources.json');
    const monsters = readJson('monsters.json');
    const monsterIds = new Set(Object.values(dropSources).flat().map(String));
    const subset = {};
    monsterIds.forEach(id => {
      if (monsters[id]) subset[id] = monsters[id];
    });
    return { monsters: subset };
  }
  if (name === 'item-icons') {
    return readJson('item-icons.json');
  }
  if (name === 'tw-mobs') {
    return readJson('tw/tw-mobs.json');
  }
  if (name === 'item-ui-category') {
    return decode(fs.readFileSync(path.join(DATA_DIR, 'ui_categories.msgpack'))).itemIdToCategory || {};
  }
  if (name === 'market-items') {
    // id list -> { id: 1 }; an id missing from its shard is not sellable on the market board
    return Object.fromEntries(readJson('market-items.json').map(id => [id, 1]));
  }
  const file = path.join(DATA_DIR, `${name}.msgpack`);
  return decode(fs.readFileSync(file));
}

function shardDomain(name, { shards, flat }) {
  const source = loadDomainSource(name);
  const buckets = Array.from({ length: shards }, () => (flat ? {} : {}));

  if (flat) {
    for (const [id, value] of Object.entries(source)) {
      buckets[shardOf(id, shards)][id] = value;
    }
  } else {
    for (const [table, rows] of Object.entries(source)) {
      if (!rows || typeof rows !== 'object' || Array.isArray(rows)) {
        throw new Error(`${name}.${table} is not an id-keyed table; cannot shard`);
      }
      for (const [id, value] of Object.entries(rows)) {
        const bucket = buckets[shardOf(id, shards)];
        (bucket[table] ||= {})[id] = value;
      }
    }
  }

  const dir = path.join(OUT_DIR, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  let largest = 0;
  buckets.forEach((bucket, i) => {
    const bytes = encode(bucket);
    fs.writeFileSync(path.join(dir, `${i}.msgpack`), bytes);
    total += bytes.length;
    largest = Math.max(largest, bytes.length);
  });
  console.log(`  ${name}: ${shards} shards, ${(total / 1024 / 1024).toFixed(1)}MB total, largest ${(largest / 1024).toFixed(0)}KB`);
}

// Small precomputed lists so pages don't need a big table just to know which ids to show
function buildCompanyCraftIds() {
  const { recipes } = decode(fs.readFileSync(path.join(DATA_DIR, 'recipes.msgpack')));
  const ids = new Set();
  (recipes || []).forEach(recipe => {
    // Same rule as recipeDatabase.js companyCraftResultItemIds
    const isFc = recipe.companyCraft === true || (typeof recipe.id === 'string' && String(recipe.id).startsWith('fc'));
    if (isFc && recipe.result) ids.add(recipe.result);
  });
  const sorted = [...ids].sort((a, b) => a - b);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'company-craft-ids.json'), JSON.stringify(sorted));
  console.log(`  company-craft-ids: ${sorted.length} items`);
}

// UI category names (~112 entries) so the item page badge doesn't need the full ui_categories table
function buildUiCategoryNames() {
  const { twItemUICategories } = decode(fs.readFileSync(path.join(DATA_DIR, 'ui_categories.msgpack')));
  fs.writeFileSync(path.join(OUT_DIR, 'ui-category-names.json'), JSON.stringify(twItemUICategories || {}));
  console.log(`  ui-category-names: ${Object.keys(twItemUICategories || {}).length} categories`);
}

console.log('Building data shards...');
for (const [name, config] of Object.entries(SHARDED_DOMAINS)) {
  shardDomain(name, config);
}
buildCompanyCraftIds();
buildUiCategoryNames();
console.log('Data shards written to public/data/shards');
