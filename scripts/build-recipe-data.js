#!/usr/bin/env node

/**
 * Build Recipe Data - Converts JSON to MessagePack binary format
 * 
 * This script:
 * 1. Reads tw-recipes.json from teamcraft source
 * 2. Converts to optimized binary format using MessagePack
 * 3. Saves to public/data/recipes.msgpack for distribution
 * 
 * Benefits:
 * - 13MB JSON → 4.3MB MessagePack (67% smaller)
 * - Parse time: JSON ~500ms → MessagePack ~100ms (5x faster)
 * - No database calls needed (all data in-memory)
 * - Offline support (data bundled with app)
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTwJsonPath } from './tw-json-paths.js';
import { buildCompanyCraftRecipes } from './company-craft-from-csv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_SOURCE = getTwJsonPath('tw-recipes.json');
const GLOBAL_RECIPES_SOURCE = path.join(
  __dirname,
  '../teamcraft_git/libs/data/src/lib/json/recipes.json',
);
const RECIPE_LEVEL_TABLE_SOURCE = getTwJsonPath('tw-recipe-level-table.json');
const LEVEL_ADJUST_TABLE_SOURCE = getTwJsonPath('tw-gatherer-crafter-lv-adjust-table.json');
const COLLECTABLES_SHOP_ITEM_SOURCE = path.join(__dirname, '../tw_dataminer/dumpcsv-output/rawexd/CollectablesShopItem.csv');
const COLLECTABLES_SHOP_REFINE_SOURCE = path.join(__dirname, '../tw_dataminer/dumpcsv-output/rawexd/CollectablesShopRefine.csv');
const ITEM_SOURCE = path.join(__dirname, '../tw_dataminer/dumpcsv-output/rawexd/Item.csv');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'recipes.msgpack');

/**
 * Load recipes from JSON source file
 */
function loadRecipesFromJSON(jsonPath) {
  console.log(`[Recipe] Reading JSON source...`);
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`[Recipe] ERROR: JSON source file not found: ${jsonPath}`);
    console.error(`[Recipe] Please ensure teamcraft submodule is initialized`);
    console.error(`[Recipe] Run: git submodule update --init --recursive`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const recipes = JSON.parse(content);
  
  if (!Array.isArray(recipes) || recipes.length === 0) {
    console.error('[Recipe] ERROR: JSON file is empty or invalid');
    process.exit(1);
  }
  
  console.log(`[Recipe] Loaded ${recipes.length} recipes`);
  return recipes;
}

/**
 * Recipe IDs and crafting stats are language-neutral. Keep the TW export as
 * the source of truth, then append only global recipes not yet exported for
 * TW so future-version items can still use the crafting tree and simulator.
 */
function supplementWithGlobalRecipes(twRecipes) {
  if (!fs.existsSync(GLOBAL_RECIPES_SOURCE)) {
    console.warn('[Recipe] Global Teamcraft recipes not found; using TW recipes only');
    return twRecipes;
  }

  const globalRecipes = loadRecipesFromJSON(GLOBAL_RECIPES_SOURCE);
  const knownRecipeIds = new Set(twRecipes.map((recipe) => String(recipe.id)));
  const supplementalRecipes = globalRecipes.filter(
    (recipe) => !knownRecipeIds.has(String(recipe.id)),
  );
  console.log(`[Recipe] Supplementing ${supplementalRecipes.length} newer global recipes missing from the TW export`);
  return twRecipes.concat(supplementalRecipes);
}

function loadJSON(jsonPath, label) {
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`${label} source not found: ${jsonPath}`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
}

function loadCsvRows(csvPath, label) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`${label} source not found: ${csvPath}`);
  }

  return fs.readFileSync(csvPath, 'utf-8')
    .split(/\r?\n/)
    .slice(3) // CSV metadata rows: key, labels, and types.
    .filter((line) => line.trim())
    .map(parseCsvLine);
}

/** Build result-item -> three Collectables Shop quality thresholds. */
function loadCollectabilityThresholds() {
  const refineRows = loadCsvRows(COLLECTABLES_SHOP_REFINE_SOURCE, 'Collectables refine');
  const thresholdsByRefineId = new Map(refineRows.map((row) => [
    Number(row[0]),
    {
      low: Number(row[1]),
      mid: Number(row[2]),
      high: Number(row[3]),
    },
  ]));
  const shopRows = loadCsvRows(COLLECTABLES_SHOP_ITEM_SOURCE, 'Collectables shop item');
  const thresholdsByItemId = new Map();

  for (const row of shopRows) {
    const itemId = Number(row[1]);
    const thresholds = thresholdsByRefineId.get(Number(row[8]));
    if (!Number.isFinite(itemId) || itemId <= 0 || !thresholds
      || !Object.values(thresholds).every(Number.isFinite)) {
      continue;
    }
    thresholdsByItemId.set(itemId, thresholds);
  }

  console.log(`[Recipe] Loaded Collectables thresholds for ${thresholdsByItemId.size} items`);
  return thresholdsByItemId;
}

