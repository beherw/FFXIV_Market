import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import HistoryButton from './HistoryButton';
import '../styles/TopBar.css';

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
  marketableItems = null, // Marketable items set for filtering
  
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
  
  const isItemInfoPage = !!selectedItem;
  const logoClass = isServerDataLoaded ? 'topbar-logo-loaded' : 'topbar-logo-loading';

  // Helper function to render external links
  const renderExternalLinks = (className = '') => {
    if (!isItemInfoPage) return null;
    
    return (
      <div className={`topbar-external-links ${className}`}>
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
          className="topbar-external-link"
        >
          Wiki
        </button>
        <a
          href={`https://www.garlandtools.org/db/#item/${selectedItem.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-external-link"
        >
          Garland
        </a>
        <a
          href={`https://universalis.app/market/${selectedItem.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-external-link"
        >
          Market
        </a>
      </div>
    );
  };

  return (
    <>
      {/* Logo - Desktop: Fixed Top Left */}
      <button
        onClick={() => navigate('/')}
        className="topbar-desktop-logo"
        title="返回主頁"
      >
        <img
          src="/logo.png"
          alt="返回主頁"
          className={logoClass}
        />
      </button>

      {/* Fixed Search Bar - Top Row */}
      <div className={`topbar-container ${isItemInfoPage ? 'item-info-page' : ''}`}>
        {/* Item Info Page: Wrapper for left (logo/search/buttons) and right (external links) */}
        {isItemInfoPage ? (
          <div className="topbar-item-info-wrapper">
            {/* Left side: Logo, Search Bar, and navigation buttons */}
            <div className="topbar-item-info-left">
              {/* First Row: Logo, Search Bar, and all three navigation buttons */}
              <div className="topbar-first-row">
                {/* Mobile Logo */}
                <button
                  onClick={() => navigate('/')}
                  className="topbar-mobile-logo"
                  title="返回主頁"
                >
                  <img
                    src="/logo.png"
                    alt="返回主頁"
                    className={logoClass}
                  />
                </button>

                {/* Search Bar */}
                <div className={`topbar-search-container ${isItemInfoPage ? 'item-info-page' : ''}`}>
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
                    marketableItems={marketableItems}
                  />
                </div>

                {/* All three navigation buttons on first row */}
                {showNavigationButtons && (
                  <>
                    {/* History Button */}
                    <div className={`topbar-nav-button-container ${isItemInfoPage ? 'item-info-page' : ''}`}>
                      <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} isItemInfoPage={isItemInfoPage} />
                    </div>

                    {/* Ultimate Price King Button */}
                    <div className={`topbar-nav-button-container ${isItemInfoPage ? 'item-info-page' : ''}`}>
                      <button
                        onClick={handleUltimatePriceKingClick}
                        className={`topbar-nav-button ${isItemInfoPage ? 'item-info-page' : ''} ${currentActivePage === 'ultimate-price-king' ? 'active' : ''}`}
                        title="製造職找價"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`topbar-nav-icon ${isItemInfoPage ? 'item-info-page' : ''}`}
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
                        <span className="topbar-nav-text item-info-page">製造職</span>
                      </button>
                    </div>

                    {/* MSQ Equipment Price Checker Button */}
                    <div className={`topbar-nav-button-container ${isItemInfoPage ? 'item-info-page' : ''}`}>
                      <button
                        onClick={handleMSQPriceCheckerClick}
                        className={`topbar-nav-button ${isItemInfoPage ? 'item-info-page' : ''} ${currentActivePage === 'msq-price-checker' ? 'active' : ''}`}
                        title="主線裝備查價"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`topbar-nav-icon ${isItemInfoPage ? 'item-info-page' : ''}`}
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
                        <span className="topbar-nav-text item-info-page">主線裝備</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Second Row: Navigation buttons and External Links - Only show on item info page when mid breakpoint (890px-979px) */}
              {showNavigationButtons && (
                <div className="topbar-second-row">
                  {/* Left side: Navigation buttons */}
                  <div className="topbar-second-row-left">
                    {/* History Button - Show on second row when not wide enough */}
                    <div className="topbar-nav-button-container">
                      <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} isItemInfoPage={true} />
                    </div>

                    {/* Ultimate Price King Button */}
                    <div className="topbar-nav-button-container">
                      <button
                        onClick={handleUltimatePriceKingClick}
                        className={`topbar-nav-button topbar-second-row-nav-button ${currentActivePage === 'ultimate-price-king' ? 'active' : ''}`}
                        title="製造職找價"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="topbar-nav-icon topbar-second-row-nav-icon"
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
                        <span className="topbar-nav-text topbar-second-row-nav-text">製造職</span>
                      </button>
                    </div>

                    {/* MSQ Equipment Price Checker Button */}
                    <div className="topbar-nav-button-container">
                      <button
                        onClick={handleMSQPriceCheckerClick}
                        className={`topbar-nav-button topbar-second-row-nav-button ${currentActivePage === 'msq-price-checker' ? 'active' : ''}`}
                        title="主線裝備查價"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="topbar-nav-icon topbar-second-row-nav-icon"
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
                        <span className="topbar-nav-text topbar-second-row-nav-text">主線裝備</span>
                      </button>
                    </div>
                  </div>

                  {/* Right side: External Links */}
                  {renderExternalLinks('topbar-external-links-second-row')}
                </div>
              )}
            </div>

            {/* Right side: External Links */}
            {renderExternalLinks('topbar-item-info-right')}
          </div>
        ) : (
          /* Other Pages: Default layout */
          <div className="topbar-first-row">
            {/* Mobile Logo */}
            <button
              onClick={() => navigate('/')}
              className="topbar-mobile-logo"
              title="返回主頁"
            >
              <img
                src="/logo.png"
                alt="返回主頁"
                className={logoClass}
              />
            </button>

            {/* Search Bar */}
            <div className="topbar-search-container">
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
                marketableItems={marketableItems}
              />
            </div>

            {/* All three navigation buttons */}
            {showNavigationButtons && (
              <>
                {/* History Button */}
                <div className="topbar-nav-button-container">
                  <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} isItemInfoPage={false} />
                </div>

                {/* Ultimate Price King Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleUltimatePriceKingClick}
                    className={`topbar-nav-button ${currentActivePage === 'ultimate-price-king' ? 'active' : ''}`}
                    title="製造職找價"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="topbar-nav-icon"
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
                    <span className="topbar-nav-text">製造職</span>
                    <span className="topbar-nav-text narrow-only">職</span>
                  </button>
                </div>

                {/* MSQ Equipment Price Checker Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleMSQPriceCheckerClick}
                    className={`topbar-nav-button ${currentActivePage === 'msq-price-checker' ? 'active' : ''}`}
                    title="主線裝備查價"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="topbar-nav-icon"
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
                    <span className="topbar-nav-text">主線裝備</span>
                    <span className="topbar-nav-text narrow-only">裝備</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile (< mid): External links on separate row for item info page */}
      {isItemInfoPage && (
        <div className="topbar-external-links-mobile">
          {renderExternalLinks()}
        </div>
      )}
    </>
  );
}
