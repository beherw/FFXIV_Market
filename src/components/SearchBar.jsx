import { useState, useEffect, useRef } from 'react';
import { getMostRecentlyUpdatedItems } from '../services/universalis';
import { getItemById } from '../services/itemDatabase';
import ItemImage from './ItemImage';

export default function SearchBar({ onSearch, isLoading, value, onChange, disabled, disabledTooltip, selectedDcName, onItemSelect }) {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isComposing, setIsComposing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const debounceTimerRef = useRef(null);
  const onSearchRef = useRef(onSearch);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const recentItemsAbortRef = useRef(null);

  // Keep onSearch ref up to date
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Format timestamp to GMT+8
  const formatUploadTime = (timestamp) => {
    const date = new Date(timestamp);
    // Convert to GMT+8
    const gmt8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    const hours = gmt8Date.getUTCHours().toString().padStart(2, '0');
    const minutes = gmt8Date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = gmt8Date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Fetch recently updated items when dropdown should show
  const fetchRecentItems = async () => {
    if (!selectedDcName || isLoadingRecent) return;
    
    // Cancel previous request
    if (recentItemsAbortRef.current) {
      recentItemsAbortRef.current.abort();
    }
    
    recentItemsAbortRef.current = new AbortController();
    setIsLoadingRecent(true);
    
    try {
      const items = await getMostRecentlyUpdatedItems(selectedDcName, 20, {
        signal: recentItemsAbortRef.current.signal
      });
      
      if (!items || items.length === 0) {
        setRecentItems([]);
        setIsLoadingRecent(false);
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
      
      setRecentItems(itemsWithDetails);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch recent items:', error);
      }
    } finally {
      setIsLoadingRecent(false);
    }
  };

  // Handle focus - show dropdown if search is empty
  const handleFocus = () => {
    if (!searchTerm.trim() && !disabled) {
      setShowDropdown(true);
      fetchRecentItems();
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown when search term changes
  useEffect(() => {
    if (searchTerm.trim()) {
      setShowDropdown(false);
    }
  }, [searchTerm]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (recentItemsAbortRef.current) {
        recentItemsAbortRef.current.abort();
      }
    };
  }, []);

  // Handle item click from dropdown
  const handleRecentItemClick = (item) => {
    setShowDropdown(false);
    if (onItemSelect && item.itemDetails) {
      onItemSelect(item.itemDetails);
    }
  };

  // Sync with external value
  useEffect(() => {
    if (value !== undefined && value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Don't convert on display - keep user's input as-is (Traditional Chinese)
  // Conversion happens only when searching (in the background)
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onChange) {
      onChange(value);
    }
  };

  // Handle Enter key to search immediately and break debounce
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isComposing && !isDisabled) {
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Execute search immediately
      if (searchTerm.trim()) {
        onSearchRef.current(searchTerm.trim());
      } else {
        onSearchRef.current('');
      }
    }
  };

  // Debounce search
  useEffect(() => {
    if (isComposing) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchTerm.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        onSearchRef.current(searchTerm.trim());
      }, 800);
    } else {
      onSearchRef.current('');
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, isComposing]);

  const isDisabled = disabled || isLoading;

  return (
    <div className="w-full h-full">
      <div className="relative group h-full">
        <div className="absolute left-2.5 mid:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10">
          <svg className="w-4 h-4 mid:w-5 mid:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="多關鍵詞用空格分隔（例：豹 褲）"
          className={`w-full h-full pl-9 mid:pl-10 pr-9 mid:pr-10 bg-slate-900/80 backdrop-blur-sm border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 transition-all text-xs mid:text-sm shadow-lg ${
            isDisabled 
              ? 'border-slate-700/30 cursor-not-allowed opacity-60' 
              : 'border-purple-500/30 focus:border-ffxiv-gold focus:ring-ffxiv-gold/50'
          }`}
          disabled={isDisabled}
        />
        {isLoading && (
          <div className="absolute right-2.5 mid:right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 mid:h-4 mid:w-4 border-b-2 border-ffxiv-gold"></div>
          </div>
        )}
        {/* Tooltip for disabled state */}
        {disabled && disabledTooltip && (
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
            {disabledTooltip}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-0">
              <div className="border-4 border-transparent border-b-slate-900"></div>
            </div>
          </div>
        )}

        {/* Recently Updated Items Dropdown */}
        {showDropdown && !searchTerm.trim() && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
          >
            <div className="px-3 py-2 border-b border-slate-700/50">
              <span className="text-xs text-gray-400 font-medium">最近更新的物品</span>
            </div>
            
            {isLoadingRecent ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-ffxiv-gold"></div>
                <span className="ml-2 text-xs text-gray-400">載入中...</span>
              </div>
            ) : recentItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500">
                暫無數據
              </div>
            ) : (
              <div className="py-1">
                {recentItems.map((item, index) => (
                  <button
                    key={`${item.itemID}-${index}`}
                    onClick={() => handleRecentItemClick(item)}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-purple-800/40 transition-colors text-left"
                  >
                    <ItemImage
                      itemId={item.itemID}
                      alt={item.name}
                      className="w-8 h-8 object-contain rounded border border-slate-600/50 bg-slate-800/50 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {item.worldName} · {formatUploadTime(item.lastUploadTime)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
