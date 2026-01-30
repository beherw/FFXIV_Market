-- ============================================================================
-- DATABASE OPTIMIZATION - Missing Indexes Analysis and Creation
-- ============================================================================
-- This script analyzes query patterns and creates missing indexes for optimal performance
-- Run this after create_tables.sql and optimize_search_indexes.sql
-- ============================================================================

-- ============================================================================
-- 1. TW_RECIPES TABLE - Composite Indexes for Common Query Patterns
-- ============================================================================
-- Common query: WHERE job IN (...) AND lvl >= X AND lvl <= Y
-- Current indexes: id, result, job, lvl (individual)
-- Missing: Composite index on (job, lvl) for range queries

-- Composite index for job + level range queries (most common pattern)
-- This dramatically speeds up queries like: WHERE job IN (8,9) AND lvl >= 50 AND lvl <= 90
CREATE INDEX IF NOT EXISTS idx_tw_recipes_job_lvl 
  ON tw_recipes(job, lvl);

-- Composite index for result + job (less common but still useful)
-- Speeds up: WHERE result = X AND job = Y
CREATE INDEX IF NOT EXISTS idx_tw_recipes_result_job 
  ON tw_recipes(result, job);

-- Note: The GIN index on ingredients JSONB already exists from optimize_search_indexes.sql

-- ============================================================================
-- 2. EQUIPMENT TABLE - JSONB Index for Jobs Array Queries
-- ============================================================================
-- Common query: WHERE jobs @> '["DNC"]' (JSONB containment)
-- Current indexes: id, level, equipSlotCategory
-- Missing: GIN index on jobs JSONB column

-- GIN index for JSONB containment queries on jobs array
-- This enables fast queries like: WHERE jobs @> '["DNC"]' or jobs ? 'DNC'
CREATE INDEX IF NOT EXISTS idx_equipment_jobs_gin 
  ON equipment USING gin(jobs);

-- Composite index for level + equipSlotCategory (common filter combination)
CREATE INDEX IF NOT EXISTS idx_equipment_level_slot 
  ON equipment(level, "equipSlotCategory");

-- ============================================================================
-- 3. UI_CATEGORIES TABLE - Composite Index for Category Queries
-- ============================================================================
-- Common query: WHERE category IN (...) then select id
-- Current indexes: id, category, job
-- Missing: Composite index on (category, id) for efficient filtering + selection

-- Composite index for category filtering (most common pattern)
CREATE INDEX IF NOT EXISTS idx_ui_categories_category_id 
  ON ui_categories(category, id);

-- Composite index for job + category (if both are often filtered together)
CREATE INDEX IF NOT EXISTS idx_ui_categories_job_category 
  ON ui_categories(job, category);

-- ============================================================================
-- 4. ILVLS TABLE - Composite Index for Range Queries
-- ============================================================================
-- Common query: WHERE value >= X AND value <= Y then select id
-- Current indexes: id, value
-- Missing: Composite index on (value, id) for range queries with id selection

-- Composite index for value range queries (optimizes: WHERE value BETWEEN X AND Y)
-- This helps when filtering by ilvl range and then selecting item IDs
CREATE INDEX IF NOT EXISTS idx_ilvls_value_id 
  ON ilvls(value, id);

-- ============================================================================
-- 5. SHOPS_BY_NPC TABLE - Index for NPC ID Queries
-- ============================================================================
-- Common query: WHERE id IN (...) (NPC IDs)
-- Note: This table uses 'id' column for NPC ID, not shop ID
-- Missing: Index on id column (if not already primary key)

-- Check if id is primary key first, if not create index
-- If id is already PRIMARY KEY, this will be ignored (safe to run)
CREATE INDEX IF NOT EXISTS idx_shops_by_npc_id 
  ON shops_by_npc(id);

-- ============================================================================
-- 6. ITEM_PATCH TABLE - Composite Index for Patch Queries
-- ============================================================================
-- Common query: WHERE value = X then select id
-- Current indexes: id, value
-- Missing: Composite index on (value, id) for efficient filtering

CREATE INDEX IF NOT EXISTS idx_item_patch_value_id 
  ON item_patch(value, id);

