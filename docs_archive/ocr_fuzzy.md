整體思路 🧠
你現在流程大概是：

精確搜尋
找不到 → fuzzy search
加上 OCR 後，多了一種「字都差不多、順序大致正確，但有 1–2 個錯字」的情境。
你要的其實是：針對 OCR 結果做「容錯版 fuzzy search」，而且對象是「中文物品名 JSON（id → 名稱）」。

關鍵設計方向：

用「字級別（character-level）」來做 fuzzy，不要太依賴斷詞（繁中 plus OCR 錯字斷詞容易爆掉）
利用「n-gram + 編碼前建索引」來縮小候選，再用「編輯距離 / 相似度打分」
有條件的話，額外加一層「OCR 友善權重（形近字/簡繁/常見誤識別）」
下面分層幫你設計一個可以落地的架構。

一、資料結構與預處理設計 🏗️
先假設你有一份：

json
{  
  "123": "高級魔法藥水",  
  "456": "鋼鐵長劍",  
  "789": "精緻皮靴"  
}  
1.1 建立「搜尋索引」而不只是單純 JSON
為了高效 fuzzy，你可以在啟動時把所有物品名做預處理，例如：

itemId -> name（原始）
name -> itemId（方便反查）
針對名字做 character n-gram 索引（例如 2-gram、3-gram）
例：
"鋼鐵長劍" → 2-gram 字串：["鋼鐵", "鐵長", "長劍"]

建立：

ts
// 例：TypeScript / JS 概念  
type Item = { id: string; name: string };  
  
const items: Item[] = ...; // 從 JSON 載入  
const indexByNgram = new Map<string, Set<string>>(); // ngram -> Set<itemId>  
  
function buildIndex(items: Item[], n = 2) {  
  for (const item of items) {  
    const ngrams = toNgrams(item.name, n);  
    for (const ng of ngrams) {  
      if (!indexByNgram.has(ng)) indexByNgram.set(ng, new Set());  
      indexByNgram.get(ng)!.add(item.id);  
    }  
  }  
}  
toNgrams 就是按字切，繁中不用斷詞，直接一個 char 一個 char：

ts
function toNgrams(text: string, n: number): string[] {  
  const chars = [...text]; // 正確處理 Unicode  
  const res: string[] = [];  
  for (let i = 0; i <= chars.length - n; i++) {  
    res.push(chars.slice(i, i + n).join(""));  
  }  
  return res;  
}  
二、搜尋流程設計（含 OCR 容錯）🔍
2.1 高階流程
對每個 query（可能來自 OCR）：

先 exact match（完全相等 / 前綴 / 包含）
若沒結果 → 進入 一般 fuzzy（你原本的邏輯）
若仍沒結果或信心低 → 啟動「OCR 容錯 fuzzy 模式」
我們重點設計第 3 步。

三、OCR 友善 fuzzy search 核心架構 🧩
3.1 步驟概覽
對 OCR 輸入 q：

字串正規化（繁簡一致、符號清洗）
用 q 產生 n-gram（同樣 2-gram 或 3-gram）
用 n-gram 索引擷取一批候選 itemId
對候選計算「OCR 友善相似度分數」
依分數排序，取 top N（再加門檻）
3.2 正規化（Normalization）✂️
一開始先做：

去除空白、明顯雜訊（例如多出來的 .、,、- 等）
簡轉繁（如果 OCR 偶爾給簡體）
字元標準化（全形/半形轉換等）
假設你使用 Node.js，可以用一些常見庫（例如 opencc 做簡繁轉換），或自己很輕量地處理。

3.3 候選召回：用 n-gram 索引加速 🎯
對 query q 做 2-gram：

ts
const qNgrams = toNgrams(q, 2);  
const candidateScore = new Map<string, number>(); // itemId => ngram 重疊數  
for (const ng of qNgrams) {  
  const set = indexByNgram.get(ng);  
  if (!set) continue;  
  for (const itemId of set) {  
    candidateScore.set(itemId, (candidateScore.get(itemId) ?? 0) + 1);  
  }  
}  
接著可以先粗過濾：例如只保留 ngram overlap >= 1 或 >= 2 的 item，避免全表掃描。

3.4 精排：OCR 友善相似度計算 🧮
這段是重點。你可以設計一個綜合分數：

text
score = w1 * ngram_overlap_score  
      + w2 * normalized_edit_distance_score  
      + w3 * position_similarity_score  
      + w4 * ocr_confusion_weight  
說人話就是：

ngram_overlap_score

