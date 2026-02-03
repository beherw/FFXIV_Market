# 數據表遷移指南：從 Supabase/JSON 到 MessagePack Binary

## 📋 總覽

本文檔說明如何將數據表從以下方式遷移到 MessagePack binary 格式：
- **Supabase 動態查詢** → MessagePack 本地文件
- **大型 JSON 直接導入** → MessagePack 本地文件

### Recipe 遷移完成示例

已完成的 recipe 遷移可作為參考模板，節省了：
- **檔案大小**: 10.67MB JSON → 4.33MB MessagePack (59%⬇️)
- **載入時間**: ~700ms → ~300ms (57%⬇️)  
- **查詢延遲**: ~500ms → <1ms (500x⬆️)
- **資料庫負載**: 每次查詢 → 0 (100%⬇️)

---

## 🎯 何時應該遷移？

### ✅ **適合遷移的數據表**

滿足以下條件者：

| 條件 | 說明 |
|------|------|
| **數據穩定** | 更新頻率低（每個遊戲patch才更新） |
| **查詢頻繁** | 用戶互動中頻繁訪問 |
| **全量需要** | 需要載入完整數據集進行過濾/搜尋 |
| **檔案適中** | 原始大小 < 20MB |
| **無複雜查詢** | 不需要伺服器端 JOIN/聚合 |

**候選表格：**
- ✅ `tw_recipes` (已完成)
- ⭐ `tw_items` (~1MB, 查詢極高頻)
- ⭐ `tw_item_descriptions` (~1.7MB, 查詢高頻)
- ⭐ `equipment` (查詢中高頻)
- ⭐ `extracts` (獲取途徑, 查詢高頻)
- ○ `shops`, `npcs`, `quests` (查詢中低頻)

### ❌ **不適合遷移的數據表**

| 原因 | 例子 |
|------|------|
| **頻繁更新** | 用戶生成內容、即時價格 |
| **檔案過大** | > 20MB 會影響初始載入 |
| **按需查詢** | 只需要少數幾筆記錄 |
| **需要複雜查詢** | 需要 SQL JOIN、聚合函數 |

---

## 📝 遷移步驟

### Step 1: 創建 Build 腳本

**文件：** `scripts/build-<table>-data.js`

**模板（基於 recipe）：**

```javascript
#!/usr/bin/env node

/**
 * Build <Table> Data - Converts JSON to MessagePack binary format
 */

import * as msgpack from '@msgpack/msgpack';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置：根據你的數據源調整
const JSON_SOURCE = path.join(__dirname, '../teamcraft_git/libs/data/src/lib/json/tw/tw-<table>.json');
const OUTPUT_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, '<table>.msgpack');

/**
 * Load data from JSON source file
 */
function loadDataFromJSON(jsonPath) {
  console.log(`\n📖 Reading JSON source: ${jsonPath}`);
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON source file not found: ${jsonPath}`);
    console.error(`\nPlease ensure teamcraft submodule is initialized:`);
    console.error(`  git submodule update --init --recursive\n`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(content);
  
  // 根據數據結構調整驗證邏輯
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.error('❌ JSON file is empty or invalid');
    process.exit(1);
  }
  
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`✓ Loaded ${count} records from JSON`);
  return data;
}

/**
 * Optimize data structure for smaller size
 */
function optimizeData(data) {
  console.log(`\n🔧 Optimizing data structure...`);
  
  // 根據數據類型調整優化策略
  let optimized;
  
  if (Array.isArray(data)) {
    // Array: 移除空值
    optimized = data.map(item => {
      const cleaned = {};
      Object.keys(item).forEach(key => {
        const value = item[key];
        if (value !== null && value !== undefined && value !== '') {
          cleaned[key] = value;
        }
      });
      return cleaned;
    });
  } else {
    // Object: 移除空值
    optimized = {};
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== null && value !== undefined && value !== '') {
        optimized[key] = value;
      }
    });
  }
  
  const count = Array.isArray(optimized) ? optimized.length : Object.keys(optimized).length;
  console.log(`✓ Optimized ${count} records`);
  return optimized;
}

/**
 * Main build function
 */
