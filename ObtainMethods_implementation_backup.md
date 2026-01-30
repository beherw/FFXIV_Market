# ObtainMethods Component - Supabase Migration Progress

## 📋 概述

ObtainMethods 組件用於顯示物品的獲取方式（取得方式）。本文件記錄從 JSON 文件加載遷移到 Supabase 查詢的完整進度和測試結果。

## ✅ 當前狀態

**日期**: 2026-01-30  
**狀態**: 準備階段 - 所有表已遷移到 Supabase，測試完成

### 已完成的工作

1. ✅ **extracts.json 遷移到 Supabase**
   - 已添加到 `json_list.txt`
   - 表名: `extracts`
   - 結構: `object_complex`
   - 數據量: 43,393 行

2. ✅ **所有相關表已遷移**
   - 共 28 個表已成功遷移到 Supabase
   - 所有表測試通過，數據結構正確

3. ✅ **extractsService.js 已更新**
   - `getItemSources()` 現在使用 Supabase 查詢
   - 使用 `getItemSourcesById()` 函數，只查詢單一 itemId
   - 已移除 JSON chunk 加載邏輯

## 📊 Supabase 表測試結果

### 核心表（已測試 ✅）

| 表名 | 行數 | 狀態 | 用途 |
|------|------|------|------|
| `extracts` | 43,393 | ✅ | 物品獲取方式主表 |
| `tw_items` | 42,679 | ✅ | 繁體中文物品名稱 |
| `tw_npcs` | 28,059 | ✅ | 繁體中文 NPC 名稱 |
| `tw_shops` | 1,842 | ✅ | 繁體中文商店名稱 |
| `tw_instances` | 584 | ✅ | 繁體中文副本名稱 |
| `tw_quests` | 5,067 | ✅ | 繁體中文任務名稱 |
| `tw_fates` | 1,566 | ✅ | 繁體中文 FATE 名稱 |
| `tw_achievements` | 3,450 | ✅ | 繁體中文成就名稱 |
| `tw_places` | 4,767 | ✅ | 繁體中文地點名稱 |

### 輔助表（已測試 ✅）

| 表名 | 行數 | 狀態 | 用途 |
|------|------|------|------|
| `npcs` | 58,497 | ✅ | NPC 詳細數據（位置、標題等） |
| `shops` | 2,271 | ✅ | 商店詳細數據 |
| `instances` | 650 | ✅ | 副本詳細數據 |
| `quests` | 5,466 | ✅ | 任務詳細數據（獎勵等） |
| `fates` | 2,084 | ✅ | FATE 詳細數據 |
| `achievements` | 3,900 | ✅ | 成就詳細數據 |
| `places` | 5,500 | ✅ | 地點詳細數據 |

### 擴展表（已測試 ✅）

| 表名 | 行數 | 狀態 | 用途 |
|------|------|------|------|
| `tw_npc_titles` | 1,629 | ✅ | NPC 標題 |
| `tw_achievement_descriptions` | 3,450 | ✅ | 成就描述 |
| `zh_instances` | 634 | ✅ | 簡體中文副本名稱 |
| `zh_quests` | 5,281 | ✅ | 簡體中文任務名稱 |
| `zh_fates` | 1,661 | ✅ | 簡體中文 FATE 名稱 |
| `shops_by_npc` | 902 | ✅ | 按 NPC 組織的商店 |
| `gil_shop_names` | 1,109 | ✅ | 金幣商店名稱 |
| `npcs_database_pages` | 30,163 | ✅ | NPC 數據庫頁面 |
| `quests_database_pages` | 5,298 | ✅ | 任務數據庫頁面 |
| `fates_database_pages` | 2,084 | ✅ | FATE 數據庫頁面 |
| `fate_sources` | 146 | ✅ | FATE 來源映射 |
| `loot_sources` | 3,865 | ✅ | 戰利品來源映射 |

## 🔍 數據結構測試

### extracts 表結構