-- ============================================================================
-- 7. RARITIES TABLE - Already Optimized
-- ============================================================================
-- Current indexes: id, value
-- No additional indexes needed (simple lookups)

-- ============================================================================
-- 8. MARKET_ITEMS TABLE - Already Optimized
-- ============================================================================
-- Current indexes: id (primary key)
-- No additional indexes needed (simple existence checks)

-- ============================================================================
-- 9. EXTRACTS TABLE - Index for Item ID Lookups
-- ============================================================================
-- Common query: WHERE id = X (item ID lookup)
-- Ensure primary key index exists

-- Extract table should have id as primary key, but ensure index exists
CREATE INDEX IF NOT EXISTS idx_extracts_id 
  ON extracts(id);

-- ============================================================================
-- 10. OBTAIN METHODS TABLES - Indexes for Source Queries
-- ============================================================================
-- These tables are queried by item ID frequently
-- Ensure indexes exist on id columns

-- Fate sources table
CREATE INDEX IF NOT EXISTS idx_fate_sources_id 
  ON fate_sources(id);

-- Loot sources table  
CREATE INDEX IF NOT EXISTS idx_loot_sources_id 
  ON loot_sources(id);

-- ============================================================================
-- ANALYZE ALL TABLES
-- ============================================================================
-- Update table statistics so PostgreSQL can choose the best query plan
ANALYZE tw_recipes;
ANALYZE equipment;
ANALYZE ui_categories;
ANALYZE ilvls;
ANALYZE item_patch;
ANALYZE shops_by_npc;
ANALYZE extracts;
ANALYZE fate_sources;
ANALYZE loot_sources;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify indexes are created and being used:

-- 1. Check all indexes on key tables:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename IN (
--   'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 
--   'item_patch', 'shops_by_npc', 'extracts', 'fate_sources', 'loot_sources'
-- )
-- ORDER BY tablename, indexname;

-- 2. Test tw_recipes composite index performance:
-- EXPLAIN ANALYZE
-- SELECT * FROM tw_recipes
-- WHERE job IN (8, 9) AND lvl >= 50 AND lvl <= 90
-- LIMIT 100;

-- 3. Test equipment JSONB index performance:
-- EXPLAIN ANALYZE
-- SELECT * FROM equipment
-- WHERE jobs @> '["DNC"]'
-- LIMIT 100;

-- 4. Test ui_categories composite index performance:
-- EXPLAIN ANALYZE
-- SELECT id FROM ui_categories
-- WHERE category IN (1, 2, 3)
-- LIMIT 100;

-- 5. Test ilvls composite index performance:
-- EXPLAIN ANALYZE
-- SELECT id FROM ilvls
-- WHERE value >= 500 AND value <= 600
-- LIMIT 100;

-- 6. Check index usage statistics:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename IN (
--   'tw_recipes', 'equipment', 'ui_categories', 'ilvls', 
--   'item_patch', 'shops_by_npc', 'extracts', 'fate_sources', 'loot_sources'
-- )
-- ORDER BY idx_scan DESC;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Index Creation Priority:
--    - High Priority: idx_tw_recipes_job_lvl, idx_equipment_jobs_gin
--    - Medium Priority: idx_ui_categories_category_id, idx_ilvls_value_id
--    - Low Priority: Other composite indexes (create if query patterns show they're needed)
--
-- 2. Index Size Considerations:
--    - Composite indexes are larger than single-column indexes
--    - GIN indexes (for JSONB) are larger than B-tree indexes
--    - Monitor disk space, but performance gains usually justify the size
--
-- 3. Query Plan Analysis:
--    - Use EXPLAIN ANALYZE to verify indexes are being used
--    - If indexes aren't being used, check:
--      a) Table statistics are up to date (run ANALYZE)
--      b) Query conditions match index columns
--      c) Index selectivity (PostgreSQL may choose sequential scan for small tables)
--
-- 4. Maintenance:
--    - Run ANALYZE periodically (or rely on autovacuum)
--    - Monitor index usage with pg_stat_user_indexes
--    - Consider REINDEX if query performance degrades over time
--    - Drop unused indexes to save space and improve write performance
--
-- 5. Performance Testing:
--    - Test queries before and after index creation
--    - Monitor query execution times
--    - Check index scan vs sequential scan in EXPLAIN output
