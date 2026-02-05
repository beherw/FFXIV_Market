#!/usr/bin/env node

/**
 * Analyze obtainable methods data to understand all types and their structure
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../public/data/obtainable-methods.json');

function analyzeObtainableMethods() {
  console.log('=== Analyzing Obtainable Methods Data ===\n');
  
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  
  // Get all unique types from the data
  const typeStats = {};
  let totalItems = 0;
  let totalSources = 0;

  Object.entries(data).forEach(([itemId, sources]) => {
    totalItems++;
    sources.forEach(source => {
      totalSources++;
      const type = source.type || 'unknown';
      if (!typeStats[type]) {
        typeStats[type] = { count: 0, itemIds: [], sampleStructures: [] };
      }
      typeStats[type].count++;
      if (typeStats[type].itemIds.length < 3) {
        typeStats[type].itemIds.push(itemId);
      }
      if (typeStats[type].sampleStructures.length < 2) {
        typeStats[type].sampleStructures.push({ itemId, source });
      }
    });
  });

  console.log('Total items:', totalItems);
  console.log('Total sources:', totalSources);
  console.log('\n=== Types and Sample Items ===\n');

  Object.entries(typeStats)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([type, info]) => {
      console.log(`${type}: ${info.count} occurrences`);
      console.log(`  Sample items: [${info.itemIds.join(', ')}]`);
      console.log('  Sample structure:');
      info.sampleStructures.forEach((sample, idx) => {
        console.log(`    [${idx + 1}] Item ${sample.itemId}:`, JSON.stringify(sample.source, null, 2).split('\n').join('\n      '));
      });
      console.log('');
    });
}

analyzeObtainableMethods();