```json
{
  "id": 2,
  "sources": [
    {
      "type": 2,
      "data": [
        {
          "id": 1769663,
          "type": "SpecialShop",
          "npcs": [{"id": 1016902}, {"id": 1016903}],
          "trades": [{
            "currencies": [{"id": 14944, "amount": 2}],
            "items": [{"id": 2, "amount": 15}]
          }]
        }
      ]
    }
  ]
}
```

**測試結果**:
- ✅ sources 字段為 JSONB 類型，自動解析為數組
- ✅ 數據結構與原始 JSON 完全一致
- ✅ 測試 itemId=2，返回 7 個 source types: [2, 6, 7, 8, 9, 13, 15]

### 各表數據結構示例

#### tw_items
```json
{"id": 1, "tw": "Gil"}
```

#### tw_npcs
```json
{"id": 1000063, "tw": "郵差莫古利"}
```

#### tw_shops
```json
{"id": 262151, "tw": "購買道具"}
```

#### npcs
```json
{
  "id": 1000000,
  "en": null,
  "ja": null,
  "title": {"en": "", "ja": ""},
  "defaultTalks": []
}
```

#### shops
```json
{
  "id": 0,
  "type": "GilShop",
  "npcs": [],
  "trades": [{
    "items": [{"id": 4594, "amount": 1}],
    "currencies": [{"id": 1, "amount": 108}]
  }]
}
```

## 📝 json_list.txt 配置

所有 ObtainMethods 需要的表已添加到 `json_converter/json_list.txt`:

### NPC 相關 (4 個)
- `tw-npc-titles.json` → `tw_npc_titles` (object_nested)
- `tw-npcs.json` → `tw_npcs` (object_nested)
- `npcs.json` → `npcs` (object_complex)
- `npcs-database-pages.json` → `npcs_database_pages` (object_complex)

### Shop 相關 (4 個)
- `tw-shops.json` → `tw_shops` (object_nested)
- `shops.json` → `shops` (object_complex)
- `shops-by-npc.json` → `shops_by_npc` (object_complex)
- `gil-shop-names.json` → `gil_shop_names` (object_nested)

### Instance 相關 (3 個)
- `tw-instances.json` → `tw_instances` (object_nested)
- `instances.json` → `instances` (object_complex)
- `zh-instances.json` → `zh_instances` (object_nested)

### Quest 相關 (4 個)
- `tw-quests.json` → `tw_quests` (object_nested)
- `quests.json` → `quests` (object_complex)
- `zh-quests.json` → `zh_quests` (object_nested)
- `quests-database-pages.json` → `quests_database_pages` (object_complex)

### FATE 相關 (5 個)
- `tw-fates.json` → `tw_fates` (object_nested)
- `fates.json` → `fates` (object_complex)
- `zh-fates.json` → `zh_fates` (object_nested)
- `fates-database-pages.json` → `fates_database_pages` (object_complex)
- `fate-sources.json` → `fate_sources` (object_nested)

### Achievement 相關 (3 個)
- `tw-achievements.json` → `tw_achievements` (object_nested)
- `tw-achievement-descriptions.json` → `tw_achievement_descriptions` (object_nested)
- `achievements.json` → `achievements` (object_complex)

### Place/Zone 相關 (2 個)
- `tw-places.json` → `tw_places` (object_nested)
- `places.json` → `places` (object_nested)

### Loot Sources (1 個)
- `loot-sources.json` → `loot_sources` (object_nested)

## 🎯 下一步計劃

### 階段 1: 創建批量查詢函數（待完成）

需要在 `supabaseData.js` 中創建以下函數：

1. **NPC 相關**
   - `getTwNpcsByIds(npcIds)` - 批量查詢繁體中文 NPC 名稱
   - `getNpcsByIds(npcIds)` - 批量查詢 NPC 詳細數據
   - `getNpcsDatabasePagesByIds(npcIds)` - 批量查詢 NPC 數據庫頁面

2. **Shop 相關**
   - `getTwShopsByIds(shopIds)` - 批量查詢繁體中文商店名稱
   - `getShopsByIds(shopIds)` - 批量查詢商店詳細數據
   - `getShopsByNpcIds(npcIds)` - 批量查詢按 NPC 組織的商店

