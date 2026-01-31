#!/usr/bin/env node

/**
 * JSON to CSV Converter for Supabase Migration
 * 
 * This script reads JSON files listed in json_list.txt and converts them
 * to CSV format suitable for importing into Supabase.
 * 
 * Usage: node json_to_csv.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const JSON_LIST_FILE = path.join(__dirname, 'json_list.txt');
const OUTPUT_DIR = path.join(__dirname, 'csv_output');
const PROJECT_ROOT = path.join(__dirname, '..');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Escape CSV field value
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert to string
  let str = String(value);
  
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * Convert array of simple values to CSV
 */
function convertArrayToCSV(data, tableName) {
  const rows = [];
  rows.push('id'); // Header
  
  data.forEach((value, index) => {
    rows.push(escapeCSV(value));
  });
  
  return rows.join('\n');
}

/**
 * Convert simple object (key-value pairs) to CSV
 */
function convertObjectSimpleToCSV(data, tableName) {
  const rows = [];
  // Special handling for ui_categories table - it needs 'id,category' instead of 'id,value'
  const valueColumnName = tableName === 'ui_categories' ? 'category' : 'value';
  rows.push(`id,${valueColumnName}`); // Header
  
  Object.entries(data).forEach(([key, value]) => {
    rows.push(`${escapeCSV(key)},${escapeCSV(value)}`);
  });
  
  return rows.join('\n');
}

/**
 * Convert nested object (e.g., { "id": { "tw": "value" } }) to CSV
 */
