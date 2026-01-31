# GitHub Pages 版：OCR 搜尋功能實作指南 🧾

本文件已針對「靜態 GitHub Pages 網站」調整，適合作為 AI agent 的操作說明或工程師實作參考。

---

## 0. 環境與前提說明 🌐

### 本專案的固定條件

- **部署方式**：GitHub Pages 靜態網站
- **Build**：使用 GitHub Actions（build 完後只上傳靜態檔案）

### 沒有的東西

- ❌ 沒有自建 Apache / Nginx / Node.js server
- ❌ 無法改伺服器 MIME type / CORS 設定

### 可以做的事

- ✅ 在 HTML 中引用 CDN（如 jsDelivr、unpkg）
- ✅ 在 repo 中放 `.js` / `.css` / `.wasm` / `.traineddata` 等靜態檔，由 GitHub Pages 直接 serve
- ✅ 在前端（瀏覽器）使用 JavaScript / WebAssembly

**因為是 GitHub Pages，文件中不會出現 Apache / Nginx / Express 設定，所有方案都以「純前端 + 靜態檔案」為前提。**

---

## 1. 給 AI Agent 的任務說明 🤖

請你閱讀本文件後，幫我在這個 GitHub Pages 靜態網站 repo 內實作：

### 目標

在現有的搜尋框旁邊，加上一顆「OCR 按鈕」。

### 功能要求

- 使用 Tesseract.js（優先使用 CDN）在前端完成 OCR
- 支援繁體中文 `chi_tra`
- 讓使用者可以上傳圖片
- 辨識完後：
  - 自動把文字填入搜尋框
  - 觸發原有的搜尋行為（例如 dispatch `input` / `change` 事件，或呼叫既有 `performSearch` 函數）

### 實作限制

- ✅ 只能修改 / 新增 HTML / CSS / JS 靜態檔案
- ❌ 不新增任何後端程式碼或 server 設定
- 📁 若需要新增 JS 檔案，請沿用專案既有結構（例如放在 `assets/` 或目前 JS 所在目錄）
- 🌐 優先使用 CDN 方案；自 host `.wasm` / `.traineddata` 僅作為備用方案

### 輸出要求

請提供：
1. 需要修改 / 新增的檔案清單
2. 每個檔案的完整內容（或清楚的 diff）
3. 使用到的 CDN script link（例如 Tesseract.js）

---

## 2. 功能概要 🚀

這個 OCR 搜尋功能會：

- ✅ 完全在**瀏覽器端**執行，不需要後端 / API key
- ✅ 使用 Tesseract.js 做 OCR
- ✅ 支援繁體中文 (`chi_tra`)，可選多語言（如 `chi_tra+eng`）
- ✅ 圖片前處理：
  - 灰階化
  - 二值化（支援 Otsu 自動閾值）
  - 放大
  - 對比度提升
  - 可選去噪（中值濾波）
- ✅ 自動把辨識結果填入搜尋框
- ✅ 顯示真實進度條
- ✅ 按鈕有好看的樣式與 hover 動畫

---

## 3. 安裝 / 引用 Tesseract.js 📦

### 3.1 推薦方案：使用 CDN（GitHub Pages 最適合）⭐

在 HTML 加上：

```html
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
```

在 JS 內可以直接使用全域 `Tesseract`：

```javascript
const worker = await Tesseract.createWorker({
  logger: (m) => {
    // 例如：顯示 progress
    console.log(m);
  },
});

await worker.loadLanguage('chi_tra');
await worker.initialize('chi_tra');
```

**GitHub Pages 情境下：使用 CDN 完全不需要處理 `.wasm` / `.traineddata` 檔案與 MIME type。**

### 3.2 備用方案：將 Tesseract 靜態檔案放進 repo（自 Host）📁

如果你不想依賴外部 CDN（例如目標區域對 CDN 不穩），可以：

#### 3.2.1 準備檔案結構

在 repo 裡建立：

```
<repo-root>/
└── tesseract/
    ├── tesseract-core.wasm.js      # WASM 核心 JS wrapper
    ├── tesseract-core.wasm         # WASM binary
    ├── worker.min.js               # Tesseract worker 腳本
    └── lang-data/                  # 語言模型
        ├── chi_tra.traineddata     # 繁體中文模型
        ├── eng.traineddata         # 英文模型（選用）
        └── ...
```

**取得方式（本地開發時）：**