function buildData() {
  console.log('🏗️  Building <Table> Data (JSON → MessagePack)\n');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  // Step 1: Load data from JSON source
  const data = loadDataFromJSON(JSON_SOURCE);
  
  // Step 2: Optimize structure
  const optimized = optimizeData(data);
  
  // Step 3: Encode to MessagePack
  console.log(`\n📦 Encoding to MessagePack...`);
  const packed = msgpack.encode(optimized);
  
  // Step 4: Save to public directory
  console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, packed);
  
  // Step 5: Statistics
  const jsonSourceSize = fs.statSync(JSON_SOURCE).size;
  const msgpackSize = packed.length;
  const jsonSize = JSON.stringify(optimized).length;
  
  const buildTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Build Complete!\n');
  console.log('📊 Size Comparison:');
  console.log(`   JSON Source: ${(jsonSourceSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   JSON (stringified): ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   MessagePack: ${(msgpackSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Savings:    ${((1 - msgpackSize / jsonSourceSize) * 100).toFixed(1)}% vs source`);
  console.log(`\n⏱️  Build Time: ${buildTime}ms`);
  console.log(`📍 Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60) + '\n');
}

// Run build
try {
  buildData();
} catch (error) {
  console.error('\n❌ Build failed:', error);
  process.exit(1);
}
```

### Step 2: 修改服務層代碼

**文件：** `src/services/<table>Database.js`

**原本（Supabase）：**

```javascript
// 舊方式：從 Supabase 查詢
import { getTw<Table>ByIds } from './supabaseData';

export async function get<Table>(ids) {
  return await getTw<Table>ByIds(ids); // 每次查詢 ~500ms
}
```

**改為（MessagePack）：**

```javascript
// 新方式：從 MessagePack 本地文件
import { decode } from '@msgpack/msgpack';

let dataCache = null;
let indexCache = null;
let isLoading = false;
let loadPromise = null;

/**
 * Load data from MessagePack binary file
 */
export async function load<Table>Database() {
  // Return cached data if available
  if (dataCache && indexCache) {
    return { data: dataCache, index: indexCache };
  }

  // If already loading, wait for existing load
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  loadPromise = (async () => {
    try {
      const loadStartTime = performance.now();
      
      // Fetch MessagePack binary file (使用 BASE_URL 處理 GitHub Pages 子路徑)
      console.log('[<Table>] 📦 Loading from MessagePack...');
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}data/<table>.msgpack`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      // Get binary data
      const arrayBuffer = await response.arrayBuffer();
      const fetchTime = performance.now() - loadStartTime;
      console.log(`[<Table>] ✓ Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB in ${fetchTime.toFixed(2)}ms`);
      
      // Decode MessagePack
      const decodeStartTime = performance.now();
      dataCache = decode(new Uint8Array(arrayBuffer));
      const decodeTime = performance.now() - decodeStartTime;
      
      // Build indexes for fast lookups
      const indexStartTime = performance.now();
      indexCache = buildIndexes(dataCache);
      const indexTime = performance.now() - indexStartTime;
      
      const totalTime = performance.now() - loadStartTime;
      console.log(`[<Table>] ✅ Total load time: ${totalTime.toFixed(2)}ms`);

      isLoading = false;
      return { data: dataCache, index: indexCache };
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      console.error('[<Table>] ❌ Failed to load:', error);
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Build indexes based on your query patterns
 */
function buildIndexes(data) {
  const indexes = {};
  
  // 例如：為常見查詢建立索引
  if (Array.isArray(data)) {
    indexes.byId = new Map();
    data.forEach(item => {
      if (item.id) {
        indexes.byId.set(item.id, item);
      }
    });
  } else {
    // Object-based data already indexed by key
    indexes.byKey = data;
  }
  
  return indexes;
}

/**
 * Query methods - 根據實際需求調整
 */
export async function get<Table>ById(id) {
  const { index } = await load<Table>Database();
  return index.byId?.get(id) || null;
}

export async function get<Table>ByIds(ids) {
  const { index } = await load<Table>Database();
  return ids.map(id => index.byId?.get(id)).filter(Boolean);
}

// ... 其他查詢方法
```

### Step 3: 更新 package.json

```json
{
  "scripts": {
    "prebuild": "node scripts/build-recipe-data.js && node scripts/build-<table>-data.js",
    "build": "vite build",
    "build-recipe": "node scripts/build-recipe-data.js",
    "build-<table>": "node scripts/build-<table>-data.js"
  }
}
```

### Step 4: 更新 vite.config.js (可選)

```javascript
// vite.config.js
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/FFXIV_Market/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 將 msgpack 分離到獨立 chunk
          if (id.includes('@msgpack/msgpack')) {
            return 'msgpack';
          }
        }
      }
    }
  }
});
```

### Step 5: Git 配置

**⚠️ 重要：不要將 .msgpack 文件加入 .gitignore！**

MessagePack 文件**必須 commit 到 Git**，因為：
- GitHub Pages 直接部署 dist/ 目錄
- CI/CD 雖然會執行 prebuild，但為了確保部署可靠性，建議 commit 文件
- 文件大小通常 < 5MB，不會造成 repo 負擔

```bash
# 確認文件已追蹤
git add public/data/<table>.msgpack
git commit -m "Add <table> MessagePack binary"
```

### Step 6: 測試

```bash
# 1. 生成 MessagePack
npm run build-<table>

