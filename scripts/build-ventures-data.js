#!/usr/bin/env node
/**
 * Build Ventures Data - Converts retainer-tasks + venture-sources JSON to MessagePack
 * Output: public/data/ventures-data.msgpack
 *
 * Structure: {
 *   tasks: [[id, lvl, cost, itemId, maxQty, reqGathering, reqIlvl, category], ...],
 *   exploration: [itemId, ...]   // items obtainable from exploration ventures
 * }
 *
 * Category mapping:
 *   17 = 採礦筹集 (Mining)
 *   18 = 採伐筹集 (Botany/Logging)
 *   19 = 捕魚筹集 (Fishing)
 *   34 = 狩獵筹集 (Hunting/Combat)
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RETAINER_TASKS_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/retainer-tasks.json');
const VENTURE_SOURCES_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/venture-sources.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ventures-data.msgpack');

console.log('[Ventures] Reading retainer-tasks.json...');
if (!fs.existsSync(RETAINER_TASKS_SOURCE)) {
  console.error(`[Ventures] ERROR: Not found: ${RETAINER_TASKS_SOURCE}`);
  process.exit(1);
}
const tasks = JSON.parse(fs.readFileSync(RETAINER_TASKS_SOURCE, 'utf-8'));
console.log(`[Ventures] Loaded ${tasks.length} collection tasks`);

// Collection tasks: [id, lvl, cost, itemId, maxQty, reqGathering, reqIlvl, category]
const compactTasks = tasks.map(t => {
  const maxQty = Array.isArray(t.quantities) && t.quantities.length > 0
    ? Math.max(...t.quantities.map(q => q.quantity))
    : 1;
  return [t.id, t.lvl, t.cost, t.item, maxQty, t.reqGathering || 0, t.reqIlvl || 0, t.category];
});

// Exploration items: items from venture-sources.json (they map to non-collection task IDs)
const collectionItemIds = new Set(tasks.map(t => t.item));
let explorationItems = [];
if (fs.existsSync(VENTURE_SOURCES_SOURCE)) {
  const ventureSources = JSON.parse(fs.readFileSync(VENTURE_SOURCES_SOURCE, 'utf-8'));
  // Items in venture-sources but NOT in collection tasks = exploration drops
  explorationItems = Object.keys(ventureSources)
    .map(Number)
    .filter(id => !collectionItemIds.has(id));
  console.log(`[Ventures] Loaded ${explorationItems.length} exploration item IDs`);
}

const payload = {
  tasks: compactTasks,
  exploration: explorationItems,
};

const encoded = msgpack.encode(payload);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
fs.writeFileSync(OUTPUT_FILE, encoded);
const sizeKB = (encoded.byteLength / 1024).toFixed(1);
console.log(`[Ventures] ✅ Written ${OUTPUT_FILE} (${sizeKB} KB)`);
