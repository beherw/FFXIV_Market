-- Supabase Table Creation Scripts
-- Run these SQL statements in Supabase SQL Editor before importing CSV files
-- After creating tables, import the corresponding CSV files from csv_output/

-- ============================================================================
-- ITEM DATA TABLES
-- ============================================================================

-- Traditional Chinese item names
CREATE TABLE IF NOT EXISTS tw_items (
  id INTEGER PRIMARY KEY,
  tw TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tw_items_id ON tw_items(id);

-- Traditional Chinese item descriptions
CREATE TABLE IF NOT EXISTS tw_item_descriptions (
  id INTEGER PRIMARY KEY,
  tw TEXT
);
CREATE INDEX IF NOT EXISTS idx_tw_item_descriptions_id ON tw_item_descriptions(id);

-- Marketable items list (simple array converted to table)
CREATE TABLE IF NOT EXISTS market_items (
  id INTEGER PRIMARY KEY
);
CREATE INDEX IF NOT EXISTS idx_market_items_id ON market_items(id);

-- Equipment data (complex structure with JSONB for arrays)
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY,
  equipSlotCategory INTEGER,
  level INTEGER,
  unique INTEGER,
  jobs JSONB,  -- Array stored as JSONB
  pDmg INTEGER,
  mDmg INTEGER,
  pDef INTEGER,
  mDef INTEGER,
  delay INTEGER
);
CREATE INDEX IF NOT EXISTS idx_equipment_id ON equipment(id);
CREATE INDEX IF NOT EXISTS idx_equipment_level ON equipment(level);
CREATE INDEX IF NOT EXISTS idx_equipment_equipSlotCategory ON equipment(equipSlotCategory);

-- Item levels
CREATE TABLE IF NOT EXISTS ilvls (
  id INTEGER PRIMARY KEY,
  value INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ilvls_id ON ilvls(id);
CREATE INDEX IF NOT EXISTS idx_ilvls_value ON ilvls(value);

-- Item rarities
CREATE TABLE IF NOT EXISTS rarities (
  id INTEGER PRIMARY KEY,
  value INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rarities_id ON rarities(id);

-- Item patch versions
CREATE TABLE IF NOT EXISTS item_patch (
  id INTEGER PRIMARY KEY,
  value INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_patch_id ON item_patch(id);
CREATE INDEX IF NOT EXISTS idx_item_patch_value ON item_patch(value);

-- Patch names
CREATE TABLE IF NOT EXISTS patch_names (
  id INTEGER PRIMARY KEY,
  name TEXT
);
CREATE INDEX IF NOT EXISTS idx_patch_names_id ON patch_names(id);

-- ============================================================================
-- RECIPE DATA TABLES
-- ============================================================================

-- Traditional Chinese recipes (complex structure with nested arrays)
CREATE TABLE IF NOT EXISTS tw_recipes (
  id INTEGER PRIMARY KEY,
  job INTEGER,
  lvl INTEGER,
  yields INTEGER,
  result INTEGER,
  stars INTEGER,
  qs BOOLEAN,
  hq BOOLEAN,
  durability INTEGER,
  quality INTEGER,
  progress INTEGER,
  suggestedControl INTEGER,
  suggestedCraftsmanship INTEGER,
  controlReq INTEGER,
  craftsmanshipReq INTEGER,
  rlvl INTEGER,
  ingredients JSONB,  -- Array of ingredient objects stored as JSONB
  unlocks INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tw_recipes_id ON tw_recipes(id);
CREATE INDEX IF NOT EXISTS idx_tw_recipes_result ON tw_recipes(result);
CREATE INDEX IF NOT EXISTS idx_tw_recipes_job ON tw_recipes(job);
CREATE INDEX IF NOT EXISTS idx_tw_recipes_lvl ON tw_recipes(lvl);

-- ============================================================================
-- CATEGORY/UI DATA TABLES
-- ============================================================================

-- Traditional Chinese UI category names
CREATE TABLE IF NOT EXISTS tw_item_ui_categories (
  id INTEGER PRIMARY KEY,
  tw TEXT
);
CREATE INDEX IF NOT EXISTS idx_tw_item_ui_categories_id ON tw_item_ui_categories(id);

-- UI categories (complex structure)
CREATE TABLE IF NOT EXISTS ui_categories (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category INTEGER,
  job INTEGER,
  order INTEGER,
  data JSONB  -- Additional nested data stored as JSONB
);
CREATE INDEX IF NOT EXISTS idx_ui_categories_id ON ui_categories(id);
CREATE INDEX IF NOT EXISTS idx_ui_categories_category ON ui_categories(category);
CREATE INDEX IF NOT EXISTS idx_ui_categories_job ON ui_categories(job);

-- Equipment slot categories
CREATE TABLE IF NOT EXISTS equip_slot_categories (
  id INTEGER PRIMARY KEY,
  data JSONB  -- Complex nested structure stored as JSONB
);
CREATE INDEX IF NOT EXISTS idx_equip_slot_categories_id ON equip_slot_categories(id);

-- ============================================================================
-- JOB DATA TABLES
-- ============================================================================

-- Traditional Chinese job abbreviations
CREATE TABLE IF NOT EXISTS tw_job_abbr (
  id INTEGER PRIMARY KEY,
  tw TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tw_job_abbr_id ON tw_job_abbr(id);

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. After creating tables, import CSV files from csv_output/ directory
-- 2. For columns with JSONB type, Supabase will automatically parse JSON strings from CSV
-- 3. Consider adding Row Level Security (RLS) policies if needed
-- 4. You may want to add foreign key constraints between related tables
-- 5. For large tables, consider partitioning or additional indexes based on query patterns
