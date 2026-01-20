import { useState, useEffect, useRef } from 'react';
import { getMostRecentlyUpdatedItems } from '../services/universalis';
import { getItemById } from '../services/itemDatabase';
import ItemImage from './ItemImage';

export default function RecentUpdatesSection({ onItemSelect, selectedDcName }) {
  const [recentItems, setRecentItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const abortControllerRef = useRef(null);
  const refreshCooldownRef = useRef(false);
  
  const REFRESH_COOLDOWN = 3000; // 3 seconds cooldown

  const fetchRecentItems = async () => {
    if (!selectedDcName || isLoading) return;
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    
    try {
      const items = await getMostRecentlyUpdatedItems(selectedDcName, 10, {
        signal: abortControllerRef.current.signal
      });
      
      if (!items || items.length === 0) {
        setRecentItems([]);
        setIsLoading(false);
        return;
      }
      
      // Fetch item details for each item
      const itemsWithDetails = await Promise.all(
        items.map(async (item) => {
          try {
            const itemDetails = await getItemById(item.itemID);
            return {
              ...item,
              name: itemDetails?.name || `物品 #${item.itemID}`,
              itemDetails
            };
          } catch {
            return {
              ...item,
              name: `物品 #${item.itemID}`,
              itemDetails: null
            };
          }
        })
      );
      
      setRecentItems(itemsWithDetails.filter(item => item.itemDetails));
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch recent items:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount and when selectedDcName changes
  useEffect(() => {
    if (selectedDcName) {
      fetchRecentItems();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [selectedDcName]);

  const handleRefresh = () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime;
    
    // Check cooldown
    if (refreshCooldownRef.current || timeSinceLastRefresh < REFRESH_COOLDOWN) {
      return;
    }
    
    refreshCooldownRef.current = true;
    setLastRefreshTime(now);
    fetchRecentItems();
    
    // Reset cooldown after REFRESH_COOLDOWN
    setTimeout(() => {
      refreshCooldownRef.current = false;
    }, REFRESH_COOLDOWN);
  };

  const handleItemClick = (item) => {
    if (onItemSelect && item.itemDetails) {
      onItemSelect(item.itemDetails);
    }
  };

  if (!selectedDcName) {
    return null;
  }

  return (
    <div className="mb-6 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-semibold text-ffxiv-gold flex items-center gap-2">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 sm:h-6 sm:w-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          最近更新的物品
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshCooldownRef.current || isLoading}
          className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-md border transition-all duration-200 flex items-center gap-1.5 ${
            refreshCooldownRef.current || isLoading
              ? 'bg-slate-700/60 text-gray-500 border-slate-600/40 cursor-not-allowed'
              : 'bg-purple-800/60 hover:bg-purple-700/70 text-gray-200 hover:text-white border-purple-500/40 hover:border-purple-400/60'
          }`}
          title={refreshCooldownRef.current ? '請稍候再試' : '刷新'}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? 'animate-spin' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          <span>刷新</span>
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
          <span className="ml-3 text-sm text-gray-400">載入中...</span>
        </div>
      ) : recentItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          暫無數據
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {recentItems.map((item) => (
            <button
              key={item.itemID}
              onClick={() => handleItemClick(item)}
              className="bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-indigo-900/30 rounded-lg p-3 sm:p-4 border border-purple-500/30 hover:border-ffxiv-gold/50 transition-all hover:scale-105 group"
            >
              <div className="flex flex-col items-center gap-2">
                <ItemImage
                  itemId={item.itemID}
                  alt={item.name}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded border border-purple-500/30 bg-slate-900/50 group-hover:border-ffxiv-gold/50 transition-colors"
                />
                <p className="text-xs sm:text-sm text-white font-medium text-center line-clamp-2 group-hover:text-ffxiv-gold transition-colors" title={item.name}>
                  {item.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