# 2. 啟動開發伺服器
npm run dev

# 3. 測試查詢功能
# 訪問使用該數據的頁面，檢查:
# - 數據正確載入
# - 查詢速度快
# - Console 沒有錯誤
```

---

## 🗑️ 清理舊代碼

### 移除 Supabase 查詢函數

**文件：** `src/services/supabaseData.js`

```javascript
// ❌ 移除或標記為 deprecated
export async function getTw<Table>() { ... }
export async function getTw<Table>ByIds(ids) { ... }
```

**保留的理由：** 其他尚未遷移的數據表可能還在使用

### 更新文檔

**需要更新的文檔：**

1. **json_converter/json_list.txt**
   ```diff
   - # Recipe Data Files
   - teamcraft_git/.../tw-recipes.json|tw_recipes|array_of_objects|Crafting recipes
   + # Recipe Data Files (使用 MessagePack binary, 不再同步到 Supabase)
   + # teamcraft_git/.../tw-recipes.json|tw_recipes|array_of_objects|Crafting recipes (已遷移到 MessagePack)
   ```

2. **docs_archive/SUPABASE_MIGRATION_COMPLETE.md**
   - 添加註解說明 recipe 已改用 MessagePack
   - 更新資料表狀態

3. **README.md**
   - 更新架構圖（如果有）
   - 說明新的數據載入方式

### 保留但標記為過時的文件

以下文件保留但添加註解：

```markdown
<!-- docs_archive/QUERY_OPTIMIZATION.md -->
# ⚠️ 注意：Recipe 查詢已不再使用 Supabase

Recipe 數據已遷移到 MessagePack binary 格式。
本文檔中關於 recipe 的優化建議已過時。

詳見：[RECIPE_MESSAGEPACK_IMPLEMENTATION.md](RECIPE_MESSAGEPACK_IMPLEMENTATION.md)

---

原文檔內容...
```

---

## 📊 遷移檢查清單

使用此清單追蹤遷移進度：

```markdown
## <Table> 遷移檢查清單

### 準備階段
- [ ] 評估數據表是否適合遷移（大小、查詢頻率、更新頻率）
- [ ] 確認 teamcraft JSON 源文件存在
- [ ] 確認數據結構理解正確

### 實作階段
- [ ] 創建 build script (`scripts/build-<table>-data.js`)
- [ ] 測試 build script 成功生成 .msgpack 文件
- [ ] 創建/修改服務層代碼 (`src/services/<table>Database.js`)
- [ ] 更新所有引用該服務的組件
- [ ] 移除對 Supabase 查詢的依賴

### 配置階段
- [ ] 更新 `package.json` scripts
- [ ] 更新 `package.json` dependencies (使用 @msgpack/msgpack)
- [ ] 更新 `vite.config.js` (manualChunks + BASE_URL)
- [ ] **確認 fetch 使用 import.meta.env.BASE_URL**
- [ ] **確認 .msgpack 文件已 commit 到 Git** (不要加入 .gitignore)
- [ ] 更新 GitHub Actions workflow (如需要)

### 測試階段
- [ ] 本地測試：數據正確載入
- [ ] 本地測試：查詢功能正常
- [ ] 本地測試：性能符合預期
- [ ] Build 測試：production build 成功
- [ ] 部署測試：生產環境正常運作

### 清理階段
- [ ] 移除/標記過時的 Supabase 查詢函數
- [ ] 更新 `json_converter/json_list.txt`
- [ ] 更新相關文檔
- [ ] 標記過時文檔

