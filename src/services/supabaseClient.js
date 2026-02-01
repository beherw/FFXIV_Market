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

function renderErrorPage({ title, message, detail, icon = '⚠️' }) {
  if (typeof document === 'undefined') {
    return;
  }

  const contact = '請聯繫網頁製作者 Discord wuperbear';

  document.title = title;
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(1200px 800px at 50% -10%, rgba(88,28,135,0.35), transparent 70%), linear-gradient(135deg, #0b0f1a 0%, #0f172a 45%, #2e1065 65%, #0b0f1a 100%);color:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',Arial,sans-serif;padding:24px;">
      <div style="text-align:center;max-width:720px;width:100%;">
        <div style="margin-bottom:28px;">
        </div>
        <div style="background:linear-gradient(145deg, rgba(30,41,59,0.65), rgba(88,28,135,0.25), rgba(30,41,59,0.65));backdrop-filter:blur(6px);border-radius:16px;border:1px solid rgba(147,51,234,0.25);padding:32px 28px;margin-bottom:24px;box-shadow:0 0 35px rgba(59,130,246,0.08);">
          <div style="font-size:56px;margin-bottom:18px;">${icon}</div>
          <div style="font-size:26px;font-weight:700;color:#fbbf24;margin-bottom:12px;">${title}</div>
          <div style="font-size:16px;line-height:1.7;color:#e2e8f0;margin-bottom:12px;">${message}</div>
          ${detail ? `<div style=\"font-size:14px;line-height:1.6;color:#94a3b8;\">${detail}</div>` : ''}
        </div>
        <div style="font-size:15px;font-weight:600;color:#fbbf24;">${contact}</div>
      </div>
    </div>
  `;
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Supabase] Missing env vars: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY');
  renderErrorPage({
    title: 'Supabase 設定缺失',
    message: '缺少連線 Supabase 所需的金鑰或變數。',
    detail: '請確認 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY 已正確設定。',
  });
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
