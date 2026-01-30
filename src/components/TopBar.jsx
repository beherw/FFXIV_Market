import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import HistoryButton from './HistoryButton';
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
  
  // Optional: selected item for external links
  selectedItem,
  getSimplifiedChineseName,
  addToast,
  
  // Optional: custom navigation buttons
  showNavigationButtons = true,
  activePage = null, // 'crafting-inspiration', 'msq-price-checker', 'advanced-search', 'history', or null
  
  // Optional: custom handlers
  onMSQPriceCheckerClick,
  onCraftingInspirationClick,
  onAdvancedSearchClick,
  onTaxRatesClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Track if wiki button is currently processing (to prevent duplicate clicks)
  const [isWikiProcessing, setIsWikiProcessing] = useState(false);
  
  // Determine active page from location if not provided
  const currentActivePage = activePage || (() => {
    if (location.pathname === '/crafting-inspiration') return 'crafting-inspiration';
    if (location.pathname === '/msq-price-checker') return 'msq-price-checker';
    if (location.pathname === '/advanced-search') return 'advanced-search';
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
    // If already on the crafting inspiration page, do nothing
    if (location.pathname === '/crafting-inspiration') {
      return;
    }
    
    if (onCraftingInspirationClick) {
      onCraftingInspirationClick();
    } else {
      setSearchText('');
      navigate('/crafting-inspiration');
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
            // Prevent duplicate clicks
            if (isWikiProcessing) {
              return;
            }
            
            // Mark as processing
            setIsWikiProcessing(true);
            
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
            } finally {
              // Remove processing state after a short delay to allow window.open to complete
              // This prevents rapid clicking but allows legitimate re-clicks after the page opens
              setTimeout(() => {
                setIsWikiProcessing(false);
              }, 1000);
            }
          }}
          disabled={isWikiProcessing}
          className={`topbar-external-link ${isWikiProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Wiki"
        >
          <span className="topbar-external-link-full">Wiki</span>
          <span className="topbar-external-link-short">W</span>
        </button>
        <a
          href={`https://www.garlandtools.org/db/#item/${selectedItem.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-external-link"
          title="Garland"
        >
          <span className="topbar-external-link-full">Garland</span>
          <span className="topbar-external-link-short">G</span>
        </a>
        <a
          href={`https://universalis.app/market/${selectedItem.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="topbar-external-link"
          title="Market"
        >
          <span className="topbar-external-link-full">Market</span>
          <span className="topbar-external-link-short">M</span>
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
          src={`${getAssetPath('logo.png')}?v=2`}
          alt="返回主頁"
          className={logoClass}
        />
      </button>

      {/* Fixed Search Bar - Top Row */}
      <div className={`topbar-container ${isItemInfoPage ? 'item-info-page' : ''}`}>
        {/* Item Info Page: Simplified responsive layout */}
        {isItemInfoPage ? (
          <div className="topbar-item-info-wrapper">
            {/* First Row: Logo + Search Bar + Navigation Buttons (desktop) + External Links (desktop, fixed right) */}
            <div className="topbar-item-info-first-row">
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
              <div className="topbar-search-container item-info-page">
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

              {/* Navigation Buttons - Desktop: Show on first row */}
              {showNavigationButtons && (
                <>
                  {/* Advanced Search Button */}
                  <div className="topbar-nav-button-container item-info-page-desktop">
                    <button
                      onClick={handleAdvancedSearchClick}
                      className={`topbar-nav-button item-info-page ${currentActivePage === 'advanced-search' ? 'active' : ''}`}
                      title="進階搜尋"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="topbar-nav-icon item-info-page"
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
                      <span className="topbar-nav-text item-info-page">進階搜尋</span>
                    </button>
                  </div>

                  {/* History Button */}
                  <div className="topbar-nav-button-container item-info-page-desktop">
                    <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} isItemInfoPage={true} />
                  </div>

                  {/* Visual Separator */}
                  <div className="topbar-nav-separator item-info-page item-info-page-desktop"></div>

                  {/* Crafting Inspiration Button */}
                  <div className="topbar-nav-button-container item-info-page-desktop">
                    <button
                      onClick={handleCraftingInspirationClick}
                      className={`topbar-nav-button item-info-page ${currentActivePage === 'crafting-inspiration' ? 'active' : ''}`}
                      title="製造職找價"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="topbar-nav-icon item-info-page"
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
                      <span className="topbar-nav-text item-info-page">製造靈感</span>
                    </button>
                  </div>

                  {/* MSQ Equipment Price Checker Button */}
                  <div className="topbar-nav-button-container item-info-page-desktop">
                    <button
                      onClick={handleMSQPriceCheckerClick}
                      className={`topbar-nav-button item-info-page ${currentActivePage === 'msq-price-checker' ? 'active' : ''}`}
                      title="主線裝備查價"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="topbar-nav-icon item-info-page"
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
                      <span className="topbar-nav-text item-info-page">主線裝備</span>
                    </button>
                  </div>

                  {/* Tax Rates Button */}
                  <div className="topbar-nav-button-container item-info-page-desktop">
                    <button
                      onClick={onTaxRatesClick}
                      className="topbar-nav-button item-info-page"
                      title="查稅"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="topbar-nav-icon item-info-page"
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
                      <span className="topbar-nav-text item-info-page">查稅</span>
                    </button>
                  </div>
                </>
              )}

            </div>

            {/* External Links - Always fixed top right */}
            <div className="topbar-item-info-external-links">
              {renderExternalLinks()}
            </div>

            {/* Second Row: Navigation Buttons - Show when space is limited */}
            {showNavigationButtons && (
              <div className="topbar-item-info-nav-row">
                {/* Advanced Search Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleAdvancedSearchClick}
                    className={`topbar-nav-button item-info-page ${currentActivePage === 'advanced-search' ? 'active' : ''}`}
                    title="進階搜尋"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="topbar-nav-icon item-info-page"
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
                    <span className="topbar-nav-text item-info-page">進階搜尋</span>
                  </button>
                </div>

                {/* History Button */}
                <div className="topbar-nav-button-container">
                  <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} isItemInfoPage={true} />
                </div>

                {/* Visual Separator */}
                <div className="topbar-nav-separator item-info-page"></div>

                {/* Crafting Inspiration Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleCraftingInspirationClick}
                    className={`topbar-nav-button item-info-page ${currentActivePage === 'crafting-inspiration' ? 'active' : ''}`}
                    title="製造職找價"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="topbar-nav-icon item-info-page"
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
                    <span className="topbar-nav-text item-info-page">製造靈感</span>
                  </button>
                </div>

                {/* MSQ Equipment Price Checker Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={handleMSQPriceCheckerClick}
                    className={`topbar-nav-button item-info-page ${currentActivePage === 'msq-price-checker' ? 'active' : ''}`}
                    title="主線裝備查價"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="topbar-nav-icon item-info-page"
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
                    <span className="topbar-nav-text item-info-page">主線裝備</span>
                  </button>
                </div>

                {/* Tax Rates Button */}
                <div className="topbar-nav-button-container">
                  <button
                    onClick={onTaxRatesClick}
                    className="topbar-nav-button item-info-page"
                    title="查稅"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="topbar-nav-icon item-info-page"
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
                    <span className="topbar-nav-text item-info-page">查稅</span>
                  </button>
                </div>
              </div>
            )}

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

            {/* All three navigation buttons */}
            {showNavigationButtons && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
