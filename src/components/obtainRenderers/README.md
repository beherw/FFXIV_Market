# Obtainable Methods Renderer System

## Current usage (Option B)

**The main app does not use these renderers.** `ObtainMethods.jsx` implements all rendering inline in a single `renderSource()` function. This folder contains renderer modules and `getRenderer()` for future adoption (Option A: refactor `renderSource()` to call `getRenderer(type)` and pass props). The renderers are kept for reference and to avoid maintaining two rendering paths until a deliberate migration is done.

## Overview

The obtainable methods rendering system has been refactored to separate different obtainable method types into individual renderer files. This improves:

1. **Code Organization** - Each method type has its own dedicated file
2. **Performance** - Dynamic loading only loads renderers that are actually needed
3. **Maintainability** - Easier to find and update specific rendering logic
4. **File Size** - Reduces the size of the main ObtainMethods.jsx file

## Directory Structure

```
src/components/obtainRenderers/
├── index.js                      # Dynamic renderer loader
├── sharedUtils.jsx               # Shared utility functions
├── craftedByRenderer.jsx         # ✅ CRAFTED_BY (Type 1) - 製作
├── tradeSourcesRenderer.jsx      # TODO: TRADE_SOURCES (Type 2) - 兌換
├── vendorsRenderer.jsx           # TODO: VENDORS (Type 3) - NPC商店
├── treasuresRenderer.jsx         # TODO: TREASURES (Type 9) - 寶箱/容器
├── instancesRenderer.jsx         # TODO: INSTANCES (Type 6) - 副本掉落
├── dropsRenderer.jsx             # TODO: DROPS (Type 20) - 怪物掉落
├── desynthsRenderer.jsx          # TODO: DESYNTHS (Type 5) - 精製獲得
├── questsRenderer.jsx            # TODO: QUESTS (Type 10) - 任務獎勵
├── fatesRenderer.jsx             # TODO: FATES (Type 11) - 危命任務
├── gatheredByRenderer.jsx        # TODO: GATHERED_BY (Type 7) - 採集獲得
├── reducedFromRenderer.jsx       # TODO: REDUCED_FROM (Type 4) - 分解獲得
├── venturesRenderer.jsx          # TODO: VENTURES (Type 8) - 遠征獲得
├── gardeningRenderer.jsx         # TODO: GARDENING (Type 12) - 園藝獲得
├── mogstationRenderer.jsx        # TODO: MOGSTATION (Type 13) - 商城購買
├── levesRenderer.jsx             # TODO: ISLAND_CROP (Type 15) - 理符任務
├── voyagesRenderer.jsx           # TODO: VOYAGES (Type 16) - 遠征
├── masterbooksRenderer.jsx       # TODO: MASTERBOOKS (Type 18) - 製作書
├── alarmsRenderer.jsx            # TODO: ALARMS (Type 19) - 鬧鐘提醒
└── achievementsRenderer.jsx      # TODO: ACHIEVEMENTS (Type 22) - 成就獎勵
```

## Implementation Status

### ✅ Completed
- `craftedByRenderer.jsx` - Fully implemented CRAFTED_BY renderer

### 📝 TODO (Stub Files Created)
All other renderer files have been created as stubs and need to have their rendering logic extracted from ObtainMethods.jsx.

## How to Use

### Dynamic Loading (Recommended)

The `index.js` file provides a dynamic loader that only imports renderers when needed:

```javascript
import { getRenderer } from './obtainRenderers';
import { DataType } from '../services/extractsService';

// Get a specific renderer
const renderer = await getRenderer(DataType.CRAFTED_BY);
if (renderer) {
  const jsx = renderer({
    source,
    index,
    dataLoaded,
    onExpandCraftingTree,
    // ... other props
  });
}

// Preload multiple renderers at once
import { preloadRenderers } from './obtainRenderers';
await preloadRenderers([
  DataType.CRAFTED_BY,
  DataType.TRADE_SOURCES,
  DataType.VENDORS
]);
```

### Direct Import (For specific cases)

```javascript
import { renderCraftedBy } from './obtainRenderers/craftedByRenderer';

const jsx = renderCraftedBy({
  source,
  index,
  // ... props
});
```

## Renderer Function Signature

Each renderer should export a function with this signature:

