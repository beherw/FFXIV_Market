/**
 * Item Language Utilities
 * Functions to detect user language preference and get item names in different languages
 */

/**
 * Detect user language preference from URL params or browser
 * @param {URLSearchParams} searchParams - URL search params
 * @returns {string} Language code (tw, zh, en, ja, ko, de, fr)
 */
export function detectLanguage(searchParams) {
  // Check URL parameter first
  const langParam = searchParams.get('lang');
  if (langParam) {
    const langMap = {
      'tw': 'tw',
      'zh': 'zh',
      'cn': 'zh',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'de': 'de',
      'fr': 'fr'
    };
    return langMap[langParam.toLowerCase()] || 'tw';
  }
  
  // Fallback to browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh-tw') || browserLang.startsWith('zh-hant')) {
      return 'tw';
    } else if (browserLang.startsWith('zh') || browserLang.startsWith('zh-cn') || browserLang.startsWith('zh-hans')) {
      return 'zh';
    } else if (browserLang.startsWith('ja')) {
      return 'ja';
    } else if (browserLang.startsWith('ko')) {
      return 'ko';
    } else if (browserLang.startsWith('de')) {
      return 'de';
    } else if (browserLang.startsWith('fr')) {
      return 'fr';
    } else if (browserLang.startsWith('en')) {
      return 'en';
    }
  }
  
  // Default to Traditional Chinese
  return 'tw';
}

/**
 * Get item name in the preferred language
 * @param {Object} item - Item object with name fields
 * @param {string} preferredLang - Preferred language code
 * @returns {string} Item name in preferred language, fallback to nameTW or name
 */
export function getItemNameForLanguage(item, preferredLang = 'tw') {
  if (!item) return 'item';
  
  // Priority order based on preferred language
  const nameFields = {
    'tw': ['nameTW', 'name'],
    'zh': ['nameZH', 'nameTW', 'name'],
    'en': ['nameEN', 'name'],
    'ja': ['nameJA', 'name'],
    'ko': ['nameKO', 'name'],
    'de': ['nameDE', 'name'],
    'fr': ['nameFR', 'name']
  };
  
  const fields = nameFields[preferredLang] || nameFields['tw'];
  
  for (const field of fields) {
    if (item[field] && item[field].trim()) {
      return item[field].trim();
    }
  }
  
  // Fallback to any available name
  return item.nameTW || item.name || 'item';
}

/**
 * Get item name for URL generation (uses searchLanguageName if available, otherwise preferred language)
 * @param {Object} item - Item object
 * @param {string} preferredLang - Preferred language code
 * @returns {string} Item name for URL
 */
export function getItemNameForUrl(item, preferredLang = 'tw') {
  if (!item) return 'item';
  
  // If item has searchLanguageName (from search results), use it
  if (item.searchLanguageName && item.searchLanguageName.trim()) {
    return item.searchLanguageName.trim();
  }
  
  // Otherwise use preferred language name
  return getItemNameForLanguage(item, preferredLang);
}
