# Traditional Chinese Search Flow - Complete Query Breakdown

## Overview
When a user inputs Traditional Chinese text, the system performs a multi-step search process that queries multiple database tables in sequence until results are found.

---

## Entry Point
**File**: `src/services/itemDatabase.js`  
**Function**: `searchItems(searchText, fuzzy = false, signal = null)`

---

## Step-by-Step Flow

### **STEP 1: Precise Search with TW Names (Original Input)**

**Purpose**: Search for exact substring matches in Traditional Chinese item names

**Function Called**: `searchTwItems(trimmedSearchText, false, signal)`

**Location**: `src/services/supabaseData.js` → `searchLanguageItems('tw_items', 'tw', searchText, false, signal)`

#### **Database Query 1: Search `tw_items` table**

**Table**: `tw_items`  
**Columns**: `id`, `tw`  
**Index Used**: `idx_tw_items_tw_trgm` (GIN trigram index for fast ILIKE queries)

**Query Logic**:
```sql
SELECT id, tw 
FROM tw_items 
WHERE tw IS NOT NULL 
  AND tw <> '' 
  AND tw ILIKE '%word1%' 
  AND tw ILIKE '%word2%'  -- (if multiple words)
-- Paginated: LIMIT 1000 OFFSET 0, then OFFSET 1000, etc.
```

**Query Details**:
- If search text has spaces: splits into words, each word must appear as substring (AND condition)
- If no spaces: single word substring match
- Uses `ILIKE` (case-insensitive LIKE) with leading/trailing wildcards
- Paginated in batches of 1000 rows

**Returns**: `{itemId: {tw: "name"}}` format
- Example: `{36221: {tw: "精金投斧"}, 36220: {tw: "精金战斧"}}`

---

### **STEP 2: Check Marketability for Search Results**

**Purpose**: Filter out non-marketable items (only show items that can be traded)

**Function Called**: `getMarketItemsByIds(itemIds, signal)`

**Location**: `src/services/supabaseData.js`

#### **Database Query 2: Check `market_items` table**

**Table**: `market_items`  
**Columns**: `id`  
**Index Used**: `idx_market_items_id` (primary key index)

**Query Logic**:
```sql
SELECT id 
FROM market_items 
WHERE id IN (36221, 36220, 12345, ...)  -- (up to 1000 IDs per batch)
```

**Query Details**:
- Batched in groups of 1000 IDs (Supabase IN clause limit)
- Returns Set of marketable item IDs
- Used to filter search results

**Returns**: `Set<itemId>` 
- Example: `Set {36221, 36220, 12345}`

---

### **STEP 3: Load Item Descriptions (Lazy Loading)**

**Purpose**: Load Traditional Chinese descriptions for matching items

**Function Called**: `getTwItemDescriptionsByIds(itemIds, signal)`

**Location**: `src/services/supabaseData.js`

#### **Database Query 3: Load from `tw_item_descriptions` table**

**Table**: `tw_item_descriptions`  
**Columns**: `id`, `tw`  
**Index Used**: `idx_tw_item_descriptions_id` (primary key index)

**Query Logic**:
```sql
SELECT id, tw 
FROM tw_item_descriptions 
WHERE id IN (36221, 36220, 12345, ...)  -- (up to 1000 IDs per batch)
```

**Query Details**:
- Only loads descriptions for items that don't exist in cache
- Batched in groups of 1000 IDs
- Cached after first load

**Returns**: `{itemId: {tw: "description"}}`
- Example: `{36221: {tw: "精金製の投斧..."}}`

---

### **STEP 4: Load Ilvl and Version Data**

**Purpose**: Attach item level and patch version to results for sorting/display

**Function Called**: `loadIlvlAndVersionForResults(results, signal)`

**Location**: `src/services/itemDatabase.js`

#### **Database Query 4a: Load from `ilvls` table**

**Table**: `ilvls`  
**Columns**: `id`, `value`  
**Index Used**: `idx_ilvls_id` (primary key index)

**Query Logic**:
```sql
SELECT id, value 
FROM ilvls 
WHERE id IN (36221, 36220, 12345, ...)  -- (up to 1000 IDs per batch)
```

**Returns**: `{itemId: ilvlValue}`
- Example: `{36221: 665, 36220: 660}`

#### **Database Query 4b: Load from `item_patch` table**

**Table**: `item_patch`  
**Columns**: `id`, `value` (patch ID)  
**Index Used**: `idx_item_patch_id` (primary key index)

**Query Logic**:
```sql
SELECT id, value 
FROM item_patch 
WHERE id IN (36221, 36220, 12345, ...)  -- (up to 1000 IDs per batch)
```

**Returns**: `{itemId: patchId}`
- Example: `{36221: 70, 36220: 70}`

**Note**: Both queries run in parallel using `Promise.all()`

---

### **STEP 5: Sort Results**

**Sort Order**:
1. **Primary**: Tradable items first (marketable items appear before non-marketable)
2. **Secondary**: By ilvl descending (highest ilvl first)
3. **Tertiary**: By item ID descending (if ilvl is null)