overlap / max(ngrams(q), ngrams(itemName)) → 越多共同 n-gram 分數越高。
normalized_edit_distance_score

用 Levenshtein 距離在「字級別」計算。
eds = 1 - (editDistance / maxLen)，0～1 之間，越高越相似。
position_similarity_score

OCR 通常是「某幾個字錯」，但 順序大致正確。
可以對齊後計算「相同位置字元相等的比例」。
例如：

正確：鋼鐵長劍
OCR：鋼銕長劍（鐵 被識成 銕）
位置比對：3/4 位相同 → 0.75
ocr_confusion_weight（選配，進階一點）

你可以定義一個「形近字 / 常見誤識別表」：

json
{  
  "鐵": ["銕", "钲", "鉃"],  
  "鬱": ["郁"],  
  "險": ["険"]  
}  
當 edit distance 裡發現某一對 (a, b) 就是常見誤識別配對 → 給較低懲罰。

實作上就是：自訂一個「帶權重的編輯距離」：

完全不同字替換 cost = 1
在誤識別表裡的替換 cost = 0.3～0.5
這樣就對 OCR 產生的錯字更友善。

四、簡易實作草圖（不綁語言）🧱
4.1 搜尋主函式 pseudo-code
pseudo
function searchWithOcrTolerance(query):  
    q = normalize(query)  
  
    # 1. exact or substring match  
    exactHits = findExactOrSubstring(q)  
    if exactHits not empty:  
        return rankByLengthOrOther(exactHits)  
  
    # 2. 一般 fuzzy（你原本那套）  
    fuzzyHits = normalFuzzySearch(q)  
    if highConfidence(fuzzyHits):  
        return fuzzyHits  
  
    # 3. OCR 容錯模式  
    return ocrFuzzySearch(q)  
4.2 OCR fuzzy 主體
pseudo
function ocrFuzzySearch(q):  
    qNgrams = toNgrams(q, 2)  
  
    candidateScore = map<itemId, int>()  
    for ng in qNgrams:  
        for itemId in indexByNgram[ng]:  
            candidateScore[itemId] += 1  
  
    # 粗選前 K 名做精排  
    topCandidates = takeTopKBy(candidateScore, K = 200)  
  
    scored = []  
    for itemId in topCandidates:  
        name = getNameById(itemId)  
        score = calcOcrFriendlySimilarity(q, name)  
        scored.append({ id: itemId, name: name, score: score })  
  
    # 設一個門檻，例如 score >= 0.6  
    result = filter(scored, s => s.score >= 0.6)  
    sortDescending(result by score)  
  
    return result[0:10] # 回傳前幾個  
4.3 calcOcrFriendlySimilarity（核心打分）
pseudo
function calcOcrFriendlySimilarity(q, name):  
    overlapScore = ngramOverlapScore(q, name, n=2)  
    edScore = 1 - weightedEditDistance(q, name) / max(len(q), len(name))  
    posScore = positionMatchScore(q, name)  # 同位置字相等比例  
  
    # 權重可以調  
    w1 = 0.4  
    w2 = 0.4  
    w3 = 0.2  
  
    return w1 * overlapScore + w2 * edScore + w3 * posScore  
weightedEditDistance 裡面就可以用前面說的誤識別表，把「看起來像 OCR 會搞錯的字」懲罰降低。

五、若你想用現成搜尋引擎（Elasticsearch / Meilisearch）🛠️
如果你不想自己寫全部，也可以靠搜尋引擎幫忙：

5.1 核心設定方向
使用 character n-gram 分詞（2~3 gram）
關掉「只吃詞的分詞器」，不靠中文斷詞
設定 fuzziness（Elasticsearch）或類似 fuzzy 選項
再稍微客製 scoring function（例如 script_score）
5.2 可能用法（Elasticsearch 概念）
index 時：對 name 欄位使用 custom analyzer：
tokenizer: standard or icu_tokenizer
filter: ngram with min_gram=2, max_gram=3
search 時：
multi_match + fuzziness
或自訂 function_score，結合 _score + 長度差等等
這樣就能不自己維護 n-gram 索引，交給引擎處理。

六、整體架構整理圖 🗺️
可想像成這樣一個 pipeline：

輸入來源

手動輸入
OCR 輸出
Normalization 層

去雜訊 / 簡繁轉換 / 全半形
檢索決策層

精確匹配
一般 fuzzy
OCR fuzzy（本題新增）
OCR fuzzy 索引與打分

預建 n-gram 索引（item 資料載入時建好）
用 n-gram 召回候選
帶 OCR 權重的相似度精排
結果輸出

