# ZoneId 處理追蹤文檔

## 目的
追蹤所有使用 zoneId 的地方，確保每個地方都正確使用了中心化的 placeUtils 模組，避免修好一個壞一個的問題。

## 中心化模組
**文件**: `src/utils/placeUtils.js`

### 函數列表
1. `getPlaceName(zoneId, placeData)` - 基礎函數，返回繁體中文或英文，找不到時返回 `Zone {zoneId}`
2. `getPlaceNameWithFallback(zoneId, placeData, fallbackPrefix)` - 帶中文備用的函數，找不到時返回 `{fallbackPrefix} {zoneId}`（默認「區域 {zoneId}」）
3. `hasPlaceData(zoneId, placeData)` - 檢查是否有區域數據

### 使用原則
- **顯示給用戶的地方**：使用 `getPlaceNameCN()` 或 `getPlaceNameWithFallback()`，確保顯示中文備用文本
- **內部邏輯判斷**：可以使用 `getPlaceName()` 或 `hasPlaceData()`

---

## 追蹤清單

### ObtainMethods.jsx

#### 1. TRADE_SOURCES (商店兌換) - NPC 位置
- **行號**: ~1533
- **zoneId 來源**: `npc.zoneId` (從 trade source 的 npc 對象)
- **當前實現**: `const zoneName = npcZoneId ? getPlaceName(npcZoneId) : '';`
- **狀態**: ⚠️ **需要修改** - 應改為 `getPlaceNameCN`
- **顯示位置**: 
  - Line 1618: `{zoneName && hasLocation && (`
  - Line 1625: `zoneName,` (MapModal)
  - Line 1638: `{zoneName}` (顯示文本)
- **備註**: 用於顯示 NPC 位置，應該使用中文備用

#### 2. VENDORS (商人) - 位置信息
- **行號**: ~1721
- **zoneId 來源**: `firstVendor.zoneId` 或從 NPC 數據獲取
- **當前實現**: `const zoneName = zoneId ? getPlaceName(zoneId) : '';`
- **狀態**: ⚠️ **需要修改** - 應改為 `getPlaceNameCN`
- **顯示位置**:
  - Line 1723: `const hasLocationInfo = zoneName && coords && ...`
  - Line 1792: `zoneName,` (MapModal)
  - Line 1804: `{zoneName}` (顯示文本)
  - Line 1816: `{zoneName}` (顯示文本)
- **備註**: 用於顯示商人位置，應該使用中文備用

#### 3. QUESTS (任務) - 起始位置
- **行號**: ~2133
- **zoneId 來源**: 從 `questsDatabasePages.startingPoint.zoneid` 或 NPC 數據獲取
- **當前實現**: `const zoneName = zoneId ? getPlaceName(zoneId) : '';`
- **狀態**: ⚠️ **需要修改** - 應改為 `getPlaceNameCN`
- **顯示位置**:
  - Line 2134: `const hasLocation = zoneName && coords && ...`
  - Line 2175: `{hasLocation && zoneName && (`
  - Line 2183: `zoneName,` (MapModal)
  - Line 2196: `{zoneName}` (顯示文本)
  - Line 2204: `{zoneName}` (顯示文本)
- **備註**: 用於顯示任務起始位置，應該使用中文備用

#### 4. FATES (危命任務) - 位置信息
- **行號**: ~2278
- **zoneId 來源**: `fate.zoneId` (從 FATE 源數據)
- **當前實現**: `const zoneName = fateZoneId ? getPlaceName(fateZoneId) : '';`
- **狀態**: ⚠️ **需要修改** - 應改為 `getPlaceNameCN`
- **顯示位置**:
  - Line 2282: `if (fateZoneId && !zoneName)` (調試警告)
  - Line 2351: `{zoneName ? `${zoneName} ` : ''}{fateLevel}級危命任務` (顯示文本)
  - Line 2526: `zoneName,` (MapModal)
  - Line 2539: `{zoneName}` (顯示文本)
- **備註**: 用於顯示 FATE 位置，應該使用中文備用

#### 5. GATHERED_BY (採集獲得) - 節點位置
- **行號**: ~2604
- **zoneId 來源**: `node.zoneId` (從採集節點數據)
- **當前實現**: `const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';`
- **狀態**: ✅ **已正確** - 使用 `getPlaceNameCN`
- **顯示位置**:
  - Line 2618: `{zoneName}` (顯示文本)
  - Line 2641: `zoneName,` (MapModal)
  - Line 2654: `{zoneName}` (顯示文本)
- **備註**: 已正確使用中文備用函數

