#!/usr/bin/env node

/**
 * Sync CSV files to Supabase
 * 
 * This script reads CSV files and syncs them to Supabase tables.
 * It creates tables if they don't exist and upserts data.
 * 
 * Usage: node sync_to_supabase.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dojkqotccerymtnqnyfj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY or SUPABASE_SECRET_KEY environment variable is required');
  process.exit(1);
}

// Initialize Supabase client with service role key (for admin operations)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CSV_OUTPUT_DIR = path.join(__dirname, 'csv_output');
const SQL_FILE = path.join(__dirname, 'create_tables.sql');

/**
 * Read and execute SQL file
 */
async function executeSQL(sqlContent) {
  // Split SQL by semicolons and execute each statement
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        // Try direct query if RPC doesn't work
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        // Note: Supabase JS client doesn't support raw SQL execution directly
        // We'll need to use REST API or create tables differently
      }
    } catch (err) {
      console.warn(`Warning executing SQL: ${err.message}`);
    }
  }
}

/**
 * Execute SQL using Supabase REST API via pg_net or direct database connection
 */
async function executeSQL(sql) {
  try {
    // Method 1: Try using Supabase's REST API with a helper function
    // First, we'll try to execute via the database connection string
    // Extract database connection info from Supabase URL
    const dbUrl = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
    
    // Use Supabase's SQL execution endpoint (requires pg_net extension)
    // We'll use the management API approach via REST
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      return true;
    }

    // Method 2: Try direct SQL execution via PostgREST (if pg_net is enabled)
    // This requires the pg_net extension and a helper function
    // For now, we'll create tables dynamically using the schema
    return false;
  } catch (error) {
    console.warn(`SQL execution warning: ${error.message}`);
    return false;
  }
}

/**
 * Create all tables from SQL file automatically (if helper function exists)
 */
async function createAllTables() {
  console.log('Checking if helper functions exist for automatic table creation...');
  
  // Check if exec_sql function exists
  try {
    const { error } = await supabase.rpc('exec_sql', { query: 'SELECT 1' });
    if (!error) {
      console.log('  ✓ Helper function exec_sql found - will auto-create tables');
      return true;
    }
  } catch (e) {
    // Function doesn't exist
  }
  
  // Check if create_table_if_not_exists function exists
  try {
    const { error } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'test_table_check',
      columns_def: 'id INTEGER'
    });
    if (!error) {
      console.log('  ✓ Helper function create_table_if_not_exists found - will auto-create tables');
      return true;
    }
  } catch (e) {
    // Function doesn't exist
  }
  
  console.log('  ⚠ Helper functions not found - tables will be created dynamically from CSV structure');
  console.log('  💡 Tip: Run create_helper_function.sql in Supabase SQL Editor to enable full auto-creation');
  return false;
}

/**
 * Create table dynamically using Supabase REST API
 * Tries multiple methods to create tables automatically
 */
