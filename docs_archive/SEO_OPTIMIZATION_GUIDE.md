# FFXIV Market SEO 優化指南

## 目標

1. 提高 Google 搜尋命中率
2. 讓主頁能以「FFXIV（FF14）Market / FFXIV（FF14）物價查詢」相關關鍵字被索引
3. 讓每一個 `/item/{id}/{物品繁體名稱}` 頁面能以「FFXIV（FF14）物品名稱」被直接搜尋到
4. 使用語義共存方式同時兼顧「FFXIV」和「FF14」兩種常見搜尋關鍵字

---

## 一、主頁 SEO 優化

### 1.1 HTML Meta Tags 設定

**位置**: `index.html`

```html
<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="./favicon_bear.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- SEO Meta Tags -->
    <!-- Fallback title: 當 JavaScript 載入失敗時使用，JS 成功後會覆蓋此 title -->
    <title>FFXIV Market｜FF14 繁中市場查價工具</title>
    <meta name="description" content="FFXIV（FF14）物價查詢工具，即時查詢最終幻想14物品市場價格、歷史價格趨勢、各伺服器價格比較。支援繁體中文，提供完整的物品取得方式與市場資訊。" />
    <meta name="keywords" content="FFXIV,FF14,最終幻想14,物價查詢,市場價格,FFXIV Market,FF14 Market,物品價格,市場資訊,繁體中文" />
    <meta name="author" content="貝爾" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://beherw.github.io/FFXIV_Market/" />
    <meta property="og:title" content="繁中XIV市場 - FF14 Market - 貝爾的市場小屋" />
    <meta property="og:description" content="FFXIV（FF14）物價查詢工具，即時查詢最終幻想14物品市場價格、歷史價格趨勢、各伺服器價格比較。" />
    <meta property="og:image" content="https://beherw.github.io/FFXIV_Market/public/logo.png" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://beherw.github.io/FFXIV_Market/" />
    <meta name="twitter:title" content="繁中XIV市場 - FF14 Market - 貝爾的市場小屋" />
    <meta name="twitter:description" content="FFXIV（FF14）物價查詢工具，即時查詢最終幻想14物品市場價格、歷史價格趨勢、各伺服器價格比較。" />
    <meta name="twitter:image" content="https://beherw.github.io/FFXIV_Market/public/logo.png" />
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://beherw.github.io/FFXIV_Market/" />
    
    <!-- Language -->
    <meta http-equiv="content-language" content="zh-TW" />
    
    <!-- Robots -->
    <meta name="robots" content="index, follow" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx?v=2026-01-30"></script>
    <meta name="version" content="2026-01-30" />
  </body>
</html>
```

**重要說明**：
- `index.html` 中的 `<title>` 是**中性 fallback title**，當 JavaScript 載入失敗時使用
- 當 JavaScript 成功載入後，會在 `App.jsx` 中動態覆蓋此 title：
  - **主頁**: `繁中XIV市場 - FF14 Market - 貝爾的市場小屋`
  - **物品頁**: `{物品名} - 繁中XIV市場 - FF14 Market`
- 這樣確保即使 JS 失敗，至少也有合理的 title 顯示，不會出現錯誤或空白

### 1.2 主頁內容結構（在 React 中）

**位置**: `src/App.jsx` 或創建 `src/components/HomePage.jsx`

確保主頁有：
- **H1 標題**: 「FFXIV 物價查詢」或「最終幻想14 市場價格查詢」
- **可被爬蟲讀取的文字內容**：描述網站功能
- **結構化內容**：使用語義化 HTML

**建議實作**：

```jsx
// 在 App.jsx 的主頁渲染部分添加
{!selectedItem && !isOnHistoryPage && !isOnCraftingInspirationPage && 
 !isOnMSQPriceCheckerPage && !isOnAdvancedSearchPage && (
  <div className="home-page-content">
    <h1 className="text-3xl font-bold mb-4">FFXIV（FF14）物價查詢</h1>
    <p className="text-lg mb-4">
      FFXIV（FF14）玩家可在此查詢物品市場價格、歷史價格趨勢，並比較不同伺服器的價格。
      這是專為最終幻想14玩家設計的市場價格查詢工具，支援繁體中文介面。
    </p>
    <h2 className="text-2xl font-semibold mb-3">主要功能</h2>
    <ul className="list-disc list-inside mb-4">
      <li>即時市場價格查詢</li>
      <li>歷史價格趨勢分析</li>
      <li>跨伺服器價格比較</li>
      <li>完整的物品取得方式資訊</li>
      <li>支援繁體中文介面</li>
    </ul>
    {/* 原有的搜尋欄位 */}
  </div>
)}
```

