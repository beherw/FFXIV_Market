# Obtainable Methods Refactoring Progress

## Completed Renderers ✅

### 1. CRAFTED_BY (Type 1 - 製作) 
**File:** `craftedByRenderer.jsx`  
**Status:** ✅ Fully Implemented  
**Features:**
- Displays crafting jobs with icons
- Shows level, stars, and masterbook requirements
- Crafting tree expand/collapse button
- Masterbook item linking

### 2. TRADE_SOURCES (Type 2 - 兌換)
**File:** `tradeSourcesRenderer.jsx`  
**Status:** ✅ Fully Implemented  
**Features:**
- Groups trades by currency and shop
- Shows currency items with HQ indicators
- Quest requirements for shops
- NPC locations with map modal integration
- Handles multiple NPCs per trade

### 3. VENDORS (Type 3 - NPC商店)
**File:** `vendorsRenderer.jsx`  
**Status:** ✅ Fully Implemented  
**Features:**
- Groups vendors by NPC
- Shows NPC names, titles, and locations
- Price display with ranges
- Achievement requirements
- Handles housing NPCs specially
- Separate display for NPCs with/without locations

### 4. TREASURES (Type 9 - 寶箱/容器)
**File:** `treasuresRenderer.jsx`  
**Status:** ✅ Fully Implemented  
**Features:**
- Displays treasure items with icons
- Item linking on click
- Clean, simple card layout

### 5. INSTANCES (Type 6 - 副本掉落)
**File:** `instancesRenderer.jsx`  
**Status:** ✅ Fully Implemented  
**Features:**
- Shows instance names with appropriate icons
- Level and item level requirements
- Level sync information
- Links to Huiji Wiki
- Different icons for raids, trials, ultimates, dungeons

## Remaining Renderers 📝

### High Priority (Common Types)
- [ ] DROPS (Type 20 - 怪物掉落) - Very common
- [ ] QUESTS (Type 10 - 任務獎勵) - Very common
- [ ] GATHERED_BY (Type 7 - 採集獲得) - Common
- [ ] FATES (Type 11 - 危命任務) - Common

### Medium Priority
- [ ] DESYNTHS (Type 5 - 精製獲得)
- [ ] REDUCED_FROM (Type 4 - 分解獲得)
- [ ] VENTURES (Type 8 - 遠征獲得)
- [ ] ISLAND_CROP / Leves (Type 15 - 理符任務)
- [ ] ACHIEVEMENTS (Type 22 - 成就獎勵)
- [ ] ALARMS (Type 19 - 鬧鐘提醒)

### Lower Priority (Less Common)
- [ ] GARDENING (Type 12 - 園藝獲得)
- [ ] MOGSTATION (Type 13 - 商城購買)
- [ ] VOYAGES (Type 16 - 遠征)
- [ ] MASTERBOOKS (Type 18 - 製作書)

## Implementation Notes

### Current Approach
1. Each renderer is a separate file in `src/components/obtainRenderers/`
2. Dynamic loading via `index.js` - only loads renderers when needed
3. Shared utilities in `sharedUtils.jsx`
4. Props passed from ObtainMethods.jsx include all helper functions and data

### Helper Functions Used by Renderers
All renderers receive these as props from ObtainMethods.jsx:
- `loadedDataRef` - React ref to current loaded data
- `getNpcName()` - Get NPC names
- `getNpcTitle()` - Get NPC titles
- `getPlaceNameCN()` - Get Chinese place names
- `getShopName()` - Get shop names
- `getCurrencyName()` - Get currency item names
- `getInstanceName()` - Get instance names
- `getAchievementInfo()` - Get achievement data
- `onItemClick()` - Handle item clicks
- `navigate()` - React Router navigation
- `setMapModal()` - Open map modal
- `getItemById()` - Fetch item data
- `generateItemUrl()` - Generate item URLs
- And more...

### Benefits Achieved
1. **Reduced File Size:** Main ObtainMethods.jsx can be reduced by ~2000 lines
2. **Better Performance:** Dynamic loading only imports needed renderers
3. **Improved Maintainability:** Each method type in its own focused file
4. **Easier Testing:** Can test renderers individually
5. **Better Code Organization:** Clear separation of concerns

## Next Steps

### To Complete the Refactoring:

1. **Implement remaining renderers** (prioritize common types first)
   - DROPS renderer is large and complex (grouped by zone)
   - QUESTS renderer has special handling for levequests
   - GATHERED_BY shows gathering nodes with timers
   - FATES includes location and level info

2. **Update ObtainMethods.jsx** (optional)
   - Can optionally update to use dynamic loader
   - Current code still works as-is
   - Can gradually migrate one type at a time

3. **Test each renderer**
   - Verify data displays correctly
   - Check all interactive elements work
   - Ensure no console errors

## Usage Example

```javascript
import { getRenderer } from './obtainRenderers';
import { DataType } from '../services/extractsService';

// In ObtainMethods.jsx
const renderSourceDynamic = async (source, index) => {
  const renderer = await getRenderer(source.type);
  if (renderer) {
    return renderer({
      source,
      index,
      dataLoaded,
      loadedDataRef,
      onItemClick,
      navigate,
      // ... all other props
    });
  }
  return null;
};
```

## File Structure

```
src/components/obtainRenderers/
├── README.md                      # Documentation
├── PROGRESS.md                    # This file
├── index.js                       # Dynamic loader
├── sharedUtils.jsx                # Shared utilities
├── craftedByRenderer.jsx          # ✅ Implemented
├── tradeSourcesRenderer.jsx       # ✅ Implemented
├── vendorsRenderer.jsx            # ✅ Implemented
├── treasuresRenderer.jsx          # ✅ Implemented
├── instancesRenderer.jsx          # ✅ Implemented
├── dropsRenderer.jsx              # 📝 TODO
├── questsRenderer.jsx             # 📝 TODO
├── fatesRenderer.jsx              # 📝 TODO
├── gatheredByRenderer.jsx         # 📝 TODO
├── desynthsRenderer.jsx           # 📝 TODO
├── reducedFromRenderer.jsx        # 📝 TODO
├── venturesRenderer.jsx           # 📝 TODO
├── gardeningRenderer.jsx          # 📝 TODO
├── mogstationRenderer.jsx         # 📝 TODO
├── levesRenderer.jsx              # 📝 TODO
├── voyagesRenderer.jsx            # 📝 TODO
├── masterbooksRenderer.jsx        # 📝 TODO
├── alarmsRenderer.jsx             # 📝 TODO
└── achievementsRenderer.jsx       # 📝 TODO
```

## Performance Impact

### Before Refactoring
- All rendering code in one 4926-line file
- All loaded at once even if not needed
- Difficult to maintain and find specific logic

### After Refactoring (Current Progress)
- 5 renderers extracted (~500-600 lines total)
- Dynamic loading - only loads what's needed
- Easy to find and update specific method types
- Remaining ~18 renderers can be gradually migrated

### Example Benefit
An item with only CRAFTED_BY and VENDORS sources:
- **Before:** Load entire 4926-line file
- **After:** Load only craftedByRenderer.jsx (~170 lines) + vendorsRenderer.jsx (~250 lines)
- **Savings:** ~95% reduction in loaded code for that item