```bash
# 安裝
npm install tesseract.js tesseract.js-core

# 從 node_modules 複製必要檔案到 repo（以 public 根目錄為例，可依專案調整）
mkdir -p public/tesseract/lang-data
cp -r node_modules/tesseract.js-core/tesseract-core.wasm* public/tesseract/
cp node_modules/tesseract.js/dist/worker.min.js public/tesseract/
cp -r node_modules/tesseract.js-core/lang-data/* public/tesseract/lang-data/
```

**對 GitHub Pages 而言：只要檔案存在於 repo，Pages 就會自動以正確 MIME type 提供，不需要額外設定伺服器。**

#### 3.2.2 路徑設定（GitHub Pages 注意事項）

GitHub Pages 有兩種常見網址型態：

- **使用者 / 組織頁**：`https://username.github.io/`
- **專案頁**：`https://username.github.io/repo-name/`

為了相容兩種情況，建議使用**相對路徑**或用 `window.location.origin + window.location.pathname` 來組路徑。

**最簡單：假設 `tesseract` 目錄跟 HTML 在同一層（通常在根目錄）：**

```javascript
const worker = await Tesseract.createWorker({
  corePath: './tesseract/tesseract-core.wasm.js',
  workerPath: './tesseract/worker.min.js',
  langPath: './tesseract/lang-data',
  logger: (m) => { /* ... */ },
});
```

**或穩一點的寫法（處理 project page prefix）：**

```javascript
function basePath() {
  // 例如 / 或 /repo-name/
  const path = window.location.pathname;
  return path.endsWith('/') ? path : path + '/';
}

const BASE = basePath();

const worker = await Tesseract.createWorker({
  corePath: `${BASE}tesseract/tesseract-core.wasm.js`,
  workerPath: `${BASE}tesseract/worker.min.js`,
  langPath: `${BASE}tesseract/lang-data`,
  logger: (m) => { /* ... */ },
});
```

之後：

```javascript
await worker.loadLanguage('chi_tra');
await worker.initialize('chi_tra');
```

---

## 4. HTML：搜尋框 + OCR UI 結構 🧱

以下是完整 HTML 範例。若你的專案已有自己的 layout / search bar，只需整合關鍵部分：

- 搜尋 input（`id="searchInput"`，可自訂）
- OCR 按鈕（`id="ocrButton"`）
- 隱藏的檔案輸入（`id="imageInput"`）
- OCR 進度顯示區塊
- 可選：二值化閾值控制區塊

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OCR 搜尋功能</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="search-container">
        <div class="search-wrapper">
            <!-- 搜尋框 -->
            <input 
                type="text" 
                id="searchInput" 
                class="search-input" 
                placeholder="多關鍵詞用空格分隔（例：豹 褲）"
            />
            
            <!-- OCR 按鈕 -->
            <button 
                id="ocrButton" 
                class="ocr-button" 
                title="上傳圖片進行 OCR 辨識"
            >
                <svg class="ocr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                </svg>
                <span class="ocr-button-text">OCR</span>
            </button>
            
            <!-- 隱藏的檔案輸入 -->
            <input 
                type="file" 
                id="imageInput" 
                accept="image/*" 
                style="display: none;"
            />
            
            <!-- OCR 進度提示 -->
            <div id="ocrProgress" class="ocr-progress" style="display: none;">
                <div class="ocr-progress-spinner"></div>
                <div class="ocr-progress-content">
                    <span class="ocr-progress-text">辨識中...</span>
                    <div class="ocr-progress-bar">
                        <div id="ocrProgressBar" class="ocr-progress-bar-fill" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Tesseract.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
    <script src="ocr-search.js"></script>
</body>
</html>
```

**若你原本已經有 HTML，實作時只需：**

1. 把 OCR 按鈕、隱藏 file input、progress 區塊整合進現有 search bar 區域
2. 確認 `id` 與 `ocr-search.js` 裡的 `CONFIG` 對齊

---

## 5. CSS：按鈕與進度條樣式 🎨

你可以放在既有的 CSS 檔，或新建 `styles.css` 引入。

```css
/* styles.css */

.search-container {
    max-width: 800px;
    margin: 50px auto;
    padding: 20px;
}

.search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
}

.search-input {
    flex: 1;
    padding: 12px 16px;
    font-size: 16px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.3s ease;
}

