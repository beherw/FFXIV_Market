# Performance Optimization Guide

## Overview
This document outlines additional performance optimizations beyond database queries and indexes.

## ✅ Already Optimized

1. ✅ **Database Queries** - Batch queries instead of N+1 patterns
2. ✅ **Database Indexes** - All critical indexes created
3. ✅ **Code Splitting** - Lazy loading for route-based components
4. ✅ **Large Files** - Dynamic imports for JSON files >10MB

## 🔧 Additional Optimizations Needed

### 1. React Memoization (High Priority)

#### **ObtainMethods.jsx** - Expensive Computations Without useMemo

**Problem**: Lines 3444-3462 recalculate expensive operations on every render:
- `sortedSources` - sorts array and calls `getSourceItemCount` for each item
- `filteredSources` - filters sorted sources
- `uniqueMethodTypes` - creates Set and maps over sources
- `validSources` - maps and filters, calling `renderSource` (potentially expensive)

**Solution**: Wrap in `useMemo`:

```javascript
// Sort sources by item count (descending) - memoized
const sortedSources = useMemo(() => {
  return [...sources].sort((a, b) => {
    const countA = getSourceItemCount(a);
    const countB = getSourceItemCount(b);
    return countB - countA; // Descending order
  });
}, [sources]);

// Filter sources by selected method type - memoized
const filteredSources = useMemo(() => {
  return filteredMethodType 
    ? sortedSources.filter(source => source.type === filteredMethodType)
    : sortedSources;
}, [sortedSources, filteredMethodType]);

// Get unique method types for filter tags - memoized
const uniqueMethodTypes = useMemo(() => {
  return [...new Set(sortedSources.map(s => s.type))];
}, [sortedSources]);

// Filter out null results - memoized
const validSources = useMemo(() => {
  return filteredSources.map((source, index) => {
    const rendered = renderSource(source, index, false);
    return rendered;
  }).filter(Boolean);
}, [filteredSources]);
```

**Impact**: Prevents recalculation on every render, especially when parent re-renders

#### **Deep Object Copying Optimization**

**Problem**: Lines 463-473 in ObtainMethods.jsx use inefficient deep copy:
```javascript
loadedDataRef.current = { ...newLoadedData };
Object.keys(newLoadedData).forEach(key => {
  // Manual deep copy for each nested object
});
```

**Solution**: Use `structuredClone` (modern browsers) or optimize:
```javascript
// Option 1: Use structuredClone (faster, native)
loadedDataRef.current = structuredClone(newLoadedData);

// Option 2: If structuredClone not available, use JSON parse/stringify (faster than manual copy)
loadedDataRef.current = JSON.parse(JSON.stringify(newLoadedData));
```

**Impact**: Faster deep copying, especially for large objects

### 2. Component Memoization (Medium Priority)

#### **ItemTable Component**

**Problem**: Large component that might re-render unnecessarily when props haven't changed

**Solution**: Wrap with `React.memo`:
```javascript
export default React.memo(ItemTable, (prevProps, nextProps) => {
  // Custom comparison function for better control
  return (
    prevProps.items === nextProps.items &&
    prevProps.selectedItem?.id === nextProps.selectedItem?.id &&
    prevProps.selectedRarities === nextProps.selectedRarities &&
    // ... other critical props
  );
});
```

**Impact**: Prevents unnecessary re-renders when parent updates but props are unchanged

#### **ItemImage Component**

**Problem**: Rendered many times in lists, might benefit from memoization

**Solution**: Already uses some optimization, but could add `React.memo`:
```javascript
export default React.memo(ItemImage);
```

### 3. Callback Memoization (Medium Priority)

#### **ObtainMethods.jsx** - getSourceItemCount Function

**Problem**: Function recreated on every render, used in sort comparator

**Solution**: Wrap in `useCallback`:
```javascript
const getSourceItemCount = useCallback((source) => {
  const { type, data } = source;
  // ... existing logic
}, []); // No dependencies needed
```

**Impact**: Stable function reference prevents unnecessary recalculations

### 4. Array Operation Optimizations (Low Priority)

#### **AdvancedSearch.jsx** - displayedResults.map()

