# Simple Solution: Create Tables Once

## The Problem

Supabase REST API **cannot create tables**. This is a security/architectural limitation.

## The Solution (2 minutes)

**Create tables manually ONE TIME**, then everything works automatically forever.

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/dojkqotccerymtnqnyfj
2. Click **"SQL Editor"** (left sidebar)
3. Click **"New query"**

### Step 2: Copy & Paste SQL

1. Open file: `json_converter/create_tables.sql`
2. **Select ALL** (Ctrl+A / Cmd+A)
3. **Copy** (Ctrl+C / Cmd+C)
4. **Paste** into Supabase SQL Editor
5. Click **"Run"** button (or Ctrl+Enter)

### Step 3: Wait for Success

You should see: ✅ "Success. No rows returned"

### Step 4: Verify

1. Click **"Table Editor"** (left sidebar)
2. You should see 13 tables:
   - tw_items
   - tw_item_descriptions
   - market_items
   - equipment
   - ilvls
   - rarities
   - item_patch
   - patch_names
   - tw_recipes
   - tw_item_ui_categories
   - ui_categories
   - equip_slot_categories
   - tw_job_abbr

### Step 5: Push to GitHub

After tables exist, push to GitHub and the sync will work! 🎉

## That's It!

- ✅ Tables created once
- ✅ Future pushes sync automatically
- ✅ No more manual steps needed

## Why This Is Needed

Supabase's REST API (PostgREST) is designed for **data operations** (SELECT, INSERT, UPDATE), not **schema operations** (CREATE TABLE).

For security reasons, table creation must be done via:
- SQL Editor (what we're doing)
- Supabase CLI (requires extra setup)
- Management API (requires database password)

## Troubleshooting

**"Tables still don't exist"**
- Make sure you ran the SQL in SQL Editor
- Check Table Editor to verify
- Refresh the page

**"Still getting errors"**
- Verify all 13 tables exist in Table Editor
- Check table names match exactly (case-sensitive)
- Try running the SQL again (IF NOT EXISTS is safe)

---

**TL;DR:** Run `create_tables.sql` in Supabase SQL Editor ONCE, then everything works! 🚀