.search-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* OCR 按鈕樣式 */
.ocr-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    min-width: 100px;
}

.ocr-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.ocr-button:active {
    transform: translateY(0);
    box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
}

.ocr-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.ocr-icon {
    width: 20px;
    height: 20px;
    stroke-width: 2;
}

.ocr-button-text {
    font-size: 14px;
}

/* OCR 進度提示 */
.ocr-progress {
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 20px;
    background: rgba(102, 126, 234, 0.95);
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    animation: slideDown 0.3s ease;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.ocr-progress-spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.ocr-progress-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ocr-progress-text {
    font-size: 14px;
    font-weight: 500;
}

.ocr-progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    overflow: hidden;
}

.ocr-progress-bar-fill {
    height: 100%;
    background: white;
    transition: width 0.3s ease;
    border-radius: 2px;
}
```

---

## 6. JavaScript：完整 OCR 實作（GitHub Pages 版）🧠

這支 `ocr-search.js` 已針對 GitHub Pages + CDN 為主調整：

- 預設 `useCDN: true`
- 如果未來想自 host tesseract 檔案，只要把 `useCDN` 改成 `false`，並確保 `tesseract/` 目錄存在於 repo

```javascript
// ocr-search.js

// 全域配置
const CONFIG = {
  // DOM 元素 ID
  searchInputId: 'searchInput',
  ocrButtonId: 'ocrButton',
  imageInputId: 'imageInput',
  ocrProgressId: 'ocrProgress',
  ocrProgressBarId: 'ocrProgressBar',
  thresholdControlId: 'thresholdControl',
  thresholdSliderId: 'thresholdSlider',
  thresholdValueId: 'thresholdValue',
  autoThresholdBtnId: 'autoThresholdBtn',

  // Tesseract.js 設定
  useCDN: true, // GitHub Pages 推薦：使用 CDN
  tesseractPaths: {
    // 僅在 useCDN: false 時使用，假設 /tesseract/ 在專案根目錄
    corePath: './tesseract/tesseract-core.wasm.js',
    workerPath: './tesseract/worker.min.js',
    langPath: './tesseract/lang-data',
  },

  tesseractLang: 'chi_tra', // 可改為 'chi_tra+eng' 支援多語言

  // 圖片處理參數
  imageScale: 2.5,
  threshold: 128,
  maxImageDimension: 2000,
  enableAdvancedProcessing: false,
  enableAutoThreshold: true,
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const ocrButton = document.getElementById(CONFIG.ocrButtonId);
  const imageInput = document.getElementById(CONFIG.imageInputId);
  const searchInput = document.getElementById(CONFIG.searchInputId);
  const ocrProgress = document.getElementById(CONFIG.ocrProgressId);

  if (!ocrButton || !imageInput || !searchInput || !ocrProgress) {
    console.error('OCR 功能初始化失敗：找不到必要的 DOM 元素');
    return;
  }

  // 點擊 OCR 按鈕 → 打開檔案選擇
  ocrButton.addEventListener('click', () => {
    imageInput.click();
  });

  // 檔案選擇後 → 執行 OCR
  imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案！');
      return;
    }

    const progressBar = document.getElementById(CONFIG.ocrProgressBarId);

    try {
      showProgress(ocrProgress, ocrButton, progressBar);

      const img = await loadImage(file);
      const resizedImage = await resizeImageIfNeeded(img);
      const processedImage = await preprocessImage(resizedImage);

      const recognizedText = await performOCR(processedImage, (progress) => {
        updateProgress(progressBar, progress);
      });

      if (recognizedText.trim()) {
        searchInput.value = recognizedText.trim();
        // 觸發原有搜尋邏輯
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        alert('無法辨識圖片中的文字，請嘗試其他圖片。');
      }
    } catch (error) {
      console.error('OCR 辨識失敗：', error);
      alert('OCR 辨識失敗，請稍後再試');
    } finally {
      hideProgress(ocrProgress, ocrButton, progressBar);
      imageInput.value = ''; // 讓之後可選同一張圖
    }
  });

  // 閾值 UI 控制（可選）
  const thresholdSlider = document.getElementById(CONFIG.thresholdSliderId);
  const thresholdValue = document.getElementById(CONFIG.thresholdValueId);
  const autoThresholdBtn = document.getElementById(CONFIG.autoThresholdBtnId);

  if (thresholdSlider && thresholdValue) {
    thresholdSlider.addEventListener('input', (e) => {
      CONFIG.threshold = parseInt(e.target.value, 10);
      thresholdValue.textContent = CONFIG.threshold;
    });
  }

  if (autoThresholdBtn) {
    autoThresholdBtn.addEventListener('click', () => {
      alert('自動閾值將在下次處理圖片時自動應用');
    });
  }
});

