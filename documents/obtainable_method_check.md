# 獲取方法（Obtainable Method）完整檢查報告

## 日期
2026-02-01

## 所有可能的 DataType 定義
根據 `src/services/extractsService.js` 的定義：

```javascript
export const DataType = {
  DEPRECATED: 0,           // 已棄用
  CRAFTED_BY: 1,          // 製作
  TRADE_SOURCES: 2,       // 兌換
  VENDORS: 3,             // NPC商店
  REDUCED_FROM: 4,        // 分解獲得
  DESYNTHS: 5,            // 精製獲得
  INSTANCES: 6,           // 副本掉落
  GATHERED_BY: 7,         // 採集獲得
  VENTURES: 8,            // 遠征獲得
  TREASURES: 9,           // 寶箱/容器
  QUESTS: 10,             // 任務獎勵
  FATES: 11,              // 危命任務
  GARDENING: 12,          // 園藝獲得
  MOGSTATION: 13,         // 商城購買
  ISLAND_PASTURE: 14,     // 島嶼牧場（Eureka相關，已過濾）
  ISLAND_CROP: 15,        // 理符任務
  VOYAGES: 16,            // 遠征
  REQUIREMENTS: 17,       // 需求
  MASTERBOOKS: 18,        // 製作書
  ALARMS: 19,             // 鬧鐘提醒
  DROPS: 20,              // 怪物掉落
  ACHIEVEMENTS: 22,       // 成就獎勵
};
```

## 方法名稱映射（getMethodTypeName）
位置：`src/components/ObtainMethods.jsx` 第 1694-1715 行

```javascript
const methodTypeNames = {
  [DataType.CRAFTED_BY]: '製作',
  [DataType.TRADE_SOURCES]: '兌換',
  [DataType.VENDORS]: 'NPC商店',
  [DataType.TREASURES]: '寶箱/容器',
  [DataType.INSTANCES]: '副本掉落',
  [DataType.DESYNTHS]: '精製獲得',
  [DataType.QUESTS]: '任務獎勵',
  [DataType.FATES]: '危命任務',
  [DataType.GATHERED_BY]: '採集獲得',
  [DataType.REDUCED_FROM]: '分解獲得',
  [DataType.VENTURES]: '遠征獲得',
  [DataType.GARDENING]: '園藝獲得',
  [DataType.MOGSTATION]: '商城購買',
  [DataType.ISLAND_CROP]: '理符任務',
  [DataType.VOYAGES]: '遠征',
  [DataType.REQUIREMENTS]: '需求',
  [DataType.MASTERBOOKS]: '製作書',
  [DataType.ALARMS]: '鬧鐘提醒',
  [DataType.DROPS]: '怪物掉落',
  [DataType.ACHIEVEMENTS]: '成就獎勵',
};
```

## 渲染邏輯檢查（renderSource 函數）

### ✅ 已實現的類型（23種）

1. **CRAFTED_BY (1)** - ✅ 製作
   - 位置：第 1993 行
   - 功能：顯示製作職業、等級、星級、製作書需求
   - 支援展開製作價格樹

2. **TRADE_SOURCES (2)** - ✅ 兌換
   - 位置：第 2119 行
   - 功能：顯示兌換 NPC、貨幣名稱、數量、HQ 需求、商店名稱、任務前置

3. **VENDORS (3)** - ✅ NPC商店
   - 位置：第 2402 行
   - 功能：顯示商店 NPC、價格、位置、任務前置

4. **TREASURES (9)** - ✅ 寶箱/容器
   - 位置：第 2582 行
   - 功能：顯示寶箱位置

5. **INSTANCES (6)** - ✅ 副本掉落
   - 位置：第 2636 行
   - 功能：顯示副本名稱、等級

6. **DROPS (20)** - ✅ 怪物掉落
   - 位置：第 2755 行
   - 功能：按區域分組顯示怪物名稱、等級、位置
   - 同時處理 type 13（Teamcraft 原始 DROPS 值）

7. **DESYNTHS (5)** - ✅ 精製獲得
   - 位置：第 2902 行
   - 功能：顯示可精製的物品名稱

8. **QUESTS (10)** - ✅ 任務獎勵
   - 位置：第 2965 行
   - 功能：顯示任務名稱、等級、類型、接取 NPC、位置

9. **FATES (11)** - ✅ 危命任務
   - 位置：第 3229 行
   - 功能：顯示 FATE 名稱、等級、位置
   - 自動合併重複的 FATE 數據

10. **ISLAND_PASTURE (14)** - ✅ 島嶼牧場（已過濾）
    - 位置：第 3568 行
    - 功能：返回 null（不顯示）
    - 說明：這些是 Eureka 相關來源，在資料處理階段已過濾
    - 部分錯誤分類為 ISLAND_PASTURE 的 FATE 已轉換為 FATES 類型

11. **GATHERED_BY (7)** - ✅ 採集獲得
    - 位置：第 3573 行
    - 功能：顯示採集點類型、等級、星級、位置、時間限制

12. **REDUCED_FROM (4)** - ✅ 分解獲得
    - 位置：第 3681 行
    - 功能：顯示可分解的物品名稱

