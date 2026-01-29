# JSON to CSV Conversion Summary

## ✅ Conversion Complete

All 13 JSON files have been successfully converted to CSV format.

## Generated Files

### CSV Files (in `csv_output/` directory)

| CSV File | Size | Source JSON | Table Name |
|----------|------|-------------|------------|
| tw_recipes.csv | 3.7 MB | tw-recipes.json (11 MB) | tw_recipes |
| equipment.csv | 2.0 MB | equipment.json (6.2 MB) | equipment |
| tw_item_descriptions.csv | 1.7 MB | tw-item-descriptions.json (2.1 MB) | tw_item_descriptions |
| tw_items.csv | 1.1 MB | tw-items.json (2.1 MB) | tw_items |
| ilvls.csv | 448 KB | ilvls.json (748 KB) | ilvls |
| item_patch.csv | 416 KB | item-patch.json (696 KB) | item_patch |
| rarities.csv | 388 KB | rarities.json (688 KB) | rarities |
| ui_categories.csv | 288 KB | ui-categories.json (732 KB) | ui_categories |
| market_items.csv | 96 KB | market-items.json (144 KB) | market_items |
| patch_names.csv | 16 KB | patch-names.json (32 KB) | patch_names |
| tw_job_abbr.csv | 4 KB | tw-job-abbr.json (4 KB) | tw_job_abbr |
| tw_item_ui_categories.csv | 4 KB | tw-item-ui-categories.json (8 KB) | tw_item_ui_categories |
| equip_slot_categories.csv | 4 KB | equip-slot-categories.json (8 KB) | equip_slot_categories |

**Total CSV size:** ~10.5 MB (compressed from ~25-30 MB JSON)

## Next Steps

### 1. Create Tables in Supabase

Run the SQL script `create_tables.sql` in your Supabase SQL Editor to create all necessary tables with proper indexes.

### 2. Import CSV Files

1. Go to Supabase Dashboard → Table Editor
2. Select each table
3. Click "Import" → "Import CSV"
4. Upload the corresponding CSV file from `csv_output/` directory

**Import Order Recommendation:**
1. Start with smaller tables (patch_names, tw_job_abbr, etc.)
2. Then medium tables (market_items, ilvls, rarities, etc.)
3. Finally large tables (tw_items, tw_item_descriptions, equipment, tw_recipes)

### 3. Verify Data

After importing, verify:
- Row counts match expected values
- Primary keys are set correctly
- JSONB columns contain valid JSON
- Indexes are created and working

### 4. Test Queries

Test some sample queries to ensure data is accessible:

```sql
-- Get item name
SELECT tw FROM tw_items WHERE id = 1;

-- Get equipment data
SELECT * FROM equipment WHERE id = 1602;

-- Get recipes for an item
SELECT * FROM tw_recipes WHERE result = 5056;

-- Check marketable items
SELECT COUNT(*) FROM market_items;
```

## File Structure

```
json_converter/
├── json_list.txt              # List of JSON files to convert
├── json_to_csv.js             # Conversion script
├── create_tables.sql          # SQL for creating Supabase tables
├── README.md                  # Usage instructions
├── CONVERSION_SUMMARY.md      # This file
└── csv_output/               # Generated CSV files
    ├── tw_items.csv
    ├── tw_item_descriptions.csv
    ├── market_items.csv
    ├── equipment.csv
    ├── ilvls.csv
    ├── rarities.csv
    ├── item_patch.csv
    ├── patch_names.csv
    ├── tw_recipes.csv
    ├── tw_item_ui_categories.csv
    ├── ui_categories.csv
    ├── equip_slot_categories.csv
    └── tw_job_abbr.csv
```

## Notes

- CSV files use UTF-8 encoding (important for Traditional Chinese characters)
- Arrays and nested objects are stored as JSON strings (will be imported as JSONB in Supabase)
- All CSV files include headers
- Special characters (commas, quotes, newlines) are properly escaped
- The `id` column in most tables corresponds to the item/job/category ID

## Troubleshooting

If import fails:
1. Check CSV file encoding (should be UTF-8)
2. Verify table structure matches CSV headers
3. Ensure primary key constraints are correct
4. For JSONB columns, verify JSON strings are valid
5. Check Supabase import logs for specific errors
