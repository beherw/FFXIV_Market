# Performance Guidelines - Supabase Data Loading

## ⚠️ CRITICAL RULE: NEVER LOAD ALL ITEMS AT ONCE

**Always use targeted queries with WHERE clauses. Never load entire tables unless absolutely necessary.**

## Table Sizes

- `tw_items`: 42,679 items
- `tw_item_descriptions`: 19,032 items
- `ilvls`: 50,900 items
- `rarities`: 50,900 items
- `item_patch`: 48,455 items
- `market_items`: 16,670 items
- `patch_names`: 104 items (small, OK to load all)

## ✅ CORRECT: Targeted Queries

Always use functions with `ByIds` suffix:

```javascript
// ✅ CORRECT: Load only what you need
const itemIds = [1, 2, 3, 4, 5];
const descriptions = await getTwItemDescriptionsByIds(itemIds);
const ilvls = await getIlvlsByIds(itemIds);
const rarities = await getRaritiesByIds(itemIds);
const marketableSet = await getMarketItemsByIds(itemIds);
```

## ❌ WRONG: Loading All Data

Never use functions without `ByIds` suffix for large tables:

```javascript
// ❌ WRONG: Loads ALL 19,032 descriptions
const descriptions = await getTwItemDescriptions();

// ❌ WRONG: Loads ALL 50,900 ilvls
const ilvls = await getIlvls();

// ❌ WRONG: Loads ALL 42,679 items
const { items } = await loadItemDatabase();
```

## Workflow Pattern

1. **Search database** → Get item IDs
   ```javascript
   const searchResults = await searchTwItems(searchText);
   const itemIds = Object.keys(searchResults).map(id => parseInt(id));
   ```

2. **Use those IDs** to fetch only needed data
   ```javascript
   const descriptions = await getTwItemDescriptionsByIds(itemIds);
   const ilvls = await getIlvlsByIds(itemIds);
   ```

3. **Never load entire tables** unless absolutely necessary

## When Full Loads Are Acceptable

Only acceptable in these scenarios:

1. **Fuzzy search** - Requires full dataset for character-order matching
2. **Fallback** - When targeted query fails and you need data anyway
3. **Small tables** - `patch_names` (104 items) is OK to load all

## Functions Reference

### ✅ Use These (Targeted)
- `getTwItemDescriptionsByIds(itemIds)` - Load descriptions for specific items
- `getIlvlsByIds(itemIds)` - Load ilvls for specific items
- `getRaritiesByIds(itemIds)` - Load rarities for specific items
- `getItemPatchByIds(itemIds)` - Load patch data for specific items
- `getMarketItemsByIds(itemIds)` - Check marketability for specific items
- `searchTwItems(searchText)` - Search items by name (returns only matches)
- `getTwItemById(itemId)` - Get single item by ID

### ⚠️ Avoid These (Loads All)
- `getTwItemDescriptions()` - Loads ALL 19,032 descriptions
- `getIlvls()` - Loads ALL 50,900 ilvls
- `getRarities()` - Loads ALL 50,900 rarities
- `getItemPatch()` - Loads ALL 48,455 patch versions
- `getMarketItems()` - Loads ALL 16,670 marketable items
- `loadItemDatabase()` - Loads ALL 42,679 items

## Code Review Checklist

When reviewing code, check:

- [ ] Are we using `*ByIds()` functions for large tables?
- [ ] Are we loading data only for items we actually need?
- [ ] Are we filtering by tradeability before loading metadata?
- [ ] Are we using search queries instead of loading all items?
- [ ] Are we caching results to avoid duplicate requests?

## Performance Impact

Loading all data vs targeted queries:

- **All descriptions**: ~6 seconds, 19,032 items
- **Targeted (100 items)**: ~200ms, 100 items
- **Speed improvement**: ~30x faster

- **All ilvls**: ~8 seconds, 50,900 items  
- **Targeted (100 items)**: ~200ms, 100 items
- **Speed improvement**: ~40x faster

## Debugging

If you see warnings in console:
- `⚠️ WARNING: Loading ENTIRE table` - Find the caller and replace with targeted query
- `⚠️ getTwItemDescriptions() called` - Replace with `getTwItemDescriptionsByIds()`
- `❌ CRITICAL: Loading FULL item database` - Only acceptable for fuzzy search

Check stack traces to find where the full load is happening.
