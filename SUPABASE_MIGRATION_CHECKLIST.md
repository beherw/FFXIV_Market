# Supabase Migration Checklist

This document contains critical findings and a checklist for migrating other pages/components from JSON to Supabase database approach.

## ⚠️ Critical Findings & Best Practices

### 1. **Always Use WHERE Clauses - Never Load All Items**

**❌ WRONG:**
```javascript
// This loads ALL 42,679 items unnecessarily!
const { shopItems } = await loadItemDatabase();
```

**✅ CORRECT:**
```javascript
// Use database queries with WHERE clauses
const searchResults = await searchTwItems(searchText, false, signal);
// Or create empty arrays if data isn't available
const shopItems = [];
const shopItemIds = new Set();
```

**Why:** Loading all items causes:
- Slow initial load times
- Unnecessary network traffic
- Poor user experience
- Higher Supabase API costs

### 2. **Implement Query Cancellation (Abort Signals)**

**Always add abort signal support:**
```javascript
export async function searchTwItems(searchText, fuzzy = false, signal = null) {
  // Check if aborted before each request
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  
  // ... query logic ...
  
  // Check after each pagination request
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}
```

**In components:**
```javascript
// Cancel previous queries when starting new ones
if (searchAbortControllerRef.current) {
  searchAbortControllerRef.current.abort();
}
searchAbortControllerRef.current = new AbortController();
const signal = searchAbortControllerRef.current.signal;

// Pass signal to queries
const results = await searchTwItems(text, false, signal);

// Cleanup on unmount/navigation
useEffect(() => {
  return () => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
  };
}, []);
```

**Why:** Prevents:
- Memory leaks from pending promises
- Race conditions
- Unnecessary network requests after navigation
- State updates after component unmounts

### 3. **Handle Pagination Correctly**

**Supabase has a 1000 row limit by default:**
```javascript
// Always paginate for large tables
const pageSize = 1000;
let allData = [];
let from = 0;
let hasMore = true;

while (hasMore) {
  if (signal && signal.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .range(from, from + pageSize - 1);
  
  if (data && data.length > 0) {
    allData = allData.concat(data);
    from += pageSize;
    hasMore = data.length === pageSize;
  } else {
    hasMore = false;
  }
}
```

### 4. **Use Caching Strategically**

**Cache at service level:**
```javascript
// In supabaseData.js
const dataCache = {};
const loadPromises = {};

async function loadTableData(tableName, transformFn = null, signal = null) {
  // Return cached data if available
  if (dataCache[tableName]) {
    return dataCache[tableName];
  }
  
  // Return existing promise if already loading
  if (loadPromises[tableName]) {
    return loadPromises[tableName];
  }
  
  // ... load and cache ...
}
```

**Cache at component level for frequently accessed data:**
```javascript
// Use refs for data that doesn't need reactivity
const twItemsDataRef = useRef(null);

useEffect(() => {
  if (!twItemsDataRef.current) {
    getTwItems().then(data => {
      twItemsDataRef.current = data;
    });
  }
}, []);
```

### 5. **Avoid Loading Full Database for Simple Operations**

**❌ WRONG:**
```javascript
// Loading all items just to check shopItems (which is always empty)
const { shopItems } = await loadItemDatabase();
```

**✅ CORRECT:**
```javascript
// If data isn't available or always empty, create directly
const shopItems = [];
const shopItemIds = new Set();
```

### 6. **Handle Empty/Null Data Gracefully**

**Always check for empty/null before processing:**
```javascript
if (!searchText || !searchText.trim()) {
  return {};
}

// Check data after query
if (data && data.length > 0) {
  // Process data
} else {
  // Return empty structure
  return transformFn ? transformFn([]) : [];
}
```

### 7. **Error Handling**

**Handle abort errors silently:**
```javascript
try {
  const results = await searchTwItems(text, false, signal);
} catch (error) {
  // Ignore abort errors (user navigated away)
  if (error.name === 'AbortError' || signal.aborted) {
    return;
  }
  // Handle other errors
  console.error('Search error:', error);
}
```

