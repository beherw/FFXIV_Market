# Database Optimization Summary

## Analysis Date
Generated after analyzing query patterns in `supabaseData.js` and table schemas in `create_tables.sql`

## Critical Missing Indexes (High Priority)

### 1. **tw_recipes** - Composite Index for Job + Level Queries
**Problem**: Most common query pattern is `WHERE job IN (...) AND lvl >= X AND lvl <= Y`
**Current State**: Has individual indexes on `job` and `lvl`, but no composite index
**Impact**: **HIGH** - This is one of the most frequently used queries (CraftingInspiration component)
**Solution**: 
```sql
CREATE INDEX idx_tw_recipes_job_lvl ON tw_recipes(job, lvl);
```

### 2. **equipment** - GIN Index for JSONB Jobs Array
**Problem**: Queries use `WHERE jobs @> '["DNC"]'` (JSONB containment) but no GIN index exists
**Current State**: Has B-tree indexes on `id`, `level`, `equipSlotCategory`, but no JSONB index
**Impact**: **HIGH** - Equipment filtering by job is common and slow without GIN index
**Solution**:
```sql
CREATE INDEX idx_equipment_jobs_gin ON equipment USING gin(jobs);
```

## Important Missing Indexes (Medium Priority)

### 3. **ui_categories** - Composite Index for Category Filtering
**Problem**: Common query is `WHERE category IN (...)` then select `id`
**Current State**: Has individual indexes on `category` and `id`
**Impact**: **MEDIUM** - Improves category-based filtering performance
**Solution**:
```sql
CREATE INDEX idx_ui_categories_category_id ON ui_categories(category, id);
```

### 4. **ilvls** - Composite Index for Range Queries
**Problem**: Common query is `WHERE value >= X AND value <= Y` then select `id`
**Current State**: Has individual indexes on `value` and `id`
**Impact**: **MEDIUM** - Improves ilvl range filtering performance
**Solution**:
```sql
CREATE INDEX idx_ilvls_value_id ON ilvls(value, id);
```

## Additional Optimizations (Lower Priority)

### 5. **shops_by_npc** - Ensure Index on NPC ID
**Problem**: Queries use `WHERE id IN (...)` for NPC IDs
**Impact**: **LOW** - Should already be primary key, but ensure index exists

### 6. **item_patch** - Composite Index
**Problem**: Queries filter by `value` then select `id`
**Impact**: **LOW** - Minor improvement for patch-based queries

### 7. **Obtain Methods Tables** - Ensure Indexes Exist
**Tables**: `fate_sources`, `loot_sources`, `extracts`
**Impact**: **LOW** - Ensure primary key indexes exist

## Already Optimized Tables

✅ **tw_items, cn_items, ko_items, en_items, ja_items, de_items, fr_items**
- Have trigram GIN indexes for ILIKE queries (from `optimize_search_indexes.sql`)

✅ **tw_recipes**
- Has GIN index on `ingredients` JSONB column (from `optimize_search_indexes.sql`)
- Has indexes on `id`, `result`, `job`, `lvl` (from `create_tables.sql`)

✅ **market_items**
- Has primary key index on `id`

✅ **rarities**
- Has indexes on `id` and `value`

## Query Pattern Analysis

### Most Frequent Query Patterns Found:

1. **Recipe Queries** (Very Common)
   ```sql
   WHERE job IN (8, 9) AND lvl >= 50 AND lvl <= 90
   WHERE result IN (123, 456, 789)
   WHERE ingredients @> '[{"id": 123}]'
   ```

2. **Equipment Queries** (Common)
   ```sql
   WHERE jobs @> '["DNC"]'
   WHERE id IN (123, 456, 789)
   ```

3. **Item Level Queries** (Common)
   ```sql
   WHERE value >= 500 AND value <= 600
   WHERE value = 600
   WHERE id IN (123, 456, 789)
   ```

4. **Category Queries** (Common)
   ```sql
   WHERE category IN (1, 2, 3)
   ```

5. **Item Name Queries** (Very Common)
   ```sql
   WHERE tw ILIKE '%pattern%'
   ```
   ✅ Already optimized with trigram indexes

## Performance Impact Estimates

| Index | Query Speed Improvement | Disk Space Cost |
|-------|------------------------|-----------------|
| `idx_tw_recipes_job_lvl` | 10-50x faster | ~5-10 MB |
| `idx_equipment_jobs_gin` | 20-100x faster | ~10-20 MB |
| `idx_ui_categories_category_id` | 5-20x faster | ~2-5 MB |
| `idx_ilvls_value_id` | 5-15x faster | ~3-8 MB |

## Execution Order

1. **First**: Run `create_tables.sql` (if tables don't exist)
2. **Second**: Run `optimize_search_indexes.sql` (for text search)
3. **Third**: Run `optimize_database_indexes.sql` (this file - for query optimization)

## Verification

After creating indexes, verify they're being used:

```sql
-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans
FROM pg_stat_user_indexes
WHERE tablename IN ('tw_recipes', 'equipment', 'ui_categories', 'ilvls')
ORDER BY idx_scan DESC;

-- Test query performance
EXPLAIN ANALYZE
SELECT * FROM tw_recipes
WHERE job IN (8, 9) AND lvl >= 50 AND lvl <= 90
LIMIT 100;
```

## Notes

- All indexes use `IF NOT EXISTS` so it's safe to run multiple times
- Index creation may take a few minutes for large tables
- Monitor disk space - indexes increase storage requirements
- Run `ANALYZE` after creating indexes to update statistics
- Consider dropping unused indexes if they're not being used (check `idx_scan`)