async function createTableIfNotExists(tableName, columns) {
  // Check if table exists by trying to query it
  const { error: queryError } = await supabase.from(tableName).select('*').limit(1);
  
  if (queryError && (queryError.code === 'PGRST116' || queryError.message.includes('does not exist'))) {
    // Table doesn't exist, create it
    console.log(`Creating table: ${tableName}...`);
    
    // Build CREATE TABLE SQL
    const createSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns});`;
    
    // Method 1: Try using exec_sql RPC function (if helper function was created)
    try {
      const { error: rpcError } = await supabase.rpc('exec_sql', { query: createSQL });
      if (!rpcError) {
        console.log(`  ✓ Table ${tableName} created via RPC`);
        await createIndexes(tableName);
        return true;
      }
    } catch (e) {
      // RPC function may not exist, continue to next method
    }
    
    // Method 2: Try using create_table_if_not_exists helper function
    try {
      const { error: helperError } = await supabase.rpc('create_table_if_not_exists', {
        table_name: tableName,
        columns_def: columns
      });
      if (!helperError) {
        console.log(`  ✓ Table ${tableName} created via helper function`);
        await createIndexes(tableName);
        return true;
      }
    } catch (e) {
      // Helper function may not exist, continue to next method
    }
    
    // Method 3: Try direct REST API call
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: createSQL })
      });

      if (response.ok) {
        console.log(`  ✓ Table ${tableName} created via REST API`);
        await createIndexes(tableName);
        return true;
      }
    } catch (e) {
      // REST API method failed
    }
    
    // If all methods fail, provide instructions
    console.warn(`  ⚠ Could not create table ${tableName} automatically.`);
    console.warn(`  This is normal - Supabase requires tables to be created manually the first time.`);
    console.warn(`  Option 1: Run create_tables.sql in Supabase SQL Editor (recommended)`);
    console.warn(`  Option 2: Run create_helper_function.sql first, then this script will auto-create tables`);
    console.warn(`  SQL to create manually: ${createSQL}`);
    return false;
  } else if (queryError) {
    console.warn(`Error checking table ${tableName}: ${queryError.message}`);
    return false;
  } else {
    console.log(`  ✓ Table ${tableName} already exists`);
    return true;
  }
}

/**
 * Create indexes for a table
 */
async function createIndexes(tableName) {
  // Create primary index on id column
  const indexSQL = `CREATE INDEX IF NOT EXISTS idx_${tableName}_id ON "${tableName}"(id);`;
  
  try {
    await supabase.rpc('exec_sql', { query: indexSQL });
  } catch (e) {
    // Index creation is optional, continue even if it fails
  }
}

/**
 * Parse CSV file and return array of objects
 */
function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      console.warn(`Skipping row ${i}: column count mismatch`);
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      let value = values[index] || '';
      // Try to parse JSON if it looks like JSON
      if (value.startsWith('[') || value.startsWith('{')) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      // Try to parse numbers
      else if (!isNaN(value) && value !== '') {
        const num = Number(value);
        if (!isNaN(num)) {
          value = num;
        }
      }
      row[header] = value;
    });
    rows.push(row);
  }
  
  return { headers, rows };
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Upsert data to Supabase table
 */
async function upsertData(tableName, rows, batchSize = 1000) {
  console.log(`Upserting ${rows.length} rows to ${tableName}...`);
  
  // Process in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    // Clean batch data - remove null/undefined values that might cause issues
    const cleanBatch = batch.map(row => {
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        if (row[key] !== null && row[key] !== undefined) {
          cleanRow[key] = row[key];
        }
      });
      return cleanRow;
    });
    
    // Try upsert first (update if exists, insert if not)
    let { error } = await supabase
      .from(tableName)
      .upsert(cleanBatch, { onConflict: 'id', ignoreDuplicates: false });
    
    if (error) {
      // If upsert fails, try delete + insert for this batch
      console.warn(`Upsert failed for batch ${Math.floor(i / batchSize) + 1}, trying delete + insert: ${error.message}`);
      
      // Extract IDs from batch
      const ids = cleanBatch.map(row => row.id).filter(id => id !== undefined && id !== null);
      
      if (ids.length > 0) {
        // Delete existing rows
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .in('id', ids);
        
        if (deleteError) {
          console.warn(`Delete warning (may be expected if rows don't exist): ${deleteError.message}`);
        }
      }
      
      // Insert new rows
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(cleanBatch);
      
      if (insertError) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1} to ${tableName}:`, insertError.message);
        console.error(`Sample row:`, JSON.stringify(cleanBatch[0], null, 2));
        throw insertError;
      }
    }
    
    // Progress update
    const processed = Math.min(i + batchSize, rows.length);
    if (processed % 5000 === 0 || processed >= rows.length) {
      console.log(`  Processed ${processed}/${rows.length} rows`);
    }
  }
  
  console.log(`✓ Successfully synced ${rows.length} rows to ${tableName}`);
}

/**
 * Get table schema from CSV headers
 */
function getTableSchema(headers, sampleRow) {
  const columns = headers.map(header => {
    const value = sampleRow[header];
    let type = 'TEXT';
    
    if (value === null || value === undefined) {
      type = 'TEXT';
    } else if (typeof value === 'number') {
      // Check if it's a float or integer
      type = Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
    } else if (typeof value === 'boolean') {
      type = 'BOOLEAN';
    } else if (typeof value === 'object') {
      type = 'JSONB';
    } else if (header === 'id') {
      type = 'INTEGER';
    } else if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      // Looks like JSON string
      type = 'JSONB';
    }
    
    // Escape column name if needed
    const escapedHeader = header.includes('-') || header.match(/^\d/) ? `"${header}"` : header;
    const isPrimaryKey = header === 'id' ? ' PRIMARY KEY' : '';
    const isNullable = header === 'id' ? ' NOT NULL' : '';
    
    return `${escapedHeader} ${type}${isPrimaryKey}${isNullable}`;
  });
  
  return columns.join(', ');
}

/**
 * Process a single CSV file
 */
async function processCSVFile(csvFileName) {
  const csvPath = path.join(CSV_OUTPUT_DIR, csvFileName);
  const tableName = csvFileName.replace('.csv', '');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    return false;
  }
  
  console.log(`\nProcessing: ${csvFileName}`);
  console.log(`  Table: ${tableName}`);
  
  try {
    // Parse CSV
    const { headers, rows } = parseCSV(csvPath);
    
    if (rows.length === 0) {
      console.log(`  Skipping: No data rows found`);
      return true;
    }
    
    console.log(`  Rows: ${rows.length}`);
    
    // Get schema from first row
    const schema = getTableSchema(headers, rows[0]);
    
    // Create table if needed (this may not work via API, tables should be created manually)
    // But we'll try anyway
    await createTableIfNotExists(tableName, schema);
    
    // Verify table exists before proceeding
    const { error: checkError } = await supabase.from(tableName).select('*').limit(1);
    if (checkError && (checkError.code === 'PGRST116' || checkError.message.includes('does not exist'))) {
      console.error(`  ERROR: Table ${tableName} does not exist. Please create it first using create_tables.sql`);
      console.error(`  Or run this SQL in Supabase SQL Editor:`);
      console.error(`  CREATE TABLE IF NOT EXISTS "${tableName}" (${schema});`);
      return false;
    }
    
    // Upsert data
    await upsertData(tableName, rows);
    
    return true;
  } catch (error) {
    console.error(`  ERROR: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Syncing CSV files to Supabase');
  console.log('='.repeat(80));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
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
  
  // First, try to create all tables from SQL file
  console.log('Step 1: Ensuring all tables exist...');
  await createAllTables();
  console.log('');
  
  // Process each CSV file
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < csvFiles.length; i++) {
    const csvFile = csvFiles[i];
    console.log(`[${i + 1}/${csvFiles.length}]`);
    
    const success = await processCSVFile(csvFile);
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
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