**Provide fallbacks:**
```javascript
catch (error) {
  if (error.name === 'AbortError' || signal.aborted) {
    throw error; // Re-throw abort errors
  }
  console.error(`Error loading ${tableName}:`, error);
  // Return empty fallback
  return transformFn ? transformFn([]) : [];
}
```

## 📋 Migration Checklist

When migrating a new component/page from JSON to Supabase:

### Pre-Migration Analysis
- [ ] Identify all JSON files used by the component
- [ ] Check if data is already in Supabase (check `json_converter/json_list.txt`)
- [ ] Determine data access patterns (full load vs. filtered queries)
- [ ] Identify where data is used (initial load, search, filters, etc.)

### Implementation Steps
- [ ] Create/update function in `supabaseData.js` with:
  - [ ] Abort signal parameter
  - [ ] Pagination support (if table > 1000 rows)
  - [ ] Proper caching
  - [ ] Error handling
- [ ] Update component to:
  - [ ] Use database queries with WHERE clauses (never load all items)
  - [ ] Implement abort controllers for queries
  - [ ] Add cleanup in useEffect hooks
  - [ ] Handle loading states
  - [ ] Handle error states
- [ ] Remove JSON imports
- [ ] Update data access patterns

### Performance Checks
- [ ] Verify queries use WHERE clauses (check Network tab)
- [ ] Ensure no unnecessary full table loads
- [ ] Check that pagination works for large tables
- [ ] Verify caching prevents duplicate requests
- [ ] Test query cancellation on navigation/unmount

### Testing Checklist
- [ ] Test component functionality matches JSON approach
- [ ] Test with empty/null data
- [ ] Test error handling (network failures, aborted requests)
- [ ] Test navigation away during data loading
- [ ] Test concurrent requests (should use cached data)
- [ ] Verify no console errors
- [ ] Check Network tab for unnecessary requests
- [ ] Test performance (should be faster than loading all items)

### Code Review Checklist
- [ ] No `loadItemDatabase()` calls unless absolutely necessary
- [ ] All queries have WHERE clauses or are paginated
- [ ] Abort signals implemented for all async operations
- [ ] Cleanup functions in useEffect hooks
- [ ] Error handling for abort errors
- [ ] Caching implemented where appropriate
- [ ] No unnecessary data transformations

## 🔍 Common Pitfalls to Avoid

1. **Loading all items for simple operations**
   - ❌ Loading all items just to filter in memory
   - ✅ Use database WHERE clauses

2. **Missing abort signal handling**
   - ❌ Queries continue after navigation
   - ✅ Always implement abort signals

3. **Not checking for empty data**
   - ❌ Assuming data always exists
   - ✅ Always check for null/empty before processing

4. **Forgetting pagination**
   - ❌ Only getting first 1000 rows
   - ✅ Always paginate for large tables

5. **Not caching results**
   - ❌ Repeated queries for same data
   - ✅ Cache at service and component level

6. **Loading data unnecessarily**
   - ❌ Loading full database for empty arrays
   - ✅ Create empty structures directly when data isn't available

## 📝 Notes for Future Migrations

### Pages/Components Still Using JSON (if any)
- Check `src/components/` for any remaining JSON imports
- Check `src/services/` for any remaining JSON imports
- Verify all data is available in Supabase

### Performance Monitoring
- Monitor Supabase API usage in dashboard
- Check query performance in Supabase logs
- Monitor bundle size (should decrease after removing JSON)

### Data Sync
- All data syncs automatically via GitHub Actions (`.github/workflows/sync-supabase.yml`)
- CSV files are generated from JSON in `json_converter/csv_output/`
- Tables are created/updated automatically via `sync_smart.js`

## 🎯 Success Criteria

A successful migration should:
- ✅ Use database queries with WHERE clauses
- ✅ Implement abort signal handling
- ✅ Have proper error handling
- ✅ Cache data appropriately
- ✅ Be faster than JSON approach
- ✅ Handle edge cases (empty data, errors, cancellation)
- ✅ No console errors
- ✅ No unnecessary network requests
