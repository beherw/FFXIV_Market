-- ============================================================================
-- INDEX VERIFICATION AND ANALYSIS SCRIPT
-- ============================================================================
-- Run this script to verify all indexes are created and check their usage
-- ============================================================================

-- ============================================================================
-- 1. CHECK ALL INDEXES ON KEY TABLES
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'tw_items', 'cn_items', 'ko_items', 'en_items', 'ja_items', 'de_items', 'fr_items',
  'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 'item_patch', 
  'shops_by_npc', 'extracts', 'fate_sources', 'loot_sources',
  'market_items', 'rarities', 'tw_item_descriptions'
)
ORDER BY tablename, indexname;

-- ============================================================================
-- 2. CHECK INDEX USAGE STATISTICS
-- ============================================================================
-- Shows how often each index is being used (idx_scan = number of times index was scanned)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN '⚠️ UNUSED - Consider dropping if not needed'
    WHEN idx_scan < 10 THEN '⚠️ LOW USAGE - Monitor'
    WHEN idx_scan < 100 THEN '✓ MODERATE USAGE'
    ELSE '✓✓ HIGH USAGE'
  END as usage_status
FROM pg_stat_user_indexes
WHERE tablename IN (
  'tw_items', 'cn_items', 'ko_items', 'en_items', 'ja_items', 'de_items', 'fr_items',
  'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 'item_patch', 
  'shops_by_npc', 'extracts', 'fate_sources', 'loot_sources',
  'market_items', 'rarities', 'tw_item_descriptions'
)
ORDER BY idx_scan DESC, tablename, indexname;

-- ============================================================================
-- 3. CHECK TABLE SIZES AND INDEX SIZES
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE tablename IN (
  'tw_items', 'cn_items', 'ko_items', 'en_items', 'ja_items', 'de_items', 'fr_items',
  'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 'item_patch', 
  'shops_by_npc', 'extracts', 'fate_sources', 'loot_sources',
  'market_items', 'rarities', 'tw_item_descriptions'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 4. CHECK FOR MISSING INDEXES ON FOREIGN KEY COLUMNS
-- ============================================================================
-- Note: This assumes foreign keys exist. If not, this query will return empty.
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = tc.table_name 
      AND indexdef LIKE '%' || kcu.column_name || '%'
    ) THEN '✓ Indexed'
    ELSE '⚠️ No index on FK column'
  END as index_status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'ilvls', 'item_patch', 'market_items', 'rarities', 
    'tw_item_descriptions', 'equipment'
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 5. TEST QUERY PERFORMANCE WITH EXPLAIN ANALYZE
-- ============================================================================

-- Test 1: Recipe query with job and level filter (should use idx_tw_recipes_job_lvl)
EXPLAIN ANALYZE
SELECT * FROM tw_recipes
WHERE job IN (8, 9) AND lvl >= 50 AND lvl <= 90
LIMIT 100;

-- Test 2: Equipment query with JSONB containment (should use idx_equipment_jobs_gin)
EXPLAIN ANALYZE
SELECT * FROM equipment
WHERE jobs @> '["DNC"]'
LIMIT 100;

-- Test 3: UI categories query (should use idx_ui_categories_category_id)
EXPLAIN ANALYZE
SELECT id FROM ui_categories
WHERE category IN (1, 2, 3)
LIMIT 100;

-- Test 4: Ilvls range query (should use idx_ilvls_value_id)
EXPLAIN ANALYZE
SELECT id FROM ilvls
WHERE value >= 500 AND value <= 600
LIMIT 100;

-- Test 5: Ilvls max value query (should use idx_ilvls_value_id)
EXPLAIN ANALYZE
SELECT value FROM ilvls
ORDER BY value DESC
LIMIT 1;

-- Test 6: Text search query (should use trigram GIN index)
EXPLAIN ANALYZE
SELECT id, tw
FROM tw_items
WHERE tw IS NOT NULL 
  AND tw <> ''
  AND tw ILIKE '%火%'
LIMIT 100;

-- Test 7: Recipe ingredients JSONB query (should use idx_tw_recipes_ingredients_gin)
EXPLAIN ANALYZE
SELECT * FROM tw_recipes
WHERE ingredients @> '[{"id": 123}]'
LIMIT 100;

-- ============================================================================
-- 6. CHECK FOR DUPLICATE OR REDUNDANT INDEXES
-- ============================================================================
-- Find indexes that might be redundant (same columns, different names)
SELECT 
  tablename,
  array_agg(indexname ORDER BY indexname) as indexes,
  array_agg(indexdef ORDER BY indexname) as index_definitions
FROM pg_indexes
WHERE tablename IN (
  'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 'item_patch'
)
GROUP BY tablename
HAVING COUNT(*) > 1
ORDER BY tablename;

-- ============================================================================
-- 7. CHECK INDEX FRAGMENTATION (PostgreSQL 14+)
-- ============================================================================
-- Note: This requires pgstattuple extension
-- CREATE EXTENSION IF NOT EXISTS pgstattuple;
-- 
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
--   idx_scan as scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('tw_recipes', 'equipment', 'ui_categories', 'ilvls')
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 8. RECOMMENDATIONS BASED ON USAGE
-- ============================================================================
-- Find indexes that are never used (might be candidates for removal)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  'Consider dropping if not needed for unique constraints' as recommendation
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND tablename IN (
    'tw_items', 'cn_items', 'ko_items', 'en_items', 'ja_items', 'de_items', 'fr_items',
    'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 'item_patch', 
    'shops_by_npc', 'extracts', 'fate_sources', 'loot_sources',
    'market_items', 'rarities', 'tw_item_descriptions'
  )
  AND indexname NOT LIKE '%_pkey'  -- Don't recommend dropping primary keys
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Run ANALYZE on tables if index usage shows 0 scans:
--    ANALYZE tw_recipes;
--    ANALYZE equipment;
--    ANALYZE ui_categories;
--    ANALYZE ilvls;
--
-- 2. If indexes show "Index Scan" in EXPLAIN ANALYZE, they're being used correctly
--    If they show "Seq Scan", the index might not be optimal or statistics are stale
--
-- 3. Monitor index usage over time - unused indexes waste space and slow down writes
--
-- 4. Consider dropping indexes with 0 scans (except primary keys and unique constraints)
--
-- 5. If query performance is still slow after indexes are created:
--    - Check if statistics are up to date (run ANALYZE)
--    - Verify query conditions match index columns
--    - Check if table is too small (PostgreSQL may prefer sequential scan for small tables)