13. **VENTURES (8)** - ✅ 遠征獲得
    - 位置：第 3747 行
    - 功能：顯示雇員探險類型、等級

14. **GARDENING (12)** - ✅ 園藝獲得
    - 位置：第 3811 行
    - 功能：顯示種子名稱、種植時間

15. **MOGSTATION (13)** - ✅ 商城購買
    - 位置：第 3877 行
    - 功能：顯示官方商城圖標，無額外資料

16. **ISLAND_CROP (15)** - ✅ 理符任務
    - 位置：第 3900 行
    - 功能：顯示理符任務名稱、等級、類型、接取 NPC、位置

17. **VOYAGES (16)** - ✅ 遠征
    - 位置：第 4244 行
    - 功能：顯示海上探險航線名稱

18. **MASTERBOOKS (18)** - ✅ 製作書
    - 位置：第 4396 行
    - 功能：顯示製作書名稱

19. **ALARMS (19)** - ✅ 鬧鐘提醒
    - 位置：第 4529 行
    - 功能：顯示採集點定時提醒資訊（星級、時間、位置）

20. **ACHIEVEMENTS (22)** - ✅ 成就獎勵
    - 位置：第 4628 行
    - 功能：顯示成就名稱、描述、圖標
    - 支援滑鼠懸停顯示詳細工具提示

### ⚠️ 未實現的類型（3種）

1. **DEPRECATED (0)** - ⚠️ 已棄用
   - 狀態：無渲染邏輯（預期行為，已棄用類型）
   - 建議：保持現狀

2. **REQUIREMENTS (17)** - ⚠️ 需求
   - 狀態：有名稱映射，但無渲染邏輯
   - 影響：如果有物品帶有此類型資料，將不會顯示
   - 建議：需要實現或確認此類型是否已廢棄

3. **ACHIEVEMENTS (22)** - ✅ 已實現
   - 更正：此類型已實現，位置：第 4628 行

## 問題總結

### 🔴 需要立即處理

#### REQUIREMENTS (17) - 需求
- **問題**：有名稱映射 `'需求'`，但沒有對應的渲染邏輯
- **影響**：如果有物品使用此獲取方法，將無法顯示
- **建議**：
  1. 檢查資料庫中是否有物品使用 `DataType.REQUIREMENTS = 17`
  2. 如果有，需要實現渲染邏輯
  3. 如果沒有或已廢棄，可以從 `getMethodTypeName` 中移除

### ✅ 正常處理

#### DEPRECATED (0) - 已棄用
- **狀態**：預期不渲染，符合設計
- **處理**：無需修改

#### ISLAND_PASTURE (14) - 島嶼牧場
- **狀態**：已正確過濾，不應顯示
- **處理**：
  - 在 useEffect 中已將錯誤分類的 ISLAND_PASTURE 轉換為 FATES
  - renderSource 中返回 null 作為安全檢查

## 特殊處理

### 1. DROPS 類型（type 20 和 type 13）
- 同時處理 `DataType.DROPS = 20` 和舊版 `type = 13`
- 代碼位置：第 2757-2759 行
```javascript
const isDropsType = type === DataType.DROPS || 
  (type === 13 && Array.isArray(data) && data.length > 0 && 
   (typeof data[0] === 'object' && 'id' in data[0]) || typeof data[0] === 'number');
```

### 2. FATES 自動合併
- 處理重複的 FATE 數據
- 合併來自不同來源的 FATE 資訊
- 代碼位置：第 979-1010 行

### 3. ISLAND_PASTURE 轉 FATES
- 將錯誤分類的 ISLAND_PASTURE 轉換為 FATES 類型
- 代碼位置：第 914-933 行

## 排序邏輯
- **DROPS（怪物掉落）**：永遠排在第一位
- 其他類型：按物品數量降序排序
- 代碼位置：第 1600-1615 行

## 過濾功能
- 支援按獲取方法類型過濾
- 標籤顯示在標題右側
- 顯示總數量（x 種）

## 建議行動

### 立即行動
1. **檢查 REQUIREMENTS (17) 的使用情況**
   ```sql
   -- 若使用 Supabase 時可在此執行（主應用已改為本地 msgpack，此為可選）
   SELECT COUNT(*) as count
   FROM extracts_unified
   WHERE type = 17;
   ```

2. **如果有資料，實現 REQUIREMENTS 渲染邏輯**
   - 參考其他類型的實現
   - 加入到 renderSource 函數中

3. **如果無資料，清理代碼**
   - 從 `getMethodTypeName` 移除 `REQUIREMENTS`
   - 加入註釋說明已廢棄

### 文檔更新
- 更新 README.md，說明支援的獲取方法類型
- 記錄特殊處理邏輯（DROPS、FATES 合併等）

## 結論

**總計**：20 種 DataType（排除 DEPRECATED）
- ✅ **已完整實現**：19 種
- ⚠️ **需要檢查**：1 種（REQUIREMENTS）
- 🔴 **確認問題**：0 種

整體而言，獲取方法的顯示邏輯相當完善，只需要確認 `REQUIREMENTS` 類型的處理即可。