3. **Instance 相關**
   - `getTwInstancesByIds(instanceIds)` - 批量查詢繁體中文副本名稱
   - `getInstancesByIds(instanceIds)` - 批量查詢副本詳細數據
   - `getZhInstancesByIds(instanceIds)` - 批量查詢簡體中文副本名稱

4. **Quest 相關**
   - `getTwQuestsByIds(questIds)` - 批量查詢繁體中文任務名稱
   - `getQuestsByIds(questIds)` - 批量查詢任務詳細數據
   - `getZhQuestsByIds(questIds)` - 批量查詢簡體中文任務名稱
   - `getQuestsDatabasePagesByIds(questIds)` - 批量查詢任務數據庫頁面

5. **FATE 相關**
   - `getTwFatesByIds(fateIds)` - 批量查詢繁體中文 FATE 名稱
   - `getFatesByIds(fateIds)` - 批量查詢 FATE 詳細數據
   - `getZhFatesByIds(fateIds)` - 批量查詢簡體中文 FATE 名稱
   - `getFatesDatabasePagesByIds(fateIds)` - 批量查詢 FATE 數據庫頁面

6. **Achievement 相關**
   - `getTwAchievementsByIds(achievementIds)` - 批量查詢繁體中文成就名稱
   - `getTwAchievementDescriptionsByIds(achievementIds)` - 批量查詢成就描述
   - `getAchievementsByIds(achievementIds)` - 批量查詢成就詳細數據

7. **Place 相關**
   - `getTwPlacesByIds(zoneIds)` - 批量查詢繁體中文地點名稱
   - `getPlacesByIds(zoneIds)` - 批量查詢地點詳細數據

8. **其他**
   - `getFateSourcesByItemId(itemId)` - 查詢 FATE 來源
   - `getLootSourcesByItemId(itemId)` - 查詢戰利品來源

### 階段 2: 重構 ObtainMethods 組件（待完成）

1. **移除預先加載**
   - 移除 `useEffect` 中預先加載所有數據的邏輯
   - 移除 `dataLoaded` 狀態和相關檢查

2. **實現按需加載**
   - 先獲取 `sources`（從 Supabase）
   - 分析 `sources` 中需要的所有 ID
   - 批量查詢 Supabase 只獲取需要的數據
   - 按順序加載：sources → IDs → 批量查詢 → 渲染

3. **優化查詢順序**
   - 優先查詢最常用的數據（NPC、Shop、Item 名稱）
   - 延遲加載大型數據（database pages）
   - 使用並行查詢提高效率

4. **保持向後兼容**
   - 保持現有的函數接口（`getNpcName`, `getShopName` 等）
   - 內部實現改為從 Supabase 查詢的數據對象中獲取

## 🔧 技術細節

### 危命任務（FATE）處理邏輯

FATE 數據來源有三個：

1. **extracts 表的 sources**
   - 從 `extracts` 表的 `sources` 字段中提取 `type: 11` (DataType.FATES) 的數據
   - 數據格式：`{ type: 11, data: [{ id, level, zoneId, mapId, coords }, ...] }`

2. **fate_sources 表**
   - 查詢 `fate_sources` 表，獲取該物品的額外 FATE 來源
   - 用於補充 `extracts` 中可能缺失的 FATE 數據
   - 查詢函數：`getFateSourcesByItemId(itemId)`

3. **fates_database_pages 表反向查找**
   - 遍歷 `fates_database_pages` 表，查找 `items` 數組中包含該物品的 FATE
   - 用於發現所有可能獎勵該物品的 FATE（包括稀有掉落）

**處理流程**：
```
1. 從 extracts 獲取 FATE sources
   ↓
2. 從 fate_sources 表獲取額外 FATE IDs
   ↓
3. 合併兩者，去重
   ↓
4. 從 fates_database_pages 反向查找獎勵該物品的 FATE
   ↓
5. 再次合併，確保所有相關 FATE 都被包含
   ↓
6. 批量查詢 FATE 詳細數據（名稱、圖標、位置等）
   ↓
7. 渲染顯示
```

