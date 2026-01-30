# JSON to CSV Converter & Supabase Sync

This directory contains tools to convert JSON data files to CSV format and automatically sync them to Supabase.

## Quick Start

### 1. Setup GitHub Secrets (One-time)

Go to: `https://github.com/YOUR_REPO/settings/secrets/actions`

Add:
- `SUPABASE_URL`: `https://dojkqotccerymtnqnyfj.supabase.co`
- `SUPABASE_SERVICE_KEY`: `sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5`

### 2. Setup Helper Function (One-time)

Run `sql/create_helper_function.sql` in Supabase SQL Editor to enable automatic table creation.

### 3. Push to GitHub

That's it! The workflow will:
- Convert JSON → CSV
- Create tables automatically
- Sync CSV data to Supabase

## Files

### Core Scripts
- `json_list.txt` - List of JSON files to convert
- `json_to_csv.js` - Converts JSON files to CSV
- `sync_smart.js` - Smart sync script (creates tables + syncs data)

### SQL Files (in `sql/` directory)
- `sql/create_helper_function.sql` - **Required (one-time)** - Helper function for auto table creation
- `sql/create_tables.sql` - **Optional** - SQL to create tables manually (fallback if auto-creation fails)
- `sql/optimize_database_indexes.sql` - **Optional** - Creates composite indexes for better query performance
- `sql/optimize_search_indexes.sql` - **Optional** - Creates trigram indexes for fast text search (ILIKE queries)
- `sql/verify_indexes.sql` - **Optional** - Diagnostic script to verify indexes are created and being used

### Output
- `csv_output/` - Generated CSV files (gitignored, auto-generated)

## How It Works

```
Push to GitHub
    ↓
GitHub Actions triggers
    ↓
Convert JSON → CSV (json_to_csv.js)
    ↓
Sync CSV → Supabase (sync_smart.js)
    - Creates tables automatically using exec_sql helper
    - Infers column types from CSV data
    - Syncs data in chunks
    ↓
Done! ✅
```

## Manual Usage

### Convert JSON to CSV
```bash
cd json_converter
node json_to_csv.js
```

### Sync to Supabase (Local Test)
```bash
export SUPABASE_URL="https://dojkqotccerymtnqnyfj.supabase.co"
export SUPABASE_SERVICE_KEY="sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5"
node sync_smart.js
```

## Adding New JSON Files

1. Add entry to `json_list.txt`:
   ```
   path/to/file.json|table_name|structure_type|description
   ```
2. Push to GitHub - workflow handles the rest!

## Structure Types

- `array` - Simple array `[1, 2, 3]`
- `object_simple` - Key-value `{ "id": value }`
- `object_nested` - Nested `{ "id": { "tw": "name" } }`
- `object_complex` - Complex with arrays
- `array_of_objects` - Array of objects

## Troubleshooting

**"Table does not exist" errors:**
- Run `sql/create_helper_function.sql` in Supabase SQL Editor
- Or run `sql/create_tables.sql` manually once

**"Helper function not found":**
- Verify `exec_sql` function exists in Supabase
- Check function uses `sql_query` parameter name

**CSV parsing errors:**
- Check CSV files for malformed data
- Verify JSON structure matches structure_type

## Notes

- Tables are created automatically using `exec_sql` helper function
- Column types are inferred from CSV data (INTEGER, TEXT, JSONB, etc.)
- Large files are processed in chunks (500 rows)
- CSV files are regenerated on each push