---

## 二、物品頁 SEO 優化

### 2.1 動態 Meta Tags 設定

由於是 SPA，需要使用 `react-helmet-async` 或直接在 `useEffect` 中動態更新 `<head>`。

#### 方案 A: 使用 react-helmet-async（推薦）

**安裝**:
```bash
npm install react-helmet-async
```

**設定 Provider** (`src/main.jsx`):
```jsx
import { HelmetProvider } from 'react-helmet-async';

ReactDOM.createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </HelmetProvider>
)
```

**在 App.jsx 中使用** (`src/App.jsx`):
```jsx
import { Helmet } from 'react-helmet-async';

// 在 App 組件中，當 selectedItem 改變時
// 注意：這裡會覆蓋 index.html 中的 fallback title
useEffect(() => {
  if (selectedItem) {
    const itemName = selectedItem.nameTW || selectedItem.name || '未知物品';
    
    // 動態更新 title（覆蓋 index.html 中的 fallback title）
    document.title = `${itemName} - 繁中XIV市場 - FF14 Market`;
  } else {
    // 主頁 title（覆蓋 index.html 中的 fallback title）
    document.title = '繁中XIV市場 - FF14 Market - 貝爾的市場小屋';
  }
}, [selectedItem]);

// 在渲染物品頁的地方添加 Helmet
{selectedItem && (
  <>
    <Helmet>
      <title>{`${selectedItem.nameTW || selectedItem.name} - 繁中XIV市場 - FF14 Market`}</title>
      <meta 
        name="description" 
        content={`查詢 ${selectedItem.nameTW || selectedItem.name} 的市場價格、歷史價格趨勢、各伺服器價格比較。FFXIV（FF14）物品編號: ${selectedItem.id}`}
      />
      <meta 
        name="keywords" 
        content={`FFXIV,FF14,${selectedItem.nameTW || selectedItem.name},物價查詢,市場價格,物品編號${selectedItem.id}`}
      />
      
      {/* Open Graph */}
      <meta property="og:type" content="product" />
      <meta property="og:url" content={`https://beherw.github.io/FFXIV_Market/item/${selectedItem.id}/${encodeURIComponent(selectedItem.nameTW || selectedItem.name)}`} />
      <meta property="og:title" content={`${selectedItem.nameTW || selectedItem.name} - 繁中XIV市場 - FF14 Market`} />
      <meta property="og:description" content={`查詢 ${selectedItem.nameTW || selectedItem.name} 的市場價格、歷史價格趨勢、各伺服器價格比較。`} />
      {selectedItem.icon && (
        <meta property="og:image" content={`https://xivapi.com${selectedItem.icon}`} />
      )}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={`${selectedItem.nameTW || selectedItem.name} - 繁中XIV市場 - FF14 Market`} />
      <meta name="twitter:description" content={`查詢 ${selectedItem.nameTW || selectedItem.name} 的市場價格、歷史價格趨勢。`} />
      
      {/* Canonical */}
      <link rel="canonical" href={`https://beherw.github.io/FFXIV_Market/item/${selectedItem.id}/${encodeURIComponent(selectedItem.nameTW || selectedItem.name)}`} />
    </Helmet>
    
    {/* 原有的物品頁內容 */}
  </>
)}
```

#### 方案 B: 直接操作 DOM（無需額外套件）

**在 App.jsx 中**:
```jsx
// 注意：這裡會覆蓋 index.html 中的 fallback title
useEffect(() => {
  if (selectedItem) {
    const itemName = selectedItem.nameTW || selectedItem.name || '未知物品';
    const itemId = selectedItem.id;
    const baseUrl = 'https://beherw.github.io/FFXIV_Market';
    
    // 更新 title（覆蓋 index.html 中的 fallback title）
    document.title = `${itemName} - 繁中XIV市場 - FF14 Market`;
    
    // 更新或創建 meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 
      `查詢 ${itemName} 的市場價格、歷史價格趨勢、各伺服器價格比較。FFXIV（FF14）物品編號: ${itemId}`
    );
    
    // 生成 URL slug（將物品名稱轉換為 URL 友好的格式）
    const itemSlug = (selectedItem.nameTW || selectedItem.name || 'item')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    
    // 更新 canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${baseUrl}/item/${itemId}/${encodeURIComponent(itemSlug)}`);
    
    // 更新 Open Graph tags
    const updateOGTag = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };
    
    updateOGTag('og:type', 'product');
    updateOGTag('og:url', `${baseUrl}/item/${itemId}/${encodeURIComponent(itemSlug)}`);
    updateOGTag('og:title', `${itemName} - 繁中XIV市場 - FF14 Market`);
    updateOGTag('og:description', `查詢 ${itemName} 的市場價格、歷史價格趨勢、各伺服器價格比較。`);
    if (selectedItem.icon) {
      updateOGTag('og:image', `https://xivapi.com${selectedItem.icon}`);
    }
  } else {
    // 重置為主頁 meta
    document.title = '繁中XIV市場 - FF14 Market - 貝爾的市場小屋';
    // ... 重置其他 meta tags
  }
}, [selectedItem]);
```

### 2.2 物品頁 H1 標題

**確保物品頁有 H1**（應該已經有，確認即可）:

```jsx
{selectedItem && (
  <div className="item-page">
    <h1 className="item-title">
      {selectedItem.nameTW || selectedItem.name}
    </h1>
    {/* 其他內容 */}
  </div>
)}
```

### 2.3 Schema.org JSON-LD（結構化數據）

**在物品頁添加 Product Schema**:

⚠️ **重要**: GIL 不是 ISO 4217 合法貨幣，使用 `priceCurrency: "GIL"` 可能導致 Google Rich Results 忽略整個 Product。因此採用安全的方案：先不使用 `offers`。

```jsx
{selectedItem && (
  <>
    {/* 其他內容 */}
    
    <script type="application/ld+json">
      {JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": selectedItem.nameTW || selectedItem.name,
        "description": `FFXIV（FF14）物品: ${selectedItem.nameTW || selectedItem.name}`,
        "identifier": selectedItem.id.toString(),
        "category": "Video Game Item",
        "brand": {
          "@type": "Brand",
          "name": "Final Fantasy XIV"
        },
        // 注意：不使用 offers，因為 GIL 不是 ISO 4217 合法貨幣
        // 避免 Google Rich Results 忽略整個 Product
        ...(selectedItem.icon && { "image": `https://xivapi.com${selectedItem.icon}` })
      })}
    </script>
  </>
)}
```

**實作建議**：創建一個組件 `src/components/ItemSEO.jsx`:

```jsx
import { useEffect } from 'react';

