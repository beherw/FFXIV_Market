/**
 * Test advanced search query combinations using gameData (local msgpack/JSON).
 * Run after build with a server that serves public/ (e.g. npm run preview), or in browser console.
 * Usage: node test_scripts/test_advanced_search_queries.js (requires served app for fetch to work)
 */

import {
  advancedSearchWithJoin,
  getTwItemsByIds,
  getEquipmentByJobs,
  getItemIdsByCategories,
  getItemIdsByIlvlRange
} from '../src/services/gameData.js';

async function testSingleJob() {
  console.log('\n=== Test 1: Single job (PLD) ===');
  const itemIds = await advancedSearchWithJoin({ jobAbbrs: ['PLD'] });
  console.log(`Found ${itemIds.length} items`);
  if (itemIds.length > 0) {
    const names = await getTwItemsByIds(itemIds.slice(0, 5));
    console.log('First 5:', Object.entries(names).map(([id, o]) => ({ id, tw: o?.tw })));
  }
}

async function testSingleCategory() {
  console.log('\n=== Test 2: Single category (category 5) ===');
  const itemIds = await getItemIdsByCategories([5]);
  console.log(`Found ${itemIds.length} items`);
  if (itemIds.length > 0) {
    const names = await getTwItemsByIds(itemIds.slice(0, 5), null, { includeEquipLevel: false });
    console.log('First 5:', Object.entries(names).map(([id, o]) => ({ id, tw: o?.tw })));
  }
}

async function testJobAndCategory() {
  console.log('\n=== Test 3: Job + category (PLD + category 5) ===');
  const itemIds = await advancedSearchWithJoin({ jobAbbrs: ['PLD'], categoryIds: [5] });
  console.log(`Found ${itemIds.length} items`);
  if (itemIds.length > 0) {
    const names = await getTwItemsByIds(itemIds.slice(0, 5), null, { includeEquipLevel: false });
    console.log('First 5:', Object.entries(names).map(([id, o]) => ({ id, tw: o?.tw })));
  }
}

async function testJobAndIlvlRange() {
  console.log('\n=== Test 4: Job + ilvl range (PLD + 660-665) ===');
  const itemIds = await advancedSearchWithJoin({ jobAbbrs: ['PLD'], minIlvl: 660, maxIlvl: 665 });
  console.log(`Found ${itemIds.length} items`);
  if (itemIds.length > 0) {
    const names = await getTwItemsByIds(itemIds.slice(0, 5));
    console.log('First 5:', Object.entries(names).map(([id, o]) => ({ id, tw: o?.tw, ilvl: o?.ilvl })));
  }
}

async function testCategoryAndIlvlRange() {
  console.log('\n=== Test 5: Category + ilvl range (category 5 + 660-665) ===');
  const itemIds = await advancedSearchWithJoin({ categoryIds: [5], minIlvl: 660, maxIlvl: 665 });
  console.log(`Found ${itemIds.length} items`);
  if (itemIds.length > 0) {
    const names = await getTwItemsByIds(itemIds.slice(0, 5));
    console.log('First 5:', Object.entries(names).map(([id, o]) => ({ id, tw: o?.tw, ilvl: o?.ilvl })));
  }
}

async function testFullCombination() {
  console.log('\n=== Test 6: Job + category + ilvl (PLD + category 5 + 660-665) ===');
  const itemIds = await advancedSearchWithJoin({
    jobAbbrs: ['PLD'],
    categoryIds: [5],
    minIlvl: 660,
    maxIlvl: 665
  });
  console.log(`Found ${itemIds.length} items`);
  if (itemIds.length > 0) {
    const names = await getTwItemsByIds(itemIds.slice(0, 5));
    console.log('First 5:', Object.entries(names).map(([id, o]) => ({ id, tw: o?.tw, ilvl: o?.ilvl })));
  }
}

async function runAllTests() {
  console.log('Testing advanced search (gameData – local msgpack/JSON)...\n');
  try {
    await testSingleJob();
    await testSingleCategory();
    await testJobAndCategory();
    await testJobAndIlvlRange();
    await testCategoryAndIlvlRange();
    await testFullCombination();
    console.log('\nAll tests completed.');
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Ensure app data is built (npm run build-items) and, if running in Node, that fetch can reach /data/*.msgpack (e.g. run via npm run preview and test in browser).');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export {
  testSingleJob,
  testSingleCategory,
  testJobAndCategory,
  testJobAndIlvlRange,
  testCategoryAndIlvlRange,
  testFullCombination,
  runAllTests
};
