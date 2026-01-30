-- ============================================================================
-- SYSTEM CATALOG PERFORMANCE DIAGNOSTIC SCRIPT
-- ============================================================================
-- Diagnose why pg_timezone_names and other system catalog queries are slow
-- ============================================================================

-- ============================================================================
-- 1. TEST pg_timezone_names PERFORMANCE
-- ============================================================================
\timing on

-- First run (cold cache)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT name FROM pg_timezone_names;

-- Second run (warm cache)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT name FROM pg_timezone_names;

\timing off

-- ============================================================================
-- 2. CHECK DATABASE CONNECTION AND NETWORK LATENCY
-- ============================================================================
-- Check if you're connecting to a remote database
SELECT 
  current_database() as database_name,
  inet_server_addr() as server_address,
  inet_server_port() as server_port,
  inet_client_addr() as client_address,
  inet_client_port() as client_port;

-- Test round-trip time
\timing on
SELECT 1;
\timing off

-- ============================================================================
-- 3. CHECK DATABASE SERVER RESOURCES
-- ============================================================================
-- Check active connections and locks
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting_connections
FROM pg_stat_activity
WHERE datname = current_database();

-- Check for blocking locks
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ============================================================================
-- 4. CHECK SYSTEM CATALOG CACHE STATISTICS
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  heap_blks_read,
  heap_blks_hit,
  CASE 
    WHEN heap_blks_hit + heap_blks_read = 0 THEN 0
    ELSE round(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read), 2)
  END as cache_hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'pg_catalog'
ORDER BY heap_blks_read + heap_blks_hit DESC
LIMIT 20;

-- ============================================================================
-- 5. CHECK DATABASE SIZE AND BLOAT
-- ============================================================================
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))) as total_table_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema');

-- ============================================================================
-- 6. CHECK POSTGRESQL VERSION AND CONFIGURATION
-- ============================================================================
SELECT 
  version() as postgresql_version,
  current_setting('shared_buffers') as shared_buffers,
  current_setting('effective_cache_size') as effective_cache_size,
  current_setting('work_mem') as work_mem,
  current_setting('maintenance_work_mem') as maintenance_work_mem;

-- ============================================================================
-- 7. COMPARE WITH OTHER SYSTEM CATALOG QUERIES
-- ============================================================================
\timing on

-- Test other simple system catalog queries
SELECT count(*) FROM pg_timezone_names;
SELECT count(*) FROM pg_database;
SELECT count(*) FROM pg_namespace;
SELECT count(*) FROM pg_tables;

\timing off

-- ============================================================================
-- 8. CHECK FOR CORRUPTED SYSTEM CATALOGS
-- ============================================================================
-- Run VACUUM ANALYZE on system catalogs (requires superuser)
-- VACUUM ANALYZE pg_catalog.pg_timezone_names;

-- Check for errors in PostgreSQL logs
-- (This requires checking log files manually)

-- ============================================================================
-- 9. DETAILED EXPLAIN FOR pg_timezone_names
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, COSTS, TIMING)
SELECT name FROM pg_timezone_names
ORDER BY name;

-- ============================================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================================
-- Common causes of slow pg_timezone_names:
-- 
-- 1. REMOTE DATABASE CONNECTION
--    - High network latency
--    - Solution: Use connection pooling, move closer to database, or use local DB
--
-- 2. FIRST-TIME ACCESS (COLD CACHE)
--    - First query loads data into cache
--    - Solution: This is normal, subsequent queries should be faster
--
-- 3. DATABASE SERVER RESOURCE CONTENTION
--    - High CPU usage, memory pressure, I/O wait
--    - Solution: Check server resources, optimize other queries
--
-- 4. LOCK CONTENTION
--    - Other queries holding locks
--    - Solution: Identify and resolve blocking queries
--
-- 5. CORRUPTED SYSTEM CATALOGS
--    - Rare but possible
--    - Solution: Run VACUUM ANALYZE on system catalogs (requires superuser)
--
-- 6. CONNECTION POOLING ISSUES
--    - Connection pooler overhead
--    - Solution: Check pooler configuration, consider direct connection for diagnostics
--
-- EXPECTED PERFORMANCE:
-- - Local database: < 10ms
-- - Remote database (low latency): < 50ms
-- - Remote database (high latency): < 200ms
-- - Your current: 175ms - 1008ms (ABNORMAL)