Top N 匹配 + 分數
如果分數頂多 0.4 左右 → 可以回傳「可能是這幾個」給前端做 disambiguation（選單）
七、你接下來可以怎麼做 ✅
如果要快速落地，我會建議：

先做最小可行版：

只用 2-gram 索引 + 普通 Levenshtein + 位置比對
不先管什麼「誤識別表」
上線後觀察：

把「OCR 輸入 + 最後選中的正確字串」記 log
從 log 中抽出常見誤識別 → 反向建立你的 ocr_confusion_map
第二版再加：

weighted edit distance（針對你的實際 OCR engine 的錯誤模式優化）
或者接入 Elasticsearch / Meilisearch 做更進階索引

---

## 八、實際實作說明 ✅

### 8.1 實現狀態

已根據上述設計完成 OCR fuzzy search 的實作，具體如下：

#### 核心函數（`src/services/itemDatabase.js`）

1. **`toNgrams(text, n = 2)`** - 生成字符級別的 n-gram
2. **`normalizeOCRText(text)`** - 正規化 OCR 文本（去除雜訊、簡繁轉換）
3. **`levenshteinDistance(str1, str2)`** - 計算編輯距離（字符級別）
4. **`positionMatchScore(query, name)`** - 計算位置相似度分數
5. **`ngramOverlapScore(query, name, n = 2)`** - 計算 n-gram 重疊分數
6. **`calcOcrFriendlySimilarity(query, name)`** - 計算 OCR 友善相似度（綜合分數）
   - 權重：ngram overlap (0.4) + edit distance (0.4) + position match (0.2)
7. **`buildNgramIndex(items, n = 2)`** - 構建 n-gram 索引（按需構建）
8. **`ocrFuzzySearch(query, items, ngramIndex, topK, minScore)`** - OCR fuzzy 搜索核心函數
9. **`searchItemsOCR(searchText, signal)`** - OCR 版本的搜索函數（導出）

#### 搜索流程

`searchItemsOCR` 的搜索流程：

1. **精確匹配**：先嘗試使用正規化後的查詢進行精確/子字串匹配
2. **OCR Fuzzy 搜索**：如果精確匹配無結果，則：
   - 載入完整資料庫（用於 n-gram 索引）
   - 構建 2-gram 索引
   - 使用 n-gram 索引召回候選物品（至少 1 個 n-gram 匹配）
   - 對候選物品計算 OCR 友善相似度分數
   - 過濾分數 >= 0.4 的結果
   - 按分數降序排序，返回前 50 個結果

#### 與一般搜索的區別

- **一般搜索**（`searchItems`）：
  - 使用 `handleSearch(searchTerm)` 調用
  - 使用精確匹配 → 一般 fuzzy（僅在有空格時）→ 語言轉換 → 簡體資料庫搜索
  - 不會影響 OCR 搜索

- **OCR 搜索**（`searchItemsOCR`）：
  - 使用 `handleSearch(searchTerm, skipNavigation, isOCR=true)` 調用
  - 使用精確匹配 → OCR fuzzy 搜索（n-gram + 相似度打分）
  - 只在 OCR 功能貼圖後觸發

#### 整合點

1. **`src/components/SearchBar.jsx`**：
   - `handleOCRTextRecognized` 函數在 OCR 識別完成後調用
   - 調用 `onSearch(text, false, true)` 傳遞 `isOCR=true` 標記

2. **`src/App.jsx`**：
   - `handleSearch` 函數接受 `isOCR` 參數
   - 當 `isOCR=true` 時，使用 `searchItemsOCR` 而非 `searchItems`
   - 其他處理邏輯（結果分離、市場數據載入等）保持一致

### 8.2 使用方式

- **一般輸入框搜索**：用戶在搜索框輸入文字後按 Enter 或點擊搜索 → 使用 `searchItems`（不受 OCR fuzzy 影響）
- **OCR 搜索**：用戶點擊 OCR 按鈕 → 貼圖 → OCR 識別完成 → 自動觸發搜索 → 使用 `searchItemsOCR`（OCR fuzzy 模式）

### 8.3 未來優化方向

1. **誤識別表**：收集 OCR 錯誤模式，建立形近字對照表，優化 weighted edit distance
2. **索引優化**：考慮預建 n-gram 索引並緩存，避免每次 OCR 搜索都重新構建
3. **參數調整**：根據實際使用情況調整相似度權重和閾值
4. **性能優化**：對於大量候選結果，可以考慮更高效的相似度計算方法
