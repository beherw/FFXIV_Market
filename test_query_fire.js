/**
 * Test script to query "火" and show first 3 results
 * Run with: node test_query_fire.js
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration (from supabaseClient.js)
const SUPABASE_URL = 'https://dojkqotccerymtnqnyfj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hMotsHXlY9psWRl35E3Ppw_WAH4P7Pf';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Import the query function
async function searchTwItemsWithJoin(searchText, fuzzy = false) {
  if (!searchText || !searchText.trim()) {
    return [];
  }

  const trimmedSearchText = searchText.trim();
  const hasSpaces = trimmedSearchText.includes(' ');
  const words = hasSpaces 
    ? trimmedSearchText.split(/\s+/).filter(w => w)
    : [trimmedSearchText];

  if (words.length === 0) {
    return [];
  }

  console.log(`📥 Searching for: "${searchText}"...`);

  try {
    // Step 1: Search items by name
    let query = supabase
      .from('tw_items')
      .select('id, tw')
      .not('tw', 'is', null)
      .neq('tw', '');

    // Add search filters
    words.forEach(word => {
      if (fuzzy) {
        const pattern = '%' + Array.from(word).join('%') + '%';
        query = query.ilike('tw', pattern);
      } else {
        query = query.ilike('tw', `%${word}%`);
      }
    });

    // Fetch all matching rows
    const pageSize = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) {
        console.error(`Error searching items:`, error);
        throw error;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    if (allData.length === 0) {
      return [];
    }

    // Step 2: Get item IDs
    const itemIds = allData.map(row => row.id).filter(id => id > 0);

    // Step 3: Fetch ilvls, versions, and marketable status in parallel
    const batchSize = 1000;
    const ilvlsMap = {};
    const versionsMap = {};
    const marketableSet = new Set();

    // Fetch ilvls
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);
      const { data: ilvlData } = await supabase
        .from('ilvls')
        .select('id, value')
        .in('id', batch);
      if (ilvlData) {
        ilvlData.forEach(row => {
          ilvlsMap[row.id] = row.value;
        });
      }
    }

    // Fetch versions
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);
      const { data: versionData } = await supabase
        .from('item_patch')
        .select('id, value')
        .in('id', batch);
      if (versionData) {
        versionData.forEach(row => {
          versionsMap[row.id] = row.value;
        });
      }
    }

    // Fetch marketable status
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);
      const { data: marketData } = await supabase
        .from('market_items')
        .select('id')
        .in('id', batch);
      if (marketData) {
        marketData.forEach(row => marketableSet.add(row.id));
      }
    }

    // Step 4: Transform to array format
    const result = allData.map(row => ({
      id: row.id,
      name: row.tw,
      ilvl: ilvlsMap[row.id] || null,
      version: versionsMap[row.id] || null,
      marketable: marketableSet.has(row.id) || false
    }));

    // Step 5: Sort by ilvl descending
    result.sort((a, b) => {
      const aIlvl = a.ilvl;
      const bIlvl = b.ilvl;
      
      if (aIlvl !== null && bIlvl !== null) {
        return bIlvl - aIlvl;
      }
      if (aIlvl !== null) return -1;
      if (bIlvl !== null) return 1;
      return b.id - a.id;
    });

    return result;
  } catch (error) {
    console.error(`Error searching items:`, error);
    return [];
  }
}

// Main test
async function main() {
  console.log('🔥 Testing query for "火"...\n');
  
  const results = await searchTwItemsWithJoin('火', false);
  
  console.log(`✅ Found ${results.length} items\n`);
  console.log('📋 First 3 results:\n');
  console.log('='.repeat(80));
  
  results.slice(0, 3).forEach((item, index) => {
    console.log(`\n${index + 1}. Item ID: ${item.id}`);
    console.log(`   Name: ${item.name}`);
    console.log(`   ilvl: ${item.ilvl !== null ? item.ilvl : 'null'}`);
    console.log(`   Version: ${item.version !== null ? item.version : 'null'}`);
    console.log(`   Marketable: ${item.marketable}`);
    console.log(`   Full object:`, JSON.stringify(item, null, 2));
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`\nTotal results: ${results.length}`);
}

main().catch(console.error);
