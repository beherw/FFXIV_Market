# Obtainable Methods Investigation Report

## Overview

This document tracks the investigation of all obtainable methods in the FFXIV Market application.

**Investigation Date:** 2026-02-05

**Statistics:**
- Total Items: 43,393
- Total Sources: 61,495

---

## Type Summary Table

| Type | Count | Sample Items | Status | Issues |
|------|-------|--------------|--------|--------|
| specialshop | 13,111 | 2, 3, 4 | ⏳ Pending | |
| craft | 11,331 | 1602, 1603, 1604 | ⏳ Pending | |
| vendor | 6,676 | 1601, 1602, 1603 | ⏳ Pending | |
| instance | 6,614 | 2, 3, 4 | ⏳ Pending | |
| type_-1 | 4,136 | 23, 24, 26 | ⏳ Pending | Unknown type! |
| gardening | 3,875 | 1666, 1736, 1806 | ⏳ Pending | |
| mogstation | 3,838 | 2, 3, 4 | ⏳ Pending | |
| masterbook | 3,714 | 8, 9, 10 | ⏳ Pending | |
| gathering | 2,924 | 2, 3, 4 | ⏳ Pending | |
| islandcrop | 1,425 | 2, 3, 4 | ⏳ Pending | |
| fate | 806 | 8, 9, 10 | ⏳ Pending | |
| type_21 | 799 | 2967, 2968, 2969 | ⏳ Pending | Unknown type! |
| desynth | 719 | 13, 19, 1616 | ⏳ Pending | |
| treasure | 382 | 2, 3, 4 | ⏳ Pending | |
| venture | 300 | 2, 3, 4 | ⏳ Pending | |
| quest | 252 | 4, 9, 27 | ⏳ Pending | |
| alarm | 189 | 2221, 2222, 2223 | ⏳ Pending | |
| drop | 163 | 15956, 26508, 26509 | ⏳ Pending | |
| islandpasture | 146 | 6155, 6164, 6174 | ⏳ Pending | |
| reduction | 66 | 8, 9, 10 | ⏳ Pending | |
| tripleTriadDuel | 20 | 37593, 37594, 37595 | ⏳ Pending | |
| achievement | 9 | 37603, 37604, 37605 | ⏳ Pending | |

---

## Detailed Investigation

### 1. specialshop (兌換) - 13,111 occurrences

**Sample Data Structure:**
```json
{
  "type": "specialshop",
  "typeName": "兌換",
  "currency": "item",
  "vendors": [{"npcName": "", "zoneName": "", "aetheryteName": ""}]
}
```

**Frontend Renderer:** `tradeSourcesRenderer.jsx`
**DataType:** 2 (TRADE_SOURCES)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- ⚠️ `npcName`, `zoneName`, `aetheryteName` are empty strings!
- ⚠️ Missing `currencyItemId` and `price` fields

**Root Cause Analysis:**
- TODO: Check extracts.json structure
- TODO: Check build script conversion

**Fix Status:** ⏳ Pending

---

### 2. craft (製作) - 11,331 occurrences

**Sample Data Structure:**
```json
{
  "type": "craft",
  "typeName": "製作",
  "recipeId": 3,
  "job": 9
}
```

**Frontend Renderer:** `craftedByRenderer.jsx`
**DataType:** 1 (CRAFTED_BY)

**Test Items:**
- [ ] Item 1602:
- [ ] Item 1603:
- [ ] Item 1604:

**Issues Found:**
- TODO

**Fix Status:** ⏳ Pending

---

### 3. vendor (NPC商店) - 6,676 occurrences

**Sample Data Structure:**
```json
{
  "type": "vendor",
  "typeName": "NPC商店",
  "price": 63
}
```

**Frontend Renderer:** `vendorsRenderer.jsx`
**DataType:** 3 (VENDORS)

**Test Items:**
- [ ] Item 1601:
- [ ] Item 1602:
- [ ] Item 1603:

**Issues Found:**
- ⚠️ Missing `vendors` array with NPC info

**Fix Status:** ⏳ Pending

---

### 4. instance (副本掉落) - 6,614 occurrences

**Sample Data Structure:**
```json
{
  "type": "instance",
  "typeName": "副本",
  "instanceNames": ["Instance 9", "Instance 52", ...],
  "instanceContentTypes": [2],
  "totalInstances": 6
}
```

**Frontend Renderer:** `instancesRenderer.jsx`
**DataType:** 6 (INSTANCES)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- ⚠️ `instanceNames` contains "Instance X" placeholders instead of real names

**Fix Status:** ⏳ Pending

---

### 5. type_-1 (未知) - 4,136 occurrences

**Sample Data Structure:**
```json
{
  "type": "type_-1",
  "typeName": "未知"
}
```

**Frontend Renderer:** None
**DataType:** -1 (UNKNOWN)

**Issues Found:**
- ⚠️ This is an undefined type - need to investigate what this data represents
- ⚠️ No frontend renderer exists

**Fix Status:** ⏳ Pending

---

### 6. gardening (園藝獲得) - 3,875 occurrences

