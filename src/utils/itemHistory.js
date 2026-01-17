// Item history management using localStorage
const HISTORY_KEY = 'ffxiv_market_item_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Get all item IDs from history
 * @returns {number[]} Array of item IDs (most recent first)
 */
export function getItemHistory() {
  try {
    const historyStr = localStorage.getItem(HISTORY_KEY);
    if (!historyStr) return [];
    const history = JSON.parse(historyStr);
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('Failed to get item history:', error);
    return [];
  }
}

/**
 * Add an item ID to history
 * @param {number} itemId - The item ID to add
 */
export function addItemToHistory(itemId) {
  try {
    let history = getItemHistory();
    
    // Remove the item if it already exists (to move it to the front)
    history = history.filter(id => id !== itemId);
    
    // Add to the beginning
    history.unshift(itemId);
    
    // Keep only the most recent MAX_HISTORY_ITEMS
    history = history.slice(0, MAX_HISTORY_ITEMS);
    
    // Save back to localStorage
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to add item to history:', error);
  }
}

/**
 * Remove an item ID from history
 * @param {number} itemId - The item ID to remove
 */
export function removeItemFromHistory(itemId) {
  try {
    let history = getItemHistory();
    history = history.filter(id => id !== itemId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to remove item from history:', error);
  }
}

/**
 * Clear all history
 */
export function clearItemHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear item history:', error);
  }
}
