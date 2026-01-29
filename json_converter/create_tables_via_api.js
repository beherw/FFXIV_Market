#!/usr/bin/env node

/**
 * Create tables in Supabase using REST API
 * This script executes the SQL from create_tables.sql via Supabase's REST API
 * 
 * Usage: node create_tables_via_api.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dojkqotccerymtnqnyfj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const SQL_FILE = path.join(__dirname, 'create_tables.sql');

/**
 * Execute SQL statement using Supabase REST API
 */
async function executeSQL(sql) {
  // Method 1: Try using exec_sql RPC function (if helper function exists)
  try {
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    if (!error) {
      return true;
    }
  } catch (e) {
    // RPC function doesn't exist
  }

  // Method 2: Try using Management API (requires project ref)
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  if (projectRef) {
    try {
      // Use Supabase Management API
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({ query: sql })
      });

      if (response.ok) {
        return true;
      }
    } catch (e) {
      // Management API failed
    }
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Creating Tables in Supabase');
  console.log('='.repeat(80));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  if (!fs.existsSync(SQL_FILE)) {
    console.error(`ERROR: SQL file not found: ${SQL_FILE}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(SQL_FILE, 'utf-8');
  
  // Split SQL into statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => {
      const trimmed = s.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('--') && 
             !trimmed.startsWith('/*') &&
             !trimmed.startsWith('=');
    });

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
    
    // Skip comments and empty statements
    if (preview.length === 0 || preview.startsWith('--')) {
      skipCount++;
      continue;
    }

    console.log(`[${i + 1}/${statements.length}] ${preview}...`);

    try {
      const success = await executeSQL(statement);
      
      if (success) {
        console.log(`  ✓ Success`);
        successCount++;
      } else {
        console.log(`  ⚠ Skipped (table may already exist or API not available)`);
        skipCount++;
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log(`Total statements: ${statements.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('');

  if (failCount === 0 && successCount > 0) {
    console.log('✅ Tables created successfully!');
  } else if (successCount === 0 && skipCount > 0) {
    console.log('⚠️  Could not create tables via API.');
    console.log('💡 This is normal - Supabase REST API cannot execute DDL statements.');
    console.log('💡 Please create tables manually:');
    console.log('   1. Go to Supabase SQL Editor');
    console.log('   2. Run create_tables.sql');
    console.log('   3. Or run create_helper_function.sql first, then this script');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
