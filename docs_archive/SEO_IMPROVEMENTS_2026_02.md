# SEO 優化改進報告 (2026-02-03)

## 問題分析

比較了 [cycleapple/ffxiv-item-search-tc](https://github.com/cycleapple/ffxiv-item-search-tc) 的實現，發現我們的網站在 Google 搜尋不到的主要原因：

### 關鍵差異

#### 1. ❌ 缺少完整的 SEO Meta Tags
對方網站有完整的 meta tags：
- ✅ 詳細的 description（含關鍵功能描述）
- ✅ 豐富的 keywords
- ✅ 完整的 Open Graph tags (title, description, type, url, image, locale)
- ✅ Twitter Card tags
- ✅ Canonical URL
- ✅ 語言標記
- ✅ 明確的 robots 指令

#### 2. ❌ 缺少 SPA 路由處理
對方使用 `spa-github-pages` 方案：
- 404.html 處理路由重定向
- index.html 包含路由解析腳本
- 確保 Google 能正確索引所有頁面

#### 3. ❌ 缺少結構化數據標記
對方雖未使用 Schema.org，但我們可以做得更好

#### 4. ❌ sitemap 更新頻率不足
需要定期更新 lastmod 時間

## 已實施的改進

### 1. 增強 Meta Tags
**檔案：`index.html`**

```html
<!-- 改進前 -->
<title>FFXIV Market｜FF14 繁中市場查價工具</title>
<meta name="description" content="FFXIV（FF14）物價查詢工具..." />

<!-- 改進後 -->
<title>FFXIV Market｜FF14 繁中市場查價工具 - 即時物品價格查詢、OCR 截圖辨識</title>
<meta name="title" content="..." />
<meta name="description" content="...支援 OCR 截圖辨識、即時查詢...製作配方、採集地點資訊..." />
<meta name="keywords" content="FFXIV,FF14,最終幻想14,Final Fantasy XIV,OCR,截圖辨識,Universalis,製作配方,採集地點,伺服器比價,繁中服,陸行鳥,莫古力" />
```

### 2. 添加 Open Graph 完整資訊
```html
<meta property="og:site_name" content="FFXIV Market" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="zh_TW" />
```

### 3. 增強 Robots 指令
```html
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
<meta name="googlebot" content="index, follow" />
```

### 4. 添加 Schema.org 結構化數據
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "FFXIV Market",
  "alternateName": "FF14 繁中市場查價工具",
  "url": "https://beherw.github.io/FFXIV_Market/",
  "description": "...",
  "applicationCategory": "Utility",
  "inLanguage": "zh-TW",
  "about": {
    "@type": "VideoGame",
    "name": "Final Fantasy XIV"
  }
}
```

### 5. 實施 SPA 路由處理
**新增檔案：`public/404.html`**
- 使用 spa-github-pages 方案
- 自動將路徑轉換為查詢參數

**更新 `index.html`**
- 添加路由解析腳本
- 確保 SPA 路由正常運作

### 6. 更新 sitemap.xml
- 更新 lastmod 至 2026-02-03
- 調整進階搜尋優先級至 0.9
- 添加動態頁面註解說明

## 對比對方網站的優勢

### 我們做得更好的地方：
1. ✅ **Schema.org 結構化數據** - 對方沒有，我們有
2. ✅ **更詳細的 keywords** - 包含 OCR、伺服器名稱
3. ✅ **更完整的 robots 指令** - 明確指定 image/snippet 處理
4. ✅ **theme-color** - 提供更好的移動端體驗

### 對方做得好我們已採用的：
1. ✅ SPA 路由處理方案
2. ✅ 完整的 Open Graph tags
3. ✅ 404.html 重定向
4. ✅ Canonical URL

## 需要後續處理的項目

### 1. Google Search Console 驗證
目前有 `google475f0f8c209c8768.html`，需要：
- [ ] 確認 GSC 所有權驗證是否完成
- [ ] 提交 sitemap.xml
- [ ] 監控索引狀態

### 2. 建立動態 Sitemap
建議建立腳本定期生成熱門物品的 sitemap：
```javascript
// 範例：生成前 1000 個熱門物品的 URL
const popularItems = [5333, 27759, 36110, ...];
const sitemap = popularItems.map(id => `
  <url>
    <loc>https://beherw.github.io/FFXIV_Market/item/${id}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`).join('');
