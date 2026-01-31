/**
 * 生成 URL slug（將物品名稱轉換為 URL 友好的格式）
 * @param {string} itemName - 物品名稱（繁體中文或英文）
 * @returns {string} URL slug
 */
export function generateItemSlug(itemName) {
  if (!itemName) return 'item';
  
  // 對於中文，直接使用 encodeURIComponent 處理
  // 對於英文，轉換為小寫並替換空格為連字符
  // 保留中文字符，只移除特殊字符（保留字母、數字、中文、連字符、下劃線）
  return itemName
    .trim()
    .replace(/\s+/g, '-')  // 空格替換為連字符
    .replace(/[^\w\-\u4e00-\u9fff]+/g, '')  // 移除特殊字符，但保留中文（\u4e00-\u9fff）
    .replace(/\-\-+/g, '-')  // 多個連字符替換為單個
    .replace(/^-+/, '')  // 移除開頭的連字符
    .replace(/-+$/, '')  // 移除結尾的連字符
    || 'item';  // 如果結果為空，使用 'item' 作為 fallback
}

/**
 * 生成物品頁面的完整 URL
 * @param {number} itemId - 物品 ID
 * @param {string} itemName - 物品名稱
 * @param {string} baseUrl - 基礎 URL（可選）
 * @returns {string} 完整的物品頁 URL
 */
export function generateItemUrl(itemId, itemName, baseUrl = '') {
  const slug = generateItemSlug(itemName);
  const path = `/item/${itemId}/${encodeURIComponent(slug)}`;
  return baseUrl ? `${baseUrl}${path}` : path;
}
