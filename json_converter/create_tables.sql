-- Supabase Table Creation Scripts
-- Run these SQL statements in Supabase SQL Editor before importing CSV files
-- After creating tables, import the corresponding CSV files from csv_output/
--
-- NEW SEARCH LOGIC:
-- User input >> search TW (Traditional Chinese) strict then fuzzy
-- User input >> search CN (Simplified Chinese) strict then fuzzy
-- User input >> search EN (English) strict then fuzzy
-- User input >> search JA (Japanese) strict then fuzzy
-- User input >> search KO (Korean) strict then fuzzy
-- User input >> search DE (German) strict then fuzzy
-- User input >> search FR (French) strict then fuzzy
-- User input >> search other languages (if available)...

-- ============================================================================
-- ITEM NAME TABLES (for search - one per language)
-- ============================================================================

-- Traditional Chinese item names (TW)
CREATE TABLE IF NOT EXISTS tw_items (
  id INTEGER PRIMARY KEY,
  tw TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tw_items_id ON tw_items(id);
CREATE INDEX IF NOT EXISTS idx_tw_items_tw ON tw_items(tw);  -- For text search

-- Simplified Chinese item names (CN/ZH)
CREATE TABLE IF NOT EXISTS cn_items (
  id INTEGER PRIMARY KEY,
  zh TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cn_items_id ON cn_items(id);
CREATE INDEX IF NOT EXISTS idx_cn_items_zh ON cn_items(zh);  -- For text search

-- Korean item names (KO)
CREATE TABLE IF NOT EXISTS ko_items (
  id INTEGER PRIMARY KEY,
  ko TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ko_items_id ON ko_items(id);
CREATE INDEX IF NOT EXISTS idx_ko_items_ko ON ko_items(ko);  -- For text search

-- English item names (EN) - from items.json
-- Note: Some items may not have all languages, so allow NULL
CREATE TABLE IF NOT EXISTS en_items (
  id INTEGER PRIMARY KEY,
  en TEXT
);
CREATE INDEX IF NOT EXISTS idx_en_items_id ON en_items(id);
CREATE INDEX IF NOT EXISTS idx_en_items_en ON en_items(en);  -- For text search

-- Japanese item names (JA) - from items.json
-- Note: Some items may not have all languages, so allow NULL
CREATE TABLE IF NOT EXISTS ja_items (
  id INTEGER PRIMARY KEY,
  ja TEXT
);
CREATE INDEX IF NOT EXISTS idx_ja_items_id ON ja_items(id);
CREATE INDEX IF NOT EXISTS idx_ja_items_ja ON ja_items(ja);  -- For text search

-- German item names (DE) - from items.json
-- Note: Some items may not have all languages, so allow NULL
CREATE TABLE IF NOT EXISTS de_items (
  id INTEGER PRIMARY KEY,
  de TEXT
);
CREATE INDEX IF NOT EXISTS idx_de_items_id ON de_items(id);
CREATE INDEX IF NOT EXISTS idx_de_items_de ON de_items(de);  -- For text search

-- French item names (FR) - from items.json
-- Note: Some items may not have all languages, so allow NULL
CREATE TABLE IF NOT EXISTS fr_items (
  id INTEGER PRIMARY KEY,
  fr TEXT
);
CREATE INDEX IF NOT EXISTS idx_fr_items_id ON fr_items(id);
CREATE INDEX IF NOT EXISTS idx_fr_items_fr ON fr_items(fr);  -- For text search

-- Traditional Chinese item descriptions (for display)
CREATE TABLE IF NOT EXISTS tw_item_descriptions (
  id INTEGER PRIMARY KEY,
  tw TEXT
);
CREATE INDEX IF NOT EXISTS idx_tw_item_descriptions_id ON tw_item_descriptions(id);

-- ============================================================================
-- SHARED ITEM DATA TABLES (use item ID, shared across all languages)
-- ============================================================================

-- Marketable items list (simple array converted to table)
CREATE TABLE IF NOT EXISTS market_items (
  id INTEGER PRIMARY KEY
);
CREATE INDEX IF NOT EXISTS idx_market_items_id ON market_items(id);

-- Equipment data (complex structure with JSONB for arrays)
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY,
  "equipSlotCategory" INTEGER,
  level INTEGER,
  "unique" INTEGER,
  jobs JSONB,  -- Array stored as JSONB
  "pDmg" INTEGER,
  "mDmg" INTEGER,
  "pDef" INTEGER,
  "mDef" INTEGER,
  delay INTEGER
);
CREATE INDEX IF NOT EXISTS idx_equipment_id ON equipment(id);
CREATE INDEX IF NOT EXISTS idx_equipment_level ON equipment(level);
CREATE INDEX IF NOT EXISTS idx_equipment_equipSlotCategory ON equipment("equipSlotCategory");

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
  "suggestedControl" INTEGER,
  "suggestedCraftsmanship" INTEGER,
  "controlReq" INTEGER,
  "craftsmanshipReq" INTEGER,
  rlvl INTEGER,
  ingredients JSONB,  -- Array of ingredient objects stored as JSONB
  "progressDivider" INTEGER,
  "qualityDivider" INTEGER,
  "progressModifier" INTEGER,
  "qualityModifier" INTEGER,
  expert INTEGER,
  "conditionsFlag" INTEGER
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
  "order" INTEGER,
  data JSONB  -- Additional nested data stored as JSONB
);
CREATE INDEX IF NOT EXISTS idx_ui_categories_id ON ui_categories(id);
CREATE INDEX IF NOT EXISTS idx_ui_categories_category ON ui_categories(category);
CREATE INDEX IF NOT EXISTS idx_ui_categories_job ON ui_categories(job);

-- Equipment slot categories
CREATE TABLE IF NOT EXISTS equip_slot_categories (
  id INTEGER PRIMARY KEY,
  "MainHand" INTEGER,
  "OffHand" INTEGER,
  "Head" INTEGER,
  "Body" INTEGER,
  "Gloves" INTEGER,
  "Waist" INTEGER,
  "Legs" INTEGER,
  "Feet" INTEGER,
  "Ears" INTEGER,
  "Neck" INTEGER,
  "Wrists" INTEGER,
  "FingerL" INTEGER,
  "FingerR" INTEGER,
  "SoulCrystal" INTEGER
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
-- 6. Text search indexes (idx_tw_items_tw, idx_cn_items_zh, idx_ko_items_ko, idx_en_items_en, idx_ja_items_ja, idx_de_items_de, idx_fr_items_fr) support LIKE queries for search
-- 7. For fuzzy search, consider using PostgreSQL's pg_trgm extension for trigram matching:
--    CREATE EXTENSION IF NOT EXISTS pg_trgm;
--    CREATE INDEX idx_tw_items_tw_trgm ON tw_items USING gin(tw gin_trgm_ops);
--    CREATE INDEX idx_cn_items_zh_trgm ON cn_items USING gin(zh gin_trgm_ops);
--    CREATE INDEX idx_ko_items_ko_trgm ON ko_items USING gin(ko gin_trgm_ops);
--    CREATE INDEX idx_en_items_en_trgm ON en_items USING gin(en gin_trgm_ops);
--    CREATE INDEX idx_ja_items_ja_trgm ON ja_items USING gin(ja gin_trgm_ops);
--    CREATE INDEX idx_de_items_de_trgm ON de_items USING gin(de gin_trgm_ops);
--    CREATE INDEX idx_fr_items_fr_trgm ON fr_items USING gin(fr gin_trgm_ops);
-- 8. Search order: TW (strict then fuzzy) -> CN (strict then fuzzy) -> EN (strict then fuzzy) -> JA (strict then fuzzy) -> KO (strict then fuzzy) -> DE (strict then fuzzy) -> FR (strict then fuzzy) -> other languages