function convertObjectNestedToCSV(data, tableName) {
  const rows = [];
  const headers = ['id'];
  const firstEntry = Object.values(data)[0];
  
  // Extract all keys from nested objects (skip 'id' since we already have it from object key)
  if (firstEntry && typeof firstEntry === 'object') {
    Object.keys(firstEntry).forEach(key => {
      if (key !== 'id') {  // Skip 'id' to avoid duplicate column
        headers.push(key);
      }
    });
  }
  
  rows.push(headers.join(','));
  
  Object.entries(data).forEach(([id, nestedObj]) => {
    const row = [escapeCSV(id)];
    
    if (nestedObj && typeof nestedObj === 'object') {
      headers.slice(1).forEach(header => {
        const value = nestedObj[header];
        if (value !== undefined && value !== null) {
          // If value is array or object, stringify it
          if (typeof value === 'object') {
            row.push(escapeCSV(JSON.stringify(value)));
          } else {
            row.push(escapeCSV(value));
          }
        } else {
          row.push('');
        }
      });
    }
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Convert nested object with field extraction (e.g., extract "en" from { "id": { "en": "value", "ja": "value" } })
 * This is used for items.json which contains multiple languages in one file
 */
function convertObjectNestedExtractFieldToCSV(data, tableName, fieldToExtract) {
  const rows = [];
  const headers = ['id', fieldToExtract];
  
  rows.push(headers.join(','));
  
  Object.entries(data).forEach(([id, nestedObj]) => {
    const row = [escapeCSV(id)];
    
    if (nestedObj && typeof nestedObj === 'object') {
      const value = nestedObj[fieldToExtract];
      if (value !== undefined && value !== null) {
        row.push(escapeCSV(value));
      } else {
        row.push(''); // Empty if field doesn't exist
      }
    } else {
      row.push('');
    }
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Convert complex object (e.g., equipment.json) to CSV
 */
function convertObjectComplexToCSV(data, tableName) {
  const rows = [];
  const headers = ['id'];
  const allKeys = new Set();
  
  // Collect all possible keys from ALL entries (not just the first one)
  // This ensures fields like 'position' are included even if the first entry doesn't have them
  Object.values(data).forEach(entry => {
    if (entry && typeof entry === 'object') {
      Object.keys(entry).forEach(key => {
        if (key !== 'id') {  // Skip 'id' to avoid duplicate column
          allKeys.add(key);
        }
      });
    }
  });
  
  // Convert Set to sorted array for consistent column order
  const sortedKeys = Array.from(allKeys).sort();
  headers.push(...sortedKeys);
  
  rows.push(headers.join(','));
  
  Object.entries(data).forEach(([id, obj]) => {
    const row = [escapeCSV(id)];
    
    if (obj && typeof obj === 'object') {
      headers.slice(1).forEach(header => {
        const value = obj[header];
        if (value !== undefined && value !== null) {
          // If value is array or object, stringify it for Supabase JSONB
          if (Array.isArray(value)) {
            row.push(escapeCSV(JSON.stringify(value)));
          } else if (typeof value === 'object') {
            row.push(escapeCSV(JSON.stringify(value)));
          } else {
            row.push(escapeCSV(value));
          }
        } else {
          row.push('');
        }
      });
    }
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Convert array of objects (e.g., recipes) to CSV
 */
function convertArrayOfObjectsToCSV(data, tableName) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const rows = [];
  const firstObj = data[0];
  const headers = Object.keys(firstObj);
  
  rows.push(headers.join(','));
  
  data.forEach(obj => {
    const row = headers.map(header => {
      const value = obj[header];
      if (value === undefined || value === null) {
        return '';
      }
      // If value is array or object, stringify it for Supabase JSONB
      if (Array.isArray(value)) {
        return escapeCSV(JSON.stringify(value));
      } else if (typeof value === 'object') {
        return escapeCSV(JSON.stringify(value));
      } else {
        return escapeCSV(value);
      }
    });
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Process a single JSON file
 */
function processJSONFile(jsonPath, tableName, structureType) {
  const fullPath = path.join(PROJECT_ROOT, jsonPath);
  
  console.log(`Processing: ${jsonPath}`);
  console.log(`  Table: ${tableName}`);
  console.log(`  Structure: ${structureType}`);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`  ERROR: File not found: ${fullPath}`);
    return false;
  }
  
  try {
    // Read and parse JSON
    const jsonContent = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(jsonContent);
    
    let csvContent = '';
    
    // Check if structure type includes field extraction (e.g., "object_nested_extract_en")
    const extractMatch = structureType.match(/^object_nested_extract_([a-z]+)$/);
    if (extractMatch) {
      const fieldToExtract = extractMatch[1];
      console.log(`  Extracting field: ${fieldToExtract}`);
      csvContent = convertObjectNestedExtractFieldToCSV(data, tableName, fieldToExtract);
    } else {
      // Convert based on structure type
      switch (structureType) {
        case 'array':
          csvContent = convertArrayToCSV(data, tableName);
          break;
        case 'object_simple':
          csvContent = convertObjectSimpleToCSV(data, tableName);
          break;
        case 'object_nested':
          csvContent = convertObjectNestedToCSV(data, tableName);
          break;
        case 'object_complex':
          csvContent = convertObjectComplexToCSV(data, tableName);
          break;
        case 'array_of_objects':
          csvContent = convertArrayOfObjectsToCSV(data, tableName);
          break;
        default:
          console.error(`  ERROR: Unknown structure type: ${structureType}`);
          return false;
      }
    }
    
    // Write CSV file
    const csvFileName = `${tableName}.csv`;
    const csvPath = path.join(OUTPUT_DIR, csvFileName);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    
    // Get file size
    const stats = fs.statSync(csvPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`  ✓ Created: ${csvFileName} (${fileSizeMB} MB)`);
    return true;
    
  } catch (error) {
    console.error(`  ERROR processing ${jsonPath}:`, error.message);
    return false;
  }
}

/**
 * Parse json_list.txt and process all files
 */
function main() {
  console.log('='.repeat(80));
  console.log('JSON to CSV Converter for Supabase Migration');
  console.log('='.repeat(80));
  console.log('');
  
  if (!fs.existsSync(JSON_LIST_FILE)) {
    console.error(`ERROR: json_list.txt not found at ${JSON_LIST_FILE}`);
    process.exit(1);
  }
  
  const jsonListContent = fs.readFileSync(JSON_LIST_FILE, 'utf-8');
  const lines = jsonListContent.split('\n');
  
  const filesToProcess = [];
  
  // Parse json_list.txt
  lines.forEach((line, index) => {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    
    // Parse format: path|table_name|structure_type|description
    const parts = trimmed.split('|');
    if (parts.length < 3) {
      console.warn(`Warning: Skipping invalid line ${index + 1}: ${trimmed}`);
      return;
    }
    
    const jsonPath = parts[0].trim();
    const tableName = parts[1].trim();
    const structureType = parts[2].trim();
    const description = parts[3] ? parts[3].trim() : '';
    
    filesToProcess.push({
      jsonPath,
      tableName,
      structureType,
      description
    });
  });
  
  console.log(`Found ${filesToProcess.length} files to process\n`);
  
  // Process each file
  let successCount = 0;
  let failCount = 0;
  
  filesToProcess.forEach((file, index) => {
    console.log(`[${index + 1}/${filesToProcess.length}]`);
    const success = processJSONFile(file.jsonPath, file.tableName, file.structureType);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    console.log('');
  });
  
  // Summary
  console.log('='.repeat(80));
  console.log('Conversion Summary');
  console.log('='.repeat(80));
  console.log(`Total files: ${filesToProcess.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');
  
  if (successCount > 0) {
    console.log('Next steps:');
    console.log('1. Review the CSV files in the csv_output directory');
    console.log('2. Import CSV files into Supabase using the Supabase dashboard');
    console.log('3. Create appropriate indexes on id columns for performance');
    console.log('4. For JSONB columns (arrays/objects), ensure column type is JSONB in Supabase');
  }
}

// Run the script
main();

export {
  convertArrayToCSV,
  convertObjectSimpleToCSV,
  convertObjectNestedToCSV,
  convertObjectNestedExtractFieldToCSV,
  convertObjectComplexToCSV,
  convertArrayOfObjectsToCSV
};