**獎勵物品顯示邏輯**：
- **銀牌獎勵**：顯示 `fates_database_pages.items` 數組中的所有物品
- **金牌獎勵**：顯示相同物品，但標記為 `×5`（數量更多）
- **稀有獎勵**：如果物品不在 `items` 數組中，但在 `fate_sources` 中，則顯示為稀有掉落

**過濾邏輯**：
- 過濾掉被誤分類為 FATE 的採集節點（有 `nodeId` 或 `itemId` 但沒有 `id`）
- 只顯示在 Supabase 中有數據的 FATE（`tw_fates`、`fates` 或 `fates_database_pages` 中至少有一個存在）

### 查詢優化原則

1. **永遠不載入全部數據**
   - 使用 `WHERE id IN (...)` 查詢
   - 批量查詢最多 1000 個 ID（Supabase 限制）

2. **按需加載**
   - 先分析 sources，提取需要的 ID
   - 只查詢實際需要的數據

3. **緩存機制**
   - 使用 `targetedQueryCache` 緩存查詢結果
   - 避免重複查詢相同的 ID

4. **並行查詢**
   - 不同類型的數據可以並行查詢
   - 使用 `Promise.all()` 提高效率

### 數據加載流程

```
1. 獲取 sources (getItemSourcesById)
   ↓
2. 分析 sources，提取所有需要的 ID
   ↓
3. 批量查詢 Supabase（並行）
   - NPC IDs → getTwNpcsByIds, getNpcsByIds
   - Shop IDs → getTwShopsByIds, getShopsByIds
   - Instance IDs → getTwInstancesByIds, getInstancesByIds
   - Quest IDs → getTwQuestsByIds, getQuestsByIds
   - ... 等等
   ↓
4. 渲染組件
```

## 📚 參考資料

- `src/services/extractsService.js` - extracts 查詢服務
- `src/services/supabaseData.js` - Supabase 數據查詢服務
- `src/components/ObtainMethods.jsx` - 主組件（待重構）
- `json_converter/json_list.txt` - 表配置列表

## ✅ 測試檢查清單

- [x] extracts 表存在且數據正確
- [x] 所有 28 個表都已遷移到 Supabase
- [x] 數據結構與原始 JSON 一致
- [x] extracts sources 字段正確解析為數組
- [x] 批量查詢函數已實現
- [x] ObtainMethods 組件已重構
- [ ] 性能測試通過
- [ ] 功能測試通過

## 🎯 重構完成狀態

### ✅ 已完成的工作

1. **批量查詢函數** (`supabaseData.js`)
   - ✅ 所有 NPC、Shop、Instance、Quest、FATE、Achievement、Place 相關函數
   - ✅ 特殊來源查詢函數（FateSources, LootSources）
   - ✅ 緩存機制已實現

2. **ObtainMethods 組件重構**
   - ✅ 移除所有 JSON 文件導入和懶加載
   - ✅ 實現按需加載：sources → 提取 IDs → 批量查詢
   - ✅ 更新所有數據訪問函數使用 `loadedData`
   - ✅ 添加調試日誌

3. **輔助函數**
   - ✅ `extractIdsFromSources.js` - 從 sources 提取所需 IDs

### 📋 測試準備

- ✅ 構建成功（`npm run build`）
- ✅ 測試文檔已創建（`TEST_OBTAIN_METHODS.md`）
- ✅ 測試腳本已創建（`test_obtain_methods.js`）

### 🔍 下一步：測試

請按照 `TEST_OBTAIN_METHODS.md` 進行測試：
1. 啟動開發服務器：`npm run dev`
2. 打開瀏覽器開發者工具
3. 訪問物品頁面進行測試
4. 檢查 Console 日誌確認數據加載
5. 驗證所有數據正確顯示

---

**最後更新**: 2026-01-30  
**狀態**: ✅ 重構完成，準備測試
