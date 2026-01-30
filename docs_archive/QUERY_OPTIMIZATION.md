# Query Optimization Guide

## Problem: Slow ILIKE Queries

The PostgREST query for searching `tw_items` is slow because:

```sql
WHERE tw IS NOT NULL 
  AND tw <> '' 
  AND tw ILIKE '%pattern%'
LIMIT 100 OFFSET 0
```

### Root Causes

1. **Leading wildcard in ILIKE**: Patterns like `%pattern%` cannot use B-tree indexes efficiently
2. **Full table scan**: PostgreSQL must scan all rows to find matches
3. **Large OFFSET values**: Deep pagination requires scanning through many rows
4. **Multiple conditions**: Each filter condition adds overhead

## Solution: Trigram Indexes (GIN)

### What are Trigram Indexes?

Trigram indexes break text into 3-character sequences and create an index. This allows PostgreSQL to efficiently find rows containing substrings, even with leading wildcards.

**Example:**
- Text: "火焰"
- Trigrams: "火焰" → (positions tracked internally)

### Performance Improvement

- **Before**: Full table scan, ~500ms-2000ms for 42k rows
- **After**: Index scan, ~10ms-50ms for 42k rows
- **Speedup**: 10-100x faster

## Implementation

### Step 1: Run the Migration Script

Execute `optimize_search_indexes.sql` in Supabase SQL Editor:

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes
CREATE INDEX idx_tw_items_tw_trgm 
  ON tw_items USING gin(tw gin_trgm_ops);
```

### Step 2: Verify Index Usage

Check if PostgreSQL is using the index:

```sql
EXPLAIN ANALYZE
SELECT id, tw
FROM tw_items
WHERE tw IS NOT NULL 
  AND tw <> ''
  AND tw ILIKE '%火%'
LIMIT 100;
```

Look for `Bitmap Index Scan` or `Index Scan` in the output.

## Additional Optimizations

### 1. Partial Indexes

For queries that always filter `NULL` and empty strings, create a partial index:

```sql
CREATE INDEX idx_tw_items_tw_trgm_partial 
  ON tw_items USING gin(tw gin_trgm_ops)
  WHERE tw IS NOT NULL AND tw <> '';
```

**Benefits:**
- Smaller index size (only indexes non-null, non-empty values)
- Faster index scans
- Better query plan selection

### 2. Cursor-Based Pagination (Future Improvement)

Instead of `OFFSET`, use cursor-based pagination:

**Current (Slow):**
```sql
SELECT * FROM tw_items WHERE ... LIMIT 100 OFFSET 1000;
-- Must scan 1000 rows before returning results
```

**Better (Fast):**
```sql
SELECT * FROM tw_items 
WHERE ... AND id > 12345 
ORDER BY id 
LIMIT 100;
-- Uses index on id, very fast
```

**Implementation in Supabase:**
```javascript
// Instead of:
query.range(from, from + pageSize - 1)

// Use:
query.gt('id', lastId).order('id', { ascending: true }).limit(pageSize)
```

### 3. Query Rewriting

If possible, avoid leading wildcards when the pattern starts with known characters:

**Slow:**
```sql
WHERE tw ILIKE '%火%'
```

**Faster (if pattern doesn't need leading wildcard):**
```sql
WHERE tw ILIKE '火%'  -- Can use regular B-tree index
```

### 4. Limit Result Set Early

PostgREST queries can be optimized by:
- Using smaller page sizes (50-100 instead of 1000)
- Adding more selective WHERE conditions
- Using SELECT only needed columns

## Monitoring

### Check Index Usage

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE tablename = 'tw_items'
  AND indexname LIKE '%trgm%';
```

### Check Query Performance

Enable query logging in Supabase:
1. Go to Database → Logs
2. Filter by "slow queries"
3. Look for queries taking > 100ms

### Analyze Query Plans

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, tw
FROM tw_items
WHERE tw IS NOT NULL 
  AND tw <> ''
  AND tw ILIKE '%火%'
