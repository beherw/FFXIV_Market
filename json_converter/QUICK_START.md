# Quick Start Guide - Supabase Sync

## 🚀 Quick Setup (5 minutes)

### Step 1: Add GitHub Secrets

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`
2. Click "New repository secret"
3. Add these two secrets:

   **Secret 1:**
   - Name: `SUPABASE_URL`
   - Value: `https://dojkqotccerymtnqnyfj.supabase.co`

   **Secret 2:**
   - Name: `SUPABASE_SERVICE_KEY`
   - Value: `sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5`

### Step 2: Create Tables in Supabase

1. Go to: https://supabase.com/dashboard/project/dojkqotccerymtnqnyfj
2. Click "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy the entire contents of `json_converter/create_tables.sql`
5. Paste and click "Run"
6. Wait for all tables to be created (should see "Success" message)

### Step 3: Push to GitHub

That's it! When you push to the `main` branch:

1. GitHub Actions will automatically:
   - Convert JSON files to CSV
   - Sync CSV data to Supabase tables
   - Update existing data or insert new data

2. Check the workflow status:
   - Go to "Actions" tab in GitHub
   - Click on the latest workflow run
   - See logs for sync progress

## 📋 Manual Test (Optional)

Test locally before pushing:

```bash
cd json_converter

# Set your Supabase credentials
export SUPABASE_URL="https://dojkqotccerymtnqnyfj.supabase.co"
export SUPABASE_SERVICE_KEY="sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5"

# Convert JSON to CSV
node json_to_csv.js

# Sync to Supabase
node sync_to_supabase.js
```

## 🔍 Verify Data

After sync, verify in Supabase:

1. Go to Supabase Dashboard → Table Editor
2. Select any table (e.g., `tw_items`)
3. You should see data rows
4. Check row counts match expected values

## ⚠️ Troubleshooting

### "Table does not exist" error
- Make sure you ran `create_tables.sql` in Supabase SQL Editor
- Check table names match exactly (case-sensitive)

### "Permission denied" error
- Verify you're using the **service role key** (starts with `sb_secret_`)
- Not the anon key (starts with `sb_publishable_`)

### Workflow not triggering
- Check that you're pushing to `main` branch
- Or manually trigger: Actions → Sync CSV to Supabase → Run workflow

### Large files timing out
- The script processes in batches
- GitHub Actions has 6-hour timeout
- Very large files (>10M rows) may need manual import

## 📊 What Gets Synced

The workflow syncs these 13 tables:
- `tw_items` - Item names (Traditional Chinese)
- `tw_item_descriptions` - Item descriptions
- `market_items` - Marketable item IDs
- `equipment` - Equipment data
- `ilvls` - Item levels
- `rarities` - Item rarities
- `item_patch` - Patch versions
- `patch_names` - Patch names
- `tw_recipes` - Crafting recipes
- `tw_item_ui_categories` - UI categories
- `ui_categories` - Category data
- `equip_slot_categories` - Equipment slots
- `tw_job_abbr` - Job abbreviations

## 🎯 Next Steps

After successful sync:
1. Update your application code to use Supabase API instead of JSON imports
2. Create API endpoints or use Supabase client in your app
3. Test that data loads correctly from Supabase

For more details, see `SETUP_SUPABASE.md`
