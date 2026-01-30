-- Helper function to enable SQL execution via REST API
-- Run this ONCE in Supabase SQL Editor to enable automatic table creation
-- This creates a function that allows executing SQL via REST API

-- Enable pg_net extension (for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to execute SQL (for table creation)
-- Note: This requires superuser privileges, so it may not work on all Supabase plans
-- If this doesn't work, tables will need to be created manually

-- 1. Completely delete the old version of the function
DROP FUNCTION IF EXISTS exec_sql(text);

-- 2. Create the new version with the correct parameter name
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- 3. Re-apply the security restrictions
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM public;
REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM anon;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

-- Alternative: Create a simpler helper that uses DO blocks
-- This is safer and works on all Supabase plans
CREATE OR REPLACE FUNCTION create_table_if_not_exists(
  table_name text,
  columns_def text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I (%s)', table_name, columns_def);
END;
$$;

GRANT EXECUTE ON FUNCTION create_table_if_not_exists(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_table_if_not_exists(text, text) TO service_role;

-- Note: If the above functions don't work due to permissions,
-- you can still create tables manually using create_tables.sql
-- The sync script will detect existing tables and skip creation
