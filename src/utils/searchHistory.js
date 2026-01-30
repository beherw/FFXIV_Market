// Search keyword history management using localStorage
const SEARCH_HISTORY_KEY = 'ffxiv_market_search_history';
const MAX_SEARCH_HISTORY = 10;

/**
 * Get all search keywords from history
 * @returns {string[]} Array of search keywords (most recent first)
 */
export function getSearchHistory() {
  try {
    const historyStr = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!historyStr) return [];
    const history = JSON.parse(historyStr);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('Failed to get search history:', error);
    return [];
  }
}

/**
 * Add a search keyword to history
 * @param {string} keyword - The search keyword to add
 */
export function addSearchToHistory(keyword) {
  try {
    if (!keyword || !keyword.trim()) return;
    
    const trimmedKeyword = keyword.trim();
    let history = getSearchHistory();
    
    // Remove the keyword if it already exists (to move it to the front)
    history = history.filter(k => k !== trimmedKeyword);
    
    // Add to the beginning
    history.unshift(trimmedKeyword);
    
    // Keep only the most recent MAX_SEARCH_HISTORY
    history = history.slice(0, MAX_SEARCH_HISTORY);
    
    // Save back to localStorage
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to add search to history:', error);
  }
}

/**
 * Remove a search keyword from history
 * @param {string} keyword - The search keyword to remove
 */
export function removeSearchFromHistory(keyword) {
  try {
    let history = getSearchHistory();
    history = history.filter(k => k !== keyword);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('searchHistoryChanged'));
  } catch (error) {
    console.error('Failed to remove search from history:', error);
  }
}

/**
 * Clear all search history
 */
export function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('searchHistoryChanged'));
  } catch (error) {
    console.error('Failed to clear search history:', error);
  }
}
