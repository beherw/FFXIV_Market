import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ onSearch, isLoading, value, onChange, disabled, disabledTooltip }) {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isComposing, setIsComposing] = useState(false);
  const debounceTimerRef = useRef(null);
  const onSearchRef = useRef(onSearch);
  const inputRef = useRef(null);

  // Keep onSearch ref up to date
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

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
    <div className="w-full min-w-[280px] sm:min-w-[320px]">
      <div className="relative group">
        <div className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="多關鍵詞用空格分隔（例：豹 褲）"
          className={`w-full h-9 sm:h-12 pl-9 sm:pl-10 pr-9 sm:pr-10 bg-slate-900/80 backdrop-blur-sm border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 transition-all text-xs sm:text-sm shadow-lg ${
            isDisabled 
              ? 'border-slate-700/30 cursor-not-allowed opacity-60' 
              : 'border-purple-500/30 focus:border-ffxiv-gold focus:ring-ffxiv-gold/50'
          }`}
          disabled={isDisabled}
        />
        {isLoading && (
          <div className="absolute right-2.5 sm:right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-ffxiv-gold"></div>
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
      </div>
    </div>
  );
}
