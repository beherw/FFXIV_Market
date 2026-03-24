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
 * Optimize recipe data structure for smaller size
 */
function optimizeRecipes(recipes) {
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
  const recipes = loadRecipesFromJSON(JSON_SOURCE);

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
  
  // Step 2: Optimize structure
  const optimized = optimizeRecipes(merged);
  
  // Step 3: Encode to MessagePack
  console.log(`[Recipe] Encoding to MessagePack...`);
  const packed = msgpack.encode(optimized);
  
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