### 監控階段 (部署後)
- [ ] 監控初始載入時間
- [ ] 監控記憶體使用
- [ ] 收集用戶反饋
- [ ] 記錄性能指標
```

---

## ⚠️ 重要：避免常見陷阱

### 陷阱 1: 使用錯誤的 MessagePack 庫

❌ **錯誤：使用 msgpack-lite**
```javascript
import msgpack from 'msgpack-lite';  // 會在瀏覽器報錯！
```

**錯誤訊息：**
```
Uncaught TypeError: Cannot read properties of undefined (reading 'Buffer')
```

✅ **正確：使用 @msgpack/msgpack**
```javascript
import * as msgpack from '@msgpack/msgpack';  // Build script
import { decode } from '@msgpack/msgpack';   // Browser code
```

**原因：** `msgpack-lite` 依賴 Node.js 的 `Buffer`，在瀏覽器中不存在。`@msgpack/msgpack` 專為瀏覽器設計。

---

### 陷阱 2: 使用絕對路徑 fetch

❌ **錯誤：硬編碼絕對路徑**
```javascript
const response = await fetch('/data/recipes.msgpack');
// GitHub Pages 部署後會變成 404！
```

**錯誤訊息：**
```
Failed to load resource: 404
/data/recipes.msgpack → 404 Not Found
```

✅ **正確：使用 BASE_URL**
```javascript
const baseUrl = import.meta.env.BASE_URL || '/';
const response = await fetch(`${baseUrl}data/recipes.msgpack`);
```

**效果：**
- 本地開發: `http://localhost:5173/data/recipes.msgpack` ✓
- GitHub Pages: `https://xxx.github.io/FFXIV_Market/data/recipes.msgpack` ✓

---

### 陷阱 3: 忘記 commit .msgpack 文件

❌ **錯誤：將 .msgpack 加入 .gitignore**
```gitignore
public/data/*.msgpack  # ← 會導致部署後 404！
```

✅ **正確：commit 到 Git**
```bash
git add public/data/*.msgpack
git commit -m "Add MessagePack binaries"
```

**檢查方法：**
```bash
# 確認文件已追蹤
git ls-files public/data/
# 應該看到: public/data/<table>.msgpack
```

---

### 陷阱 4: package.json dependencies 不完整

❌ **錯誤：只在 devDependencies 安裝**
```json
{
  "devDependencies": {
    "@msgpack/msgpack": "^3.1.3"  // ← CI build 會失敗
  }
}
```

✅ **正確：安裝在 dependencies**
```json
{
  "dependencies": {
    "@msgpack/msgpack": "^3.1.3"
  }
}
```

---

### 陷阱 5: vite.config.js 的 manualChunks 未更新

如果從 `msgpack-lite` 遷移到 `@msgpack/msgpack`，記得更新：

```javascript
manualChunks(id) {
  if (id.includes('@msgpack/msgpack')) {  // ← 更新這裡
    return 'msgpack';
  }
}
```

---

## 🔍 常見問題

### Q: 為什麼不用 CSV？

A: CSV 只是為了同步到 Supabase 而存在的中間格式。MessagePack 直接從 JSON 源讀取，更簡單、更可靠。

### Q: MessagePack 比 JSON 小多少？

A: 通常 30-60% 的節省，取決於數據結構：
- Recipe: 59% (10.67MB → 4.33MB)
- 預計 Items: ~40-50%

### Q: 如果數據更新了怎麼辦？

A: 重新 build：
```bash
npm run build-<table>
npm run build
```

### Q: 可以同時保留 Supabase 查詢嗎？

A: 可以作為 fallback，但會增加代碼複雜度。建議完全遷移。

### Q: 記憶體佔用會不會太大？

A: MessagePack 解碼後約佔用 15-25MB（11,605 筆 recipes）。對現代瀏覽器來說完全可接受。

### Q: 可以部分載入嗎？

A: MessagePack 需要完整解碼。如果需要部分載入，考慮：
1. 分割成多個小文件（例如按 category）
2. 或保留 Supabase 按需查詢

---

## 📚 參考資源

- [Recipe MessagePack 實作完整文檔](RECIPE_MESSAGEPACK_IMPLEMENTATION.md)
- [MessagePack 官方網站](https://msgpack.org/)
- [@msgpack/msgpack NPM](https://www.npmjs.com/package/@msgpack/msgpack) ← **推薦使用**
- [~~msgpack-lite NPM~~](https://www.npmjs.com/package/msgpack-lite) ← **不支援瀏覽器，勿用**

---

**更新日期：** 2026年2月3日  
**維護者：** FFXIV Market 開發團隊
