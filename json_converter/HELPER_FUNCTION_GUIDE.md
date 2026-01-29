# Helper Function Guide - Enable Automatic Table Creation

## What This Does

This creates helper functions in Supabase that allow the sync script to **automatically create tables** without manual SQL execution.

## Quick Setup (3 Steps)

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/dojkqotccerymtnqnyfj
2. Click **"SQL Editor"** (left sidebar)
3. Click **"New query"**

### Step 2: Run Helper Function SQL

1. Open file: `json_converter/create_helper_function.sql`
2. **Copy ALL** the SQL content
3. **Paste** into Supabase SQL Editor
4. Click **"Run"** (or Ctrl+Enter)

### Step 3: Verify Functions Created

Run this query to verify:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('exec_sql', 'create_table_if_not_exists');
```

You should see both functions listed.

## What Functions Are Created?

### 1. `exec_sql(query text)`
- Executes any SQL query
- Used for running CREATE TABLE statements
- Requires SECURITY DEFINER (runs with elevated privileges)

### 2. `create_table_if_not_exists(table_name, columns_def)`
- Creates a table if it doesn't exist
- Safer alternative to exec_sql
- Specifically designed for table creation

## How It Works

After creating these functions:

1. **Sync script runs** → Checks if tables exist
2. **Tables don't exist** → Calls helper function to create them
3. **Tables created** → Data sync proceeds automatically

## Security Notes

⚠️ **Important Security Information:**

- These functions use `SECURITY DEFINER` which means they run with elevated privileges
- Only grant execute permissions to trusted roles (service_role, authenticated)
- The functions are already configured to only allow service_role and authenticated users
- Never expose these functions to anonymous/public users

## Troubleshooting

### "Function already exists"
- ✅ This is fine! The `CREATE OR REPLACE` handles this
- Just run the SQL again - it will update the functions

### "Permission denied"
- Check that you're using the **service role key** in GitHub secrets
- Verify the functions were created successfully
- Check function permissions: `\df+ exec_sql` in psql

### "Tables still not created automatically"
- Verify functions exist (run the verification query above)
- Check sync script logs for specific error messages
- Functions may need to be created in the `public` schema

### "pg_net extension error"
- The `pg_net` extension is optional
- If it fails, the functions will still work for table creation
- You can skip the pg_net line if needed

## Alternative: Manual Table Creation

If helper functions don't work or you prefer manual control:

1. Skip `create_helper_function.sql`
2. Run `create_tables.sql` manually instead
3. Tables will be created once, then sync works automatically

## Testing

After creating helper functions, test with:

```sql
-- Test exec_sql function
SELECT exec_sql('SELECT 1');

-- Test create_table_if_not_exists
SELECT create_table_if_not_exists('test_table', 'id INTEGER PRIMARY KEY, name TEXT');
```

## Next Steps

After creating helper functions:

1. ✅ Push to GitHub
2. ✅ Workflow will automatically create tables if they don't exist
3. ✅ Data will sync automatically
4. ✅ No more manual SQL needed!

## Full Workflow

```
1. Create helper functions (ONE TIME) ← You are here
   ↓
2. Push to GitHub
   ↓
3. Workflow runs
   ↓
4. Script checks if tables exist
   ↓
5. If NO → Uses helper function to create tables automatically ✨
   ↓
6. Syncs CSV data to tables
   ↓
7. Done! ✅
```

---

**Note:** Helper functions are optional. You can also just run `create_tables.sql` manually once, and everything will work the same way!