export default function ItemSEO({ item }) {
  useEffect(() => {
    if (!item) return;
    
    const itemName = item.nameTW || item.name || '未知物品';
    const itemId = item.id;
    const baseUrl = 'https://beherw.github.io/FFXIV_Market';
    
    // 更新 title（覆蓋 index.html 中的 fallback title）
    document.title = `${itemName} - 繁中XIV市場 - FF14 Market`;
    
    // 更新 meta description
    const updateMeta = (name, content) => {
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    updateMeta('description', 
      `查詢 ${itemName} 的市場價格、歷史價格趨勢、各伺服器價格比較。FFXIV（FF14）物品編號: ${itemId}`
    );
    
    // 生成 URL slug（將物品名稱轉換為 URL 友好的格式）
    const itemSlug = (item.nameTW || item.name || 'item')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    
    // 更新 canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${baseUrl}/item/${itemId}/${encodeURIComponent(itemSlug)}`);
    
    // 更新 Open Graph
    const updateOG = (property, content) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };
    
    updateOG('og:type', 'product');
    updateOG('og:url', `${baseUrl}/item/${itemId}/${encodeURIComponent(itemSlug)}`);
    updateOG('og:title', `${itemName} - 繁中XIV市場 - FF14 Market`);
    updateOG('og:description', `查詢 ${itemName} 的市場價格、歷史價格趨勢、各伺服器價格比較。`);
    if (item.icon) {
      updateOG('og:image', `https://xivapi.com${item.icon}`);
    }
    
    // 添加 Schema.org JSON-LD
    let schemaScript = document.querySelector('script[type="application/ld+json"][data-item-schema]');
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.setAttribute('type', 'application/ld+json');
      schemaScript.setAttribute('data-item-schema', 'true');
      document.head.appendChild(schemaScript);
    }
    
    schemaScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": itemName,
      "description": `FFXIV（FF14）物品: ${itemName}`,
      "identifier": itemId.toString(),
      "category": "Video Game Item",
      "brand": {
        "@type": "Brand",
        "name": "Final Fantasy XIV"
      },
      // 注意：不使用 offers，因為 GIL 不是 ISO 4217 合法貨幣
      // 避免 Google Rich Results 忽略整個 Product
      ...(item.icon && { "image": `https://xivapi.com${item.icon}` })
    });
    
    // Cleanup: 返回主頁時重置（覆蓋 fallback title）
    return () => {
      document.title = '繁中XIV市場 - FF14 Market - 貝爾的市場小屋';
    };
  }, [item]);
  
  return null; // 此組件不渲染任何內容
}
```

**在 App.jsx 中使用**:
```jsx
import ItemSEO from './components/ItemSEO';

