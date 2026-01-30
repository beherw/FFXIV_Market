// Centralized Search Results Table Component
// Used by: Main Search, Advanced Search, MSQ Price Checker, Crafting Inspiration
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ItemTable from './ItemTable';
import ServerSelector from './ServerSelector';
import RunningLoader from './RunningLoader';

export default function SearchResultsTable({
  // Results data
  items = [],
  filteredItems = null, // Optional: pre-filtered items for pagination calculation
  
  // Server selector props
  selectedWorld,
  selectedServerOption,
  onWorldChange,
  onServerOptionChange,
  datacenters = [],
  worlds = {},
  serverOptions = [],
  isServerSelectorDisabled = false,
  
  // Market data
  marketableItems = null,
  itemVelocities = {},
  itemAveragePrices = {},
  itemMinListings = {},
  itemRecentPurchases = {},
  itemTradability = {},
  isLoadingVelocities = false,
  
  // ItemTable props
  onSelect,
  selectedItem = null,
  averagePriceHeader = '平均價格',
  getSimplifiedChineseName,
  addToast,
  
  // Pagination
  defaultItemsPerPage = 20,
  itemsPerPageOptions = [20, 30, 50, 100, 200],
  // External pagination control (optional - if provided, use external state instead of internal)
  externalCurrentPage = null,
  externalItemsPerPage = null,
  onExternalPageChange = null,
  onExternalItemsPerPageChange = null,
  
  // Loading indicator
  showLoadingIndicator = false,
  loadingIndicatorMinDisplayTime = 1000, // Minimum time to show loading indicator (ms)
  velocityLoadingProgress = null, // Optional: external loading progress { loaded, total }. If provided, use this instead of calculating internally
  
      // Header
      title = '搜索結果',
      showServerBadge = true,
      titleSuffix = null, // Optional suffix for title (e.g., "，顯示 X 個")
      
      // Advanced features
      showUntradeableButton = false,
      untradeableCount = 0,
      onToggleUntradeable = null,
      isShowUntradeable = false,
      tradeableCount = 0, // Count of tradeable items (for showUntradeable button condition)
      
      // Rarity filter (for Advanced Search and Main Search)
      selectedRarities = [],
      setSelectedRarities = null,
      raritiesData = null,
      externalRarityFilter = false,
      externalRarityCounts = null,
      isRaritySelectorDisabled = false,
      
      // Warning message
      showWarningForLargeResults = true,
      
      // Loading state for running loader
      isSearching = false, // Show running loader when searching and no results
      searchingItemsCount = 0, // Count of items found during search
      
      // Callbacks
      onPageChange = null, // Optional callback when page changes
      scrollRef = null, // Optional ref to scroll to when page changes (instead of top of page)
}) {
  // Pagination state (use external if provided, otherwise use internal)
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [internalItemsPerPage, setInternalItemsPerPage] = useState(defaultItemsPerPage);
  
  const currentPage = externalCurrentPage !== null ? externalCurrentPage : internalCurrentPage;
  const itemsPerPage = externalItemsPerPage !== null ? externalItemsPerPage : internalItemsPerPage;
  
  // Loading indicator state
  const [showLoadingIndicatorState, setShowLoadingIndicatorState] = useState(false);
  const loadingIndicatorStartTimeRef = useRef(null);
  
  // Use filteredItems if provided, otherwise use items for pagination calculation
  // Note: ItemTable handles pagination internally, we just need to calculate totalPages for UI
  const itemsToPaginate = useMemo(() => {
    return filteredItems !== null ? filteredItems : items;
  }, [items, filteredItems]);
  
  // Calculate velocity loading progress internally, or use external progress if provided
  // External progress tracks items REQUESTED (more accurate), internal tracks items with DATA RECEIVED
  const velocityLoadingProgressDisplay = useMemo(() => {
    // If external progress is provided, use it (tracks items requested, more accurate)
    if (velocityLoadingProgress && velocityLoadingProgress.total > 0) {
      return velocityLoadingProgress;
    }
    // Otherwise, calculate internally based on items with data received
    const loaded = Object.keys(itemVelocities).length;
    const total = items.length; // Total items that need velocity data
    return { loaded, total };
  }, [velocityLoadingProgress, itemVelocities, items.length]);
  
  // Pagination calculations (for UI display only, ItemTable handles actual pagination)
  const totalPages = Math.ceil(itemsToPaginate.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  // Reset to first page when items change (only if using internal state)
  useEffect(() => {
    if (externalCurrentPage === null) {
      setInternalCurrentPage(1);
    }
  }, [items.length, externalCurrentPage]);
  
  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    
    // Scroll to results table if scrollRef provided, otherwise scroll to top
    if (scrollRef && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Use external handler if provided, otherwise use internal state
    if (onExternalPageChange) {
      onExternalPageChange(newPage);
    } else if (externalCurrentPage === null) {
      setInternalCurrentPage(newPage);
    }
    
    // Call optional callback
    if (onPageChange) {
      onPageChange(newPage);
    }
  }, [totalPages, onPageChange, onExternalPageChange, externalCurrentPage, scrollRef]);
  
  // Handle items per page change
  const handleItemsPerPageChange = useCallback((newItemsPerPage) => {
    // Use external handler if provided, otherwise use internal state
    if (onExternalItemsPerPageChange) {
      onExternalItemsPerPageChange(newItemsPerPage);
      // Reset to first page
      if (onExternalPageChange) {
        onExternalPageChange(1);
      } else if (externalCurrentPage === null) {
        setInternalCurrentPage(1);
      }
    } else if (externalItemsPerPage === null) {
      setInternalItemsPerPage(newItemsPerPage);
      setInternalCurrentPage(1); // Reset to first page
    }
  }, [onExternalItemsPerPageChange, onExternalPageChange, externalItemsPerPage, externalCurrentPage]);
  
  // Note: Loading indicator is now shown in header (inline) instead of separate block
  // This matches main search behavior
  
  // Ensure currentPage doesn't exceed totalPages (only if using internal state)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages && externalCurrentPage === null) {
      setInternalCurrentPage(1);
    }
  }, [totalPages, currentPage, externalCurrentPage]);
  
  // Show running loader when searching and no results yet
  if (items.length === 0 && isSearching) {
    return (
      <div className="mb-6 min-h-[500px]">
        <RunningLoader message={searchingItemsCount > 0 ? `正在載入 ${searchingItemsCount} 個物品...` : '正在搜尋中...'} />
      </div>
    );
  }
  
  // Keep a placeholder space when no items to prevent layout shift
  // This prevents the page from jumping when loader disappears and table appears
  if (items.length === 0) {
    return (
      <div className="mb-6 min-h-[500px]" aria-hidden="true"></div>
    );
  }
  
  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Show marketable items count in header (not total items) */}
        <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold">
          {title} ({tradeableCount > 0 ? tradeableCount : items.length} 個物品{titleSuffix || ''})
        </h2>
        {showServerBadge && selectedWorld && selectedServerOption && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border border-purple-500/30 rounded-lg backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-ffxiv-gold animate-pulse"></div>
            <span className="text-xs sm:text-sm font-semibold text-ffxiv-gold">
              {selectedServerOption === selectedWorld.section
                ? `${selectedWorld.section} (全服)`
                : worlds[selectedServerOption] || `伺服器 ${selectedServerOption}`
              }
            </span>
          </div>
        )}
        {/* Show/Hide Non-Marketable Items Button - ALWAYS VISIBLE */}
        {/* Logic:
            1. Always show button if onToggleUntradeable is provided (even if count is 0)
            2. If untradeableCount === 0: Show disabled tag "無不可交易物品"
            3. If untradeableCount > 0 but loading: Show disabled tag with count
            4. If untradeableCount > 0 and loaded: Show enabled button with count
            5. Button is disabled until server selector is enabled (all API requests complete)
            6. Clicking toggles between showing marketable vs non-marketable items
        */}
        {onToggleUntradeable && (
          <button
            onClick={() => {
              // Prevent click when disabled
              if (isServerSelectorDisabled || untradeableCount === 0) return;
              
              // Toggle visibility
              onToggleUntradeable(!isShowUntradeable);
              
              // Reset to first page when switching
              if (onExternalPageChange) {
                onExternalPageChange(1);
              } else {
                setCurrentPage(1);
              }
            }}
            disabled={isServerSelectorDisabled || untradeableCount === 0}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 backdrop-blur-sm shadow-sm border ${
              untradeableCount === 0
                ? 'bg-gradient-to-r from-slate-700/40 via-slate-600/30 to-slate-700/40 text-gray-500 border-slate-600/30 cursor-not-allowed opacity-60'
                : isServerSelectorDisabled
                  ? 'bg-gradient-to-r from-slate-700/40 via-slate-600/30 to-slate-700/40 text-gray-400 border-slate-600/30 cursor-not-allowed opacity-70'
                  : isShowUntradeable
                    ? 'bg-gradient-to-r from-purple-800/70 via-purple-700/60 to-purple-800/70 text-purple-200 border-purple-500/60 hover:from-purple-700/80 hover:via-purple-600/70 hover:to-purple-700/80 hover:border-purple-400/70 hover:shadow-md'
                    : 'bg-gradient-to-r from-amber-800/70 via-amber-700/60 to-amber-800/70 text-amber-200 border-amber-500/60 hover:from-amber-700/80 hover:via-amber-600/70 hover:to-amber-700/80 hover:border-amber-400/70 hover:shadow-md'
            }`}
          >
            {untradeableCount === 0 
              ? '無不可交易物品'
              : isShowUntradeable 
                ? `隱藏不可交易物品` 
                : `顯示不可交易物品 (${untradeableCount}個)`
            }
          </button>
        )}
        {/* Loading Indicator - show only for >=50 items, with minimum display time */}
        {/* Use fixed height container to prevent layout shift when indicator appears/disappears */}
        <div className="h-[28px] flex items-center">
          {showLoadingIndicator && items.length >= 50 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 border border-purple-500/30 rounded-lg">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-ffxiv-gold"></div>
              <span className="text-xs text-gray-300">
                載入中{velocityLoadingProgressDisplay && velocityLoadingProgressDisplay.total > 0 ? ` ${velocityLoadingProgressDisplay.loaded}/${velocityLoadingProgressDisplay.total}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Warning for large result sets - ONLY based on marketable items count */}
      {/* This warning only considers tradeableCount (marketable items), not total items */}
      {showWarningForLargeResults && tradeableCount > 100 && (() => {
        // Check if loading is complete
        // Only show green if ALL conditions are met:
        // 1. Not currently loading velocities
        // 2. Server selector is enabled (not disabled) - means loading is done
        // 3. We have actual velocity data (prevents false positive on initial render before loading starts)
        // 4. Either loading progress shows completion OR we have velocity data for items (fallback check)
        const hasVelocityData = Object.keys(itemVelocities).length > 0;
        const isLoadingComplete = !isLoadingVelocities && 
                                   !isServerSelectorDisabled &&
                                   hasVelocityData &&
                                   (velocityLoadingProgress.total === 0 || velocityLoadingProgress.loaded >= velocityLoadingProgress.total);
        
        return (
          <div className={`mb-4 p-4 rounded-lg border-2 transition-all duration-300 ${
            isLoadingComplete
              ? 'bg-green-900/40 border-green-500/50'
              : tradeableCount > 200
                ? 'bg-red-900/40 border-red-500/50'
                : 'bg-yellow-900/40 border-yellow-500/50'
          }`}>
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">
                {isLoadingComplete ? '✅' : '⚠️'}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold mb-1 ${
                  isLoadingComplete
                    ? 'text-green-400'
                    : tradeableCount > 200
                      ? 'text-red-400'
                      : 'text-yellow-400'
                }`}>
                  {isLoadingComplete ? '完成載入' : (tradeableCount > 200 ? '結果數量過多' : '結果數量較多')}
                </h3>
                <p className="text-sm text-gray-300">
                  {isLoadingComplete ? (
                    <>
                      已載入 <span className="font-bold text-green-400">{tradeableCount}</span> 個可交易物品{untradeableCount > 0 ? `（另有 ${untradeableCount} 個不可交易物品已隱藏）` : ''}。
                      <br />
                      <span className="text-green-300">建議下次使用更嚴格的關鍵字搜尋會比較快。</span>
                    </>
                  ) : (
                    <>
                      找到 <span className={`font-bold ${
                        tradeableCount > 200
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}>{tradeableCount}</span> 個可交易物品{untradeableCount > 0 ? `（另有 ${untradeableCount} 個不可交易物品已隱藏）` : ''}。
                      數據載入需要一些時間，排序可能會較慢。
                      建議使用更嚴格的關鍵詞進行搜索，或請耐心等待。
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Server Selector */}
      {selectedWorld && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <label className="text-sm font-semibold text-ffxiv-gold whitespace-nowrap">
            伺服器選擇:
          </label>
          <ServerSelector
            datacenters={datacenters}
            worlds={worlds}
            selectedWorld={selectedWorld}
            onWorldChange={onWorldChange}
            selectedServerOption={selectedServerOption}
            onServerOptionChange={onServerOptionChange}
            serverOptions={serverOptions}
            disabled={isServerSelectorDisabled || isLoadingVelocities}
          />
        </div>
      )}
      
      
      {/* Pagination Controls */}
      {itemsToPaginate.length > itemsPerPage && (
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300">每頁顯示:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-ffxiv-gold"
            >
              {itemsPerPageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span className="text-sm text-gray-400">
              顯示 {startIndex + 1}-{Math.min(endIndex, itemsToPaginate.length)} / {itemsToPaginate.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === 1
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
              }`}
            >
              首頁
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === 1
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
              }`}
            >
              上一頁
            </button>
            <span className="px-3 py-1.5 text-sm text-gray-300">
              第 {currentPage} / {totalPages} 頁
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === totalPages
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
              }`}
            >
              下一頁
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === totalPages
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
              }`}
            >
              末頁
            </button>
          </div>
        </div>
      )}
      
      {/* ItemTable */}
      <ItemTable
        items={items}
        onSelect={onSelect}
        selectedItem={selectedItem}
        marketableItems={marketableItems}
        itemVelocities={itemVelocities}
        itemAveragePrices={itemAveragePrices}
        itemMinListings={itemMinListings}
        itemRecentPurchases={itemRecentPurchases}
        itemTradability={itemTradability}
        isLoadingVelocities={isLoadingVelocities}
        averagePriceHeader={averagePriceHeader}
        getSimplifiedChineseName={getSimplifiedChineseName}
        addToast={addToast}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        selectedRarities={selectedRarities}
        setSelectedRarities={setSelectedRarities}
        raritiesData={raritiesData}
        externalRarityFilter={externalRarityFilter}
        externalRarityCounts={externalRarityCounts}
        itemsAlreadyFiltered={true}
        isRaritySelectorDisabled={isRaritySelectorDisabled}
      />
      
      {/* Pagination Controls (Bottom) */}
      {itemsToPaginate.length > itemsPerPage && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 1
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
            }`}
          >
            首頁
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 1
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
            }`}
          >
            上一頁
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-300">
            第 {currentPage} / {totalPages} 頁
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === totalPages
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
            }`}
          >
            下一頁
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === totalPages
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
            }`}
          >
            末頁
          </button>
        </div>
      )}
    </div>
  );
}
