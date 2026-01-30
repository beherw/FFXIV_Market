-- ============================================================================
-- 重新導入 ui_categories 表
-- ============================================================================
-- 這個腳本用於重新導入 ui_categories.csv 文件到 Supabase 數據庫
-- 
-- 使用步驟：
-- 1. 在 Supabase Dashboard 中打開 SQL Editor
-- 2. 複製並執行下面的 SQL 語句
-- 3. 或者使用 Supabase CLI 執行此文件
--
-- ============================================================================

-- 步驟 1: 清空現有的 ui_categories 表數據
-- 注意：這會刪除所有現有數據，請確保已備份（如果需要）
TRUNCATE TABLE ui_categories;

-- 步驟 2: 重新導入 CSV 文件
-- 
-- 推薦方法：使用 Supabase Dashboard 的 Table Editor
-- 1. 打開 Supabase Dashboard (https://supabase.com/dashboard)
-- 2. 選擇你的項目
-- 3. 進入 "Table Editor"
-- 4. 選擇 ui_categories 表
-- 5. 點擊右上角的 "..." 菜單
-- 6. 選擇 "Import data from CSV"
-- 7. 上傳文件：json_converter/csv_output/ui_categories.csv
-- 8. 確保列映射正確：
--    - CSV 的 "id" 列 -> 數據庫的 "id" 列
--    - CSV 的 "category" 列 -> 數據庫的 "category" 列
-- 9. 點擊 "Import"
--
-- 注意：CSV 文件只有 id 和 category 兩列，其他列（name, job, order, data）會是 NULL
-- 這是正常的，因為原始 JSON 文件只包含 id -> category 的映射關係

-- ============================================================================
-- 驗證數據導入
-- ============================================================================

-- 檢查總行數（應該約為 50,900）
SELECT COUNT(*) as total_rows FROM ui_categories;

-- 檢查分類 88（火槍）的物品數量
SELECT COUNT(*) as category_88_count 
FROM ui_categories 
WHERE category = 88;

-- 查看分類 88 的前幾個物品
SELECT id, category 
FROM ui_categories 
WHERE category = 88 
ORDER BY id 
LIMIT 10;

-- 檢查是否有 NULL 值
SELECT 
  COUNT(*) FILTER (WHERE id IS NULL) as null_ids,
  COUNT(*) FILTER (WHERE category IS NULL) as null_categories
FROM ui_categories;

-- 檢查分類分佈（前 10 個最常見的分類）
SELECT category, COUNT(*) as count
FROM ui_categories
GROUP BY category
ORDER BY count DESC
LIMIT 10;
