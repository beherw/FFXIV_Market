import { useState, useEffect, useCallback, useRef } from 'react';
import { getItemHistory, subscribeToHistory, clearItemHistory as clearHistory } from '../utils/itemHistory';

/**
 * Custom hook for managing history items
 * Provides a centralized, reactive way to access and manage history
 */
export function useHistory() {
  const [historyItems, setHistoryItems] = useState([]);
  const [historyIds, setHistoryIds] = useState(() => getItemHistory());
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadedIdsRef = useRef('');

  // Subscribe to history changes
  useEffect(() => {
    const handleChange = (newIds) => {
      setHistoryIds(newIds);
    };
    
    // Subscribe and get initial value
    const unsubscribe = subscribeToHistory(handleChange);
    
    // Also listen for storage events (for cross-tab sync)
    const handleStorageChange = (e) => {
      if (e.key === 'ffxiv_market_item_history') {
        setHistoryIds(getItemHistory());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Load item details when IDs change
  useEffect(() => {
    const currentIdsStr = JSON.stringify(historyIds);
    
    // Skip if IDs haven't changed
    if (lastLoadedIdsRef.current === currentIdsStr) {
      return;
    }
    
    // Skip if already loading
    if (loadingRef.current) {
      return;
    }
    
    const loadItems = async () => {
      if (historyIds.length === 0) {
        setHistoryItems([]);
        lastLoadedIdsRef.current = currentIdsStr;
        return;
      }

      loadingRef.current = true;
      setIsLoading(true);
      
      try {
        // Use batch query instead of individual queries for better performance
        const { getTwItemsByIds } = await import('../services/supabaseData');
        const itemsData = await getTwItemsByIds(historyIds);
        
        // Convert batch query results to item format
        const items = historyIds.map(id => {
          const itemData = itemsData[id];
          if (!itemData || !itemData.tw) {
            return null;
          }
          const cleanName = itemData.tw.replace(/^["']|["']$/g, '').trim();
          return {
            id,
            name: cleanName,
            nameTW: cleanName,
            searchLanguageName: null,
            description: '', // History items don't need descriptions for display
            itemLevel: '',
            shopPrice: '',
            inShop: false,
          };
        }).filter(item => item !== null);
        
        setHistoryItems(items);
        lastLoadedIdsRef.current = currentIdsStr;
      } catch (error) {
        console.error('Failed to load history items:', error);
        setHistoryItems([]);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    };

    loadItems();
  }, [historyIds]);

  // Clear history function
  const clearHistoryItems = useCallback(() => {
    clearHistory();
    setHistoryItems([]);
    setHistoryIds([]);
    lastLoadedIdsRef.current = '[]';
  }, []);

  // Refresh history (force reload from localStorage)
  const refreshHistory = useCallback(() => {
    const currentIds = getItemHistory();
    setHistoryIds(currentIds);
    // Reset the last loaded ref to force reload
    lastLoadedIdsRef.current = '';
  }, []);

  return {
    historyItems,
    historyIds,
    isLoading,
    clearHistory: clearHistoryItems,
    refreshHistory,
    hasHistory: historyIds.length > 0,
  };
}
