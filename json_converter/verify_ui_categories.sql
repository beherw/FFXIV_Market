-- ============================================================================
-- 驗證 ui_categories 表數據導入
-- ============================================================================
-- 執行這些查詢來確認數據已正確導入
-- ============================================================================

-- 1. 檢查總行數（應該約為 50,900）
SELECT COUNT(*) as total_rows FROM ui_categories;

-- 2. 檢查分類 88（火槍 - MCH 職業）的物品數量
SELECT COUNT(*) as category_88_count 
FROM ui_categories 
WHERE category = 88;

-- 3. 查看分類 88 的前 10 個物品（應該包含 8573, 10462, 10463 等）
SELECT id, category 
FROM ui_categories 
WHERE category = 88 
ORDER BY id 
LIMIT 10;

-- 4. 檢查是否有 NULL 值（id 和 category 都不應該是 NULL）
SELECT 
  COUNT(*) FILTER (WHERE id IS NULL) as null_ids,
  COUNT(*) FILTER (WHERE category IS NULL) as null_categories,
  COUNT(*) as total_rows
FROM ui_categories;

-- 5. 檢查分類分佈（前 10 個最常見的分類）
SELECT category, COUNT(*) as count
FROM ui_categories
GROUP BY category
ORDER BY count DESC
LIMIT 10;

-- 6. 檢查特定分類是否存在（測試幾個常見的分類）
SELECT 
  category,
  COUNT(*) as item_count
FROM ui_categories
WHERE category IN (1, 2, 5, 88, 96, 97)
GROUP BY category
ORDER BY category;

-- 7. 驗證查詢功能（模擬進階搜尋的查詢）
-- 這個查詢應該返回分類 88 的所有物品 ID
SELECT id
FROM ui_categories
WHERE category = 88
ORDER BY id
LIMIT 20;
