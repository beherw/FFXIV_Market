# Build vs Static Assets Explanation

## Key Difference: `import()` vs `fetch()`

### Current Situation

#### ✅ extracts.json (Optimized Approach)
- **Location**: `public/data/extracts.json`
- **Loading Method**: `fetch()` from `extractsService.js`
- **Bundled?**: ❌ **NO** - Served as static asset at runtime
- **Build Impact**: None - file is copied to `dist/` as-is
- **Why**: Too large (24MB) to bundle efficiently, needs to load on-demand

#### ⚠️ Other Large Files (Current Approach)
- **Location**: `teamcraft_git/libs/data/src/lib/json/*.json`
- **Loading Method**: `await import()` (dynamic import)
- **Bundled?**: ✅ **YES** - Vite bundles them into chunks
- **Build Impact**: Files are processed and split into chunks during build
- **Examples**: 
  - `npcs.json` (16MB) → bundled into chunk
  - `shops.json` (9.2MB) → bundled into chunk
  - `shops-by-npc.json` (27MB) → bundled into chunk
  - `tw-recipes.json` (11MB) → bundled into chunk

## Why extracts.json is Different

### Problem with extracts.json
1. **Size**: 27MB original, 24MB optimized - still very large
2. **GitHub Pages**: Has timeout limits for large file downloads
3. **Bundle Size**: Would create huge chunks if bundled
4. **On-Demand Loading**: Only needed when viewing item details

### Solution: Static Asset + fetch()
```javascript
// extractsService.js uses fetch() - NOT bundled
const response = await fetch(`${basePath}data/extracts.json`);
const data = await response.json();
```

**Benefits**:
- ✅ Not bundled (no build time processing)
- ✅ Loaded only when needed (lazy loading)
- ✅ Can be cached separately by browser
- ✅ Smaller initial bundle size
- ✅ Works better with GitHub Pages

## Why Other Files Still Use import()

### Current Approach for Other Files
```javascript
// ObtainMethods.jsx uses dynamic import() - IS bundled
const module = await import('../../teamcraft_git/libs/data/src/lib/json/npcs.json');
```

**Why this works**:
- ✅ Vite splits them into separate chunks automatically
- ✅ Chunks are loaded on-demand (code splitting)
- ✅ Better tree-shaking and optimization
- ✅ Smaller than extracts.json (most are < 16MB)

### Should We Move Other Files to public/?

**Considerations**:

**Pros of moving to public/**:
- ✅ Not bundled (faster builds)
- ✅ Can optimize files before serving
- ✅ Better for very large files (>20MB)

**Cons of moving to public/**:
- ❌ Lose Vite's code splitting benefits
- ❌ Lose tree-shaking (unused code removal)
- ❌ Lose minification/compression
- ❌ Manual chunk management needed
- ❌ More complex loading logic

**Recommendation**:
- ✅ **Keep extracts.json** in `public/` (too large, special case)
- ✅ **Keep other files** using `import()` (Vite handles them well)
- ⚠️ **Consider moving** if any file causes GitHub Pages timeout issues

## Build Process

### Files in `public/`
```
public/data/extracts.json
  ↓ (copied as-is during build)
dist/data/extracts.json  ← Served as static asset
```

### Files using `import()`
```
teamcraft_git/libs/data/src/lib/json/npcs.json
  ↓ (processed by Vite during build)
  ↓ (split into chunks, minified, optimized)
dist/assets/data-npcs-abc123.js  ← Bundled JavaScript chunk
```

## Vite Configuration

The `vite.config.js` has a manual chunk for `extracts.json`:
```javascript
if (id.includes('extracts.json')) {
  return 'data-extracts';
}
```

**Note**: This won't actually be used anymore since we're using `fetch()` instead of `import()`. The chunk config is for files that ARE imported. We could remove this line, but it doesn't hurt to leave it.

## Summary

| File | Method | Bundled? | Why |
|------|--------|----------|-----|
| extracts.json | `fetch()` | ❌ No | Too large (24MB), GitHub Pages timeout risk |
| npcs.json | `import()` | ✅ Yes | Vite handles well, code splitting works |
| shops.json | `import()` | ✅ Yes | Vite handles well, code splitting works |
| tw-recipes.json | `import()` | ✅ Yes | Vite handles well, code splitting works |

**Answer to your question**: 
- ✅ Yes, we're still building from `teamcraft_git` for other files (using `import()`)
- ✅ This is correct - Vite bundles them efficiently into chunks
- ✅ extracts.json is special - uses `fetch()` from `public/` to avoid bundling
- ⚠️ The original extracts.json is NOT bundled anymore (we use fetch instead)
