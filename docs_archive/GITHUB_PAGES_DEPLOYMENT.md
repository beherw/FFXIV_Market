# GitHub Pages 部署說明 - gumblex/tessdata_chi 模型

## 概述

本項目已配置為在 GitHub Pages 上使用 gumblex/tessdata_chi 優化模型。所有必要的文件都會自動部署，用戶無需額外配置。

## 自動部署

當代碼推送到 `main` 分支時，GitHub Actions 會自動：
1. 構建項目（使用 `GITHUB_PAGES=true` 環境變量）
2. 將構建結果部署到 GitHub Pages
3. **包含 `public/tesseract/` 目錄中的所有文件**

**注意**：模型文件不會自動更新。如果需要更新模型，請手動運行 `npm run download-model` 並提交文件。

## 文件結構

部署後的文件結構：

```
https://beherw.github.io/FFXIV_Market/
├── index.html
├── assets/
│   └── ...
└── tesseract/                    ← 自動部署
    ├── tesseract-core.wasm.js
    ├── tesseract-core.wasm
    ├── worker.min.js
    └── lang-data/
        └── chi_tra.traineddata  ← gumblex/tessdata_chi 模型
```

## 路徑配置

代碼已自動處理 GitHub Pages 子目錄路徑：

- **開發環境**：`/tesseract/...`
- **GitHub Pages**：`/FFXIV_Market/tesseract/...`

路徑會通過 `import.meta.env.BASE_URL` 自動計算，無需手動配置。

## 用戶體驗

### 首次使用

1. 用戶訪問網站
2. 點擊 OCR 按鈕
3. 系統自動加載本地 gumblex/tessdata_chi 模型
4. 享受更高的識別準確度！

### 文件加載

- **首次加載**：需要下載約 15-30 MB 的文件（取決於模型大小）
- **後續加載**：瀏覽器會緩存文件，加載速度更快
- **加載失敗**：如果本地文件加載失敗，可以手動切換回 CDN（見下方）

## 檢查部署狀態

### 方法 1：檢查文件是否存在

訪問以下 URL 確認文件已部署：

```
https://beherw.github.io/FFXIV_Market/tesseract/tesseract-core.wasm.js
https://beherw.github.io/FFXIV_Market/tesseract/worker.min.js
https://beherw.github.io/FFXIV_Market/tesseract/lang-data/chi_tra.traineddata
```

### 方法 2：檢查瀏覽器控制台

打開瀏覽器開發者工具，查看 OCR 相關日誌：

```
[OCR DEBUG] performOCR: 開始創建 Worker（指定語言）
  modelSource: "本地文件 (gumblex/tessdata_chi 優化模型)"
  basePath: "/FFXIV_Market/"
  paths: {
    corePath: "/FFXIV_Market/tesseract/tesseract-core.wasm.js",
    workerPath: "/FFXIV_Market/tesseract/worker.min.js",
    langPath: "/FFXIV_Market/tesseract/lang-data"
  }
```

## 故障排除

### 問題 1：文件未部署

**症狀**：404 錯誤，找不到文件

**解決方案**：
1. 確認文件已提交到 Git
2. 確認 `.gitignore` 沒有排除 `public/tesseract/`
3. 檢查 GitHub Actions 部署日誌

### 問題 2：路徑錯誤

**症狀**：文件存在但無法加載

**解決方案**：
1. 檢查 `vite.config.js` 中的 `base` 配置
2. 確認 `import.meta.env.BASE_URL` 正確
3. 檢查瀏覽器網絡請求的實際 URL

### 問題 3：回退到 CDN

如果本地文件無法加載，可以臨時切換回 CDN：

在 `src/components/OCRButton.tsx` 中修改：

```typescript
const CONFIG = {
  useCDN: true, // 臨時切換回 CDN
  // ...
};
```

## 文件大小限制

GitHub 倉庫和 Pages 的限制：

- **單個文件**：最大 100 MB（推薦 < 50 MB）
- **倉庫總大小**：建議 < 1 GB
- **Pages 部署**：無特殊限制

gumblex/tessdata_chi 模型文件約 10-20 MB，完全在限制內。

## 性能優化

### 1. 文件壓縮

模型文件已經過壓縮，無需額外處理。

### 2. 緩存策略

GitHub Pages 會自動設置適當的緩存頭：
- WASM 文件：長期緩存
- 模型文件：長期緩存

### 3. 並行加載

Tesseract.js 會並行加載多個文件，提高加載速度。

## 更新模型

如果需要更新 gumblex/tessdata_chi 模型：

1. 下載新版本的 `chi_tra.traineddata`
2. 替換 `public/tesseract/lang-data/chi_tra.traineddata`
3. 提交並推送到 GitHub
4. GitHub Actions 會自動重新部署

## 監控和日誌

### 瀏覽器控制台日誌

所有 OCR 操作都會記錄詳細日誌，包括：
- 文件加載狀態
- 模型來源（CDN 或本地）
- 路徑配置
- 錯誤信息

### 網絡請求

在瀏覽器開發者工具的 Network 標籤中，可以查看：
- 文件下載進度
- 加載時間
- 文件大小
- HTTP 狀態碼

## 最佳實踐

1. **定期更新模型**：關注 gumblex/tessdata_chi 的新版本
2. **監控文件大小**：確保不會超過 GitHub 限制
3. **測試部署**：每次更新後測試 OCR 功能
4. **記錄問題**：如果發現問題，記錄詳細日誌

## 相關文檔

- [gumblex/tessdata_chi 設置指南](./GUMBLEX_TESSDATA_SETUP.md)
- [繁體字 OCR 優化文檔](./TRADITIONAL_CHINESE_OCR_OPTIMIZATION.md)
- [GitHub Actions 部署配置](../.github/workflows/deploy.yml)

## 總結

✅ **自動部署**：所有文件自動包含在部署中  
✅ **路徑自動處理**：無需手動配置路徑  
✅ **用戶無感知**：用戶只需使用 OCR 功能即可  
✅ **高性能**：本地文件加載，無需依賴外部 CDN  
✅ **高準確度**：使用優化的中文模型

GitHub Pages 用戶可以直接使用優化的 OCR 功能，無需任何額外配置！
