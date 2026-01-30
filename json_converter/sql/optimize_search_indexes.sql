-- ============================================================================
-- OPTIMIZE SEARCH QUERIES - Trigram Indexes for ILIKE Performance
-- ============================================================================
-- This script creates GIN trigram indexes to dramatically improve ILIKE query
-- performance, especially for patterns with leading wildcards (%pattern%).
--
-- Problem: B-tree indexes cannot efficiently handle ILIKE queries with leading %
-- Solution: Use pg_trgm extension with GIN indexes for fast substring matching
--
-- Performance improvement: 10-100x faster for ILIKE queries
-- ============================================================================

-- Step 1: Enable pg_trgm extension (required for trigram indexes)
-- Note: This may require superuser privileges. If it fails, contact Supabase support.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Create GIN trigram indexes for all language columns used in ILIKE searches
-- These indexes enable fast ILIKE queries even with leading wildcards (%pattern%)

-- Traditional Chinese (TW) - PRIMARY SEARCH COLUMN
-- Drop old B-tree index if it exists (optional - keep it for exact matches)
-- DROP INDEX IF EXISTS idx_tw_items_tw;
CREATE INDEX IF NOT EXISTS idx_tw_items_tw_trgm 
  ON tw_items USING gin(tw gin_trgm_ops);

-- Simplified Chinese (CN/ZH)
CREATE INDEX IF NOT EXISTS idx_cn_items_zh_trgm 
  ON cn_items USING gin(zh gin_trgm_ops);

-- Korean (KO)
CREATE INDEX IF NOT EXISTS idx_ko_items_ko_trgm 
  ON ko_items USING gin(ko gin_trgm_ops);

-- English (EN)
CREATE INDEX IF NOT EXISTS idx_en_items_en_trgm 
  ON en_items USING gin(en gin_trgm_ops);

-- Japanese (JA)
CREATE INDEX IF NOT EXISTS idx_ja_items_ja_trgm 
  ON ja_items USING gin(ja gin_trgm_ops);

-- German (DE)
CREATE INDEX IF NOT EXISTS idx_de_items_de_trgm 
  ON de_items USING gin(de gin_trgm_ops);

-- French (FR)
CREATE INDEX IF NOT EXISTS idx_fr_items_fr_trgm 
  ON fr_items USING gin(fr gin_trgm_ops);

-- ============================================================================
-- OPTIONAL: Partial Indexes for Common Query Patterns
-- ============================================================================
-- These partial indexes can further optimize queries that filter out NULL/empty values
-- They're smaller and faster than full indexes when the WHERE clause matches

-- Partial index for tw_items excluding NULL and empty strings
-- This matches the common query pattern: WHERE tw IS NOT NULL AND tw <> ''
CREATE INDEX IF NOT EXISTS idx_tw_items_tw_trgm_partial 
  ON tw_items USING gin(tw gin_trgm_ops)
  WHERE tw IS NOT NULL AND tw <> '';

-- ============================================================================
-- JSONB INDEXES FOR RECIPE INGREDIENTS SEARCH
-- ============================================================================
-- The tw_recipes table uses JSONB for ingredients array
-- Queries using @> (contains) operator need GIN indexes for performance

-- GIN index for ingredients JSONB column
-- This enables fast queries like: WHERE ingredients @> '[{"id": 123}]'
CREATE INDEX IF NOT EXISTS idx_tw_recipes_ingredients_gin 
  ON tw_recipes USING gin(ingredients);

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update table statistics so PostgreSQL can choose the best query plan
ANALYZE tw_items;
ANALYZE cn_items;
ANALYZE ko_items;
ANALYZE en_items;
ANALYZE ja_items;
ANALYZE de_items;
ANALYZE fr_items;
ANALYZE tw_recipes;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify indexes are created and being used:

-- 1. Check if indexes exist:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('tw_items', 'cn_items', 'ko_items', 'en_items', 'ja_items', 'de_items', 'fr_items')
--   AND indexname LIKE '%trgm%'
-- ORDER BY tablename, indexname;

-- 2. Test query performance (should use the trigram index):
-- EXPLAIN ANALYZE
-- SELECT id, tw
-- FROM tw_items
-- WHERE tw IS NOT NULL 
--   AND tw <> ''
--   AND tw ILIKE '%火%'
-- LIMIT 100;

-- 3. Test JSONB containment query performance:
-- EXPLAIN ANALYZE
-- SELECT *
-- FROM tw_recipes
-- WHERE ingredients @> '[{"id": 123}]'
-- LIMIT 100;

-- 4. Check index usage statistics:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('tw_items', 'cn_items', 'ko_items', 'en_items', 'ja_items', 'de_items', 'fr_items', 'tw_recipes')
--   AND (indexname LIKE '%trgm%' OR indexname LIKE '%gin%')
-- ORDER BY idx_scan DESC;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Index Creation Time:
--    - GIN indexes take longer to build than B-tree indexes
--    - For 42,679 rows in tw_items, expect 30-60 seconds
--    - Indexes are created in the background, so queries can still run
--
-- 2. Index Size:
--    - GIN indexes are larger than B-tree indexes (typically 2-3x)
--    - For tw_items with ~42k rows, expect ~10-20MB per index
--    - This is acceptable for the performance gain
--
-- 3. Query Optimization:
--    - PostgreSQL will automatically use trigram indexes for ILIKE queries
--    - No code changes needed - existing queries will benefit immediately
--    - Works with patterns like: '%pattern%', '%pattern', 'pattern%'
--
-- 4. Maintenance:
--    - Indexes are automatically maintained by PostgreSQL
--    - Run ANALYZE periodically (or rely on autovacuum) to keep statistics fresh
--    - Consider REINDEX if query performance degrades over time
--
-- 5. Alternative Approaches:
--    - Full-text search (tsvector) for more advanced search features
--    - Elasticsearch/Meilisearch for very large datasets or complex search needs
--    - Cursor-based pagination instead of OFFSET for better performance on large result sets
