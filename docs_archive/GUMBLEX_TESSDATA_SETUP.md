# 使用 gumblex/tessdata_chi 優化模型設置指南

## 概述

gumblex/tessdata_chi 是一個針對中文優化的 Tesseract OCR 模型，比官方模型更準確。本指南說明如何在項目中使用此模型。

## 為什麼使用 gumblex/tessdata_chi？

- ✅ **更高的識別準確度**：針對中文優化，特別是繁體中文
- ✅ **更好的筆畫識別**：訓練集包括宋體、黑體、楷體和仿宋等常用字體
- ✅ **支持多種寫法**：支持台灣、香港、傳承、大陸寫法字體
- ✅ **更大的字符集**：chi_tra 模型支持 8000+ 字符（LSTM 模型）

## 設置步驟

### 步驟 1：下載 gumblex/tessdata_chi 模型

1. 訪問 [gumblex/tessdata_chi Releases](https://github.com/gumblex/tessdata_chi/releases)
2. 下載最新版本的 `chi_tra.traineddata` 文件（繁體中文模型）
   - 推薦下載 LSTM 版本（文件名通常包含 `lstm` 或 `best`）
   - 例如：`chi_tra.traineddata` 或 `chi_tra_lstm.traineddata`

### 步驟 2：下載 Tesseract.js 核心文件（如果使用本地文件）

如果選擇使用本地文件而不是 CDN，需要下載 Tesseract.js 的核心文件：

#### 方法 A：從 npm 包下載（推薦）

```bash
# 安裝 tesseract.js 和 tesseract.js-core
npm install tesseract.js tesseract.js-core

# 創建目錄
mkdir -p public/tesseract/lang-data

# 複製核心文件
cp node_modules/tesseract.js-core/tesseract-core.wasm.js public/tesseract/
cp node_modules/tesseract.js-core/tesseract-core.wasm public/tesseract/
cp node_modules/tesseract.js/dist/worker.min.js public/tesseract/
```

#### 方法 B：從 CDN 下載

1. 訪問 [jsDelivr CDN](https://cdn.jsdelivr.net/npm/tesseract.js@5/)
2. 下載以下文件到 `public/tesseract/` 目錄：
   - `tesseract-core.wasm.js`
   - `tesseract-core.wasm`
   - `worker.min.js`

### 步驟 3：放置模型文件

將下載的 `chi_tra.traineddata` 文件放到以下目錄：

```
public/
└── tesseract/
    ├── tesseract-core.wasm.js
    ├── tesseract-core.wasm
    ├── worker.min.js
    └── lang-data/
        └── chi_tra.traineddata  ← 放在這裡
```

### 步驟 4：配置項目

在 `src/components/OCRButton.tsx` 中，配置已設置為使用本地文件：

```typescript
const CONFIG = {
  tesseractLang: 'chi_tra',
  useCDN: false, // 設為 false 以使用本地 gumblex/tessdata_chi 模型
  tesseractPaths: {
    corePath: './tesseract/tesseract-core.wasm.js',
    workerPath: './tesseract/worker.min.js',
    langPath: './tesseract/lang-data',
  },
  // ... 其他配置
};
```

### 步驟 5：測試

1. 啟動開發服務器
2. 使用 OCR 功能測試識別準確度
3. 檢查瀏覽器控制台是否有錯誤

## 文件結構

完成設置後，項目結構應如下：

```
FFXIV_market/
├── public/
│   └── tesseract/
│       ├── tesseract-core.wasm.js      # Tesseract WASM 核心
│       ├── tesseract-core.wasm         # WASM 二進制文件
│       ├── worker.min.js               # Worker 腳本
│       └── lang-data/
│           └── chi_tra.traineddata     # gumblex/tessdata_chi 模型
├── src/
│   └── components/
│       └── OCRButton.tsx               # OCR 組件
└── index.html                          # HTML 入口（仍需要 Tesseract.js CDN 腳本）
```

## 配置選項

### 使用 CDN（官方模型）

如果暫時無法下載本地文件，可以切換回 CDN：

```typescript
const CONFIG = {
  useCDN: true, // 使用 CDN 的官方模型
  // ... 其他配置
};
```

### 使用本地文件（gumblex/tessdata_chi 模型）

```typescript
const CONFIG = {
  useCDN: false, // 使用本地 gumblex/tessdata_chi 模型
  tesseractPaths: {
    corePath: './tesseract/tesseract-core.wasm.js',
    workerPath: './tesseract/worker.min.js',
    langPath: './tesseract/lang-data',
  },
  // ... 其他配置
};
```

## 注意事項

1. **文件大小**：
   - `chi_tra.traineddata` 約 10-20 MB
   - Tesseract 核心文件約 5-10 MB
   - 總共約 15-30 MB

2. **GitHub Pages 部署**：
   - 所有文件都會被上傳到 GitHub
   - 確保 `.gitignore` 不排除這些文件
   - 首次加載可能需要一些時間下載文件

3. **路徑問題**：
   - 如果部署到子目錄（如 `/FFXIV_Market/`），可能需要調整路徑
   - 可以使用相對路徑或動態計算路徑

4. **瀏覽器兼容性**：
   - 需要支持 WebAssembly 的現代瀏覽器
   - Chrome、Firefox、Edge、Safari 都支持

## 故障排除

### 問題 1：找不到模型文件

**錯誤信息**：`Failed to load language data`

**解決方案**：
1. 檢查 `chi_tra.traineddata` 是否在正確的目錄
2. 檢查文件路徑配置是否正確
3. 檢查瀏覽器控制台的網絡請求

### 問題 2：WASM 文件加載失敗

**錯誤信息**：`Failed to load WASM`

**解決方案**：
1. 確保所有 WASM 文件都已下載
2. 檢查服務器是否正確設置了 MIME 類型
3. 對於 GitHub Pages，通常不需要額外配置

### 問題 3：路徑錯誤

**錯誤信息**：`404 Not Found`

**解決方案**：
1. 檢查 `tesseractPaths` 配置是否正確
2. 如果部署到子目錄，可能需要使用絕對路徑或動態計算路徑
3. 檢查 `index.html` 中的 base path

## 性能優化

1. **預加載**：可以在頁面加載時預加載模型
2. **緩存**：瀏覽器會自動緩存文件，第二次加載會更快
3. **CDN 回退**：如果本地文件加載失敗，可以自動回退到 CDN

## 參考資源

- [gumblex/tessdata_chi GitHub](https://github.com/gumblex/tessdata_chi)
- [Tesseract.js 文檔](https://tesseract.projectnaptha.com/)
- [Tesseract.js GitHub](https://github.com/naptha/tesseract.js)

## 更新日誌

- **2026-01-31**: 初始設置指南，支持 gumblex/tessdata_chi 模型
