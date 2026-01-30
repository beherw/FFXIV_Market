#!/usr/bin/env node

/**
 * Smart Sync Script - Dynamically creates tables and syncs CSV data
 * Uses exec_sql helper function to create tables automatically
 * 
 * Usage: node sync_smart.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dojkqotccerymtnqnyfj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY or SUPABASE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const CSV_OUTPUT_DIR = path.join(__dirname, 'csv_output');
const METADATA_TABLE = '_sync_metadata'; // Table to store sync metadata

/**
 * Parse CSV file and return array of objects
 * Handles multi-line quoted values properly
 */
function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  
  if (content.trim().length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Parse CSV properly handling quoted multi-line values
  const rows = parseCSVContent(content);
  
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = rows[0].map(h => h.trim());
  const dataRows = [];
  
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    
    // Skip if column count doesn't match
    if (values.length !== headers.length) {
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      let value = values[index] || '';
      value = value.trim();
      
      // Try to parse JSON if it looks like JSON
      if (value.startsWith('[') || value.startsWith('{')) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      // Try to parse booleans
      else if (value === 'true' || value === 'false') {
        value = value === 'true';
      }
      // Try to parse numbers
      else if (value !== '' && !isNaN(value) && value !== 'null') {
        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) {
          value = num;
        }
      }
      // Handle null/empty
      else if (value === '' || value === 'null' || value === 'NULL') {
        value = null;
      }
      
      row[header] = value;
    });
    dataRows.push(row);
  }
  
  return { headers, rows: dataRows };
}

/**
 * Parse CSV content handling quoted multi-line values
 */
function parseCSVContent(content) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row (but handle \r\n)
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n
      }
      if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      }
    } else {
      // Regular character
      currentField += char;
    }
  }
  
  // Don't forget the last field/row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  return rows;
}

/**
 * Infer column type from sample data
 */
function inferColumnType(columnName, sampleValues) {
  // id column is always INTEGER
  if (columnName === 'id') {
    return 'INTEGER PRIMARY KEY';
  }
  
  // Check sample values to infer type
  const nonNullValues = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) {
    return 'TEXT'; // Default to TEXT if no data
  }
  
  // Check if all values are numbers
  const allNumbers = nonNullValues.every(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const num = Number(v);
      return !isNaN(num) && isFinite(num) && v.trim() !== '';
    }
    return false;
  });
  
  if (allNumbers) {
    // Check if integers
    const allIntegers = nonNullValues.every(v => {
      const num = typeof v === 'number' ? v : Number(v);
      return Number.isInteger(num);
    });
    return allIntegers ? 'INTEGER' : 'NUMERIC';
  }
  
  // Check if all values are booleans
  const allBooleans = nonNullValues.every(v => 
    typeof v === 'boolean' || v === 'true' || v === 'false' || v === true || v === false
  );
  if (allBooleans) {
    return 'BOOLEAN';
  }
  
  // Check if values are JSON (arrays or objects)
  const allJSON = nonNullValues.every(v => {
    if (typeof v === 'object' && v !== null) return true;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      return (trimmed.startsWith('[') || trimmed.startsWith('{')) && trimmed.length > 1;
    }
    return false;
  });
  if (allJSON) {
    return 'JSONB';
  }
  
  // Default to TEXT
  return 'TEXT';
}

/**
 * Create table structure dynamically with RLS policies
 */
