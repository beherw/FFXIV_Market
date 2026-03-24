/**
 * Build synthetic recipe rows from FFXIV Company Craft sheets (CSV).
 * Mirrors Teamcraft's CompanyCraftSequence handling: result item + aggregated supplies.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RAWEXD = path.join(__dirname, '..', 'tw_dataminer', 'dumpcsv-output', 'rawexd');

/**
 * Parse rawexd CSV: skip first 3 lines (headers), remaining lines are comma-separated values.
 * @param {string} filePath
 * @returns {string[][]}
 */
function parseRawexdCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const dataLines = lines.slice(3);
  return dataLines.map((line) => line.split(','));
}

/**
 * @returns {{
 *   supplyItemByKey: Map<number, number>,
 *   processByKey: Map<number, Array<{ supplyKey: number, qty: number, sets: number }>>,
 *   partByKey: Map<number, number[]>,
 *   sequenceRows: Array<{ key: number, resultItem: number, partKeys: number[] }>
 * }}
 */
function readCompanyCraftSheets() {
  const supplyRows = parseRawexdCsv(path.join(RAWEXD, 'CompanyCraftSupplyItem.csv'));
  const supplyItemByKey = new Map();
  for (const row of supplyRows) {
    const k = parseInt(row[0], 10);
    const item = parseInt(row[1], 10);
    if (!Number.isFinite(k)) continue;
    supplyItemByKey.set(k, Number.isFinite(item) ? item : 0);
  }

  const processRows = parseRawexdCsv(path.join(RAWEXD, 'CompanyCraftProcess.csv'));
  const processByKey = new Map();
  for (const row of processRows) {
    const k = parseInt(row[0], 10);
    if (!Number.isFinite(k)) continue;
    const slots = [];
    for (let i = 0; i < 12; i++) {
      const base = 1 + i * 3;
      const supplyKey = parseInt(row[base], 10);
      const qty = parseInt(row[base + 1], 10);
      const sets = parseInt(row[base + 2], 10);
      if (Number.isFinite(supplyKey) && supplyKey > 0) {
        slots.push({ supplyKey, qty: Number.isFinite(qty) ? qty : 0, sets: Number.isFinite(sets) ? sets : 0 });
      }
    }
    processByKey.set(k, slots);
  }

  const partRows = parseRawexdCsv(path.join(RAWEXD, 'CompanyCraftPart.csv'));
  const partByKey = new Map();
  for (const row of partRows) {
    const k = parseInt(row[0], 10);
    if (!Number.isFinite(k)) continue;
    const processes = [];
    for (let c = 3; c <= 5; c++) {
      const p = parseInt(row[c], 10);
      if (Number.isFinite(p) && p > 0) processes.push(p);
    }
    partByKey.set(k, processes);
  }

  const seqRows = parseRawexdCsv(path.join(RAWEXD, 'CompanyCraftSequence.csv'));
  const sequenceRows = [];
  for (const row of seqRows) {
    const key = parseInt(row[0], 10);
    const resultItem = parseInt(row[1], 10);
    if (!Number.isFinite(key) || !Number.isFinite(resultItem) || resultItem <= 0) continue;
    const partKeys = [];
    for (let c = 6; c <= 13; c++) {
      const pk = parseInt(row[c], 10);
      if (Number.isFinite(pk) && pk > 0) partKeys.push(pk);
    }
    sequenceRows.push({ key, resultItem, partKeys });
  }

  return { supplyItemByKey, processByKey, partByKey, sequenceRows };
}

/**
 * @param {Set<number>} skipResultIds - do not emit FC recipe if result already has a normal recipe
 * @returns {Array<Object>} recipe objects compatible with recipeDatabase / CraftingTree
 */
export function buildCompanyCraftRecipes(skipResultIds = new Set()) {
  const { supplyItemByKey, processByKey, partByKey, sequenceRows } = readCompanyCraftSheets();
  const out = [];

  for (const seq of sequenceRows) {
    if (skipResultIds.has(seq.resultItem)) continue;

    const amountByItem = new Map();

    for (const partKey of seq.partKeys) {
      const procKeys = partByKey.get(partKey) || [];
      for (const procKey of procKeys) {
        const slots = processByKey.get(procKey) || [];
        for (const { supplyKey, qty, sets } of slots) {
          const itemId = supplyItemByKey.get(supplyKey);
          if (!itemId || itemId <= 0) continue;
          const add = (Number(qty) || 0) * (Number(sets) || 0);
          if (add <= 0) continue;
          amountByItem.set(itemId, (amountByItem.get(itemId) || 0) + add);
        }
      }
    }

    if (amountByItem.size === 0) continue;

    const ingredients = [...amountByItem.entries()].map(([id, amount]) => ({
      id,
      amount,
      quality: 0,
    }));

    out.push({
      id: `fc${seq.key}`,
      job: 0,
      lvl: 1,
      yields: 1,
      result: seq.resultItem,
      stars: 0,
      qs: false,
      hq: false,
      companyCraft: true,
      ingredients,
    });
  }

  return out;
}