#### 6. ALARMS (鬧鐘) - 節點位置
- **行號**: ~3204
- **zoneId 來源**: `alarm.zoneId` (從鬧鐘數據)
- **當前實現**: `const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';`
- **狀態**: ✅ **已正確** - 使用 `getPlaceNameCN`
- **顯示位置**:
  - Line 3221: `{zoneName}` (顯示文本)
  - Line 3239: `zoneName,` (MapModal)
  - Line 3252: `{zoneName}` (顯示文本)
- **備註**: 已正確使用中文備用函數

---

## 數據加載追蹤

### zoneId 收集位置 (ObtainMethods.jsx)

所有 zoneId 都會在數據加載階段統一收集並查詢 place 數據：

1. **FATE sources** (Line 634): `fateZoneIds.forEach(zoneId => allZoneIds.add(zoneId));`
2. **Instances** (Line 640-648): 從 `instance.position.zoneid` 收集
3. **Quests** (Line 658): 從 `questDb.startingPoint.zoneid` 收集
4. **NPCs** (Line 675-683): 從 `npc.position.zoneid` 和 `npcDb.position.zoneid` 收集
5. **Gathered nodes** (Line 691): 從 `node.zoneId` 收集
6. **Alarms** (Line 701): 從 `alarm.zoneId` 收集
7. **Vendors** (Line 711): 從 `vendor.zoneId` 收集
8. **Trade sources** (Line 723): 從 `npc.zoneId` 收集

### Place 數據查詢 (Line 731-769)
- 統一查詢所有收集到的 zoneIds
- 查詢 `tw_places` 和 `places` 表
- 存儲到 `loadedData.twPlaces` 和 `loadedData.places`

---

## 需要修復的問題

### 高優先級（顯示給用戶的地方）
1. ✅ **GATHERED_BY** - 已修復，使用 `getPlaceNameCN`
2. ✅ **ALARMS** - 已修復，使用 `getPlaceNameCN`
3. ✅ **TRADE_SOURCES** - 已修復，使用 `getPlaceNameCN`
4. ✅ **VENDORS** - 已修復，使用 `getPlaceNameCN`
5. ✅ **QUESTS** - 已修復，使用 `getPlaceNameCN`
6. ✅ **FATES** - 已修復，使用 `getPlaceNameCN`

### 低優先級（內部邏輯）
- Line 2282: 調試警告中的 `!zoneName` 檢查可以保留使用 `getPlaceName`，因為只是檢查是否有數據

---

## 修復檢查清單

修復後請確認：
- [x] 所有顯示給用戶的 zoneName 都使用 `getPlaceNameCN`
- [x] 沒有遺漏任何顯示位置
- [ ] 測試每個取得方式類型，確認顯示正確
- [x] 確認找不到 zoneId 時顯示「區域 {zoneId}」而不是「Zone {zoneId}」

### 修復總結
所有 6 個取得方式類型都已修復：
1. ✅ TRADE_SOURCES - Line 1533: 使用 `getPlaceNameCN`
2. ✅ VENDORS - Line 1721: 使用 `getPlaceNameCN`
3. ✅ QUESTS - Line 2133: 使用 `getPlaceNameCN`
4. ✅ FATES - Line 2278: 使用 `getPlaceNameCN` (調試邏輯也更新)
5. ✅ GATHERED_BY - Line 2607: 使用 `getPlaceNameCN`
6. ✅ ALARMS - Line 3207: 使用 `getPlaceNameCN`

---

## 測試用例

### 測試物品建議
1. **採集物品** - 測試 GATHERED_BY 顯示
2. **FATE 獎勵物品** - 測試 FATES 顯示
3. **任務獎勵物品** - 測試 QUESTS 顯示
4. **商店兌換物品** - 測試 TRADE_SOURCES 顯示
5. **商人出售物品** - 測試 VENDORS 顯示
6. **鬧鐘物品** - 測試 ALARMS 顯示

### 測試重點
- 確認所有 zoneId 都正確顯示區域名稱
- 確認找不到區域名稱時顯示「區域 {zoneId}」
- 確認沒有顯示「Zone {zoneId}」的情況

---

## 更新記錄

- 2026-01-30: 創建追蹤文檔
- 2026-01-30: 修復 GATHERED_BY 和 ALARMS，使用 `getPlaceNameCN`
- 2026-01-30: 標記 TRADE_SOURCES, VENDORS, QUESTS, FATES 需要修復
- 2026-01-30: ✅ 完成所有修復 - TRADE_SOURCES, VENDORS, QUESTS, FATES 都已改為使用 `getPlaceNameCN`
