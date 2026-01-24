// Item table component - replicates ObservableHQ's item selection table
import { useState, useMemo } from 'react';
import ItemImage from './ItemImage';

export default function ItemTable({ items, onSelect, selectedItem, marketableItems, itemVelocities, itemAveragePrices, itemMinListings, itemRecentPurchases, itemTradability, isLoadingVelocities, getSimplifiedChineseName, addToast, currentPage = 1, itemsPerPage = null }) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // Sort items based on current sort column and direction
  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;

    return [...items].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'tradable':
          const aTradable = itemTradability ? itemTradability[a.id] : undefined;
          const bTradable = itemTradability ? itemTradability[b.id] : undefined;
          // Treat undefined as false for sorting (non-tradable goes last)
          aValue = aTradable === true ? 1 : 0;
          bValue = bTradable === true ? 1 : 0;
          break;
        case 'velocity':
          const aVelocity = itemVelocities ? itemVelocities[a.id] : null;
          const bVelocity = itemVelocities ? itemVelocities[b.id] : null;
          // Store raw values for special handling
          aValue = aVelocity !== undefined && aVelocity !== null ? aVelocity : null;
          bValue = bVelocity !== undefined && bVelocity !== null ? bVelocity : null;
          break;
        case 'averagePrice':
          const aAvgPrice = itemAveragePrices ? itemAveragePrices[a.id] : null;
          const bAvgPrice = itemAveragePrices ? itemAveragePrices[b.id] : null;
          // Store raw values for special handling
          aValue = aAvgPrice !== undefined && aAvgPrice !== null ? aAvgPrice : null;
          bValue = bAvgPrice !== undefined && bAvgPrice !== null ? bAvgPrice : null;
          break;
        case 'minListing':
          const aMinListing = itemMinListings ? itemMinListings[a.id] : null;
          const bMinListing = itemMinListings ? itemMinListings[b.id] : null;
          // Extract price from object if it's an object, otherwise use the value directly
          // When DC is selected: minListing is a number
          // When world is selected: minListing is an object { price, region }
          aValue = aMinListing !== undefined && aMinListing !== null 
            ? (typeof aMinListing === 'object' ? aMinListing.price : aMinListing) 
            : null;
          bValue = bMinListing !== undefined && bMinListing !== null 
            ? (typeof bMinListing === 'object' ? bMinListing.price : bMinListing) 
            : null;
          break;
        case 'recentPurchase':
          const aRecentPurchase = itemRecentPurchases ? itemRecentPurchases[a.id] : null;
          const bRecentPurchase = itemRecentPurchases ? itemRecentPurchases[b.id] : null;
          // Extract price from object if it's an object, otherwise use the value directly
          // When DC is selected: recentPurchase is a number
          // When world is selected: recentPurchase is an object { price, region }
          aValue = aRecentPurchase !== undefined && aRecentPurchase !== null 
            ? (typeof aRecentPurchase === 'object' ? aRecentPurchase.price : aRecentPurchase) 
            : null;
          bValue = bRecentPurchase !== undefined && bRecentPurchase !== null 
            ? (typeof bRecentPurchase === 'object' ? bRecentPurchase.price : bRecentPurchase) 
            : null;
          break;
        default:
          return 0;
      }

      // Special handling for velocity, averagePrice, minListing, and recentPurchase columns
      if (sortColumn === 'velocity' || sortColumn === 'averagePrice' || sortColumn === 'minListing' || sortColumn === 'recentPurchase') {
        const aTradable = itemTradability ? itemTradability[a.id] : undefined;
        const bTradable = itemTradability ? itemTradability[b.id] : undefined;
        const aIsTradable = aTradable === true;
        const bIsTradable = bTradable === true;
        
        // First: Separate tradable from untradable (tradable always first)
        if (aIsTradable !== bIsTradable) {
          return bIsTradable ? 1 : -1; // Tradable (true) comes before untradable (false)
        }
        
        // Both are tradable or both are untradable
        // Within tradable items: items with values come before items without values
        if (aIsTradable && bIsTradable) {
          const aHasValue = aValue !== null && aValue !== undefined;
          const bHasValue = bValue !== null && bValue !== undefined;
          
          if (aHasValue !== bHasValue) {
            return bHasValue ? 1 : -1; // Items with values come before items without values
          }
          
          // Both have values or both don't have values
          if (aHasValue && bHasValue) {
            // Sort by value: ascending = highest first, descending = lowest first
            if (aValue < bValue) return sortDirection === 'asc' ? 1 : -1; // Reversed for highest first on asc
            if (aValue > bValue) return sortDirection === 'asc' ? -1 : 1; // Reversed for highest first on asc
          }
          // If both don't have values, they're equal, will fall through to ID sort
        }
        // If both are untradable, they're equal, will fall through to ID sort
      } else if (sortColumn === 'tradable') {
        // For tradable column, reverse the logic: ascending puts tradable (1) first, descending puts non-tradable (0) first
        if (aValue < bValue) return sortDirection === 'asc' ? 1 : -1; // Reversed: ascending puts higher value (tradable) first
        if (aValue > bValue) return sortDirection === 'asc' ? -1 : 1; // Reversed: ascending puts higher value (tradable) first
      } else {
        // Normal comparison for other columns
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      }
      
      // If values are equal, use ID as secondary sort
      return a.id - b.id;
    });
  }, [items, sortColumn, sortDirection, itemTradability, itemVelocities, itemAveragePrices, itemMinListings, itemRecentPurchases]);

  // Paginate sorted items if pagination is enabled
  const paginatedItems = useMemo(() => {
    if (!itemsPerPage || itemsPerPage <= 0) {
      return sortedItems;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage, itemsPerPage]);

  // Calculate conditions for header highlighting
  const shouldHighlightTradable = useMemo(() => {
    if (sortedItems.length <= 5) return false;
    const firstItem = sortedItems[0];
    return firstItem && itemTradability?.[firstItem.id] === false;
  }, [sortedItems, itemTradability]);

  const shouldHighlightAveragePrice = useMemo(() => {
    const itemsWithPrice = sortedItems.filter(item => itemAveragePrices?.[item.id] !== undefined).length;
    return itemsWithPrice > 10;
  }, [sortedItems, itemAveragePrices]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-ffxiv-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-ffxiv-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="overflow-x-auto bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20">
      {isLoadingVelocities && (
        <div className="px-4 py-2 bg-purple-900/30 border-b border-purple-500/20 flex items-center gap-2 text-xs text-ffxiv-gold">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-ffxiv-gold"></div>
          <span>載入市場數據中...</span>
        </div>
      )}
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border-b border-purple-500/30">
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-12 sm:w-16">圖片</th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-16 sm:w-20 cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('id')}
            >
              <div className="flex items-center gap-1">
                ID
                <SortIcon column="id" />
              </div>
            </th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs min-w-[160px] sm:min-w-[200px] cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                物品名
                <SortIcon column="name" />
              </div>
            </th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-28 sm:w-32 cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('velocity')}
            >
              <div className="flex items-center gap-1">
                日均銷量
                {isLoadingVelocities ? (
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-ffxiv-gold"></div>
                ) : (
                  <SortIcon column="velocity" />
                )}
              </div>
            </th>
            <th 
              className={`px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-36 sm:w-40 cursor-pointer hover:bg-purple-800/40 transition-colors select-none ${
                shouldHighlightAveragePrice ? 'animate-pulse' : ''
              }`}
              onClick={() => handleSort('averagePrice')}
            >
              <div className="flex items-center gap-1">
                全服平均價格
                {isLoadingVelocities ? (
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-ffxiv-gold"></div>
                ) : (
                  <SortIcon column="averagePrice" />
                )}
              </div>
            </th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-36 sm:w-40 cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('minListing')}
            >
              <div className="flex items-center gap-1">
                最低在售價
                {isLoadingVelocities ? (
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-ffxiv-gold"></div>
                ) : (
                  <SortIcon column="minListing" />
                )}
              </div>
            </th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-36 sm:w-40 cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('recentPurchase')}
            >
              <div className="flex items-center gap-1">
                最近成交價
                {isLoadingVelocities ? (
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-ffxiv-gold"></div>
                ) : (
                  <SortIcon column="recentPurchase" />
                )}
              </div>
            </th>
            <th 
              className={`px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-24 sm:w-28 cursor-pointer hover:bg-purple-800/40 transition-colors select-none ${
                shouldHighlightTradable ? 'animate-pulse' : ''
              }`}
              onClick={() => handleSort('tradable')}
            >
              <div className="flex items-center gap-1">
                可交易
                {isLoadingVelocities ? (
                  <div className="animate-spin rounded-full h-2.5 w-2.5 border-b border-ffxiv-gold"></div>
                ) : (
                  <SortIcon column="tradable" />
                )}
              </div>
            </th>
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-40 sm:w-48">鏈接</th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map((item, index) => {
            // Calculate original index for priority loading (first 5 items of all items)
            const originalIndex = (currentPage - 1) * (itemsPerPage || items.length) + index;
            // Use API-based tradability if available, otherwise fallback to marketableItems
            const isTradableFromAPI = itemTradability ? itemTradability[item.id] : undefined;
            const isMarketable = marketableItems ? marketableItems.has(item.id) : true;
            // Use API-based tradability, fallback to marketableItems check if API data not loaded yet
            const isTradable = isTradableFromAPI !== undefined ? isTradableFromAPI : (isMarketable || item.isTradable);
            const velocity = itemVelocities ? itemVelocities[item.id] : undefined;
            const averagePrice = itemAveragePrices ? itemAveragePrices[item.id] : undefined;
            const minListing = itemMinListings ? itemMinListings[item.id] : undefined;
            const recentPurchase = itemRecentPurchases ? itemRecentPurchases[item.id] : undefined;
            
            return (
              <tr
                key={item.id || index}
                onClick={() => onSelect && onSelect(item)}
                onMouseDown={(e) => {
                  // Middle mouse button (button === 1)
                  if (e.button === 1) {
                    e.preventDefault();
                    // Use relative path to ensure proper routing in SPA
                    const url = `/item/${item.id}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className={`border-b border-purple-500/20 cursor-pointer transition-colors ${
                  selectedItem?.id === item.id 
                    ? 'bg-ffxiv-gold/20' 
                    : 'hover:bg-purple-900/30'
                }`}
              >
                <td className="px-2 sm:px-4 py-2">
                  <ItemImage
                    itemId={item.id}
                    alt={item.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded border border-purple-500/30 bg-slate-900/50"
                    priority={originalIndex < 5}
                    loadDelay={originalIndex >= 5 ? (originalIndex - 5) * 200 : 0}
                  />
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-gray-400 font-mono text-xs">{item.id}</td>
                <td className="px-2 sm:px-4 py-2 text-white font-medium text-xs sm:text-sm break-words" style={{ minWidth: '160px', maxWidth: '280px' }}>
                  <span className="block" style={{ wordBreak: 'break-word', lineHeight: '1.4' }} title={item.name}>
                    {item.name}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 text-left text-xs">
                  {isLoadingVelocities ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-600/40">
                      <span className="text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : isTradable && velocity !== undefined ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/60 border border-slate-600/40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-emerald-300 font-medium whitespace-nowrap">
                        {velocity.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 text-left text-xs">
                  {isLoadingVelocities ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-600/40">
                      <span className="text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : averagePrice !== undefined ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/60 border border-slate-600/40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-ffxiv-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-ffxiv-gold font-medium whitespace-nowrap">
                        {averagePrice.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 text-left text-xs">
                  {isLoadingVelocities ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-600/40">
                      <span className="text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : minListing !== undefined ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/60 border border-slate-600/40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-blue-300 font-medium whitespace-nowrap">
                        {typeof minListing === 'object' 
                          ? minListing.price.toLocaleString() 
                          : minListing.toLocaleString()}
                      </span>
                      {typeof minListing === 'object' && minListing.region && (
                        <span className="text-xs text-gray-400 ml-1" title={`區域: ${minListing.region}`}>
                          ({minListing.region})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 text-left text-xs">
                  {isLoadingVelocities ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-600/40">
                      <span className="text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : recentPurchase !== undefined ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/60 border border-slate-600/40">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-300 font-medium whitespace-nowrap">
                        {typeof recentPurchase === 'object' 
                          ? recentPurchase.price.toLocaleString() 
                          : recentPurchase.toLocaleString()}
                      </span>
                      {typeof recentPurchase === 'object' && recentPurchase.region && (
                        <span className="text-xs text-gray-400 ml-1" title={`區域: ${recentPurchase.region}`}>
                          ({recentPurchase.region})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 text-left text-xs">
                  {isLoadingVelocities ? (
                    <span className="text-gray-500 animate-pulse">...</span>
                  ) : isTradableFromAPI !== undefined ? (
                    isTradableFromAPI ? (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] bg-green-900/50 text-green-400 border border-green-500/30 rounded">
                        可交易
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] bg-red-900/50 text-red-400 border border-red-500/30 rounded">
                        不可交易
                      </span>
                    )
                  ) : (
                    <span className="inline-block px-1.5 py-0.5 text-[10px] bg-red-900/50 text-red-400 border border-red-500/30 rounded">
                      不可交易
                    </span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2">
                  <div className="flex gap-1 sm:gap-2 text-xs whitespace-nowrap">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          if (getSimplifiedChineseName) {
                            const simplifiedName = await getSimplifiedChineseName(item.id);
                            if (simplifiedName) {
                              const prefix = item.id > 1000 || item.id < 20 ? '物品:' : '';
                              const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(simplifiedName)}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            } else {
                              const prefix = item.id > 1000 || item.id < 20 ? '物品:' : '';
                              const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(item.name)}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                            }
                          } else {
                            const prefix = item.id > 1000 || item.id < 20 ? '物品:' : '';
                            const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(item.name)}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }
                        } catch (error) {
                          console.error('Failed to open Wiki link:', error);
                          if (addToast) {
                            addToast('無法打開Wiki連結', 'error');
                          }
                        }
                      }}
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors whitespace-nowrap bg-transparent border-none p-0 cursor-pointer"
                    >
                      Wiki
                    </button>
                    <a
                      href={`https://www.garlandtools.org/db/#item/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Garland
                    </a>
                    <a
                      href={`https://universalis.app/market/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Market
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