```

### 3. 添加 Google Analytics
對方有使用 GA4，建議我們也添加：
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 4. 改善圖片 SEO
確保 logo.png：
- [ ] 尺寸為 1200x630 (Open Graph 建議尺寸)
- [ ] 檔案大小 < 300KB
- [ ] 包含網站名稱或視覺元素

### 5. 內容優化
- [ ] 在首頁添加 H1 標題
- [ ] 為主要功能添加描述性文字（助於 SEO）
- [ ] 添加 FAQ 區塊（常見問題）

### 6. 技術優化
- [ ] 確保所有內部連結使用相對路徑
- [ ] 實施 preload 關鍵資源
- [ ] 優化 Core Web Vitals (LCP, FID, CLS)

## 預期效果

### 短期（1-2週）
- Google 開始爬取和索引網站
- 主頁出現在搜尋結果中

### 中期（1個月）
- 品牌關鍵字（"FFXIV Market 繁中"）排名靠前
- 開始出現部分功能性關鍵字排名

### 長期（3-6個月）
- 主要關鍵字（"FF14 市場查價"、"FFXIV 繁中查價"）進入前列
- 物品頁面開始被索引
- 自然流量穩定成長

## 監控指標

建議在 Google Search Console 監控：
1. **索引涵蓋率** - 確保重要頁面都被索引
2. **搜尋查詢** - 了解使用者如何找到網站
3. **點擊率 (CTR)** - 優化 title 和 description
4. **行動裝置可用性** - 確保移動端體驗良好

## 競爭對手分析

### cycleapple/ffxiv-item-search-tc
**優勢：**
- 已建立一定時間，有搜尋排名
- 有社群（Discord）支持
- 功能齊全（採集鬧鐘、製作模擬器）

**我們的差異化：**
- ✅ OCR 截圖辨識功能（獨特賣點）
- ✅ 更好的結構化數據標記
- ✅ 專注市場查價體驗
- 可考慮：添加更多市場分析功能

## 建議行動計畫

### 立即執行（本週）
1. ✅ 更新 meta tags - **已完成**
2. ✅ 實施 SPA 路由處理 - **已完成**
3. ✅ 更新 sitemap - **已完成**
4. [ ] 驗證 Google Search Console
5. [ ] 提交 sitemap 到 GSC

### 近期執行（2週內）
1. [ ] 添加 Google Analytics
2. [ ] 優化首頁內容結構
3. [ ] 建立動態 sitemap 生成腳本
4. [ ] 檢查並優化圖片

### 持續改進
1. [ ] 每週監控 GSC 數據
2. [ ] 根據搜尋查詢優化內容
3. [ ] 定期更新 sitemap
4. [ ] 收集使用者反饋，改善 UX

## 其他建議

### 社群建立
考慮建立：
- Discord 社群（參考對方做法）
- 定期更新開發日誌
- 收集使用者意見

### 外部連結
- 在 Reddit r/ffxiv 分享
- 在巴哈姆特 FF14 哈啦板宣傳
- 請其他 FFXIV 工具網站交換連結

### 內容行銷
- 撰寫使用教學文章
- 製作 OCR 功能示範影片
- 分享市場趨勢分析

## 結論

經過此次 SEO 優化，我們的網站已具備被 Google 索引的所有技術基礎。主要改進：

1. **完整的 meta tags 和 Open Graph 設定**
2. **SPA 路由處理方案**
3. **結構化數據標記**
4. **改善的 sitemap**

接下來重點是：
- **提交到 Google Search Console**
- **監控索引狀態**
- **持續優化內容**

預計 2-4 週後開始在 Google 搜尋結果中出現。
