import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHistory } from '../hooks/useHistory';
import ItemImage from './ItemImage';

export default function HistoryButton({ onItemSelect, compact = false, setSearchText }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const timeoutRef = useRef(null);
  
  // Use the centralized history hook
  const { historyItems, isLoading, clearHistory } = useHistory();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Delay closing to allow moving to dropdown
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleItemClick = (item) => {
    if (onItemSelect) {
      onItemSelect(item);
    }
    setIsOpen(false);
  };

  const handleButtonClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
    
    // Clear search text like MSQ button does
    if (setSearchText) {
      setSearchText('');
    }
    
    // Navigate to history page directly (don't go through home)
    // This prevents the issue where history gets cleared
    navigate('/history');
  };

  const handleClearHistory = (e) => {
    e.stopPropagation();
    if (window.confirm('確定要清空所有歷史記錄嗎？')) {
      clearHistory();
      setIsOpen(false);
    }
  };

  // Highlight button when on history page
  const isOnHistoryPage = location.pathname === '/history';

  return (
    <div 
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleButtonClick}
        onMouseDown={(e) => e.stopPropagation()}
        className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors ${
          compact 
            ? 'px-2 h-8 gap-1.5' 
            : 'px-2 mid:px-3 detail:px-4 h-9 mid:h-12 gap-1.5 mid:gap-2'
        } ${
          isOnHistoryPage 
            ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
            : 'border-purple-500/30 hover:border-ffxiv-gold/50'
        }`}
        title="歷史記錄"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4 mid:h-5 mid:w-5 text-ffxiv-gold" 
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
        <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold hidden mid:inline">歷史記錄</span>
        <span className="text-xs font-semibold text-ffxiv-gold mid:hidden">歷史</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-2 w-64 mid:w-80 bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto"
          onMouseEnter={() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
          }}
          onMouseLeave={handleMouseLeave}
        >
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ffxiv-gold mx-auto"></div>
              <p className="text-xs text-gray-400 mt-2">載入中...</p>
            </div>
          ) : historyItems.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-400">暫無歷史記錄</p>
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-purple-500/20 relative">
                <p className="text-xs text-ffxiv-gold font-semibold">最近查看 ({historyItems.length})</p>
                <button
                  onClick={handleClearHistory}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-400 transition-colors group"
                  title="清空歷史記錄"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                </button>
              </div>
              <div className="py-1">
                {historyItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-purple-900/30 transition-colors text-left"
                  >
                    <div className="flex-shrink-0">
                      <ItemImage
                        itemId={item.id}
                        alt={item.name}
                        className="w-10 h-10 object-contain rounded border border-purple-500/30 bg-slate-900/50"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium truncate" title={item.name}>
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">ID: {item.id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
