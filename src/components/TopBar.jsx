import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import HistoryButton from './HistoryButton';
import GameVersionBadge from './GameVersionBadge';
import ThemeToggle from './ThemeToggle';
import { getAssetPath } from '../utils/assetPath.js';
import '../styles/TopBar.css';

const BUG_REPORT_URL = 'https://forum.gamer.com.tw/C.php?bsn=17608&snA=28740';

const ICON_PATHS = {
  advancedSearch: ['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7'],
  craftingInspiration: [
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  ],
  msq: ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
  ventures: ['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'],
  tax: ['M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'],
  bug: ['M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 18L18 6M6 6l12 12'],
};

export function TopBarIcon({ name, className = 'tb-icon' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      {ICON_PATHS[name].map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      ))}
    </svg>
  );
}

const PAGE_BY_PATH = {
  '/crafting-inspiration': 'crafting-inspiration',
  '/msq-price-checker': 'msq-price-checker',
  '/advanced-search': 'advanced-search',
  '/company-craft': 'company-craft',
  '/ventures': 'ventures',
  '/history': 'history',
};

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
  const headerRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Publish the bar's height so pages can offset their content and toasts.
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const applyTopbarOffsets = () => {
      const topbarBottom = Math.max(0, Math.ceil(header.getBoundingClientRect().height));
      root.style.setProperty('--topbar-height', `${topbarBottom}px`);
      root.style.setProperty('--topbar-content-offset', `${topbarBottom + 16}px`);
      root.style.setProperty('--topbar-toast-offset', `${topbarBottom + 8}px`);
    };

    applyTopbarOffsets();

    const resizeObserver = new ResizeObserver(applyTopbarOffsets);
    resizeObserver.observe(header);
    return () => resizeObserver.disconnect();
  }, [showNavigationButtons]);

  // Close the mobile menu on navigation, outside click, or Escape.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const currentActivePage = activePage || PAGE_BY_PATH[location.pathname] || null;

  const goTo = (path, customHandler) => {
    setIsMenuOpen(false);
    if (location.pathname === path) return;
    if (customHandler) {
      customHandler();
    } else {
      setSearchText?.('');
      navigate(path);
    }
  };

  const navItems = [
    { key: 'advanced-search', label: '進階搜尋', icon: 'advancedSearch', onClick: () => goTo('/advanced-search', onAdvancedSearchClick) },
    { key: 'crafting-inspiration', label: '製造靈感', icon: 'craftingInspiration', onClick: () => goTo('/crafting-inspiration', onCraftingInspirationClick) },
    { key: 'msq-price-checker', label: '主線裝備', icon: 'msq', onClick: () => goTo('/msq-price-checker', onMSQPriceCheckerClick) },
    { key: 'ventures', label: '僱員查價', icon: 'ventures', onClick: () => goTo('/ventures', onVenturesClick) },
    {
      key: 'tax',
      label: '查稅',
      icon: 'tax',
      onClick: () => {
        setIsMenuOpen(false);
        onTaxRatesClick?.();
      },
    },
  ];

  const renderNavItems = (className) =>
    navItems.map((item) => {
      const isActive = currentActivePage === item.key;
      return (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className={`${className} ${isActive ? 'is-active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
        >
          <TopBarIcon name={item.icon} />
          <span>{item.label}</span>
        </button>
      );
    });

  return (
    <header ref={headerRef} className="tb">
      <div className="tb-inner">
        <button type="button" onClick={() => navigate('/')} className="tb-logo" title="返回主頁">
          <img
            src={`${getAssetPath('logo.png')}?v=2`}
            alt="返回主頁"
            className={isServerDataLoaded ? 'tb-logo-img is-loaded' : 'tb-logo-img'}
          />
          <span className="tb-brand">繁中XIV市場</span>
        </button>

        <div className="tb-search">
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

        {showNavigationButtons && (
          <nav className="tb-nav" aria-label="頁面功能">
            {renderNavItems('tb-nav-item')}
          </nav>
        )}

        <div className="tb-tools">
          <div className="tb-tools-wide">
            <GameVersionBadge />
          </div>
          {showNavigationButtons && (
            <HistoryButton onItemSelect={onItemSelect} setSearchText={setSearchText} />
          )}
          <div className="tb-tools-wide">
            <a href={BUG_REPORT_URL} target="_blank" rel="noopener noreferrer" className="tb-btn tb-btn-icon" title="回報問題" aria-label="回報問題">
              <TopBarIcon name="bug" />
            </a>
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="tb-btn tb-btn-icon tb-menu-btn"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="tb-menu"
            aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}
          >
            <TopBarIcon name={isMenuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div id="tb-menu" className="tb-menu">
          {showNavigationButtons && <nav className="tb-menu-nav" aria-label="頁面功能">{renderNavItems('tb-menu-item')}</nav>}
          <div className="tb-menu-footer">
            <GameVersionBadge />
            <a href={BUG_REPORT_URL} target="_blank" rel="noopener noreferrer" className="tb-btn">
              <TopBarIcon name="bug" />
              <span>回報問題</span>
            </a>
            <ThemeToggle showLabel />
          </div>
        </div>
      )}
    </header>
  );
}