/**
 * 讀入圖片檔案為 Image 物件
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 若圖片尺寸過大則縮放
 */
function resizeImageIfNeeded(image) {
  return new Promise((resolve) => {
    const maxDim = CONFIG.maxImageDimension;
    const { width, height } = image;

    if (width <= maxDim && height <= maxDim) {
      resolve(image);
      return;
    }

    const scale = Math.min(maxDim / width, maxDim / height);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    const resizedImg = new Image();
    resizedImg.onload = () => resolve(resizedImg);
    resizedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * Otsu 自動閾值
 */
function calculateOtsuThreshold(imageData) {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    histogram[gray]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * 中值濾波（可選去噪）
 */
function applyMedianFilter(imageData, radius = 1) {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const values = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          values.push(data[idx]);
        }
      }
      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      const idx = (y * width + x) * 4;
      newData[idx] = median;
      newData[idx + 1] = median;
      newData[idx + 2] = median;
    }
  }

  return new ImageData(newData, width, height);
}

/**
 * 圖片前處理：放大 + 灰階 + 對比度 + 二值化 + （可選）去噪
 */
function preprocessImage(image) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scale = CONFIG.imageScale;
    const width = Math.floor(image.width * scale);
    const height = Math.floor(image.height * scale);

    canvas.width = width;
    canvas.height = height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let imageData = ctx.getImageData(0, 0, width, height);

    if (CONFIG.enableAdvancedProcessing) {
      imageData = applyMedianFilter(imageData, 1);
    }

    const data = imageData.data;

    // 自動 / 手動閾值
    let threshold = CONFIG.threshold;
    if (CONFIG.enableAutoThreshold) {
      threshold = calculateOtsuThreshold(imageData);
      CONFIG.threshold = threshold;

      const thresholdValue = document.getElementById(CONFIG.thresholdValueId);
      const thresholdSlider = document.getElementById(CONFIG.thresholdSliderId);
      if (thresholdValue) thresholdValue.textContent = threshold;
      if (thresholdSlider) thresholdSlider.value = threshold;
    }

    // 灰階 + 對比 + 二值化
    const contrast = 1.5;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );

      let enhanced = (gray - 128) * contrast + 128;
      enhanced = Math.max(0, Math.min(255, enhanced));

      const binary = enhanced > threshold ? 255 : 0;

      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.src = canvas.toDataURL('image/png');
  });
}

/**
 * 使用 Tesseract.js 執行 OCR
 */
async function performOCR(image, onProgress = null) {
  try {
    const workerOptions = {
      logger: (m) => {
        if (
          onProgress &&
          m.status === 'recognizing text' &&
          typeof m.progress === 'number'
        ) {
          onProgress(m.progress);
        }
      },
    };

    // 若不使用 CDN，改為指向自 host 檔案（GitHub Pages 也支援）
    if (!CONFIG.useCDN && CONFIG.tesseractPaths) {
      workerOptions.corePath = CONFIG.tesseractPaths.corePath;
      workerOptions.workerPath = CONFIG.tesseractPaths.workerPath;
      workerOptions.langPath = CONFIG.tesseractPaths.langPath;
    }

    const worker = await Tesseract.createWorker(workerOptions);

    await worker.loadLanguage(CONFIG.tesseractLang);
    await worker.initialize(CONFIG.tesseractLang);

    const {
      data: { text },
    } = await worker.recognize(image);

    await worker.terminate();

    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  } catch (error) {
    console.error('Tesseract OCR 錯誤：', error);
    throw new Error('OCR 辨識過程發生錯誤');
  }
}

/**
 * 顯示進度 UI
 */
function showProgress(progressElement, buttonElement, progressBar) {
  progressElement.style.display = 'flex';
  buttonElement.disabled = true;
  if (progressBar) {
    progressBar.style.width = '0%';
  }
}

/**
 * 更新進度條
 */
function updateProgress(progressBar, progress) {
  if (!progressBar || typeof progress !== 'number') return;
  const percentage = Math.round(progress * 100);
  progressBar.style.width = `${percentage}%`;
}

