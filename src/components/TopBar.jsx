import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import HistoryButton from './HistoryButton';

export default function TopBar({
  // Search bar props
  onSearch,
  isSearching,
  searchText,
  setSearchText,
  isServerDataLoaded,
  selectedDcName,
  onItemSelect,
  searchResults = [], // Search results to show in dropdown
  
  // Optional: selected item for external links
  selectedItem,
  getSimplifiedChineseName,
  addToast,
  
  // Optional: custom navigation buttons
  showNavigationButtons = true,
  activePage = null, // 'ultimate-price-king', 'msq-price-checker', 'history', or null
  
  // Optional: custom handlers
  onMSQPriceCheckerClick,
  onUltimatePriceKingClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active page from location if not provided
  const currentActivePage = activePage || (() => {
    if (location.pathname === '/ultimate-price-king') return 'ultimate-price-king';
    if (location.pathname === '/msq-price-checker') return 'msq-price-checker';
    if (location.pathname === '/history') return 'history';
    return null;
  })();
  
  const handleMSQPriceCheckerClick = () => {
    if (onMSQPriceCheckerClick) {
      onMSQPriceCheckerClick();
    } else {
      setSearchText('');
      navigate('/msq-price-checker');
    }
  };
  
  const handleUltimatePriceKingClick = () => {
    if (onUltimatePriceKingClick) {
      onUltimatePriceKingClick();
    } else {
      setSearchText('');
      navigate('/ultimate-price-king');
    }
  };
  
  return (
    <>
      {/* Logo - Desktop: Fixed Top Left */}
      <button
        onClick={() => navigate('/')}
        className="fixed z-[60] mid:flex items-center justify-center hover:opacity-80 transition-opacity duration-200 cursor-pointer mid:top-4 mid:left-4 hidden mid:w-12 mid:h-12 bg-transparent border-none p-0"
        title="返回主頁"
      >
        <img
          src="/logo.png"
          alt="返回主頁"
          className="w-full h-full object-contain pointer-events-none transition-all duration-200"
          style={isServerDataLoaded ? {
            filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6)) drop-shadow(0 0 16px rgba(251, 191, 36, 0.4))',
            opacity: 1
          } : {
            opacity: 0.5
          }}
        />
      </button>

      {/* Fixed Search Bar - Top Row */}
      <div className={`fixed top-2 left-0 right-0 mid:top-4 mid:right-auto z-50 ${
        selectedItem 
          ? 'px-1.5 mid:px-0 mid:left-20 py-1 mid:py-0'
          : 'px-1.5 mid:pl-20 mid:pr-0 py-1 mid:py-0'
      } mid:w-auto`}>
        <div className="relative flex items-center gap-1.5 mid:gap-3">
          {/* Mobile Logo */}
          <button
            onClick={() => navigate('/')}
            className="mid:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity duration-200 cursor-pointer bg-transparent border-none p-0"
            title="返回主頁"
          >
            <img
              src="/logo.png"
              alt="返回主頁"
              className="w-full h-full object-contain pointer-events-none transition-all duration-200"
              style={isServerDataLoaded ? {
                filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6)) drop-shadow(0 0 16px rgba(251, 191, 36, 0.4))',
                opacity: 1
              } : {
                opacity: 0.5
              }}
            />
          </button>

          {/* Search Bar */}
          <div className={`min-w-0 h-9 mid:h-12 ${
            selectedItem 
              ? 'flex-1 mid:flex-initial mid:w-80 detail:w-96 min-w-[100px]' 
              : 'flex-1 mid:flex-initial mid:w-[420px] detail:w-[520px] min-w-[100px]'
          }`}>
            <SearchBar
              onSearch={onSearch}
              isLoading={isSearching}
              value={searchText}
              onChange={setSearchText}
              disabled={!isServerDataLoaded}
              disabledTooltip={!isServerDataLoaded ? '請等待伺服器資料載入完成' : undefined}
              selectedDcName={selectedDcName}
              onItemSelect={onItemSelect}
              searchResults={searchResults}
            />
          </div>

          {/* History Button - hidden on mobile for item info page (moves to second row) */}
          <div className={`flex-shrink-0 ${selectedItem ? 'hidden mid:block' : ''}`}>
            <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} />
          </div>

          {/* Navigation Buttons - Only show when not on item info page or on desktop */}
          {showNavigationButtons && !selectedItem && (
            <>
              {/* Ultimate Price King Button */}
              <div className="flex-shrink-0">
                <button
                  onClick={handleUltimatePriceKingClick}
                  className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 mid:px-3 detail:px-4 h-9 mid:h-12 gap-1.5 mid:gap-2 ${
                    currentActivePage === 'ultimate-price-king'
                      ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                      : 'border-purple-500/30 hover:border-ffxiv-gold/50'
                  }`}
                  title="製造職找價"
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold hidden mid:inline">製造職</span>
                  <span className="text-xs font-semibold text-ffxiv-gold mid:hidden">職</span>
                </button>
              </div>

              {/* MSQ Equipment Price Checker Button */}
              <div className="flex-shrink-0">
                <button
                  onClick={handleMSQPriceCheckerClick}
                  className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 mid:px-3 detail:px-4 h-9 mid:h-12 gap-1.5 mid:gap-2 ${
                    currentActivePage === 'msq-price-checker'
                      ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                      : 'border-purple-500/30 hover:border-ffxiv-gold/50'
                  }`}
                  title="主線裝備查價"
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold hidden mid:inline">主線裝備</span>
                  <span className="text-xs font-semibold text-ffxiv-gold mid:hidden">裝備</span>
                </button>
              </div>
            </>
          )}

          {/* MSQ Equipment Price Checker Button - Mobile only in second row for item info page */}
          {selectedItem && (
            <div className="mid:hidden flex-shrink-0">
              <button
                onClick={handleMSQPriceCheckerClick}
                className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 h-8 gap-1.5 ${
                  currentActivePage === 'msq-price-checker'
                    ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                    : 'border-purple-500/30 hover:border-ffxiv-gold/50'
                }`}
                title="主線裝備查價"
              >
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs font-semibold text-ffxiv-gold">裝</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* External Links - Fixed at top right, only shown when item is selected */}
      {selectedItem && (
        <div className="fixed top-2 mid:top-4 right-2 mid:right-4 z-50 flex items-center gap-1.5 mid:gap-2">
          <button
            onClick={async () => {
              try {
                if (getSimplifiedChineseName) {
                  const simplifiedName = await getSimplifiedChineseName(selectedItem.id);
                  if (simplifiedName) {
                    const prefix = selectedItem.id > 1000 || selectedItem.id < 20 ? '物品:' : '';
                    const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(simplifiedName)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  } else {
                    const prefix = selectedItem.id > 1000 || selectedItem.id < 20 ? '物品:' : '';
                    const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(selectedItem.name)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                } else {
                  const prefix = selectedItem.id > 1000 || selectedItem.id < 20 ? '物品:' : '';
                  const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(selectedItem.name)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              } catch (error) {
                console.error('Failed to open Wiki link:', error);
                if (addToast) {
                  addToast('無法打開Wiki連結', 'error');
                }
              }
            }}
            className="px-2 mid:px-3 h-8 mid:h-10 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors flex items-center"
          >
            Wiki
          </button>
          <a
            href={`https://www.garlandtools.org/db/#item/${selectedItem.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 mid:px-3 h-8 mid:h-10 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors flex items-center"
          >
            Garland
          </a>
          <a
            href={`https://universalis.app/market/${selectedItem.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 mid:px-3 h-8 mid:h-10 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors flex items-center"
          >
            Market
          </a>
        </div>
      )}
    </>
  );
}
