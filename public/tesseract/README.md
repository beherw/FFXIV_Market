# Tesseract.js 文件目錄

此目錄包含 Tesseract.js 的核心文件和語言模型。

## 快速設置

### 方法 1：使用 npm 腳本（推薦）

```bash
npm run download-tesseract
```

這會自動下載 Tesseract.js 核心文件。

### 方法 2：手動下載

1. **下載 Tesseract.js 核心文件**：
   - 訪問 [jsDelivr CDN](https://cdn.jsdelivr.net/npm/tesseract.js@5/)
   - 下載以下文件到此目錄：
     - `tesseract-core.wasm.js`
     - `tesseract-core.wasm`
     - `worker.min.js`

2. **下載 gumblex/tessdata_chi 模型**：
   - 訪問 [gumblex/tessdata_chi Releases](https://github.com/gumblex/tessdata_chi/releases)
   - 下載 `chi_tra.traineddata` 文件
   - 將文件放到 `lang-data/` 目錄

## 目錄結構

```
tesseract/
├── tesseract-core.wasm.js      # Tesseract WASM 核心 JS
├── tesseract-core.wasm         # Tesseract WASM 二進制
├── worker.min.js               # Tesseract Worker 腳本
└── lang-data/
    └── chi_tra.traineddata     # gumblex/tessdata_chi 繁體中文模型
```

## 注意事項

- 所有文件都會被提交到 Git（用於 GitHub Pages 部署）
- 首次加載可能需要一些時間下載文件
- 確保文件完整下載，否則 OCR 功能可能無法正常工作

## 更多信息

詳細設置指南請參考：`docs_archive/GUMBLEX_TESSDATA_SETUP.md`