---

## Fallback Steps (If Step 1 Returns No Results)

### **STEP 2 (Fallback): Fuzzy Search with TW Names**

**Condition**: Only if Step 1 returned 0 results AND search text contains spaces

**Function Called**: `searchTwItems(trimmedSearchText, true, signal)`

**Query**: Same as Step 1, but uses fuzzy matching:
```sql
SELECT id, tw 
FROM tw_items 
WHERE tw IS NOT NULL 
  AND tw <> '' 
  AND tw ILIKE '%c1%c2%c3%'  -- (fuzzy: characters must appear in order)
```

**Fuzzy Pattern**: For word "精金", pattern becomes `%精%金%` (characters must appear in order, but can have other characters between)

---

### **STEP 3 (Fallback): Convert Input and Retry**

**Condition**: If Steps 1-2 returned 0 results

**Process**:
1. Convert user input to Traditional Chinese (if it was Simplified)
2. Retry Step 1 (precise search) with converted text
3. If still no results, retry Step 2 (fuzzy search) with converted text

**Conversion**: Uses `opencc-js` library (`cn2t` converter)

---

### **STEP 4 (Fallback): Search Simplified Chinese Database**

**Condition**: If all previous steps returned 0 results

**Process**:
1. Convert input to Simplified Chinese
2. Search `cn_items` table (same query pattern as Step 1)
3. Get matching item IDs
4. Fetch Traditional Chinese names for those IDs using `getTwItemById(itemId)` for each ID

**Additional Queries**:
- Query `cn_items` table (Simplified Chinese names)
- Multiple queries to `tw_items` table: `SELECT id, tw FROM tw_items WHERE id = ?` (one per matching item)

---

## Summary: Tables Queried in Order

1. **`tw_items`** - Primary search (Traditional Chinese item names)
   - Index: `idx_tw_items_tw_trgm` (GIN trigram)
   - Query: `SELECT id, tw FROM tw_items WHERE tw ILIKE '%pattern%'`

2. **`market_items`** - Filter marketable items
   - Index: `idx_market_items_id` (primary key)
   - Query: `SELECT id FROM market_items WHERE id IN (...)`

3. **`tw_item_descriptions`** - Load descriptions (lazy)
   - Index: `idx_tw_item_descriptions_id` (primary key)
   - Query: `SELECT id, tw FROM tw_item_descriptions WHERE id IN (...)`

4. **`ilvls`** - Load item levels (parallel with item_patch)
   - Index: `idx_ilvls_id` (primary key)
   - Query: `SELECT id, value FROM ilvls WHERE id IN (...)`

5. **`item_patch`** - Load patch versions (parallel with ilvls)
   - Index: `idx_item_patch_id` (primary key)
   - Query: `SELECT id, value FROM item_patch WHERE id IN (...)`

6. **`cn_items`** - Fallback search (Simplified Chinese, only if TW search fails)
   - Index: `idx_cn_items_zh_trgm` (GIN trigram)
   - Query: `SELECT id, zh FROM cn_items WHERE zh ILIKE '%pattern%'`

---

## Query Performance Optimizations

1. **Trigram Indexes**: GIN indexes on text columns enable fast `ILIKE` queries even with leading wildcards
2. **Batching**: All `WHERE IN` queries batch up to 1000 IDs per request
3. **Caching**: Results cached to avoid duplicate queries
4. **Lazy Loading**: Descriptions only loaded when needed
5. **Parallel Queries**: Ilvl and patch data loaded simultaneously
6. **Early Filtering**: Marketability checked before loading descriptions/ilvls

---

## Example: User Searches "精金"

### Query Sequence:

1. **Query `tw_items`**:
   ```sql
   SELECT id, tw FROM tw_items 
   WHERE tw IS NOT NULL AND tw <> '' AND tw ILIKE '%精金%'
   ```
   Returns: `{36221: {tw: "精金投斧"}, 36220: {tw: "精金战斧"}, ...}`

2. **Query `market_items`**:
   ```sql
   SELECT id FROM market_items WHERE id IN (36221, 36220, ...)
   ```
   Returns: `Set {36221, 36220, ...}`

3. **Query `tw_item_descriptions`** (for filtered results):
   ```sql
   SELECT id, tw FROM tw_item_descriptions WHERE id IN (36221, 36220, ...)
   ```

4. **Query `ilvls`** (parallel):
   ```sql
   SELECT id, value FROM ilvls WHERE id IN (36221, 36220, ...)
   ```

5. **Query `item_patch`** (parallel):
   ```sql
   SELECT id, value FROM item_patch WHERE id IN (36221, 36220, ...)
   ```

6. **Results sorted** by tradability → ilvl descending → id descending

7. **First set of data returned** to UI

---

## Notes

- All queries use Supabase PostgREST API (not raw SQL)
- Pagination handled automatically for large result sets
- Abort signals supported for cancellation
- Error handling includes fallback to full database load (rare)
- Search is case-insensitive (uses `ILIKE`)