/**
 * 隱藏進度 UI
 */
function hideProgress(progressElement, buttonElement, progressBar) {
  progressElement.style.display = 'none';
  buttonElement.disabled = false;
  if (progressBar) {
    progressBar.style.width = '0%';
  }
}
```

---

## 7. React 版本（如果整個站是 React）⚛️

若你的 GitHub Pages 專案是 React SPA（例如用 CRA、Vite、Next 靜態輸出），可以使用下列 React Component。如果不是 React 專案，這一節可以直接忽略。

以下 `OCRSearchButton` 將：

- 顯示「OCR」按鈕
- 打開檔案選擇
- 使用 Tesseract.js（CDN 或自 host）辨識
- 把文字回傳給 `onTextRecognized`，或直接填入 `searchInputRef`

```jsx
// OCRSearchButton.jsx

import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';

const CONFIG = {
  useCDN: true,
  tesseractPaths: {
    corePath: './tesseract/tesseract-core.wasm.js',
    workerPath: './tesseract/worker.min.js',
    langPath: './tesseract/lang-data',
  },

  tesseractLang: 'chi_tra',
  imageScale: 2.5,
  threshold: 128,
  maxImageDimension: 2000,
  enableAdvancedProcessing: false,
  enableAutoThreshold: true,
};

export default function OCRSearchButton({ onTextRecognized, searchInputRef }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleOCRClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('請選擇圖片檔案！');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const img = await loadImage(file);
      const resizedImage = await resizeImageIfNeeded(img);
      const processedImage = await preprocessImage(resizedImage);

      const recognizedText = await performOCR(processedImage, (prog) => {
        setProgress(prog);
      });

      const text = recognizedText.trim();

      if (text && onTextRecognized) {
        onTextRecognized(text);
      }

      if (searchInputRef?.current) {
        searchInputRef.current.value = text;
        searchInputRef.current.dispatchEvent(
          new Event('input', { bubbles: true })
        );
        searchInputRef.current.dispatchEvent(
          new Event('change', { bubbles: true })
        );
      }
    } catch (error) {
      console.error('OCR 失敗：', error);
      alert('OCR 辨識失敗，請稍後再試');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <button
        onClick={handleOCRClick}
        disabled={isProcessing}
        className="ocr-button"
        title="上傳圖片進行 OCR 辨識"
      >
        {isProcessing ? (
          <>
            <div className="ocr-progress-spinner" />
            <div className="ocr-progress-content">
              <span>辨識中... {Math.round(progress * 100)}%</span>
              <div className="ocr-progress-bar">
                <div
                  className="ocr-progress-bar-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <svg
              className="ocr-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>OCR</span>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  );
}

/* 以下 utilities 與 vanilla 版本幾乎相同，可以抽到共用檔案 */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImageIfNeeded(image) {
  return new Promise((resolve) => {
    const maxDim = CONFIG.maxImageDimension;
    const { width, height } = image;

    if (width <= maxDim && height <= maxDim) {
      resolve(image);
      return;
    }

    const scale = Math.min(maxDim / width, maxDim / height);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    const resizedImg = new Image();
    resizedImg.onload = () => resolve(resizedImg);
    resizedImg.src = canvas.toDataURL('image/png');
  });
}

function calculateOtsuThreshold(imageData) {
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  const totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    histogram[gray]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

function applyMedianFilter(imageData, radius = 1) {
  const { data, width, height } = imageData;
  const newData = new Uint8ClampedArray(data);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const values = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          values.push(data[idx]);
        }
      }
      values.sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      const idx = (y * width + x) * 4;
      newData[idx] = median;
      newData[idx + 1] = median;
      newData[idx + 2] = median;
    }
  }

  return new ImageData(newData, width, height);
}

function preprocessImage(image) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scale = CONFIG.imageScale;
    const width = Math.floor(image.width * scale);
    const height = Math.floor(image.height * scale);

    canvas.width = width;
    canvas.height = height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    let imageData = ctx.getImageData(0, 0, width, height);

    if (CONFIG.enableAdvancedProcessing) {
      imageData = applyMedianFilter(imageData, 1);
    }

    const data = imageData.data;

    let threshold = CONFIG.threshold;
    if (CONFIG.enableAutoThreshold) {
      threshold = calculateOtsuThreshold(imageData);
      CONFIG.threshold = threshold;
    }

    const contrast = 1.5;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      let enhanced = (gray - 128) * contrast + 128;
      enhanced = Math.max(0, Math.min(255, enhanced));

      const binary = enhanced > threshold ? 255 : 0;
      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.src = canvas.toDataURL('image/png');
  });
}