LIMIT 100;
```

Key metrics to watch:
- **Execution Time**: Should be < 50ms
- **Index Scan**: Should use `idx_tw_items_tw_trgm`
- **Rows Removed by Filter**: Should be low (< 10%)

## Troubleshooting

### Index Not Being Used

1. **Check statistics are up to date:**
   ```sql
   ANALYZE tw_items;
   ```

2. **Check index exists:**
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'tw_items';
   ```

3. **Force index usage (if needed):**
   ```sql
   SET enable_seqscan = off;
   -- Run query
   SET enable_seqscan = on;
   ```

### Still Slow After Index Creation

1. **Check table size:**
   ```sql
   SELECT pg_size_pretty(pg_total_relation_size('tw_items'));
   ```

2. **Check index size:**
   ```sql
   SELECT pg_size_pretty(pg_relation_size('idx_tw_items_tw_trgm'));
   ```

3. **Consider VACUUM:**
   ```sql
   VACUUM ANALYZE tw_items;
   ```

### High OFFSET Values

If queries with large OFFSET are still slow:

1. **Use cursor-based pagination** (see above)
2. **Limit maximum OFFSET** in application code
3. **Consider search result caching** for common queries

## Best Practices

1. ✅ **Always use trigram indexes** for ILIKE queries with wildcards
2. ✅ **Keep statistics updated** with ANALYZE or autovacuum
3. ✅ **Use partial indexes** when WHERE clauses are consistent
4. ✅ **Monitor index usage** regularly
5. ✅ **Use cursor-based pagination** for large result sets
6. ❌ **Avoid very large OFFSET values** (> 1000)
7. ❌ **Don't create too many indexes** (slows writes)
8. ❌ **Don't ignore query plans** - always EXPLAIN ANALYZE

## Expected Performance

After optimization:

- **Simple search** (1 word, < 1000 results): < 50ms
- **Complex search** (multiple words, fuzzy): < 200ms
- **Pagination** (first page): < 50ms
- **Pagination** (page 10, cursor-based): < 50ms
- **Pagination** (page 10, OFFSET-based): < 200ms

## Migration Checklist

- [ ] Run `optimize_search_indexes.sql` in Supabase SQL Editor
- [ ] Verify indexes created: `SELECT * FROM pg_indexes WHERE indexname LIKE '%trgm%'`
- [ ] Test query performance: `EXPLAIN ANALYZE SELECT ...`
- [ ] Monitor query logs for slow queries
- [ ] Update application code to use cursor-based pagination (optional)
- [ ] Document any custom query patterns

## JSONB Containment Query Optimization

### Problem: Slow `@>` Queries on `tw_recipes`

Queries using JSONB containment operator are slow:

```sql
SELECT * FROM tw_recipes
WHERE ingredients @> '[{"id": 123}]'
LIMIT 100 OFFSET 0;
```

### Root Cause

Without a GIN index on the JSONB column, PostgreSQL must:
1. Scan all rows
2. Parse JSONB for each row
3. Check containment manually

### Solution: GIN Index on JSONB Column

Create a GIN index on the `ingredients` JSONB column:

```sql
CREATE INDEX idx_tw_recipes_ingredients_gin 
  ON tw_recipes USING gin(ingredients);
```

### Performance Improvement

- **Before**: Full table scan + JSONB parsing, ~500ms-2000ms
- **After**: Index scan, ~10ms-50ms
- **Speedup**: 10-100x faster

### Verification

Test the query performance:

```sql
EXPLAIN ANALYZE
SELECT *
FROM tw_recipes
WHERE ingredients @> '[{"id": 123}]'
LIMIT 100;
```

Look for `Bitmap Index Scan` on `idx_tw_recipes_ingredients_gin` in the output.

### JSONB Query Patterns Supported

The GIN index supports these operators efficiently:
- `@>` - Contains (used in your query)
- `?` - Key exists
- `?&` - All keys exist
- `?|` - Any key exists
- `@?` - JSON path exists
- `@@` - JSON path query

## References

- [PostgreSQL pg_trgm Documentation](https://www.postgresql.org/docs/current/pgtrgm.html)
- [PostgreSQL JSONB Indexing](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)
- [Supabase Performance Guide](https://supabase.com/docs/guides/database/performance)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
