import { useEffect } from 'react';
import { generateItemSlug, generateItemUrl } from '../utils/urlSlug';

/**
 * ItemSEO 組件：動態更新物品頁的 SEO meta tags
 * 包括 title, description, canonical URL, Open Graph tags, 和 Schema.org JSON-LD
 */
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
    
    // 生成 URL slug
    const itemSlug = generateItemSlug(itemName);
    const itemUrl = generateItemUrl(itemId, itemName, baseUrl);
    
    // 更新 canonical
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', itemUrl);
    
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
    updateOG('og:url', itemUrl);
    updateOG('og:title', `${itemName} - 繁中XIV市場 - FF14 Market`);
    updateOG('og:description', `查詢 ${itemName} 的市場價格、歷史價格趨勢、各伺服器價格比較。`);
    if (item.icon) {
      updateOG('og:image', `https://xivapi.com${item.icon}`);
    }
    
    // 更新 Twitter Card
    updateMeta('twitter:card', 'summary');
    updateMeta('twitter:title', `${itemName} - 繁中XIV市場 - FF14 Market`);
    updateMeta('twitter:description', `查詢 ${itemName} 的市場價格、歷史價格趨勢。`);
    
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
    
    // Cleanup: 返回主頁時重置
    return () => {
      document.title = '繁中XIV市場 - FF14 Market - 貝爾的市場小屋';
      
      // 重置 meta description
      const resetMeta = (name, content) => {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (meta) {
          meta.setAttribute('content', content);
        }
      };
      
      resetMeta('description', 'FFXIV（FF14）物價查詢工具，即時查詢最終幻想14物品市場價格、歷史價格趨勢、各伺服器價格比較。支援繁體中文，提供完整的物品取得方式與市場資訊。');
      
      // 重置 canonical
      let canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        canonical.setAttribute('href', `${baseUrl}/`);
      }
      
      // 重置 Open Graph
      const resetOG = (property, content) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (tag) {
          tag.setAttribute('content', content);
        }
      };
      
      resetOG('og:type', 'website');
      resetOG('og:url', `${baseUrl}/`);
      resetOG('og:title', '繁中XIV市場 - FF14 Market - 貝爾的市場小屋');
      resetOG('og:description', 'FFXIV（FF14）物價查詢工具，即時查詢最終幻想14物品市場價格、歷史價格趨勢、各伺服器價格比較。');
      
      // 移除 Schema.org script
      let schemaScript = document.querySelector('script[type="application/ld+json"][data-item-schema]');
      if (schemaScript) {
        schemaScript.remove();
      }
    };
  }, [item]);
  
  return null; // 此組件不渲染任何內容
}
