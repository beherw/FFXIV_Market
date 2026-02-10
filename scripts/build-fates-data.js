#!/usr/bin/env node

/**
 * Build FATEs Data - Merge teamcraft FATE JSONs into one MessagePack file
 *
 * Sources:
 * - tw-fates.json (Traditional Chinese names)
 * - zh-fates.json (Simplified Chinese names)
 * - fates.json (EN/JA names, icon, level, position)
 * - db/fates-database-pages.json (lvl, map, zoneid, x, y, items[])
 * - fate-sources.json (itemId -> [fateIds])
 *
 * Output: public/data/fates.msgpack
 * Structure: { fatesById: { [fateId]: { tw, zh, en, icon, level, zoneId, mapId, x, y, items } }, fateSourcesByItemId: { [itemId]: [fateIds] } }
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTwJsonPath } from './tw-json-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_PATH = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json');
const TW_FATES = getTwJsonPath('tw-fates.json');
const ZH_FATES = path.join(JSON_PATH, 'zh/zh-fates.json');
const FATES = path.join(JSON_PATH, 'fates.json');
const FATES_DB = path.join(JSON_PATH, 'db/fates-database-pages.json');
const FATE_SOURCES = path.join(JSON_PATH, 'fate-sources.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'fates.msgpack');

function loadJson(p, name) {
  if (!fs.existsSync(p)) {
    console.error(`[Fates] ERROR: ${name} not found: ${p}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  console.log(`[Fates] Loaded ${name}: ${Object.keys(data).length} keys`);
  return data;
}

function buildFatesData() {
  console.log('\n[Fates] Building FATEs MessagePack...');
  const start = Date.now();

  const twFates = loadJson(TW_FATES, 'tw-fates');
  const zhFates = loadJson(ZH_FATES, 'zh-fates');
  const fates = loadJson(FATES, 'fates');
  const fatesDb = loadJson(FATES_DB, 'fates-database-pages');
  const fateSources = loadJson(FATE_SOURCES, 'fate-sources');

  const allFateIds = new Set([
    ...Object.keys(twFates),
    ...Object.keys(zhFates),
    ...Object.keys(fates),
    ...Object.keys(fatesDb)
  ].map(k => parseInt(k, 10)).filter(n => !isNaN(n)));

  const fatesById = {};
  allFateIds.forEach(id => {
    const sid = String(id);
    const tw = twFates[sid];
    const zh = zhFates[sid];
    const en = fates[sid];
    const db = fatesDb[sid];

    const twName = tw?.name?.tw ?? tw?.tw ?? null;
    const zhName = zh?.name?.zh ?? zh?.zh ?? null;
    const enName = en?.name?.en ?? db?.en ?? null;
    const icon = en?.icon ?? db?.icon ?? null;
    const level = en?.level ?? db?.lvl ?? db?.lvlMax ?? null;
    const pos = en?.position ?? (db && (db.zoneid != null || db.map != null) ? { zoneid: db.zoneid, map: db.map, x: db.x, y: db.y } : null);
    const zoneId = pos?.zoneid ?? null;
    const mapId = pos?.map ?? null;
    const x = pos?.x ?? null;
    const y = pos?.y ?? null;
    const items = Array.isArray(db?.items) ? db.items : [];

    const entry = {};
    if (twName != null && twName !== '') entry.tw = twName;
    if (zhName != null && zhName !== '') entry.zh = zhName;
    if (enName != null && enName !== '') entry.en = enName;
    if (icon != null && icon !== '') entry.icon = icon;
    if (level != null) entry.level = level;
    if (zoneId != null) entry.zoneId = zoneId;
    if (mapId != null) entry.mapId = mapId;
    if (x != null) entry.x = x;
    if (y != null) entry.y = y;
    if (items.length > 0) entry.items = items;

    fatesById[id] = entry;
  });

  // fateSourcesByItemId: keep as object with string keys for JSON compat; msgpack handles it
  const fateSourcesByItemId = {};
  Object.entries(fateSources).forEach(([itemId, arr]) => {
    if (Array.isArray(arr) && arr.length > 0) {
      fateSourcesByItemId[itemId] = arr;
    }
  });

  const combined = {
    fatesById,
    fateSourcesByItemId
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const packed = msgpack.encode(combined);
  fs.writeFileSync(OUTPUT_FILE, packed);

  const totalSource = [TW_FATES, ZH_FATES, FATES, FATES_DB, FATE_SOURCES]
    .reduce((acc, p) => acc + fs.statSync(p).size, 0);
  const buildTime = Date.now() - start;
  console.log(`[Fates] Written ${(packed.length / 1024).toFixed(1)} KB (${Object.keys(fatesById).length} fates, ${Object.keys(fateSourcesByItemId).length} item→fate keys) in ${buildTime}ms\n`);
}

try {
  buildFatesData();
} catch (e) {
  console.error('[Fates] ERROR:', e.message);
  process.exit(1);
}
