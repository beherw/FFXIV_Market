/**
 * 簡化版檢查腳本 - 使用瀏覽器開發者工具執行
 * 
 * 在網站開啟後，按 F12 打開開發者工具，在 Console 中執行此代碼
 */

// 方法1：檢查 extracts_unified 表中 type = 17 的記錄數量
console.log('🔍 檢查 REQUIREMENTS (type=17) 使用情況\n');

// 從瀏覽器中執行這個 SQL 查詢（在 Supabase 控制台）
const sqlQuery = `
-- 檢查 type = 17 的記錄數量
SELECT COUNT(*) as count
FROM extracts_unified
WHERE type = 17;

-- 檢查所有 type 的使用統計
SELECT 
  type,
  COUNT(*) as count
FROM extracts_unified
GROUP BY type
ORDER BY type;

-- 如果有 type = 17 的記錄，查看範例
SELECT 
  item_id,
  type,
  data
FROM extracts_unified
WHERE type = 17
LIMIT 5;
`;

console.log('請在 Supabase 控制台執行以下 SQL 查詢：');
console.log('----------------------------------------');
console.log(sqlQuery);
console.log('----------------------------------------\n');

console.log('或者使用此 JavaScript 代碼（需要 supabase 客戶端）：');
console.log(`
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);

// 檢查 type = 17
const { data, count, error } = await supabase
  .from('extracts_unified')
  .select('item_id, type, data', { count: 'exact' })
  .eq('type', 17)
  .limit(10);

console.log('Type 17 記錄數量:', count);
if (count > 0) {
  console.log('範例記錄:', data);
}
`);
