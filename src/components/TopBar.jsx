import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import HistoryButton from './HistoryButton';
import GameVersionBadge from './GameVersionBadge';
import { getAssetPath } from '../utils/assetPath.js';
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
  
  
  // Optional: custom navigation buttons
  showNavigationButtons = true,
  activePage = null, // 'crafting-inspiration', 'msq-price-checker', 'advanced-search', 'company-craft', 'history', or null
  
  // Optional: custom handlers
  onMSQPriceCheckerClick,
  onCraftingInspirationClick,
  onAdvancedSearchClick,
  onVenturesClick,
  onTaxRatesClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const topbarContainerRef = useRef(null);

  useLayoutEffect(() => {
    const topbarElement = topbarContainerRef.current;
    if (!topbarElement || typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const applyTopbarOffsets = () => {
      const rect = topbarElement.getBoundingClientRect();
      const topbarBottom = Math.max(0, Math.ceil(rect.bottom));
      const contentOffset = topbarBottom + 8;
      const toastOffset = topbarBottom + 4;

      root.style.setProperty('--topbar-height', `${topbarBottom}px`);
      root.style.setProperty('--topbar-content-offset', `${contentOffset}px`);
      root.style.setProperty('--topbar-toast-offset', `${toastOffset}px`);
    };

    applyTopbarOffsets();

    const resizeObserver = new ResizeObserver(applyTopbarOffsets);
    resizeObserver.observe(topbarElement);
    window.addEventListener('resize', applyTopbarOffsets);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', applyTopbarOffsets);
    };
  }, [showNavigationButtons]);
  
  // Determine active page from location if not provided
  const currentActivePage = activePage || (() => {
    if (location.pathname === '/crafting-inspiration') return 'crafting-inspiration';
    if (location.pathname === '/msq-price-checker') return 'msq-price-checker';
    if (location.pathname === '/advanced-search') return 'advanced-search';
    if (location.pathname === '/company-craft') return 'company-craft';
    if (location.pathname === '/ventures') return 'ventures';
    if (location.pathname === '/history') return 'history';
    return null;
  })();
  
  const handleAdvancedSearchClick = () => {
    // If already on the advanced search page, do nothing
    if (location.pathname === '/advanced-search') {
      return;
    }
    
    if (onAdvancedSearchClick) {
      onAdvancedSearchClick();
    } else {
      if (setSearchText) {
        setSearchText('');
      }
      navigate('/advanced-search');
    }
  };
  
  const handleMSQPriceCheckerClick = () => {
    // If already on the MSQ price checker page, do nothing
    if (location.pathname === '/msq-price-checker') {
      return;
    }
    
    if (onMSQPriceCheckerClick) {
      onMSQPriceCheckerClick();
    } else {
      setSearchText('');
      navigate('/msq-price-checker');
    }
  };
  
  const handleCraftingInspirationClick = () => {
    if (location.pathname === '/crafting-inspiration') return;
    if (onCraftingInspirationClick) {
      onCraftingInspirationClick();
    } else {
      setSearchText('');
      navigate('/crafting-inspiration');
    }
  };

  const handleVenturesClick = () => {
    if (location.pathname === '/ventures') return;
    if (onVenturesClick) {
      onVenturesClick();
    } else {
      if (setSearchText) setSearchText('');
      navigate('/ventures');
    }
  };
  
  const logoClass = isServerDataLoaded ? 'topbar-logo-loaded' : 'topbar-logo-loading';

  return (
    <>
      {/* Logo - Desktop: Fixed Top Left */}
      <button
        onClick={() => navigate('/')}
        className="topbar-desktop-logo"
        title="返回主頁"
      >
        <img
          src={`${getAssetPath('logo.png')}?v=2`}
          alt="返回主頁"
          className={logoClass}
        />
      </button>

      {/* Fixed Search Bar - Top Row */}
      <div ref={topbarContainerRef} className="topbar-container">
        <div className="topbar-first-row">
            <div className="topbar-main-row">
            {/* Mobile Logo */}
            <button
              onClick={() => navigate('/')}
              className="topbar-mobile-logo"
              title="返回主頁"
            >
              <img
                src={`${getAssetPath('logo.png')}?v=2`}
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
            </div>

            {/* All three navigation buttons */}
            {showNavigationButtons && (
              <div className="topbar-actions-row" role="group" aria-label="頁面功能按鈕">
                {/* Advanced Search Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleAdvancedSearchClick}
                    className={`topbar-nav-button ${currentActivePage === 'advanced-search' ? 'active' : ''}`}
                    title="進階搜尋"
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                    <span className="topbar-nav-text">進階搜尋</span>
                    <span className="topbar-nav-text narrow-only">進階</span>
                  </button>
                </div>

                {/* History Button */}
                <div className="topbar-nav-button-container">
                  <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} isItemInfoPage={false} />
                </div>

                {/* Visual Separator */}
                <div className="topbar-nav-separator"></div>

                {/* Crafting Inspiration Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleCraftingInspirationClick}
                    className={`topbar-nav-button ${currentActivePage === 'crafting-inspiration' ? 'active' : ''}`}
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
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="topbar-nav-text">製造靈感</span>
                    <span className="topbar-nav-text narrow-only">感</span>
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
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                    <span className="topbar-nav-text">主線裝備</span>
                    <span className="topbar-nav-text narrow-only">裝備</span>
                  </button>
                </div>

                {/* Ventures Price Checker Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleVenturesClick}
                    className={`topbar-nav-button ${currentActivePage === 'ventures' ? 'active' : ''}`}
                    title="僱員查價"
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span className="topbar-nav-text">僱員查價</span>
                    <span className="topbar-nav-text narrow-only">僱員</span>
                  </button>
                </div>

                {/* Tax Rates Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={onTaxRatesClick}
                    className="topbar-nav-button"
                    title="查稅"
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
                    <span className="topbar-nav-text">查稅</span>
                  </button>
                </div>

                {/* Bug Report Button */}
                <GameVersionBadge />
                <a
                  href="https://forum.gamer.com.tw/C.php?bsn=17608&snA=28740"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="topbar-bug-report-btn"
                  title="回報問題"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="topbar-bug-report-icon"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span className="topbar-bug-report-text">回報</span>
                </a>
              </div>
            )}
          </div>
      </div>
    </>
  );
}