**Problem**: Line 2273 creates new array on every render

**Solution**: Already in useEffect, but ensure it's not called unnecessarily

#### **App.jsx** - historyItems.map()

**Problem**: Line 1461 creates new array in useEffect (acceptable, but could memoize if used elsewhere)

**Solution**: If used in render, wrap in useMemo

### 5. Caching Strategy Improvements (Medium Priority)

#### **Add Request Deduplication**

**Problem**: Multiple components might request same data simultaneously

**Solution**: Already implemented in supabaseData.js with `targetedQueryPromises`, but could add:
- Request queuing for same resource
- Request cancellation when component unmounts

#### **Add LocalStorage Caching for Computed Values**

**Problem**: Some computed values (like sorted sources) could be cached

**Solution**: Cache expensive computations in localStorage with TTL:
```javascript
const cacheKey = `computed_${itemId}_${sourcesHash}`;
const cached = localStorage.getItem(cacheKey);
if (cached) {
  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 min TTL
    return data;
  }
}
```

### 6. Virtualization for Large Lists (High Priority if Lists > 1000 items)

#### **ItemTable Component**

**Problem**: Rendering 1000+ items at once causes performance issues

**Solution**: Use `react-window` or `react-virtualized`:
```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
  itemData={items}
>
  {Row}
</FixedSizeList>
```

**Impact**: Only renders visible items, dramatically improves performance for large lists

### 7. Debouncing/Throttling (Already Implemented)

✅ Search input debouncing - Already implemented
✅ API request throttling - Already implemented

### 8. Image Loading Optimization (Low Priority)

#### **ItemImage Component**

**Problem**: All images load immediately, even if not visible

**Solution**: Use Intersection Observer for lazy loading:
```javascript
const [isVisible, setIsVisible] = useState(false);
const imgRef = useRef();

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    },
    { rootMargin: '50px' }
  );
  
  if (imgRef.current) {
    observer.observe(imgRef.current);
  }
  
  return () => observer.disconnect();
}, []);

// Only load image when visible
{isVisible && <img src={imageUrl} />}
```

**Impact**: Reduces initial page load time, especially for long lists

### 9. State Management Optimization (Low Priority)

#### **Reduce State Updates**

**Problem**: Multiple `setState` calls in sequence cause multiple re-renders

**Solution**: Batch state updates:
```javascript
// Instead of:
setA(value1);
setB(value2);
setC(value3);

// Use:
React.startTransition(() => {
  setA(value1);
  setB(value2);
  setC(value3);
});
```

Or use single state object:
```javascript
setState({ a: value1, b: value2, c: value3 });
```

### 10. Bundle Size Optimization (Already Optimized)

✅ Code splitting - Already implemented
✅ Lazy loading - Already implemented
✅ Tree shaking - Vite handles automatically

## Implementation Priority

### High Priority (Do First)
1. ✅ **ObtainMethods.jsx useMemo** - Easy win, significant impact
2. ✅ **Deep copy optimization** - Quick fix
3. ⚠️ **Virtualization for large lists** - If lists > 1000 items

### Medium Priority
4. **Component memoization** - ItemTable, ItemImage
5. **Callback memoization** - getSourceItemCount
6. **Caching improvements** - Request deduplication

### Low Priority
7. **Image lazy loading** - Nice to have
8. **State batching** - Minor improvement

## Expected Performance Gains

| Optimization | Expected Improvement | Effort |
|-------------|---------------------|--------|
| ObtainMethods useMemo | 30-50% faster renders | Low |
| Deep copy optimization | 20-30% faster copying | Low |
| Component memoization | 10-20% fewer re-renders | Medium |
| Virtualization | 90%+ faster for large lists | Medium |
| Image lazy loading | 20-40% faster initial load | Medium |

## Testing Recommendations

1. Use React DevTools Profiler to identify slow components
2. Monitor render counts before/after optimizations
3. Test with large datasets (1000+ items)
4. Check bundle size impact
5. Monitor memory usage

## Notes

- Most optimizations are low-risk and can be applied incrementally
- Test each optimization individually to measure impact
- Some optimizations (like virtualization) require more testing
- Monitor for any regressions after applying optimizations
