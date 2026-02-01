/**
 * Supabase Client Configuration
 *
 * Uses env vars only (no keys in repo). Set in .env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * See .env.example for placeholders.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example)'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Test Supabase connection with detailed logging
 * @returns {Promise<boolean>} - True if connection successful
 */
export async function testSupabaseConnection() {
  const startTime = performance.now();
  console.log('[Supabase] 🔌 Connecting to database...');
  
  try {
    const { data, error, status } = await supabase
      .from('market_items')
      .select('id')
      .limit(1);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (error) {
      console.error(`[Supabase] ❌ Connection failed after ${duration.toFixed(2)}ms:`, error);
      return false;
    }
    
    console.log(`[Supabase] ✅ Connected successfully in ${duration.toFixed(2)}ms (status: ${status})`);
    return true;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(`[Supabase] ❌ Connection test failed after ${duration.toFixed(2)}ms:`, error);
    return false;
  }
}

/**
 * Initialize Supabase connection on page load
 * Call this as early as possible to establish connection
 */
export async function initializeSupabaseConnection() {
  console.log('[Supabase] 🚀 Initializing database connection...');
  const connectionStartTime = performance.now();
  
  const connected = await testSupabaseConnection();
  
  const totalTime = performance.now() - connectionStartTime;
  
  if (connected) {
    console.log(`[Supabase] ✨ Database ready (total init time: ${totalTime.toFixed(2)}ms)`);
  } else {
    console.warn(`[Supabase] ⚠️ Database connection failed (total init time: ${totalTime.toFixed(2)}ms)`);
  }
  
  return connected;
}
