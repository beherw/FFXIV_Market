# Obtainable Methods 修復報告

## 日期: 2024年

## 問題摘要

原本的 `build-obtainable-methods-v2.js` 腳本使用了**錯誤的 DataType enum 對應**，導致多個方法類型的數據完全錯誤或無法顯示。

## 根本原因

### 錯誤的 DataType Enum

腳本中的 DataType enum 定義與 Teamcraft 實際使用的值不匹配：

**原本錯誤的對應:**
```javascript
const DataType = {
  DEPRECATED: 0,
  CRAFTED_BY: 1,
  // ... 
  VENTURES: 8,      // 錯誤! 應該是 GARDENING
  TREASURES: 9,     // 錯誤! 應該是 VOYAGES
  QUESTS: 10,       // 錯誤! 應該是 DROPS
  FATES: 11,        // 錯誤! 應該是 ALARMS
  GARDENING: 12,    // 錯誤! 應該是 MASTERBOOKS
  // ...
};
```

**正確的對應 (來自 Teamcraft `data-type.ts`):**
```javascript
const DataType = {
  DEPRECATED: -1,
  NONE: 0,
  CRAFTED_BY: 1,
  TRADE_SOURCES: 2,
  VENDORS: 3,
  REDUCED_FROM: 4,
  DESYNTHS: 5,
  INSTANCES: 6,
  GATHERED_BY: 7,
  GARDENING: 8,
  VOYAGES: 9,
  DROPS: 10,
  ALARMS: 11,
  MASTERBOOKS: 12,
  TREASURES: 13,
  FATES: 14,
  VENTURES: 15,
  TRIPLE_TRIAD_DUELS: 16,
  TRIPLE_TRIAD_PACK: 17,
  QUESTS: 18,
  ACHIEVEMENTS: 19,
  REQUIREMENTS: 20,
  MOGSTATION: 21,
  ISLAND_PASTURE: 22,
  ISLAND_CROP: 23
};
```

## 修復內容

### 1. DataType Enum 修正
- 完全重寫 DataType enum 以匹配 Teamcraft 定義
- 更新 TYPE_NAME_MAP 和 getTypeString 函數

### 2. 數據處理器修正

| 類型 | 問題 | 修復 |
|------|------|------|
| **GARDENING (8)** | 預期陣列，實際是單一物件 `{seedItemId, duration, crossBreeds}` | 修改為處理單一物件 |
| **ALARMS (11)** | 預期簡單 node IDs，實際是豐富物件 `{nodeId, zoneId, coords, spawns}` | 已正確處理 |
| **MASTERBOOKS (12)** | 使用內部 ID，無法對應物品名稱 | 直接使用 extracts 中的物品 ID |
| **TREASURES (13)** | 預期地圖名稱物件 | 修改為處理產品 ID 陣列 |
| **FATES (14)** | 錯誤地處理為限時採集點 | 修改為處理 FATE 事件數據 |
| **VENTURES (15)** | 預期 `{seedItemId}` | 修改為處理豐富的探險數據 |
| **ACHIEVEMENTS (19)** | 預期 `{id}` 物件 | 修改為處理整數 ID 陣列 |
| **REQUIREMENTS (20)** | 未處理 | 新增處理 `{id, amount}` 怪物掉落數據 |
| **MOGSTATION (21)** | 預期陣列 | 修改為處理單一物件 `{price, id}` |
| **ISLAND_CROP (23)** | 預期陣列 | 修改為處理單一物件 `{seed}` |

### 3. 類型名稱更新

- `ephemeralNode` → `fate` (正確反映 FATE 任務獎勵)
- 新增 `mobdrop` 類型 (Type 20 REQUIREMENTS 實際是怪物掉落)
- 移除不存在的 `gcsupply` 類型

## 修復結果

### 數據品質對比

| 類型 | 修復前 | 修復後 | 改善 |
|------|--------|--------|------|
| masterbook | 49.2% 有書名 | **100%** 有書名 (3,875) | 🎉 |
| gardening | 0% 有種子名 | **100%** 有種子名 (300) | 🎉 |
| alarm | 空白區域名 | **100%** 有區域名 (806) | 🎉 |
| drop | 0.6% 有怪物名 | **100%** 有怪物名 (252) | 🎉 |
| achievement | 9 項目 | **189** 項目有名稱 | 🎉 |
| venture | 錯誤數據結構 | **100%** 有探險數據 (1,425) | 🎉 |
| fate | 錯誤數據 (是採集點) | **146** FATE 項目 | 🎉 |
| islandcrop | 錯誤數據結構 | **100%** 有種子名 (20) | 🎉 |

### 輸出統計

- 總項目數: 38,256
- 總來源數: 53,944
- 輸出檔案: 21.01 MB (JSON), 12.46 MB (MIN)

### 類型分布

```
specialshop: 13,111
craft: 11,331
vendor: 6,676
instance: 6,614
masterbook: 3,875
treasure: 3,838
gathering: 2,924
venture: 1,425
alarm: 806
mogstation: 799
desynth: 719
voyage: 382
gardening: 300
quest: 299
drop: 252
achievement: 189
mobdrop: 163
fate: 146
reduction: 66
islandcrop: 20
islandpasture: 9
```

## 已知限制

1. **mobdrop 部分怪物名稱缺失**: 部分較新的怪物 ID (21792+) 在 mobs.json 中不存在
2. **voyage 名稱為英文**: Teamcraft 沒有提供 TW locale 的航線名稱
3. **basic 類型已移除**: Type -1 (DEPRECATED) 的基礎道具不再輸出，因為它們沒有有意義的取得方式

## 受影響的檔案

- `scripts/build-obtainable-methods-v2.js` - 主要修改
- `public/data/obtainable-methods.json` - 輸出數據
- `public/data/obtainable-methods.min.json` - 壓縮輸出

## 前端注意事項

前端渲染器需要更新以處理新的類型名稱:

1. `fate` (原 `ephemeralNode`) - FATE 任務獎勵
2. `mobdrop` (新增) - 怪物掉落 (有數量)
3. `drop` - 野外怪物掉落 (有位置)

## 測試建議

1. 驗證以下物品的取得方式是否正確顯示:
   - 物品 1666 (需要秘籍配方)
   - 物品 2221 (成就獎勵)
   - 物品 2 (園藝種植、探險、限時採集等)

2. 檢查前端各個方法渲染器是否正確對應新的類型名稱
