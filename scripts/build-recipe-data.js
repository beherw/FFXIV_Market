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

import msgpack from 'msgpack-lite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/tw/tw-recipes.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'recipes.msgpack');

/**
 * Load recipes from JSON source file
 */
function loadRecipesFromJSON(jsonPath) {
  console.log(`\n📖 Reading JSON source: ${jsonPath}`);
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON source file not found: ${jsonPath}`);
    console.error(`\nPlease ensure teamcraft submodule is initialized:`);
    console.error(`  git submodule update --init --recursive\n`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const recipes = JSON.parse(content);
  
  if (!Array.isArray(recipes) || recipes.length === 0) {
    console.error('❌ JSON file is empty or invalid');
    process.exit(1);
  }
  
  console.log(`✓ Loaded ${recipes.length} recipes from JSON`);
  return recipes;
}

/**
 * Optimize recipe data structure for smaller size
 */
function optimizeRecipes(recipes) {
  console.log(`\n🔧 Optimizing data structure...`);
  
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
  
  console.log(`✓ Optimized ${optimized.length} recipes`);
  return optimized;
}

/**
 * Main build function
 */
function buildRecipeData() {
  console.log('🏗️  Building Recipe Data (JSON → MessagePack)\n');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  // Step 1: Load recipes from JSON source
  const recipes = loadRecipesFromJSON(JSON_SOURCE);
  
  // Step 2: Optimize structure
  const optimized = optimizeRecipes(recipes);
  
  // Step 3: Encode to MessagePack
  console.log(`\n📦 Encoding to MessagePack...`);
  const packed = msgpack.encode(optimized);
  
  // Step 4: Save to public directory
  console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, packed);
  
  // Step 5: Statistics
  const jsonSourceSize = fs.statSync(JSON_SOURCE).size;
  const msgpackSize = packed.length;
  const jsonSize = JSON.stringify(optimized).length;
  
  const buildTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Build Complete!\n');
  console.log('📊 Size Comparison:');
  console.log(`   JSON Source: ${(jsonSourceSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   JSON (stringified): ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   MessagePack: ${(msgpackSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Savings:    ${((1 - msgpackSize / jsonSourceSize) * 100).toFixed(1)}% vs source`);
  console.log(`\n⏱️  Build Time: ${buildTime}ms`);
  console.log(`📍 Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60) + '\n');
}

// Run build
try {
  buildRecipeData();
} catch (error) {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
}
