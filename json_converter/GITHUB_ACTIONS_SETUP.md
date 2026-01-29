# GitHub Actions Setup Complete ✅

## What Was Created

### 1. GitHub Actions Workflow
**File:** `.github/workflows/sync-supabase.yml`

This workflow automatically:
- Triggers on push to `main` branch (when JSON files change)
- Converts JSON files to CSV
- Syncs CSV data to Supabase tables
- Can be manually triggered via "Actions" tab

### 2. Supabase Sync Script
**File:** `json_converter/sync_to_supabase.js`

Script that:
- Reads CSV files from `csv_output/` directory
- Checks if Supabase tables exist
- Upserts data to Supabase (updates existing, inserts new)
- Processes large files in batches
- Provides detailed progress logs

### 3. Documentation Files
- `QUICK_START.md` - 5-minute setup guide
- `SETUP_SUPABASE.md` - Detailed setup instructions
- `README.md` - General usage information

## Required Setup Steps

### ⚠️ IMPORTANT: You Must Do These Steps

1. **Add GitHub Secrets** (Required)
   - Go to: `https://github.com/YOUR_REPO/settings/secrets/actions`
   - Add `SUPABASE_URL`: `https://dojkqotccerymtnqnyfj.supabase.co`
   - Add `SUPABASE_SERVICE_KEY`: `sb_secret_Lpd3cK-AMqwfBYYaWakH8w_QRQ3f8w5`

2. **Create Tables in Supabase** (Required - First Time Only)
   - Go to Supabase Dashboard → SQL Editor
   - Run `create_tables.sql` to create all tables
   - Without this, the sync will fail

3. **Push to GitHub** (That's it!)
   - Push any changes to `main` branch
   - Workflow will run automatically
   - Check "Actions" tab to see progress

## How It Works

```
Push to GitHub (main branch)
    ↓
GitHub Actions triggers
    ↓
Convert JSON → CSV (json_to_csv.js)
    ↓
Sync CSV → Supabase (sync_to_supabase.js)
    ↓
Data is now in Supabase! ✅
```

## Workflow Details

**Trigger Conditions:**
- Push to `main` branch
- Changes in `json_converter/**` or `teamcraft_git/libs/data/src/lib/json/**`
- Manual trigger via GitHub Actions UI

**What It Does:**
1. Checks out code (including submodules)
2. Sets up Node.js 20
3. Installs npm dependencies
4. Converts JSON files to CSV
5. Installs Supabase client
6. Syncs CSV files to Supabase

**Processing:**
- Processes CSV files in batches of 1000 rows
- Uses upsert (update if exists, insert if new)
- Handles large files automatically
- Provides progress updates

## Monitoring

**Check Workflow Status:**
1. Go to GitHub repository
2. Click "Actions" tab
3. See "Sync CSV to Supabase" workflow
4. Click on latest run to see logs

**What to Look For:**
- ✅ Green checkmark = Success
- ❌ Red X = Failed (check logs)
- 🟡 Yellow circle = In progress

**Log Output Shows:**
- Which CSV files are being processed
- How many rows are being synced
- Progress updates for large files
- Any errors that occur

## Troubleshooting

### Workflow Not Running
- Check you're pushing to `main` branch
- Verify workflow file exists: `.github/workflows/sync-supabase.yml`
- Check GitHub Actions is enabled for your repo

### Sync Failing
- Verify GitHub secrets are set correctly
- Check tables exist in Supabase (run `create_tables.sql`)
- Review workflow logs for specific errors

### Tables Not Found
- Run `create_tables.sql` in Supabase SQL Editor
- Verify table names match exactly
- Check Supabase project URL is correct

## Security Notes

⚠️ **Important Security Information:**

- The `SUPABASE_SERVICE_KEY` has **admin privileges**
- Never commit this key to your repository
- Only store it in GitHub Secrets
- The key can read/write all data in your Supabase project
- Keep it secure!

## Next Steps After Setup

1. ✅ Add GitHub secrets
2. ✅ Create tables in Supabase
3. ✅ Push to GitHub to test
4. ✅ Verify data in Supabase dashboard
5. 🔄 Update application code to use Supabase API
6. 🔄 Remove JSON imports from codebase
7. 🔄 Deploy updated application

## Files Reference

```
json_converter/
├── json_list.txt              # List of JSON files
├── json_to_csv.js             # JSON → CSV converter
├── sync_to_supabase.js        # CSV → Supabase sync script
├── create_tables.sql          # SQL to create tables
├── QUICK_START.md            # Quick setup guide
├── SETUP_SUPABASE.md         # Detailed setup
├── README.md                 # General documentation
└── csv_output/               # Generated CSV files (gitignored)

.github/workflows/
└── sync-supabase.yml        # GitHub Actions workflow
```

## Support

If you encounter issues:
1. Check workflow logs in GitHub Actions
2. Review `SETUP_SUPABASE.md` for detailed troubleshooting
3. Verify Supabase dashboard shows tables and data
4. Test sync script locally first

---

**Status:** ✅ Ready to use after adding GitHub secrets and creating tables!
