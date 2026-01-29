# ⚠️ IMPORTANT: Create Tables First!

## The Problem

Supabase's REST API **cannot create tables automatically**. Tables must be created before data can be inserted.

## Solution: One-Time Setup

**You MUST create the tables manually ONE TIME** before the sync will work.

### Step 1: Go to Supabase SQL Editor

1. Open: https://supabase.com/dashboard/project/dojkqotccerymtnqnyfj
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**

### Step 2: Run the SQL Script

1. Open `json_converter/create_tables.sql` in your editor
2. Copy **ALL** the SQL content
3. Paste into Supabase SQL Editor
4. Click **"Run"** (or press Ctrl+Enter)
5. Wait for "Success" message

### Step 3: Verify Tables Created

1. Go to **"Table Editor"** in Supabase
2. You should see all 13 tables listed:
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

### Step 4: Push to GitHub

After tables are created, push to GitHub and the sync will work!

## Why This Is Needed

Supabase's REST API (PostgREST) is designed for data operations (SELECT, INSERT, UPDATE, DELETE), not schema operations (CREATE TABLE). 

For security and architectural reasons, table creation must be done:
- Via SQL Editor (manual)
- Via Supabase CLI (requires additional setup)
- Via Management API (requires database password)

The sync script will **automatically insert/update data** once tables exist, but cannot create the tables themselves.

## After First Setup

Once tables are created, future pushes will:
- ✅ Automatically sync CSV data
- ✅ Update existing rows
- ✅ Insert new rows
- ✅ Handle all data operations automatically

You only need to create tables **once**!

## Troubleshooting

If you see "Could not find the table" errors:
- ✅ Tables haven't been created yet
- ✅ Run `create_tables.sql` in Supabase SQL Editor
- ✅ Verify tables exist in Table Editor
- ✅ Then push again

---

**TL;DR:** Run `create_tables.sql` in Supabase SQL Editor ONCE, then everything works automatically! 🚀