async function createTableStructure(tableName, headers, sampleRows) {
  console.log(`  Ensuring table structure for ${tableName}...`);
  
  // Infer column types from sample data
  const columnDefs = headers.map(header => {
    const sampleValues = sampleRows.slice(0, 100).map(row => row[header]); // Sample first 100 rows
    const type = inferColumnType(header, sampleValues);
    return `"${header}" ${type}`;
  }).join(', ');
  
  // Build comprehensive SQL: CREATE TABLE + RLS + Policy
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public."${tableName}" (
      ${columnDefs}
    );
    
    ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;
    
    -- Only create policy if it doesn't exist
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = '${tableName}' 
        AND policyname = 'Public Read'
      ) THEN
        CREATE POLICY "Public Read" ON public."${tableName}" 
        FOR SELECT TO anon 
        USING (true);
      END IF;
    END $$;
  `;
  
  // Create indexes on id column if it exists
  let indexSQL = '';
  if (headers.includes('id')) {
    indexSQL = `CREATE INDEX IF NOT EXISTS idx_${tableName}_id ON public."${tableName}"(id);`;
  }
  
  // Execute SQL using exec_sql helper function (uses sql_query parameter)
  try {
    // Create table, RLS, and policy using sql_query parameter name
    const { data, error: createError } = await supabase.rpc('exec_sql', { sql_query: createTableSQL });
    
    if (createError) {
      // Log the actual database error but don't fail if table already exists
      const errorMsg = createError.message || '';
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        console.log(`  ℹ Table ${tableName} already exists, continuing...`);
      } else {
        console.error(`  ❌ Database Error creating table: ${createError.message}`);
        console.error(`  Error Code: ${createError.code || 'N/A'}`);
        console.error(`  Error Details:`, JSON.stringify(createError, null, 2));
        console.error(`  SQL: ${createTableSQL.substring(0, 150)}...`);
        return false;
      }
    } else {
      console.log(`  ✓ Table ${tableName} structure ensured`);
    }
    
    // Create index if needed
    if (indexSQL) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql_query: indexSQL });
      if (!indexError) {
        console.log(`  ✓ Index created on ${tableName}.id`);
      } else {
        // Don't fail on index errors, just warn
        const indexMsg = indexError.message || '';
        if (!indexMsg.includes('already exists')) {
          console.warn(`  ⚠ Could not create index: ${indexError.message}`);
        }
      }
    }
    
    // Wait a moment for table to be available in schema cache
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    console.error(`  ❌ Network/System Exception creating table: ${error.message}`);
    console.error(`  Exception:`, error);
    console.error(`  Stack:`, error.stack);
    return false;
  }
}

/**
 * Calculate SHA256 hash of file content
 */
function calculateFileHash(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Ensure metadata table exists for tracking sync state
 */
async function ensureMetadataTable() {
  const createMetadataSQL = `
    CREATE TABLE IF NOT EXISTS public."${METADATA_TABLE}" (
      table_name TEXT PRIMARY KEY,
      row_count INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      last_synced TIMESTAMP DEFAULT NOW()
    );
    
    ALTER TABLE public."${METADATA_TABLE}" ENABLE ROW LEVEL SECURITY;
    
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = '${METADATA_TABLE}' 
        AND policyname = 'Public Read'
      ) THEN
        CREATE POLICY "Public Read" ON public."${METADATA_TABLE}" 
        FOR SELECT TO anon 
        USING (true);
      END IF;
    END $$;
  `;
  
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: createMetadataSQL });
    if (error && !error.message.includes('already exists')) {
      console.warn(`  ⚠ Could not create metadata table: ${error.message}`);
    }
  } catch (error) {
    // Metadata table creation is optional, don't fail if it doesn't work
    console.warn(`  ⚠ Metadata table creation failed: ${error.message}`);
  }
}

/**
 * Check if table needs syncing by comparing row count and content hash
 */
async function needsSync(tableName, csvRowCount, csvHash) {
  try {
    // Get current row count from Supabase table
    const { count: dbRowCount, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      // Table might not exist or error, assume needs sync
      return true;
    }
    
    // Fast check: row count mismatch means definitely needs sync
    if (dbRowCount !== csvRowCount) {
      console.log(`  ℹ Row count mismatch: DB=${dbRowCount}, CSV=${csvRowCount}`);
      return true;
    }
    
    // Row counts match, check hash from metadata table
    const { data: metadata, error: metaError } = await supabase
      .from(METADATA_TABLE)
      .select('content_hash, row_count')
      .eq('table_name', tableName)
      .single();
    
    if (metaError || !metadata) {
      // No metadata found, assume needs sync
      console.log(`  ℹ No sync metadata found, will sync`);
      return true;
    }
    
    // Compare hash
    if (metadata.content_hash !== csvHash) {
      console.log(`  ℹ Content hash mismatch: data changed`);
      return true;
    }
    
    // Everything matches, no sync needed
    console.log(`  ✓ No changes detected (rows: ${csvRowCount}, hash matches)`);
    return false;
  } catch (error) {
    // On any error, assume needs sync to be safe
    console.warn(`  ⚠ Error checking sync status: ${error.message}, will sync`);
    return true;
  }
}

/**
 * Update sync metadata after successful sync
 */
async function updateSyncMetadata(tableName, rowCount, contentHash) {
  try {
    const { error } = await supabase
      .from(METADATA_TABLE)
      .upsert({
        table_name: tableName,
        row_count: rowCount,
        content_hash: contentHash,
        last_synced: new Date().toISOString()
      }, {
        onConflict: 'table_name'
      });
    
    if (error) {
      console.warn(`  ⚠ Could not update sync metadata: ${error.message}`);
    }
  } catch (error) {
    // Metadata update is optional, don't fail
    console.warn(`  ⚠ Metadata update failed: ${error.message}`);
  }
}

/**
 * Sync CSV data to Supabase table
 */
async function syncData(csvPath, tableName) {
  console.log(`\n--- Starting sync for ${tableName} ---`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`  ❌ CSV file not found: ${csvPath}`);
    return false;
  }
  
  // 1. Read and parse CSV
  console.log(`  Reading CSV file...`);
  let { headers, rows } = parseCSV(csvPath);
  
  if (rows.length === 0) {
    console.log(`  ⚠ No data rows found, skipping`);
    return true;
  }
  
  // Remove duplicate headers (defensive check)
  // parseCSV creates row objects where duplicate headers overwrite each other (last wins)
  // We need to deduplicate headers array and ensure rows only have unique keys
  const seenHeaders = new Set();
  const uniqueHeaders = headers.filter(header => {
    if (seenHeaders.has(header)) {
      console.warn(`  ⚠ Duplicate header '${header}' detected, removing duplicate`);
      return false;
    }
    seenHeaders.add(header);
    return true;
  });
  
  if (uniqueHeaders.length !== headers.length) {
    console.log(`  ⚠ Removed ${headers.length - uniqueHeaders.length} duplicate column(s)`);
    headers = uniqueHeaders;
    // Ensure rows only contain unique header keys (parseCSV may have kept last duplicate)
    rows = rows.map(row => {
      const cleanRow = {};
      uniqueHeaders.forEach(header => {
        if (row.hasOwnProperty(header)) {
          cleanRow[header] = row[header];
        }
      });
      return cleanRow;
    });
  }
  
  console.log(`  Found ${rows.length} rows with ${headers.length} columns`);
  
  // 2. Calculate CSV content hash for change detection
  const csvHash = calculateFileHash(csvPath);
  console.log(`  CSV hash: ${csvHash.substring(0, 16)}...`);
  
  // 3. Check if sync is needed (compare row count and hash)
  const shouldSync = await needsSync(tableName, rows.length, csvHash);
  
  if (!shouldSync) {
    console.log(`  ⏭ Skipping sync - no changes detected`);
    return true; // Successfully skipped
  }
  
  // 4. Always ensure table exists (CREATE IF NOT EXISTS handles existing tables)
  // This avoids schema cache errors by not checking existence first
  const created = await createTableStructure(tableName, headers, rows);
  
  if (!created) {
    console.error(`  ❌ Failed to ensure table structure for ${tableName}`);
    return false;
  }
  
  // 5. Upload Data in Chunks
  console.log(`  Uploading data in chunks...`);
  const chunkSize = 500;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    
    // Clean chunk data - remove null/undefined values that might cause issues
    const cleanChunk = chunk.map(row => {
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        if (row[key] !== null && row[key] !== undefined) {
          cleanRow[key] = row[key];
        }
      });
      return cleanRow;
    });
    
    // Try upsert if id column exists, otherwise use insert
    let uploadError = null;
    if (headers.includes('id')) {
      // Use upsert with id as conflict resolution
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(cleanChunk, { onConflict: 'id' });
      uploadError = upsertError;
    } else {
      // No id column, use insert instead
      console.warn(`  ⚠ Table ${tableName} has no 'id' column, using insert instead of upsert`);
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(cleanChunk);
      uploadError = insertError;
    }
    
    if (uploadError) {
      // If upsert/insert fails, try plain insert as fallback
      const { error: fallbackError } = await supabase
        .from(tableName)
        .insert(cleanChunk);
      
      if (fallbackError) {
        console.error(`  ❌ Error in chunk ${i + 1}-${Math.min(i + chunkSize, rows.length)}: ${fallbackError.message}`);
        failCount += chunk.length;
      } else {
        console.warn(`  ⚠ Chunk ${i + 1}-${Math.min(i + chunkSize, rows.length)}: Fallback insert succeeded`);
        successCount += chunk.length;
      }
    } else {
      successCount += chunk.length;
    }
    
    // Progress update
    const processed = Math.min(i + chunkSize, rows.length);
    if (processed % 5000 === 0 || processed >= rows.length) {
      console.log(`    Processed ${processed}/${rows.length} rows`);
    }
  }
  
  console.log(`  ✓ Sync complete: ${successCount} rows synced, ${failCount} failed`);
  
  // Update sync metadata if sync was successful
  if (failCount === 0) {
    await updateSyncMetadata(tableName, rows.length, csvHash);
  }
  
  return failCount === 0;
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Smart CSV to Supabase Sync');
  console.log('='.repeat(80));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');
  
  // Ensure metadata table exists for change detection
  console.log('Ensuring metadata table exists...');
  await ensureMetadataTable();
  console.log('');
  
  if (!fs.existsSync(CSV_OUTPUT_DIR)) {
    console.error(`ERROR: CSV output directory not found: ${CSV_OUTPUT_DIR}`);
    console.log('Run json_to_csv.js first to generate CSV files');
    process.exit(1);
  }
  
  // Get all CSV files
  const csvFiles = fs.readdirSync(CSV_OUTPUT_DIR)
    .filter(file => file.endsWith('.csv'))
    .sort();
  
  if (csvFiles.length === 0) {
    console.error('No CSV files found in csv_output directory');
    process.exit(1);
  }
  
  console.log(`Found ${csvFiles.length} CSV files to sync\n`);
  
  // Verify helper function exists (uses sql_query parameter)
  console.log('Checking for exec_sql helper function...');
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
    
    if (error) {
      console.warn('  ⚠ Helper function exec_sql not found or not accessible');
      console.warn('  Error:', error.message);
      console.warn('  💡 Make sure exec_sql function uses sql_query parameter name');
      console.warn('  💡 Run sql/create_helper_function.sql in Supabase SQL Editor');
      console.warn('  💡 Or create tables manually using sql/create_tables.sql');
      console.log('');
    } else {
      console.log('  ✓ Helper function exec_sql found - will auto-create tables\n');
    }
  } catch (e) {
    console.warn('  ⚠ Could not verify helper function:', e.message);
    console.log('');
  }
  
  // Process each CSV file
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < csvFiles.length; i++) {
    const csvFile = csvFiles[i];
    const tableName = csvFile.replace('.csv', '');
    const csvPath = path.join(CSV_OUTPUT_DIR, csvFile);
    
    console.log(`[${i + 1}/${csvFiles.length}]`);
    const success = await syncData(csvPath, tableName);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('Sync Summary');
  console.log('='.repeat(80));
  console.log(`Total files: ${csvFiles.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('');
  
  if (failCount > 0) {
    console.log('⚠️  Some tables failed to sync!');
    console.log('Check the logs above for details.');
    process.exit(1);
  } else {
    console.log('✅ All tables synced successfully!');
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