// 在渲染物品頁的地方
{selectedItem && (
  <>
    <ItemSEO item={selectedItem} />
    {/* 原有的物品頁內容 */}
  </>
)}
```

---

## 三、Sitemap.xml

### 3.1 靜態 Sitemap（推薦用於 GitHub Pages）

**位置**: `public/sitemap.xml` 或 `FFXIV_Market/public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  
  <!-- 主頁 -->
  <url>
    <loc>https://beherw.github.io/FFXIV_Market/</loc>
    <lastmod>2026-01-31</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- 其他頁面 -->
  <url>
    <loc>https://beherw.github.io/FFXIV_Market/history</loc>
    <lastmod>2026-01-31</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <url>
    <loc>https://beherw.github.io/FFXIV_Market/advanced-search</loc>
    <lastmod>2026-01-31</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  
  <!-- 注意：物品頁面需要動態生成，見下方說明 -->
  
</urlset>
```

### 3.2 動態生成 Sitemap（進階）

由於物品數量龐大，可以：

1. **生成部分熱門物品的 sitemap**（例如前 1000 個最常查詢的物品）
2. **使用 sitemap index** 分割多個 sitemap 文件
3. **在 CI/CD 中自動生成**（GitHub Actions）

**範例腳本** (`scripts/generate-sitemap.js`):

```javascript
// 這是一個範例，需要根據實際數據庫結構調整
const fs = require('fs');
const path = require('path');

// 假設你能獲取物品列表
const popularItemIds = [
  // 從數據庫或 API 獲取熱門物品 ID
  // 例如: 44247, 44248, ...
];

const baseUrl = 'https://beherw.github.io/FFXIV_Market';
const currentDate = new Date().toISOString().split('T')[0];

let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