function loadCollectableItemIds() {
  const itemRows = loadCsvRows(ITEM_SOURCE, 'Item');
  const collectableItemIds = new Set();

  for (const row of itemRows) {
    if (row[38] === 'True') {
      const itemId = Number(row[0]);
      if (Number.isFinite(itemId) && itemId > 0) {
        collectableItemIds.add(itemId);
      }
    }
  }

  console.log(`[Recipe] Loaded ${collectableItemIds.size} items with the collectable flag`);
  return collectableItemIds;
}

/**
 * Optimize recipe data structure for smaller size
 */
function optimizeRecipes(recipes, collectabilityThresholds, collectableItemIds) {
  console.log(`[Recipe] Optimizing data structure...`);
  
  // Remove null/undefined fields to reduce size
  const optimized = recipes.map(recipe => {
    const cleaned = {};
    Object.keys(recipe).forEach(key => {
      const value = recipe[key];
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = value;
      }
    });
    const collectability = collectabilityThresholds.get(Number(recipe.result));
    if (collectability) {
      cleaned.collectability = collectability;
    }
    if (collectableItemIds.has(Number(recipe.result))) {
      cleaned.isCollectable = true;
    }
    return cleaned;
  });
  
  console.log(`[Recipe] Optimized ${optimized.length} recipes`);
  return optimized;
}

/**
 * Main build function
 */
function buildRecipeData() {
  console.log('\n[Recipe] Building Recipe Data (JSON -> MessagePack)');
  
  const startTime = Date.now();
  
  // Step 1: Load recipes from JSON source
  const twRecipes = loadRecipesFromJSON(JSON_SOURCE);
  const recipes = supplementWithGlobalRecipes(twRecipes);

  // Step 1b: Append Company Craft (部隊合建) from CSV when not already in JSON (avoids dupes with full Teamcraft extracts)
  const resultIdsFromJson = new Set();
  for (const r of recipes) {
    if (r && r.result != null && r.result > 0) resultIdsFromJson.add(r.result);
  }
  const fcRecipes = buildCompanyCraftRecipes(resultIdsFromJson);
  if (fcRecipes.length > 0) {
    console.log(`[Recipe] Merging ${fcRecipes.length} Company Craft (部隊合建) recipes from CSV`);
  }
  const merged = recipes.concat(fcRecipes);

  const recipeLevelTable = loadJSON(RECIPE_LEVEL_TABLE_SOURCE, 'Recipe level table');
  const gathererCrafterLvAdjustTable = loadJSON(LEVEL_ADJUST_TABLE_SOURCE, 'Crafter level adjustment table');
  const collectabilityThresholds = loadCollectabilityThresholds();
  const collectableItemIds = loadCollectableItemIds();
  
  // Step 2: Optimize structure
  const optimized = optimizeRecipes(merged, collectabilityThresholds, collectableItemIds);
  
  // Step 3: Encode to MessagePack
  console.log(`[Recipe] Encoding to MessagePack...`);
  const packed = msgpack.encode({
    recipes: optimized,
    recipeLevelTable,
    gathererCrafterLvAdjustTable,
  });
  
  // Step 4: Save to public directory
  console.log(`[Recipe] Saving to public/data/...`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, packed);
  
  // Step 5: Statistics
  const jsonSourceSize = fs.statSync(JSON_SOURCE).size;
  const msgpackSize = packed.length;
  const jsonSize = JSON.stringify(optimized).length;
  
  const buildTime = Date.now() - startTime;
  
  console.log(`[Recipe] Complete - ${(msgpackSize / 1024 / 1024).toFixed(2)} MB (saved ${((1 - msgpackSize / jsonSourceSize) * 100).toFixed(1)}%) in ${buildTime}ms\n`);
}

// Run build
try {
  buildRecipeData();
} catch (error) {
  console.error('[Recipe] ERROR: Build failed -', error.message);
  process.exit(1);
}
