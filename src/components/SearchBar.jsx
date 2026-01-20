import { useState, useEffect, useRef } from 'react';
import { useHistory } from '../hooks/useHistory';
import { getSearchHistory, removeSearchFromHistory } from '../utils/searchHistory';
import { removeItemFromHistory } from '../utils/itemHistory';
import ItemImage from './ItemImage';

export default function SearchBar({ onSearch, isLoading, value, onChange, disabled, disabledTooltip, selectedDcName, onItemSelect, searchResults = [], marketableItems = null }) {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isComposing, setIsComposing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const debounceTimerRef = useRef(null);
  const onSearchRef = useRef(onSearch);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  // Get history items
  const { historyItems } = useHistory();
  
  // Check if we have search results (on search page)
  const hasSearchResults = searchResults && searchResults.length > 0;

  // Keep onSearch ref up to date
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Load search history when dropdown should show
  useEffect(() => {
    if (showDropdown && !searchTerm.trim()) {
      const history = getSearchHistory();
      setSearchHistory(history);
    }
  }, [showDropdown, searchTerm]);

  // Listen for storage changes to update search history
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ffxiv_market_search_history') {
        const history = getSearchHistory();
        setSearchHistory(history);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    const handleCustomStorageChange = () => {
      const history = getSearchHistory();
      setSearchHistory(history);
    };
    
    // Listen for custom event
    window.addEventListener('searchHistoryChanged', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('searchHistoryChanged', handleCustomStorageChange);
    };
  }, []);

  // Handle focus - show dropdown
  const handleFocus = () => {
    if (!disabled) {
      setShowDropdown(true);
    }
  };
  
  // Extract keyword suggestions from search results
  const getKeywordSuggestions = () => {
    if (!hasSearchResults || !searchTerm.trim()) {
      return [];
    }
    
    const searchTermTrimmed = searchTerm.trim();
    const lowerSearchTerm = searchTermTrimmed.toLowerCase();
    
    // B is the search term
    // We want to find AB patterns (X + B) and BC patterns (B + X)
    const abPatterns = new Set(); // Patterns like "围裙" (A + B)
    const bcPatterns = new Set(); // Patterns like "裙子" (B + C)
    
    // Filter to only tradeable items if marketableItems is available
    const tradeableResults = marketableItems 
      ? searchResults.filter(item => marketableItems.has(item.id))
      : searchResults;
    
    // Extract patterns from tradeable search results only
    tradeableResults.forEach(item => {
      if (item.name) {
        const itemName = item.name;
        const lowerItemName = itemName.toLowerCase();
        
        // Find all occurrences of search term in item name
        let searchIndex = 0;
        while ((searchIndex = lowerItemName.indexOf(lowerSearchTerm, searchIndex)) !== -1) {
          const termStart = searchIndex;
          const termEnd = searchIndex + searchTermTrimmed.length;
          
          // Check if there's a character before B (AB pattern)
          if (termStart > 0) {
            const charBefore = itemName[termStart - 1];
            // Extract AB pattern (1 character before + B, max 2-3 chars total)
            if (/[\u4e00-\u9fa5]/.test(charBefore)) {
              const abPattern = itemName.substring(termStart - 1, termEnd);
              if (abPattern.length >= 2 && abPattern.length <= 3) {
                abPatterns.add(abPattern);
              }
            }
          }
          
          // Check if there's a character after B (BC pattern)
          if (termEnd < itemName.length) {
            const charAfter = itemName[termEnd];
            if (/[\u4e00-\u9fa5]/.test(charAfter)) {
              const bcPattern = itemName.substring(termStart, termEnd + 1);
              if (bcPattern.length >= 2 && bcPattern.length <= 3) {
                bcPatterns.add(bcPattern);
              }
            }
          }
          
          // Move to next occurrence
          searchIndex = termEnd;
        }
      }
    });
    
    // Combine AB and BC patterns
    const allPatterns = new Set([...abPatterns, ...bcPatterns]);
    
    // Sort and return
    const sortedPatterns = Array.from(allPatterns)
      .sort((a, b) => {
        // Prefer shorter first
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        // Then alphabetically
        return a.localeCompare(b, 'zh-CN');
      });
    
    // If <= 50 patterns, return all; otherwise return top 50
    if (sortedPatterns.length <= 50) {
      return sortedPatterns;
    }
    
    return sortedPatterns.slice(0, 50);
  };
  
  // Handle keyword suggestion click - fill search box with keyword
  const handleKeywordSuggestionClick = (keyword) => {
    setShowDropdown(false);
    setSearchTerm(keyword);
    if (onChange) {
      onChange(keyword);
    }
    if (onSearch) {
      onSearch(keyword);
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

  // Close dropdown when search term changes (only if not on search page)
  useEffect(() => {
    if (searchTerm.trim() && !hasSearchResults) {
      setShowDropdown(false);
    }
  }, [searchTerm, hasSearchResults]);

  // Handle history item click
  const handleHistoryItemClick = (item) => {
    setShowDropdown(false);
    if (onItemSelect) {
      onItemSelect(item);
    }
  };

  // Handle search keyword click
  const handleSearchKeywordClick = (keyword) => {
    setShowDropdown(false);
    setSearchTerm(keyword);
    if (onChange) {
      onChange(keyword);
    }
    if (onSearch) {
      onSearch(keyword);
    }
  };

  // Handle remove history item
  const handleRemoveHistoryItem = (e, itemId) => {
    e.stopPropagation();
    removeItemFromHistory(itemId);
  };

  // Handle remove search keyword
  const handleRemoveSearchKeyword = (e, keyword) => {
    e.stopPropagation();
    removeSearchFromHistory(keyword);
    setSearchHistory(prev => prev.filter(k => k !== keyword));
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
    // Show dropdown when typing on search page
    if (hasSearchResults) {
      setShowDropdown(true);
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

        {/* Dropdown - Show search results on search page, otherwise show history/keywords */}
        {showDropdown && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
          >
            {hasSearchResults && searchTerm.trim() ? (
              /* Keyword Suggestions Dropdown - Show when on search page with input */
              <>
                <div className="px-3 py-2 border-b border-slate-700/50">
                  <span className="text-xs text-gray-400 font-medium">關鍵字推薦</span>
                </div>
                <div className="py-1">
                  {getKeywordSuggestions().map((keyword, index) => (
                    <button
                      key={`${keyword}-${index}`}
                      onClick={() => handleKeywordSuggestionClick(keyword)}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-purple-800/40 transition-colors text-left group"
                    >
                      <div className="flex-shrink-0">
                        {/* Search keyword icon */}
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4 text-ffxiv-gold" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{keyword}</div>
                      </div>
                    </button>
                  ))}
                  {getKeywordSuggestions().length === 0 && (
                    <div className="py-4 text-center text-xs text-gray-500">
                      無匹配關鍵字
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* History and Search Keywords Dropdown - Show when not on search page */
              <>
                {/* Search Keywords Section - Show first */}
                {searchHistory.length > 0 && (
                  <>
                    <div className="px-3 py-2 border-b border-slate-700/50">
                      <span className="text-xs text-gray-400 font-medium">搜索關鍵字</span>
                    </div>
                    <div className="py-1">
                      {searchHistory.slice(0, 3).map((keyword, index) => (
                        <button
                          key={`${keyword}-${index}`}
                          onClick={() => handleSearchKeywordClick(keyword)}
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-purple-800/40 transition-colors text-left group"
                        >
                          <div className="flex-shrink-0">
                            {/* Search keyword icon */}
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-4 w-4 text-ffxiv-gold" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                              />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{keyword}</div>
                          </div>
                          <button
                            onClick={(e) => handleRemoveSearchKeyword(e, keyword)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="刪除"
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-4 w-4" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M6 18L18 6M6 6l12 12" 
                              />
                            </svg>
                          </button>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* History Items Section - Show after search keywords */}
                {historyItems.length > 0 && (
                  <>
                    {searchHistory.length > 0 && (
                      <div className="px-3 py-2 border-t border-b border-slate-700/50">
                        <span className="text-xs text-gray-400 font-medium">歷史記錄</span>
                      </div>
                    )}
                    {searchHistory.length === 0 && (
                      <div className="px-3 py-2 border-b border-slate-700/50">
                        <span className="text-xs text-gray-400 font-medium">歷史記錄</span>
                      </div>
                    )}
                    <div className="py-1">
                      {historyItems.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleHistoryItemClick(item)}
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-purple-800/40 transition-colors text-left group"
                        >
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {/* History icon */}
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-4 w-4 text-ffxiv-gold flex-shrink-0" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                              />
                            </svg>
                            <ItemImage
                              itemId={item.id}
                              alt={item.name}
                              className="w-8 h-8 object-contain rounded border border-slate-600/50 bg-slate-800/50 flex-shrink-0"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{item.name}</div>
                            <div className="text-xs text-gray-500">ID: {item.id}</div>
                          </div>
                          <button
                            onClick={(e) => handleRemoveHistoryItem(e, item.id)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="刪除"
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-4 w-4" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M6 18L18 6M6 6l12 12" 
                              />
                            </svg>
                          </button>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Empty state */}
                {historyItems.length === 0 && searchHistory.length === 0 && (
                  <div className="py-4 text-center text-xs text-gray-500">
                    暫無記錄
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