// 注意：需要同時獲取物品名稱來生成完整的 URL
// 範例：假設有物品數據 { id: 44247, nameTW: "精金礦石" }
popularItemIds.forEach(item => {
  const itemId = typeof item === 'object' ? item.id : item;
  const itemName = typeof item === 'object' ? (item.nameTW || item.name || 'item') : 'item';
  const itemSlug = itemName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  
  sitemap += `  <url>
    <loc>${baseUrl}/item/${itemId}/${encodeURIComponent(itemSlug)}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
});

sitemap += '</urlset>';

fs.writeFileSync(
  path.join(__dirname, '../public/sitemap.xml'),
  sitemap,
  'utf8'
);

console.log(`Generated sitemap with ${popularItemIds.length + 1} URLs`);
```

---

## 四、Robots.txt

**位置**: `public/robots.txt` 或 `FFXIV_Market/public/robots.txt`

```
User-agent: *
Allow: /

# Sitemap
Sitemap: https://beherw.github.io/FFXIV_Market/sitemap.xml

# 允許所有爬蟲索引
Disallow: /api/
Disallow: /_next/
Disallow: /static/
```

---

## 五、URL 結構優化

### 5.1 確保 URL 結構清晰

- ✅ 主頁: `/`
- ✅ 物品頁: `/item/{id}/{物品繁體名稱}`（例如：`/item/44247/精金礦石`）
- ✅ 搜尋頁: `/search?q={query}`

**URL Slug 生成規則**：
- 使用物品的繁體中文名稱（`nameTW`）
- 轉換為小寫
- 空格替換為連字號 `-`
- 移除特殊字符，只保留字母、數字和連字號
- 移除多餘的連字號
- 使用 `encodeURIComponent` 進行 URL 編碼

**範例**：
- 物品名稱：`精金礦石` → URL slug: `精金礦石`（中文可直接使用）
- 物品名稱：`Iron Ore` → URL slug: `iron-ore`
- 完整 URL: `/item/44247/精金礦石`

### 5.2 確保 React Router 使用 BrowserRouter（已確認）

已在 `src/main.jsx` 中使用 `BrowserRouter`，這是正確的。

### 5.3 路由配置更新

**需要更新路由配置以支援新的 URL 格式**：

在 `App.jsx` 或路由配置中，需要支援兩種 URL 格式：
1. `/item/{id}` - 舊格式（向後兼容，自動重定向）
2. `/item/{id}/{slug}` - 新格式（推薦）

**實作建議**：

```jsx
// 在 App.jsx 中處理路由
useEffect(() => {
  const pathname = location.pathname;
  
  // 檢查是否為物品頁
  const itemMatch = pathname.match(/^\/item\/(\d+)(?:\/(.+))?$/);
  if (itemMatch) {
    const itemId = parseInt(itemMatch[1], 10);
    const urlSlug = itemMatch[2]; // 可能為 undefined
    
    // 載入物品
    getItemById(itemId).then(item => {
      if (item) {
        // 生成正確的 slug
        const correctSlug = (item.nameTW || item.name || 'item')
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]+/g, '')
          .replace(/\-\-+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');
        
        // 如果 URL slug 不匹配或不存在，重定向到正確的 URL
        if (!urlSlug || urlSlug !== correctSlug) {
          navigate(`/item/${itemId}/${encodeURIComponent(correctSlug)}`, { replace: true });
        }
        
        setSelectedItem(item);
      }
    });
  }
}, [location.pathname]);
```

**向後兼容性**：
- 舊的 `/item/{id}` URL 會自動重定向到 `/item/{id}/{slug}`
- 確保書籤和外部連結仍然有效

### 5.4 處理 404 頁面

確保 404 頁面有適當的 meta tags（已在 `NotFound.jsx` 中處理）。

---

## 六、實作檢查清單

### 主頁
- [ ] 更新 `index.html` 的 meta tags
- [ ] 添加 H1 標題和描述性文字內容
- [ ] 確保主頁有足夠的文字內容供爬蟲讀取

### 物品頁
- [ ] 更新路由配置以支援 `/item/{id}/{slug}` 格式
- [ ] 實作 URL slug 生成邏輯
- [ ] 實作動態 meta tags 更新（使用 `react-helmet-async` 或 DOM 操作）
- [ ] 確保物品頁有 H1 標題（物品名稱）
- [ ] 添加 Schema.org JSON-LD（Product）
- [ ] 確保 canonical URL 正確（包含 slug）
- [ ] 測試向後兼容性（舊的 `/item/{id}` URL 應自動重定向）

### 技術設定
- [ ] 創建 `sitemap.xml`
- [ ] 創建 `robots.txt`
- [ ] 確保所有 URL 可被直接訪問（無需 JavaScript）
- [ ] 測試 Google Search Console

### 測試
- [ ] 使用 Google Rich Results Test 測試 Schema.org
- [ ] 使用 Google Mobile-Friendly Test
- [ ] 使用 Google PageSpeed Insights
- [ ] 檢查所有頁面的 title 和 description

---

## 七、GitHub Pages 特殊注意事項

1. **Base URL**: 確保所有絕對 URL 使用正確的 base path (`/FFXIV_Market/`)
2. **404 頁面**: GitHub Pages 會自動使用 `404.html`，確保它也有適當的 SEO meta
3. **靜態資源**: 確保圖片、CSS、JS 路徑正確

---

## 八、後續優化建議

1. **預渲染（Prerendering）**: 考慮使用服務端渲染（SSR）或預渲染工具，讓 Google 更容易索引
2. **內容優化**: 為每個物品頁添加更多描述性文字
3. **內部連結**: 確保相關物品之間有內部連結
4. **圖片優化**: 為物品圖片添加 `alt` 屬性
5. **載入速度**: 優化頁面載入速度（已在使用 lazy loading）

---

## 九、Google Search Console 設定

1. 前往 [Google Search Console](https://search.google.com/search-console)
2. 添加屬性: `https://beherw.github.io/FFXIV_Market/`
3. 提交 sitemap: `https://beherw.github.io/FFXIV_Market/sitemap.xml`
4. 監控索引狀態和搜尋表現

---

## 十、參考資源

- [Google SEO 指南](https://developers.google.com/search/docs/beginner/seo-starter-guide)
- [Schema.org Product](https://schema.org/Product)
- [React Helmet Async](https://github.com/staylor/react-helmet-async)
- [GitHub Pages SEO](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)

---

**最後更新**: 2026-01-31