async function performOCR(image, onProgress = null) {
  try {
    const workerOptions = {
      logger: (m) => {
        if (
          onProgress &&
          m.status === 'recognizing text' &&
          typeof m.progress === 'number'
        ) {
          onProgress(m.progress);
        }
      },
    };

    if (!CONFIG.useCDN && CONFIG.tesseractPaths) {
      workerOptions.corePath = CONFIG.tesseractPaths.corePath;
      workerOptions.workerPath = CONFIG.tesseractPaths.workerPath;
      workerOptions.langPath = CONFIG.tesseractPaths.langPath;
    }

    const worker = await createWorker(workerOptions);
    await worker.loadLanguage(CONFIG.tesseractLang);
    await worker.initialize(CONFIG.tesseractLang);

    const {
      data: { text },
    } = await worker.recognize(image);

    await worker.terminate();

    return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
  } catch (error) {
    console.error('Tesseract OCR 錯誤：', error);
    throw new Error('OCR 辨識過程發生錯誤');
  }
}
```

---

## 8. 調整選項與建議參數 ⚙️

在 `CONFIG` 中可以調的東西（vanilla / React 同理）：

- **`useCDN`**
  - `true`：使用 CDN（GitHub Pages 推薦）
  - `false`：使用 repo 中的 `tesseract/` 靜態檔

- **`tesseractLang`**
  - `'chi_tra'`：繁體中文
  - `'chi_tra+eng'`：繁體中文 + 英文

- **`imageScale`**：放大倍數（2–3）

- **`maxImageDimension`**：最大邊長像素（建議 1500–2000）

- **`enableAdvancedProcessing`**：
  - `true`：啟用中值濾波去噪（慢一點但準度較高）
  - `false`：跳過（預設）

- **`enableAutoThreshold`**：
  - `true`：啟用 Otsu 自動閾值
  - `false`：使用固定 `threshold`

---

## 9. 疑難排解（GitHub Pages 版本）🩺

### 9.1 Tesseract.js / 語言模型載入失敗

**使用 CDN：**
- 檢查瀏覽器 console 是否有：
  - 網路錯誤（CDN 被擋 / 連不到）
  - CORS 問題（少見）

**使用自 host：**
- 檢查 GitHub Pages 網址下的 `/tesseract/xxx` 是否能正常下載
- 確認 `corePath` / `workerPath` / `langPath` 寫法與實際路徑一致
  - （專案頁特別注意 `https://username.github.io/repo-name/` 的 prefix）
- 檢查有沒有 `chi_tra.traineddata` 等檔案

### 9.2 OCR 準確度不佳

可以依序嘗試：

1. `enableAutoThreshold: true`
2. 提高 `imageScale`（例如 2.0 → 2.5 / 3.0）
3. 開啟 `enableAdvancedProcessing: true`
4. 若圖片內有英文：`tesseractLang = 'chi_tra+eng'`
5. 確認圖片本身：
   - 文字清晰
   - 對比度夠
   - 不要太模糊 / 過度壓縮

### 9.3 效能 / 速度

- **大圖**：調低 `maxImageDimension`
- **頻繁 OCR**：
  - 可以考慮把 worker 做成 singleton，不在本文件強制要求
- **首次載入**：
  - `chi_tra` 模型約 10–20MB，第一次會比較久
  - 建議在 UI 顯示「首次載入中…」之類的提示（本文件已有 progress bar）

---

## 10. 整體流程小結 ✅

1. 使用者點 OCR 按鈕 → 選圖片
2. 前端讀圖，必要時縮放
3. 進行基本前處理（放大、灰階、對比、二值化）
4. 用 Tesseract.js（CDN 或自 host）做 OCR
5. 真實進度由 logger 回報，更新進度條
6. 完成後把結果寫入搜尋框，觸發既有搜尋邏輯

---

**如果你要把這整份當成 prompt 給 agent，用現在這個版本就可以直接丟了。**

之後如果你 repo 結構有特別的 search bar 檔案名稱 / 路徑，也可以再補一小段「專案目前搜尋功能的實際位置」，讓 agent 更精準對接。
