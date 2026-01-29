# Automatic Table Creation

## How It Works

The sync script **automatically creates tables** if they don't exist! Here's how:

### Method 1: Dynamic Table Creation (Default - Works Now!)

The script automatically:
1. ✅ Checks if each table exists
2. ✅ If not, creates it using the CSV structure
3. ✅ Infers column types from CSV data
4. ✅ Creates indexes automatically

**No manual setup needed!** Just run the sync script and it will create tables as needed.

### Method 2: Helper Function (Optional - For Full SQL Support)

For even better auto-creation, you can optionally run `create_helper_function.sql` **once** in Supabase SQL Editor. This enables:
- Full SQL execution support
- Automatic index creation
- Better error handling

## Quick Start (No Manual Table Creation!)

**You don't need to create tables manually!** Just:

1. ✅ Add GitHub secrets (you already did this)
2. ✅ Push to GitHub
3. ✅ The workflow will automatically create all tables

That's it! The script detects missing tables and creates them automatically.

## How Table Creation Works

When the sync script runs:

```
For each CSV file:
  1. Check if table exists
  2. If NO:
     → Create table with columns from CSV headers
     → Infer data types (INTEGER, TEXT, JSONB, etc.)
     → Set 'id' as PRIMARY KEY if present
     → Create indexes
  3. If YES:
     → Skip creation, proceed to data sync
  4. Upsert CSV data to table
```

## Example

When processing `tw_items.csv`:

```csv
id,tw
1,Gil
2,火之碎晶
```

The script automatically creates:

```sql
CREATE TABLE IF NOT EXISTS tw_items (
  id INTEGER PRIMARY KEY,
  tw TEXT NOT NULL
);
CREATE INDEX idx_tw_items_id ON tw_items(id);
```

## Optional: Enable Helper Functions

If you want even more control, run this **once** in Supabase SQL Editor:

```sql
-- Run create_helper_function.sql
```

This enables:
- Full SQL execution via REST API
- Better error messages
- Automatic index creation for all tables

But it's **optional** - the script works without it!

## Troubleshooting

### "Table does not exist" error

This should not happen with auto-creation, but if it does:
1. Check Supabase logs for creation errors
2. Verify service key has proper permissions
3. Run `create_tables.sql` manually as fallback

### Tables created but no data

- Check sync logs for data insertion errors
- Verify CSV files are valid
- Check Supabase table permissions

### Permission errors

- Ensure you're using **service role key** (starts with `sb_secret_`)
- Not the anon key (starts with `sb_publishable_`)

## Summary

✅ **Automatic table creation is enabled by default**
✅ **No manual setup needed**
✅ **Just push to GitHub and it works!**

The script is smart enough to:
- Detect missing tables
- Create them automatically
- Handle different data types
- Create indexes
- Sync data

You're all set! 🚀
