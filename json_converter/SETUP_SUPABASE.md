# Supabase Setup Instructions

## 1. Set Up GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

- **Name:** `SUPABASE_URL`
  **Value:** `https://dojkqotccerymtnqnyfj.supabase.co`

- **Name:** `SUPABASE_SERVICE_KEY`
  **Value:** `sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5`

⚠️ **Important:** The service key has admin privileges. Keep it secret!

## 2. Create Tables in Supabase

Before the first sync, you need to create the tables manually:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Copy and paste the contents of `create_tables.sql`
5. Run the SQL script

Alternatively, you can create tables one by one using the Table Editor, but the SQL script is faster.

## 3. Enable Required Extensions (Optional)

If you want to use the SQL execution feature, you may need to enable the `pg_net` extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

However, the sync script will work even without this - it will just warn if tables don't exist and you'll need to create them manually.

## 4. Test the Sync Locally

Before pushing to GitHub, test locally:

```bash
cd json_converter

# Set environment variables
export SUPABASE_URL="https://dojkqotccerymtnqnyfj.supabase.co"
export SUPABASE_SERVICE_KEY="sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5"

# Convert JSON to CSV (if not already done)
node json_to_csv.js

# Sync to Supabase
node sync_to_supabase.js
```

## 5. How It Works

When you push to GitHub:

1. **GitHub Actions triggers** on push to `main` branch
2. **Converts JSON to CSV** using `json_to_csv.js`
3. **Syncs CSV to Supabase** using `sync_to_supabase.js`:
   - Checks if tables exist
   - Creates tables if needed (may require manual setup first)
   - Upserts CSV data to Supabase tables
   - Processes data in batches for large files

## 6. Troubleshooting

### Tables not being created automatically

The script tries to create tables automatically, but Supabase's REST API has limitations. If tables aren't created:

1. Run `create_tables.sql` manually in Supabase SQL Editor
2. The sync will then work for data insertion/updates

### Permission errors

Make sure you're using the **service role key** (starts with `sb_secret_`), not the anon key. The service key has admin privileges needed for table operations.

### Large file timeouts

If large CSV files timeout:
- The script processes in batches of 1000 rows
- GitHub Actions has a 6-hour timeout limit
- For very large files, consider splitting or using Supabase's bulk import feature

### Data type mismatches

If you see data type errors:
- Check the table schema matches the CSV structure
- JSONB columns should contain valid JSON strings
- Integer columns should contain numeric values

## 7. Manual Import Alternative

If the automated sync doesn't work, you can manually import CSV files:

1. Go to Supabase Dashboard → Table Editor
2. Select a table
3. Click "Import" → "Import CSV"
4. Upload the CSV file from `csv_output/` directory

## 8. Monitoring

Check GitHub Actions logs to see:
- Which files were processed
- How many rows were synced
- Any errors that occurred

The workflow runs automatically on push, or you can trigger it manually via "Actions" → "Sync CSV to Supabase" → "Run workflow".
