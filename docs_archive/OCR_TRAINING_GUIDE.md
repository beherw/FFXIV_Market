# OCR 訓練指南

本文件說明如何訓練 Tesseract OCR 模型以提升 FFXIV 市場物品名稱的識別準確度。

## 目錄
1. [訓練方法概述](#訓練方法概述)
2. [方案一：完整訓練自定義模型](#方案一完整訓練自定義模型)
3. [方案二：Fine-tuning 現有模型](#方案二fine-tuning-現有模型)
4. [方案三：優化後處理（推薦）](#方案三優化後處理推薦)
5. [訓練數據準備](#訓練數據準備)
6. [在項目中使用訓練好的模型](#在項目中使用訓練好的模型)

---

## 訓練方法概述

### Tesseract.js 訓練的限制
- Tesseract.js 是瀏覽器端的 JavaScript 實現，**無法直接在瀏覽器中進行訓練**
- 訓練必須在**服務器端**使用完整的 Tesseract OCR 工具進行
- 訓練完成後，將生成的 `.traineddata` 文件部署到項目中

### 三種訓練方案對比

| 方案 | 難度 | 效果 | 時間成本 | 推薦度 |
|------|------|------|----------|--------|
| 完整訓練 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 數週 | ⭐⭐ |
| Fine-tuning | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 數天 | ⭐⭐⭐ |
| 後處理優化 | ⭐⭐ | ⭐⭐⭐ | 數小時 | ⭐⭐⭐⭐⭐ |

---

## 方案一：完整訓練自定義模型

### 前置需求
1. **Linux/macOS 環境**（Windows 可用 WSL 或 Docker）
2. **Tesseract OCR 完整工具鏈**
3. **大量訓練數據**（建議至少 1000+ 張圖片）

### 步驟 1：安裝 Tesseract 訓練工具

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr tesseract-ocr-dev libtesseract-dev

# macOS
brew install tesseract

# 安裝訓練工具
git clone https://github.com/tesseract-ocr/tesseract.git
cd tesseract
./autogen.sh
./configure
make
sudo make install
```

### 步驟 2：安裝 tesstrain 工具

```bash
git clone https://github.com/tesseract-ocr/tesstrain.git
cd tesstrain
```

### 步驟 3：準備訓練數據

#### 3.1 數據格式
- **圖片文件**：`.tif` 格式（推薦）或 `.png`
- **文本文件**：`.gt.txt` 格式，與圖片同名
- **字體文件**：`.ttf` 格式（可選，用於生成合成數據）

#### 3.2 數據結構
```
training_data/
├── images/
│   ├── item_001.tif
│   ├── item_001.gt.txt
│   ├── item_002.tif
│   ├── item_002.gt.txt
│   └── ...
└── fonts/
    └── NotoSansTC-Regular.ttf
```

#### 3.3 數據準備腳本範例

創建 `prepare_training_data.js`：

```javascript
// 從 FFXIV 遊戲截圖中提取物品名稱區域
// 並生成訓練數據對

const fs = require('fs');
const path = require('path');

/**
 * 準備訓練數據
 * @param {string} screenshotsDir - 截圖目錄
 * @param {string} outputDir - 輸出目錄
 */
async function prepareTrainingData(screenshotsDir, outputDir) {
  // 1. 讀取所有截圖
  // 2. 使用現有的 OCR 識別（作為初始標註）
  // 3. 人工校對標註
  // 4. 裁剪出物品名稱區域
  // 5. 保存為 .tif 和 .gt.txt
}
```

### 步驟 4：執行訓練

```bash
cd tesstrain

# 使用現有繁體中文模型作為基礎
make training MODEL_NAME=ffxiv_items START_MODEL=chi_tra

# 或從頭開始訓練
make training MODEL_NAME=ffxiv_items
```

### 步驟 5：生成 .traineddata 文件

```bash
# 合併訓練結果
combine_tessdata -e tessdata/chi_tra.traineddata \
  tessdata/chi_tra/ffxiv_items.traineddata

# 或直接使用 tesstrain 生成的模型
# 輸出位置：tesstrain/data/ffxiv_items.traineddata
```

### 步驟 6：部署到項目

1. **將 .traineddata 文件放到項目中**：
   ```
   public/
   └── tesseract/
       └── lang-data/
           └── ffxiv_items.traineddata
   ```

2. **修改 OCRButton.tsx**：
   ```typescript
   const CONFIG = {
     tesseractLang: 'ffxiv_items', // 使用訓練好的模型
     // ... 其他配置
   };
   ```

3. **如果使用 CDN，需要自 host**：
   - 將 `tesseract.js` 相關文件下載到本地
   - 修改 `index.html` 中的路徑

---

## 方案二：Fine-tuning 現有模型

Fine-tuning 是基於現有 `chi_tra` 模型進行適應性訓練，適合快速優化。

### 步驟 1：準備少量高質量數據

- 至少 50-100 張代表性圖片
- 確保標註準確

### 步驟 2：使用 Tesseract 的適應性訓練

```bash
# 1. 使用現有模型進行初始識別
tesseract image.tif output -l chi_tra

# 2. 校正識別結果，生成 .box 文件
tesseract image.tif image -l chi_tra lstm.train

# 3. 訓練 LSTM 網絡
lstmtraining --model_output output/ffxiv_items \
  --continue_from tessdata/chi_tra.lstm \
  --train_listfile train_list.txt \
  --eval_listfile eval_list.txt \
  --max_iterations 1000

# 4. 合併模型
lstmtraining --stop_training \
  --continue_from output/ffxiv_items_checkpoint \
  --traineddata tessdata/chi_tra/chi_tra.traineddata \
  --model_output ffxiv_items.traineddata
```

### 步驟 3：部署（同方案一）

---

## 方案三：優化後處理（推薦）

**這是目前最實用的方案**，因為：
1. ✅ 不需要服務器端訓練
2. ✅ 可以快速迭代
3. ✅ 已經有部分實現（白名單、模糊搜索）

### 當前已有的優化

1. **白名單機制**（`useItemtwWhitelist`）
   - 只識別 itemtw 數據庫中存在的字符
   - 大幅減少誤識別

2. **模糊搜索**（`ocrFuzzySearch`）
   - 使用 n-gram 索引
   - OCR 友好的相似度計算

3. **圖像預處理**
   - 自動文字區域檢測
   - 圖像縮放和閾值優化
   - 淺色文字反轉

### 進一步優化建議

#### 1. 增強白名單機制

```typescript
// 在 OCRButton.tsx 中
// 不僅限制字符，還限制字符組合（bigram/trigram）
function buildAdvancedWhitelist(items: any[]) {
  const charSet = new Set<string>();
  const bigramSet = new Set<string>();
  
  items.forEach(item => {
    const name = item['9: Name'] || '';
    // 提取字符
    for (const char of name) {
      charSet.add(char);
    }
    // 提取 bigram
    for (let i = 0; i < name.length - 1; i++) {
      bigramSet.add(name.slice(i, i + 2));
    }
  });
  
  return { charSet, bigramSet };
}
```

#### 2. 添加常見誤識別映射表

```typescript
// 常見的 OCR 誤識別對應表
const OCR_CORRECTIONS: Record<string, string> = {
  '0': 'O', // 在某些字體中容易混淆
  '1': 'l',
  '5': 'S',
  // FFXIV 特定的誤識別
  '戰': '戰', // 確保正確識別
  // ... 更多映射
};

function correctOCRText(text: string): string {
  let corrected = text;
  for (const [wrong, correct] of Object.entries(OCR_CORRECTIONS)) {
    corrected = corrected.replace(new RegExp(wrong, 'g'), correct);
  }
  return corrected;
}
```

#### 3. 使用置信度加權搜索

```typescript
// 在 ocrFuzzySearch 中，根據 OCR 置信度調整搜索策略
function ocrFuzzySearchWithConfidence(
  query: string,
  items: any[],
  ocrConfidence: number // 0-100
) {
  // 如果置信度低，使用更寬鬆的匹配
  const minScore = ocrConfidence < 50 ? 0.3 : 0.4;
  const topK = ocrConfidence < 50 ? 100 : 50;
  
  return ocrFuzzySearch(query, items, null, topK, minScore);
}
```

#### 4. 添加用戶反饋機制

```typescript
// 記錄 OCR 識別結果和用戶最終選擇
// 用於後續分析和優化
interface OCRFeedback {
  ocrText: string;
  selectedItem: string;
  timestamp: number;
}

function saveOCRFeedback(feedback: OCRFeedback) {
  // 保存到 localStorage 或發送到後端
  const feedbacks = JSON.parse(
    localStorage.getItem('ocr_feedbacks') || '[]'
  );
  feedbacks.push(feedback);
  localStorage.setItem('ocr_feedbacks', JSON.stringify(feedbacks));
}
```

---

## 訓練數據準備

### 自動化數據收集

創建 `scripts/collect_training_data.js`：

```javascript
/**
 * 從用戶使用中收集訓練數據
 * 1. 記錄 OCR 識別結果
 * 2. 記錄用戶最終選擇的物品
 * 3. 保存截圖和對應的正確標註
 */

const fs = require('fs');
const path = require('path');

class TrainingDataCollector {
  constructor(outputDir = './training_data') {
    this.outputDir = outputDir;
    this.ensureDir(outputDir);
    this.ensureDir(path.join(outputDir, 'images'));
  }

  /**
   * 保存訓練數據對
   * @param {Buffer} imageBuffer - 圖片數據
   * @param {string} correctText - 正確的物品名稱
   * @param {string} ocrText - OCR 識別的文本
   */
  async save(imageBuffer, correctText, ocrText) {
    const timestamp = Date.now();
    const imagePath = path.join(
      this.outputDir,
      'images',
      `item_${timestamp}.tif`
    );
    const textPath = path.join(
      this.outputDir,
      'images',
      `item_${timestamp}.gt.txt`
    );

    // 保存圖片
    await fs.promises.writeFile(imagePath, imageBuffer);

    // 保存正確文本
    await fs.promises.writeFile(textPath, correctText, 'utf-8');

    // 記錄元數據
    const metadata = {
      timestamp,
      correctText,
      ocrText,
      imagePath,
      textPath,
    };
    await this.appendMetadata(metadata);
  }

  async appendMetadata(metadata) {
    const metadataPath = path.join(this.outputDir, 'metadata.jsonl');
    await fs.promises.appendFile(
      metadataPath,
      JSON.stringify(metadata) + '\n',
      'utf-8'
    );
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
```

### 手動標註工具

可以使用開源工具如：
- **Tesseract OCR Trainer**（GUI 工具）
- **jTessBoxEditor**（Java 工具，用於編輯 .box 文件）
- **OCRopy**（Python 工具）

---

## 在項目中使用訓練好的模型

### 方法 1：自 Host Tesseract 文件（推薦）

1. **下載 Tesseract.js 文件**：
   ```bash
   mkdir -p public/tesseract/lang-data
   # 將訓練好的 .traineddata 文件放到 lang-data 目錄
   ```

2. **修改 index.html**：
   ```html
   <!-- 移除 CDN，改用本地文件 -->
   <!-- <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script> -->
   ```

3. **修改 OCRButton.tsx**：
   ```typescript
   const worker = await window.Tesseract.createWorker('ffxiv_items', 1, {
     corePath: './tesseract/tesseract-core.wasm.js',
     workerPath: './tesseract/worker.min.js',
     langPath: './tesseract/lang-data',
   });
   ```

### 方法 2：使用 CDN + 自定義語言包

如果 Tesseract.js CDN 支持自定義語言包，可以：
1. 將 `.traineddata` 上傳到自己的 CDN
2. 在創建 worker 時指定自定義語言包 URL

---

## 訓練效果評估

### 評估指標

1. **字符準確率**（Character Accuracy）
   ```
   Accuracy = (正確字符數 / 總字符數) × 100%
   ```

2. **單詞準確率**（Word Accuracy）
   ```
   Word Accuracy = (完全正確的單詞數 / 總單詞數) × 100%
   ```

3. **物品匹配率**（Item Match Rate）
   ```
   Match Rate = (成功匹配到正確物品的次數 / 總測試次數) × 100%
   ```

### 測試腳本

創建 `test_scripts/test_ocr_accuracy.js`：

```javascript
/**
 * 測試 OCR 識別準確率
 */

const testCases = [
  {
    image: './test_data/item_001.png',
    expected: '精煉鐵礦石',
    ocrResult: null,
  },
  // ... 更多測試用例
];

async function testOCRAccuracy() {
  let correct = 0;
  let total = testCases.length;

  for (const testCase of testCases) {
    // 執行 OCR
    const ocrResult = await performOCR(testCase.image);
    testCase.ocrResult = ocrResult;

    // 檢查是否匹配
    const matched = await searchItems(ocrResult);
    if (matched[0]?.item['9: Name'] === testCase.expected) {
      correct++;
    }
  }

  console.log(`準確率: ${(correct / total) * 100}%`);
  console.log(`正確: ${correct}/${total}`);
}
```

---

## 推薦實施路線圖

### 階段 1：優化後處理（1-2 週）
1. ✅ 增強白名單機制
2. ✅ 添加誤識別映射表
3. ✅ 實現置信度加權搜索
4. ✅ 添加用戶反饋收集

### 階段 2：收集訓練數據（2-4 週）
1. ✅ 實現自動數據收集
2. ✅ 手動標註代表性樣本
3. ✅ 建立測試集

### 階段 3：Fine-tuning（可選，1-2 週）
1. ✅ 使用收集的數據進行 Fine-tuning
2. ✅ 評估效果
3. ✅ 部署優化後的模型

---

## 參考資源

- [Tesseract OCR 訓練文檔](https://tesseract-ocr.github.io/tessdoc/)
- [tesstrain GitHub](https://github.com/tesseract-ocr/tesstrain)
- [Tesseract.js 文檔](https://tesseract.projectnaptha.com/)
- [OCR 訓練最佳實踐](https://github.com/tesseract-ocr/tesseract/wiki/TrainingTesseract)

---

## 注意事項

1. **訓練數據質量 > 數量**：100 張高質量標註 > 1000 張低質量標註
2. **代表性**：確保訓練數據涵蓋各種場景（不同背景、字體大小、光照條件）
3. **版本兼容性**：確保訓練的 Tesseract 版本與 Tesseract.js 使用的版本兼容
4. **文件大小**：自定義 `.traineddata` 文件可能較大，注意加載時間
5. **瀏覽器兼容性**：WASM 文件需要現代瀏覽器支持

---

## 總結

對於 FFXIV 市場項目，**推薦優先實施方案三（後處理優化）**，因為：
- ✅ 實施快速，效果明顯
- ✅ 不需要額外的服務器資源
- ✅ 可以持續迭代優化
- ✅ 已經有良好的基礎（白名單、模糊搜索）

如果後處理優化達到瓶頸，再考慮進行模型訓練（方案一或二）。