```javascript
export function render[MethodName](props) {
  const {
    source,              // { type, data } - The source object
    index,               // Renderer index for key generation
    dataLoaded,          // Boolean - Is data fully loaded?
    loadedDataRef,       // Ref to current loaded data
    onItemClick,         // Function - Handle item clicks
    navigate,            // React Router navigate function
    getItemById,         // Function - Get item by ID
    generateItemUrl,     // Function - Generate item URL
    setMapModal,         // Function - Open map modal
    // ... other helper functions and data
  } = props;
  
  // Rendering logic here
  return <div>...</div>;
}
```

## Shared Utilities

The `sharedUtils.jsx` file contains:

- **Helper Functions:**
  - `getJobName(jobId, twJobAbbrData)`
  - `getJobIconUrl(jobId)`
  - `getMasterbookName(masterbookId, twItemsData)`
  - `getCurrencyName(currencyItemId, twItemsData)`
  - `getShopName(shopId, twShopsData, shopsData)`
  - `getNpcName(npcId, twNpcsData, npcsData, npcsDatabasePagesData)`
  - `getNpcTitle(npcId, twNpcTitlesData)`
  - `getZoneName(zoneId, twPlacesData, placesData)`
  
- **UI Components:**
  - `renderHQIndicator()` - HQ quality indicator
  - `renderLoadingSpinner(size)` - Loading spinner
  
- **Style Constants:**
  - `commonClasses` - Consistent CSS classes

## Migration Guide

### Step 1: Extract Rendering Logic

For each TODO renderer file, locate the corresponding rendering code in `ObtainMethods.jsx`:

1. Find the `if (type === DataType.[TYPE_NAME])` block in the `renderSource` function
2. Copy the entire rendering logic
3. Paste into the corresponding renderer file
4. Replace function calls and variables with props access

### Step 2: Identify Dependencies

Each renderer may need:
- Helper functions (from props or sharedUtils)
- Data from `loadedDataRef.current`
- Event handlers (onItemClick, navigate, etc.)
- Static data (twJobAbbrData, twNpcTitlesData, etc.)

### Step 3: Update Props

Ensure all required props are passed to the renderer:

```javascript
const rendererProps = {
  source,
  index,
  dataLoaded,
  loadedDataRef,
  onItemClick,
  navigate,
  getItemById,
  generateItemUrl,
  setMapModal,
  // Add method-specific props
  twJobAbbrData,
  // ...
};
```

### Step 4: Test

Test each renderer individually to ensure:
- Data displays correctly
- Click handlers work
- Loading states show properly
- No errors in console

## Benefits

### Before (Monolithic)
```
ObtainMethods.jsx (4926 lines)
└── renderSource() function
    ├── CRAFTED_BY rendering (~150 lines)
    ├── TRADE_SOURCES rendering (~280 lines)
    ├── VENDORS rendering (~180 lines)
    ├── ... (20+ more method types)
    └── (All loaded at once, even if not needed)
```

### After (Modular)
```
ObtainMethods.jsx (~3000 lines, reduced)
└── Uses dynamic renderer loader

obtainRenderers/
├── craftedByRenderer.jsx (~150 lines)
├── tradeSourcesRenderer.jsx (~280 lines)
└── ... (Only loaded when item needs them)
```

### Performance Impact

- **Before:** All rendering code loaded upfront (~2000 lines of rendering logic)
- **After:** Only renderers for actual item sources are loaded dynamically
- **Example:** Item with only CRAFTED_BY and VENDORS sources only loads 2 small files

## Future Enhancements

1. **Renderer Preloading:** Preload common renderers (CRAFTED_BY, VENDORS) on app load
2. **Renderer Caching:** Cache rendered JSX for frequently viewed items
3. **Code Splitting:** Webpack/Vite will automatically code-split these modules
4. **Type Safety:** Add TypeScript definitions for renderer props

## Notes

- The main `ObtainMethods.jsx` file still contains all helper functions and data loading logic
- Only the rendering JSX has been extracted to separate files
- This is a gradual refactoring - both the old and new systems can coexist
- Once all renderers are migrated, the old `renderSource` function can be removed

## Contributing

When adding a new obtainable method type:

1. Create a new renderer file: `[methodName]Renderer.jsx`
2. Export a function: `export function render[MethodName](props)`
3. Add the case to `index.js` in the `getRenderer` switch
4. Update this README