**Sample Data Structure:**
```json
{
  "type": "gardening",
  "typeName": "園藝獲得",
  "count": 1
}
```

**Frontend Renderer:** `gardeningRenderer.jsx`
**DataType:** 12 (GARDENING)

**Test Items:**
- [ ] Item 1666:
- [ ] Item 1736:
- [ ] Item 1806:

**Issues Found:**
- ⚠️ Only has `count` field - no actual gardening info like seeds, soil, etc.

**Fix Status:** ⏳ Pending

---

### 7. mogstation (商城購買) - 3,838 occurrences

**Sample Data Structure:**
```json
{
  "type": "mogstation",
  "typeName": "商城購買",
  "count": 5
}
```

**Frontend Renderer:** `mogstationRenderer.jsx`
**DataType:** 13 (MOGSTATION)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- Should be OK - mogstation items just need to show they're from the shop

**Fix Status:** ⏳ Pending

---

### 8. masterbook (製作書) - 3,714 occurrences

**Sample Data Structure:**
```json
{
  "type": "masterbook",
  "typeName": "製作書",
  "count": 78
}
```

**Frontend Renderer:** `masterbooksRenderer.jsx`
**DataType:** 18 (MASTERBOOKS)

**Test Items:**
- [ ] Item 8:
- [ ] Item 9:
- [ ] Item 10:

**Issues Found:**
- ⚠️ Only has `count` - missing masterbook ID and name

**Fix Status:** ⏳ Pending

---

### 9. gathering (採集獲得) - 2,924 occurrences

**Sample Data Structure:**
```json
{
  "type": "gathering",
  "typeName": "採集獲得"
}
```

**Frontend Renderer:** `gatheredByRenderer.jsx`
**DataType:** 7 (GATHERED_BY)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- ⚠️ Missing node info (level, zone, coordinates, time restrictions)

**Fix Status:** ⏳ Pending

---

### 10. islandcrop (無人島農作) - 1,425 occurrences

**Sample Data Structure:**
```json
{
  "type": "islandcrop",
  "typeName": "無人島農作",
  "count": 2
}
```

**Frontend Renderer:** `levesRenderer.jsx` (incorrect mapping!)
**DataType:** 15 (ISLAND_CROP)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- ⚠️ Mapped to wrong renderer (levesRenderer)!
- ⚠️ Only has count, missing crop info

**Fix Status:** ⏳ Pending

---

### 11. fate (危命任務) - 806 occurrences

**Sample Data Structure:**
```json
{
  "type": "fate",
  "typeName": "危命任務",
  "fateName": "",
  "zoneName": ""
}
```

**Frontend Renderer:** `fatesRenderer.jsx`
**DataType:** 11 (FATES)

**Test Items:**
- [ ] Item 8:
- [ ] Item 9:
- [ ] Item 10:

**Issues Found:**
- ⚠️ `fateName` and `zoneName` are empty strings!

**Fix Status:** ⏳ Pending

---

### 12. type_21 (未知) - 799 occurrences

**Sample Data Structure:**
```json
{
  "type": "type_21",
  "typeName": "未知"
}
```

**Frontend Renderer:** `explorationResultsRenderer.jsx`
**DataType:** 21

**Test Items:**
- [ ] Item 2967:
- [ ] Item 2968:
- [ ] Item 2969:

**Issues Found:**
- ⚠️ Unknown type - need to investigate

**Fix Status:** ⏳ Pending

---

### 13. desynth (精製獲得) - 719 occurrences

**Sample Data Structure:**
```json
{
  "type": "desynth",
  "typeName": "精製獲得",
  "count": 1
}
```

**Frontend Renderer:** `desynthsRenderer.jsx`
**DataType:** 5 (DESYNTHS)

**Test Items:**
- [ ] Item 13:
- [ ] Item 19:
- [ ] Item 1616:

**Issues Found:**
- ⚠️ Only has count - missing source item IDs for desynth

**Fix Status:** ⏳ Pending

---

### 14. treasure (寶箱/容器) - 382 occurrences

**Sample Data Structure:**
```json
{
  "type": "treasure",
  "typeName": "寶箱/容器",
  "count": 1
}
```

**Frontend Renderer:** `treasuresRenderer.jsx`
**DataType:** 9 (TREASURES)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- ⚠️ Only has count - missing treasure map names

**Fix Status:** ⏳ Pending

---

### 15. venture (遠征獲得) - 300 occurrences

**Sample Data Structure:**
```json
{
  "type": "venture",
  "typeName": "遠征獲得"
}
```

**Frontend Renderer:** `venturesRenderer.jsx`
**DataType:** 8 (VENTURES)

**Test Items:**
- [ ] Item 2:
- [ ] Item 3:
- [ ] Item 4:

**Issues Found:**
- ⚠️ Missing venture level, quantities, category

**Fix Status:** ⏳ Pending

---

### 16. quest (任務獎勵) - 252 occurrences

**Sample Data Structure:**
```json
{
  "type": "quest",
  "typeName": "任務獎勵",
  "questId": 115,
  "questName": ""
}
```

