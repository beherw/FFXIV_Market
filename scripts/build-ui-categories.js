#!/usr/bin/env node

/**
 * Build UI categories msgpack from teamcraft JSON.
 * Output: public/data/ui_categories.msgpack
 * Shape: { itemIdToCategory, itemIdsByCategory, twItemUICategories }
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTwJsonPath } from './tw-json-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_PATH = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');

function loadJson(relativePath, name) {
  const p = path.join(JSON_PATH, relativePath);
  if (!fs.existsSync(p)) {
    console.error(`[UI Categories] ERROR: ${name} not found: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`[UI Categories] Loaded ${name}: ${count} records`);
  return data;
}

function loadTwJson(filename, name) {
  const p = getTwJsonPath(filename);
  if (!fs.existsSync(p)) {
    console.error(`[UI Categories] ERROR: ${name} not found: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`[UI Categories] Loaded ${name}: ${count} records`);
  return data;
}

function main() {
  const uiCategories = loadJson('ui-categories.json', 'ui-categories');
  const twItemUICategories = loadTwJson('tw-item-ui-categories.json', 'tw-item-ui-categories');

  // itemId -> categoryId (keep string keys for consistency)
  const itemIdToCategory = typeof uiCategories === 'object' && !Array.isArray(uiCategories)
    ? uiCategories
    : {};

  // categoryId -> [itemIds] for getItemIdsByCategories
  const itemIdsByCategory = {};
  Object.entries(itemIdToCategory).forEach(([itemId, categoryId]) => {
    const catKey = String(categoryId);
    if (!itemIdsByCategory[catKey]) itemIdsByCategory[catKey] = [];
    itemIdsByCategory[catKey].push(parseInt(itemId, 10));
  });

  const payload = {
    itemIdToCategory,
    itemIdsByCategory,
    twItemUICategories: typeof twItemUICategories === 'object' && !Array.isArray(twItemUICategories)
      ? twItemUICategories
      : {}
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const outPath = path.join(OUTPUT_DIR, 'ui_categories.msgpack');
  const packed = msgpack.encode(payload);
  fs.writeFileSync(outPath, packed);
  console.log(`[UI Categories] Written ui_categories.msgpack: ${(packed.length / 1024).toFixed(1)} KB`);
}

main();