**Frontend Renderer:** `questsRenderer.jsx`
**DataType:** 10 (QUESTS)

**Test Items:**
- [ ] Item 4:
- [ ] Item 9:
- [ ] Item 27:

**Issues Found:**
- ⚠️ `questName` is empty!

**Fix Status:** ⏳ Pending

---

### 17. alarm (鬧鐘提醒) - 189 occurrences

**Sample Data Structure:**
```json
{
  "type": "alarm",
  "typeName": "鬧鐘提醒",
  "count": 1
}
```

**Frontend Renderer:** `alarmsRenderer.jsx`
**DataType:** 19 (ALARMS)

**Test Items:**
- [ ] Item 2221:
- [ ] Item 2222:
- [ ] Item 2223:

**Issues Found:**
- ⚠️ Only has count - missing alarm/node info

**Fix Status:** ⏳ Pending

---

### 18. drop (怪物掉落) - 163 occurrences

**Sample Data Structure:**
```json
{
  "type": "drop",
  "typeName": "怪物掉落",
  "monsters": [{"name": "", "zoneName": ""}]
}
```

**Frontend Renderer:** `dropsRenderer.jsx`
**DataType:** 20 (DROPS)

**Test Items:**
- [ ] Item 15956:
- [ ] Item 26508:
- [ ] Item 26509:

**Issues Found:**
- ⚠️ `monsters.name` and `monsters.zoneName` are empty!

**Fix Status:** ⏳ Pending

---

### 19. islandpasture (無人島牧場) - 146 occurrences

**Sample Data Structure:**
```json
{
  "type": "islandpasture",
  "typeName": "無人島牧場",
  "count": 1
}
```

**Frontend Renderer:** Returns null (filtered out)
**DataType:** 14 (ISLAND_PASTURE)

**Test Items:**
- [ ] Item 6155:
- [ ] Item 6164:
- [ ] Item 6174:

**Issues Found:**
- ⚠️ Intentionally filtered out? Need to verify

**Fix Status:** ⏳ Pending

---

### 20. reduction (分解獲得) - 66 occurrences

**Sample Data Structure:**
```json
{
  "type": "reduction",
  "typeName": "分解獲得",
  "count": 9
}
```

**Frontend Renderer:** `reducedFromRenderer.jsx`
**DataType:** 4 (REDUCED_FROM)

**Test Items:**
- [ ] Item 8:
- [ ] Item 9:
- [ ] Item 10:

**Issues Found:**
- ⚠️ Only has count - missing source item IDs

**Fix Status:** ⏳ Pending

---

### 21. tripleTriadDuel (三重幻卡對戰) - 20 occurrences

**Sample Data Structure:**
```json
{
  "type": "tripleTriadDuel",
  "typeName": "三重幻卡對戰"
}
```

**Frontend Renderer:** None
**DataType:** 23

**Test Items:**
- [ ] Item 37593:
- [ ] Item 37594:
- [ ] Item 37595:

**Issues Found:**
- ⚠️ No frontend renderer
- ⚠️ Missing NPC name, location

**Fix Status:** ⏳ Pending

---

### 22. achievement (成就獎勵) - 9 occurrences

**Sample Data Structure:**
```json
{
  "type": "achievement",
  "typeName": "成就獎勵",
  "achievementId": 1,
  "achievementName": ""
}
```

**Frontend Renderer:** `achievementsRenderer.jsx`
**DataType:** 22 (ACHIEVEMENTS)

**Test Items:**
- [ ] Item 37603:
- [ ] Item 37604:
- [ ] Item 37605:

**Issues Found:**
- ⚠️ `achievementName` is empty!

**Fix Status:** ⏳ Pending

---

## Summary of Critical Issues

### Data Issues (Backend)
1. **Empty string fields** - Many types have empty string values for important fields
2. **Missing reference data** - NPC names, zone names, quest names, etc. not being populated
3. **Unknown types** - `type_-1` and `type_21` need investigation
4. **Minimal data** - Many types only have `count` field, missing essential details

### Frontend Issues
1. **islandcrop mapped to levesRenderer** - Wrong renderer assignment
2. **Missing renderers** - `type_-1`, `type_21`, `tripleTriadDuel`
3. **islandpasture filtered out** - May need a renderer

### Recommended Fixes

1. **Backend (build-obtainable-methods-optimized.js)**
   - Load additional reference data (NPC names, zone names, quest names, etc.)
   - Properly populate all fields during data conversion
   - Handle unknown types gracefully

2. **Frontend (renderers)**
   - Create missing renderers
   - Fix islandcrop renderer mapping
   - Add fallback display for missing data

---

## Progress Tracking

- [ ] Phase 1: Investigate raw extracts.json structure
- [ ] Phase 2: Fix backend data generation
- [ ] Phase 3: Fix frontend renderers
- [ ] Phase 4: Test all types with 3 items each
- [ ] Phase 5: Final verification

---

## Next Steps

1. Examine raw extracts.json to understand the original data structure
2. Compare with ffxiv-item-search-tc implementation
3. Update build script to properly extract all fields
4. Create/fix frontend renderers
5. Run comprehensive tests
