// Item table component - replicates ObservableHQ's item selection table
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ItemImage from './ItemImage';
import { generateItemUrl } from '../utils/urlSlug';

// Lazy load ilvls data
let ilvlsDataRef = null;
const loadIlvlsData = async () => {
  if (ilvlsDataRef) {
    return ilvlsDataRef;
  }
  const ilvlsModule = await import('../../teamcraft_git/libs/data/src/lib/json/ilvls.json');
  ilvlsDataRef = ilvlsModule.default;
  return ilvlsDataRef;
};

// Lazy load rarities data
let raritiesDataRef = null;
const loadRaritiesData = async () => {
  if (raritiesDataRef) {
    return raritiesDataRef;
  }
  const raritiesModule = await import('../../teamcraft_git/libs/data/src/lib/json/rarities.json');
  raritiesDataRef = raritiesModule.default;
  return raritiesDataRef;
};

// Lazy load item-patch data
let itemPatchDataRef = null;
const loadItemPatchData = async () => {
  if (itemPatchDataRef) {
    return itemPatchDataRef;
  }
  const patchModule = await import('../../teamcraft_git/libs/data/src/lib/json/item-patch.json');
  itemPatchDataRef = patchModule.default;
  return itemPatchDataRef;
};

// Lazy load patch-names data
let patchNamesDataRef = null;
const loadPatchNamesData = async () => {
  if (patchNamesDataRef) {
    return patchNamesDataRef;
  }
  const patchNamesModule = await import('../../teamcraft_git/libs/data/src/lib/json/patch-names.json');
  patchNamesDataRef = patchNamesModule.default;
  return patchNamesDataRef;
};

// Version color palette - colors are assigned sequentially by major version number
// This ensures consistent colors across sessions and automatic color assignment for new versions
const VERSION_COLOR_PALETTE = [
  '#4A90E2',   // 0: Blue (for version 2.X - ARR)
  '#7B68EE',   // 1: Slate Blue (for version 3.X - Heavensward)
  '#FF6B6B',   // 2: Red (for version 4.X - Stormblood)
  '#FFD93D',   // 3: Yellow (for version 5.X - Shadowbringers)
  '#6BCF7F',   // 4: Green (for version 6.X - Endwalker)
  '#FF8C42',   // 5: Orange (for version 7.X - Dawntrail)
  '#9B59B6',   // 6: Purple (for future versions)
  '#1ABC9C',   // 7: Turquoise
  '#E74C3C',   // 8: Red
  '#3498DB',   // 9: Light Blue
  '#F39C12',   // 10: Orange
  '#16A085',   // 11: Green
  '#E67E22',   // 12: Dark Orange
  '#C0392B',   // 13: Dark Red
  '#8E44AD',   // 14: Dark Purple
  '#27AE60',   // 15: Dark Green
  '#2980B9',   // 16: Dark Blue
  '#D35400',   // 17: Brown
  '#34495E',   // 18: Dark Gray
  '#95A5A6',   // 19: Light Gray
];

// Version color mapping - assigns colors from palette based on major version number
// Same color for all patches in the same major version (e.g., 7.0-7.5 all use same color)
// Version 2.X uses index 0, version 3.X uses index 1, etc.
// Supports both "7.4" format and "7.X" format
const getVersionColor = (versionString) => {
  if (!versionString) return '#9CA3AF';
  
  // Extract major version number (e.g., "7.4" -> 7, "6.5" -> 6, "6.X" -> 6)
  const majorVersion = parseInt(versionString.split('.')[0], 10);
  
  // Convert version to palette index: version 2.X -> index 0, version 3.X -> index 1, etc.
  const paletteIndex = majorVersion - 2;
  
  // Use modulo to cycle through palette if version exceeds palette size
  // This ensures consistent color assignment even for very high version numbers
  if (paletteIndex >= 0 && paletteIndex < VERSION_COLOR_PALETTE.length) {
    return VERSION_COLOR_PALETTE[paletteIndex];
  } else if (paletteIndex >= 0) {
    // For versions beyond palette, cycle through colors
    return VERSION_COLOR_PALETTE[paletteIndex % VERSION_COLOR_PALETTE.length];
  }
  
  // Default gray for invalid or very old versions (< 2.X)
  return '#9CA3AF';
};

// Item name cell with copy button
const ItemNameCell = ({ itemName, addToast }) => {
  const handleCopyClick = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(itemName).then(() => {
      if (addToast) {
        addToast('已複製物品名稱', 'success');
      }
    }).catch(() => {
      if (addToast) {
        addToast('複製失敗', 'error');
      }
    });
  };

  return (
    <td 
      className="px-2 sm:px-4 py-2 text-white font-medium text-xs sm:text-sm break-words" 
      style={{ minWidth: '160px', maxWidth: '280px' }}
    >
      <div className="flex items-center gap-1.5">
        <span 
          className="flex-1 block" 
          style={{ wordBreak: 'break-word', lineHeight: '1.4' }}
        >
          {itemName}
        </span>
        <button
          onClick={handleCopyClick}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-ffxiv-gold hover:bg-purple-800/40 rounded-md border border-transparent hover:border-purple-500/40 transition-all duration-200"
          title="複製物品名稱"
          aria-label="複製物品名稱"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-3.5 w-3.5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
            />
          </svg>
        </button>
      </div>
    </td>
  );
};

export default function ItemTable({ items, onSelect, selectedItem, marketableItems, itemVelocities, itemAveragePrices, itemMinListings, itemRecentPurchases, itemTradability, isLoadingVelocities, getSimplifiedChineseName, addToast, currentPage = 1, itemsPerPage = null, selectedRarities: externalSelectedRarities, setSelectedRarities: externalSetSelectedRarities, raritiesData: externalRaritiesData, externalRarityFilter = false, externalRarityCounts = null, isServerDataLoaded = true, isRaritySelectorDisabled = false, itemsAlreadyFiltered = false }) {
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc' - default to desc for highest ilvl first
  const [ilvlsData, setIlvlsData] = useState(null);
  const [raritiesData, setRaritiesData] = useState(null);
  const [itemPatchData, setItemPatchData] = useState(null);
  const [patchNamesData, setPatchNamesData] = useState(null);
  const [internalSelectedRarities, setInternalSelectedRarities] = useState([]); // Multi-select: empty array = show all, [rarityValue1, rarityValue2, ...] = show selected rarities
  const [selectedVersions, setSelectedVersions] = useState([]); // Multi-select: empty array = show all, [version1, version2, ...] = show selected versions
  
  // Track which item IDs are currently processing wiki requests (to prevent duplicate clicks)
  const [wikiProcessingIds, setWikiProcessingIds] = useState(new Set());
  
  // Use external state if provided, otherwise use internal state
  const selectedRarities = externalSelectedRarities !== undefined ? externalSelectedRarities : internalSelectedRarities;
  const setSelectedRarities = externalSetSelectedRarities !== undefined ? externalSetSelectedRarities : setInternalSelectedRarities;
  const raritiesDataToUse = externalRaritiesData || raritiesData;
  
  // Load ilvls data
  useEffect(() => {
    loadIlvlsData().then(data => {
      setIlvlsData(data);
    });
  }, []);

  // Load rarities data (only if not provided externally)
  useEffect(() => {
    // Only load if external data is not provided (undefined or null) and internal data is not loaded yet
    if ((externalRaritiesData === undefined || externalRaritiesData === null) && !raritiesData) {
      loadRaritiesData().then(data => {
        setRaritiesData(data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalRaritiesData]);

  // Load item-patch and patch-names data
  useEffect(() => {
    Promise.all([
      loadItemPatchData(),
      loadPatchNamesData()
    ]).then(([patchData, patchNames]) => {
      setItemPatchData(patchData);
      setPatchNamesData(patchNames);
    });
  }, []);
  
  // Helper function to get ilvl for an item
  const getIlvl = (itemId) => {
    if (!ilvlsData || !itemId) return null;
    return ilvlsData[itemId.toString()] || null;
  };

  // Helper function to get rarity for an item
  const getRarity = useCallback((itemId) => {
    if (!raritiesDataToUse || !itemId) return 0; // Default to 0 if not found
    return raritiesDataToUse[itemId.toString()] !== undefined ? raritiesDataToUse[itemId.toString()] : 0;
  }, [raritiesDataToUse]);

  // Helper function to get version for an item
  // Returns the version string rounded down to 1 decimal place (e.g., "7.4", "6.0", "5.2")
  const getVersion = (itemId) => {
    if (!itemPatchData || !patchNamesData || !itemId) return null;
    
    // Get patch ID from item-patch.json
    const patchId = itemPatchData[itemId.toString()];
    if (patchId === undefined || patchId === null) return null;
    
    // Get patch info from patch-names.json
    const patchInfo = patchNamesData[patchId.toString()];
    if (!patchInfo || !patchInfo.version) return null;
    
    // Round down to 1 decimal place
    // e.g., "6.05" -> 6.0, "5.21" -> 5.2, "7.4" -> 7.4
    const versionNum = parseFloat(patchInfo.version);
    if (isNaN(versionNum)) return patchInfo.version;
    
    // Round down to 1 decimal place using Math.floor
    const rounded = Math.floor(versionNum * 10) / 10;
    return rounded.toFixed(1);
  };

  // Version Icon Component
  const VersionIcon = ({ version }) => {
    if (version === null || version === undefined) {
      return (
        <span className="text-gray-500 text-xs">-</span>
      );
    }
    
    // version is already a string like "7.4", "6.5", "5.21"
    const versionText = version;
    const color = getVersionColor(versionText);
    
    return (
      <div 
        className="inline-flex items-center px-2 py-1 rounded-lg border transition-all hover:scale-105 shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
          borderColor: `${color}50`,
          color: color,
          boxShadow: `0 1px 3px ${color}20`,
        }}
        title={`版本 ${versionText}`}
      >
        <span className="text-xs font-bold whitespace-nowrap tracking-tight">{versionText}</span>
      </div>
    );
  };

  // Filter items: hide untradeable items if there are any tradeable items
  // This should work both during loading and after loading completes
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Skip marketability filtering if items are already pre-filtered (e.g., tradeableResults)
    // This prevents double-filtering which can cause items to disappear
    if (!itemsAlreadyFiltered && marketableItems) {
      // CRITICAL: First check using marketableItems (always available)
      // This ensures filtering works even when itemTradability hasn't loaded yet
      const hasTradeableItemsByMarketable = items.some(item => marketableItems.has(item.id));
      
      if (hasTradeableItemsByMarketable) {
        // CRITICAL: Always use marketableItems as the ONLY filter when we have tradeable items
        // This ensures untradeable items are NEVER displayed, even if itemTradability data is incomplete or wrong
        // itemTradability is NOT used here because it may be incomplete during initial render
        // marketableItems is the source of truth and is always available
        filtered = items.filter(item => {
          // ONLY check: must be in marketableItems
          // This is the definitive check - if not in marketableItems, it's not tradeable
          return marketableItems.has(item.id);
        });
      }
    }

    // Filter by rarity if rarity filter is active (multi-select mode)
    // Skip if externalRarityFilter is true (filtering already done externally before pagination)
    if (!externalRarityFilter && selectedRarities.length > 0 && raritiesDataToUse) {
      filtered = filtered.filter(item => {
        const itemRarity = raritiesDataToUse[item.id?.toString()] !== undefined 
          ? raritiesDataToUse[item.id.toString()] 
          : 0;
        return selectedRarities.includes(itemRarity);
      });
    }

    // Filter by version if version filter is active (multi-select mode)
    // selectedVersions format: ["6.X", "5.X"] means filter all versions 6.0-6.9 and 5.0-5.9
    if (selectedVersions.length > 0 && itemPatchData && patchNamesData) {
      const selectedMajorVersions = selectedVersions
        .map(v => parseInt(v.split('.')[0], 10))
        .filter(v => !isNaN(v)); // Extract major version numbers (e.g., [6, 5] from ["6.X", "5.X"])
      
      if (selectedMajorVersions.length > 0) {
        filtered = filtered.filter(item => {
          const itemVersion = getVersion(item.id);
          if (!itemVersion) return false;
          
          const itemVersionNum = parseFloat(itemVersion);
          if (isNaN(itemVersionNum)) return false;
          
          const itemMajorVersion = Math.floor(itemVersionNum);
          // Match if item's major version matches any selected major version (e.g., 6.0-6.9 matches "6.X")
          return selectedMajorVersions.includes(itemMajorVersion);
        });
      }
    }

    return filtered;
  }, [items, isLoadingVelocities, itemTradability, marketableItems, selectedRarities, raritiesDataToUse, externalRarityFilter, selectedVersions, itemPatchData, patchNamesData, itemsAlreadyFiltered]);

  // Sort items based on current sort column and direction
  const sortedItems = useMemo(() => {
    if (!sortColumn) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      // First: Always separate tradable from untradable (tradable always first)
      // This should happen BEFORE any other sorting logic
      const aTradable = itemTradability ? itemTradability[a.id] : undefined;
      const bTradable = itemTradability ? itemTradability[b.id] : undefined;
      const aIsTradable = aTradable === true;
      const bIsTradable = bTradable === true;
      
      // For 'tradable' column, skip this check as it's the primary sort
      if (sortColumn !== 'tradable' && aIsTradable !== bIsTradable) {
        return bIsTradable ? 1 : -1; // Tradable (true) comes before untradable (false)
      }

      let aValue, bValue;

      switch (sortColumn) {
        case 'id':
          // Sort by ilvl if available, otherwise by id
          const aIlvl = ilvlsData ? (ilvlsData[a.id?.toString()] || null) : null;
          const bIlvl = ilvlsData ? (ilvlsData[b.id?.toString()] || null) : null;
          if (aIlvl !== null && bIlvl !== null) {
            aValue = aIlvl;
            bValue = bIlvl;
          } else if (aIlvl !== null) {
            aValue = aIlvl;
            bValue = b.id; // Use id as fallback
          } else if (bIlvl !== null) {
            aValue = a.id; // Use id as fallback
            bValue = bIlvl;
          } else {
            aValue = a.id;
            bValue = b.id;
          }
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'tradable':
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
        case 'version':
          // Get version strings and convert to numbers for comparison
          const aVersionStr = getVersion(a.id);
          const bVersionStr = getVersion(b.id);
          // Convert version strings to numbers (e.g., "7.4" -> 7.4, "6.0" -> 6.0)
          // null/undefined versions will be treated as -1 (sorted to the end)
          if (aVersionStr === null || aVersionStr === undefined) {
            aValue = -1;
          } else {
            const aVersionNum = parseFloat(aVersionStr);
            aValue = isNaN(aVersionNum) ? -1 : aVersionNum;
          }
          if (bVersionStr === null || bVersionStr === undefined) {
            bValue = -1;
          } else {
            const bVersionNum = parseFloat(bVersionStr);
            bValue = isNaN(bVersionNum) ? -1 : bVersionNum;
          }
          break;
        default:
          return 0;
      }

      // Special handling for velocity, averagePrice, minListing, and recentPurchase columns
      if (sortColumn === 'velocity' || sortColumn === 'averagePrice' || sortColumn === 'minListing' || sortColumn === 'recentPurchase') {
        // Both are tradable or both are untradable (already separated above)
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
      } else if (sortColumn === 'version') {
        // For version column: items with versions come before items without versions
        // Items without versions (aValue === -1) should be sorted to the end
        const aHasVersion = aValue !== -1;
        const bHasVersion = bValue !== -1;
        
        if (aHasVersion !== bHasVersion) {
          return bHasVersion ? 1 : -1; // Items with versions come before items without versions
        }
        
        // Both have versions or both don't have versions
        if (aHasVersion && bHasVersion) {
          // Sort by version number: ascending = newest first (higher version first), descending = oldest first (lower version first)
          if (aValue < bValue) return sortDirection === 'asc' ? 1 : -1; // Reversed for newest first on asc
          if (aValue > bValue) return sortDirection === 'asc' ? -1 : 1; // Reversed for newest first on asc
        }
        // If both don't have versions, they're equal, will fall through to ID sort
      } else if (sortColumn === 'tradable') {
        // For tradable column, reverse the logic: ascending puts tradable (1) first, descending puts non-tradable (0) first
        if (aValue < bValue) return sortDirection === 'asc' ? 1 : -1; // Reversed: ascending puts higher value (tradable) first
        if (aValue > bValue) return sortDirection === 'asc' ? -1 : 1; // Reversed: ascending puts higher value (tradable) first
      } else {
        // Normal comparison for other columns (id, name)
        // Note: tradable/untradable separation already happened at the top
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      }
      
      // If values are equal, use ID as secondary sort
      return a.id - b.id;
    });
  }, [filteredItems, sortColumn, sortDirection, itemTradability, itemVelocities, itemAveragePrices, itemMinListings, itemRecentPurchases, ilvlsData, itemPatchData, patchNamesData]);

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

  // Calculate rarity counts for legend
  // Use external counts if provided (for all results), otherwise calculate from current items
  const rarityCounts = useMemo(() => {
    // If external counts are provided, use them (they represent all results, not just current page)
    if (externalRarityCounts) {
      return externalRarityCounts;
    }
    // Otherwise, calculate from current items (fallback for other use cases)
    if (!raritiesDataToUse) return {};
    const counts = {};
    items.forEach(item => {
      const rarity = raritiesDataToUse[item.id?.toString()] !== undefined 
        ? raritiesDataToUse[item.id.toString()] 
        : 0;
      counts[rarity] = (counts[rarity] || 0) + 1;
    });
    return counts;
  }, [items, raritiesDataToUse, externalRarityCounts]);

  // Calculate version counts grouped by major version (e.g., 6.X includes 6.0-6.9)
  // Only calculate when items are loaded and patch data is available
  const versionCounts = useMemo(() => {
    if (!itemPatchData || !patchNamesData || !items || items.length === 0) return {};
    const counts = {};
    items.forEach(item => {
      // Inline version calculation to avoid dependency on getVersion function
      if (!itemPatchData || !patchNamesData || !item.id) {
        return;
      }
      const patchId = itemPatchData[item.id.toString()];
      if (patchId === undefined || patchId === null) {
        return;
      }
      const patchInfo = patchNamesData[patchId.toString()];
      if (!patchInfo || !patchInfo.version) {
        return;
      }
      const versionNum = parseFloat(patchInfo.version);
      if (isNaN(versionNum)) {
        return;
      }
      // Get major version number (e.g., 6.0 -> 6, 5.2 -> 5)
      const majorVersion = Math.floor(versionNum);
      const majorVersionKey = `${majorVersion}.X`;
      
      // Count items by major version (e.g., 6.X includes all 6.0-6.9)
      counts[majorVersionKey] = (counts[majorVersionKey] || 0) + 1;
    });
    return counts;
  }, [items, itemPatchData, patchNamesData]);

  // Get sorted list of available major versions (for display)
  const availableVersions = useMemo(() => {
    const versions = Object.keys(versionCounts);
    // Sort versions numerically by major version number (e.g., "5.X" < "6.X" < "7.X")
    return versions.sort((a, b) => {
      const aMajor = parseInt(a.split('.')[0], 10);
      const bMajor = parseInt(b.split('.')[0], 10);
      if (isNaN(aMajor) || isNaN(bMajor)) return a.localeCompare(b);
      return bMajor - aMajor; // Descending order (newest first)
    });
  }, [versionCounts]);

  // Calculate rarity counts based on current version filter (if versions are selected)
  // This is used to disable rarity options that have no items in the selected versions
  const rarityCountsWithVersionFilter = useMemo(() => {
    if (!raritiesDataToUse || !items || items.length === 0) return {};
    
    // Start with all items
    let itemsToCount = items;
    
    // Apply version filter if versions are selected (multi-select)
    if (selectedVersions.length > 0 && itemPatchData && patchNamesData) {
      const selectedMajorVersions = selectedVersions
        .map(v => parseInt(v.split('.')[0], 10))
        .filter(v => !isNaN(v));
      
      if (selectedMajorVersions.length > 0) {
        itemsToCount = items.filter(item => {
          // Inline version calculation
          if (!itemPatchData || !patchNamesData || !item.id) return false;
          const patchId = itemPatchData[item.id.toString()];
          if (patchId === undefined || patchId === null) return false;
          const patchInfo = patchNamesData[patchId.toString()];
          if (!patchInfo || !patchInfo.version) return false;
          const versionNum = parseFloat(patchInfo.version);
          if (isNaN(versionNum)) return false;
          const itemMajorVersion = Math.floor(versionNum);
          return selectedMajorVersions.includes(itemMajorVersion);
        });
      }
    }
    
    // Count rarities in filtered items
    const counts = {};
    itemsToCount.forEach(item => {
      const rarity = raritiesDataToUse[item.id?.toString()] !== undefined 
        ? raritiesDataToUse[item.id.toString()] 
        : 0;
      counts[rarity] = (counts[rarity] || 0) + 1;
    });
    return counts;
  }, [items, raritiesDataToUse, selectedVersions, itemPatchData, patchNamesData]);

  // Calculate version counts based on current rarity filter (if rarities are selected)
  // This is used to disable version options that have no items in the selected rarities
  const versionCountsWithRarityFilter = useMemo(() => {
    if (!itemPatchData || !patchNamesData || !items || items.length === 0) return {};
    
    // Start with all items
    let itemsToCount = items;
    
    // Apply rarity filter if rarities are selected (multi-select)
    if (selectedRarities.length > 0 && raritiesDataToUse) {
      itemsToCount = items.filter(item => {
        const itemRarity = raritiesDataToUse[item.id?.toString()] !== undefined 
          ? raritiesDataToUse[item.id.toString()] 
          : 0;
        return selectedRarities.includes(itemRarity);
      });
    }
    
    // Count versions in filtered items
    const counts = {};
    itemsToCount.forEach(item => {
      // Inline version calculation
      if (!itemPatchData || !patchNamesData || !item.id) {
        return;
      }
      const patchId = itemPatchData[item.id.toString()];
      if (patchId === undefined || patchId === null) {
        return;
      }
      const patchInfo = patchNamesData[patchId.toString()];
      if (!patchInfo || !patchInfo.version) {
        return;
      }
      const versionNum = parseFloat(patchInfo.version);
      if (isNaN(versionNum)) {
        return;
      }
      const majorVersion = Math.floor(versionNum);
      const majorVersionKey = `${majorVersion}.X`;
      counts[majorVersionKey] = (counts[majorVersionKey] || 0) + 1;
    });
    return counts;
  }, [items, itemPatchData, patchNamesData, selectedRarities, raritiesDataToUse]);

  const rarityOptions = [
    { value: 1, label: '普通', color: '#f3f3f3' },
    { value: 2, label: '精良', color: '#c0ffc0' },
    { value: 3, label: '稀有', color: '#5990ff' },
    { value: 4, label: '史诗', color: '#b38cff' }
  ];

  return (
    <div className="overflow-x-auto bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20">
      {/* Rarity Legend Filter and Version Filter */}
      {(raritiesDataToUse || (availableVersions.length > 0 && itemPatchData && patchNamesData)) && (
        <div className="px-4 py-2 bg-purple-900/20 border-b border-purple-500/20">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Rarity Selector */}
            {raritiesDataToUse && (
              <>
                <span className="text-xs font-semibold text-ffxiv-gold">稀有度選擇:</span>
                {rarityOptions.map(rarity => {
                  // Multi-select mode: multiple rarities can be selected at a time
                  const isSelected = selectedRarities.includes(rarity.value);
                  // Use filtered count if versions are selected, otherwise use base count
                  const count = selectedVersions.length > 0 
                    ? (rarityCountsWithVersionFilter[rarity.value] || 0)
                    : (rarityCounts[rarity.value] || 0);
                  const isDisabled = count === 0 || isRaritySelectorDisabled; // Disable if no items of this rarity or data loading in progress
                  
                  return (
                    <button
                      key={rarity.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          // If this rarity is already selected, remove it from selection
                          setSelectedRarities(prev => prev.filter(r => r !== rarity.value));
                        } else {
                          // Add this rarity to selection (multi-select)
                          setSelectedRarities(prev => [...prev, rarity.value]);
                        }
                      }}
                      disabled={isDisabled}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                        isDisabled
                          ? 'border-gray-700 bg-slate-800/30 text-gray-600 cursor-not-allowed opacity-30'
                          : isSelected
                            ? 'border-ffxiv-gold bg-ffxiv-gold/20 text-ffxiv-gold'
                            : 'border-gray-600 bg-slate-800/50 text-gray-400 hover:border-gray-500 hover:bg-slate-700/50 opacity-60'
                      }`}
                      style={{
                        borderColor: isDisabled ? undefined : (isSelected ? undefined : rarity.color),
                        color: isDisabled ? undefined : (isSelected ? undefined : rarity.color)
                      }}
                      title={isDisabled ? (isRaritySelectorDisabled ? '請耐心等待物品加載完成' : `${rarity.label} (無物品)`) : rarity.label}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rarity.color }}></span>
                        <span>{rarity.label}</span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
            
            {/* Version Selector - only show when items are loaded and versions are available */}
            {availableVersions.length > 0 && itemPatchData && patchNamesData && (
              <>
                <span className="text-xs font-semibold text-ffxiv-gold ml-2">版本號選擇:</span>
                {availableVersions.map(version => {
                  // Multi-select mode: multiple versions can be selected at a time
                  const isSelected = selectedVersions.includes(version);
                  // Use filtered count if rarities are selected, otherwise use base count
                  const count = selectedRarities.length > 0 
                    ? (versionCountsWithRarityFilter[version] || 0)
                    : (versionCounts[version] || 0);
                  const isDisabled = count === 0 || isRaritySelectorDisabled; // Disable if no items of this version or data loading in progress
                  const versionColor = getVersionColor(version);
                  
                  return (
                    <button
                      key={version}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          // If this version is already selected, remove it from selection
                          setSelectedVersions(prev => prev.filter(v => v !== version));
                        } else {
                          // Add this version to selection (multi-select)
                          setSelectedVersions(prev => [...prev, version]);
                        }
                      }}
                      disabled={isDisabled}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                        isDisabled
                          ? 'border-gray-700 bg-slate-800/30 text-gray-600 cursor-not-allowed opacity-30'
                          : isSelected
                            ? 'border-ffxiv-gold bg-ffxiv-gold/20 text-ffxiv-gold'
                            : 'border-gray-600 bg-slate-800/50 text-gray-400 hover:border-gray-500 hover:bg-slate-700/50 opacity-60'
                      }`}
                      style={{
                        borderColor: isDisabled ? undefined : (isSelected ? undefined : `${versionColor}50`),
                        color: isDisabled ? undefined : (isSelected ? undefined : versionColor)
                      }}
                      title={isDisabled ? (isRaritySelectorDisabled ? '請耐心等待物品加載完成' : `版本 ${version} (無物品)`) : `版本 ${version}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: versionColor }}></span>
                        <span>{version}</span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
      {isLoadingVelocities && (
        <div className="px-4 py-2 bg-purple-900/30 border-b border-purple-500/20 flex items-center gap-2 text-xs text-ffxiv-gold">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-ffxiv-gold"></div>
          <span>載入市場數據中...</span>
        </div>
      )}
      <table className="w-full border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border-b border-purple-500/30">
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-12 sm:w-16">圖片</th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-16 sm:w-20 cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('id')}
            >
              <div className="flex items-center gap-1">
                ilvl
                <SortIcon column="id" />
              </div>
            </th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-20 sm:w-24 cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('version')}
            >
              <div className="flex items-center gap-1">
                版本
                <SortIcon column="version" />
              </div>
            </th>
            <th 
              className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs min-w-[160px] sm:min-w-[200px] cursor-pointer hover:bg-purple-800/40 transition-colors select-none"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1">
                物品名
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-ffxiv-gold opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="點擊複製按鈕可複製物品名稱">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
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
            // Calculate original index for priority loading (first 5 items of final sorted/filtered list)
            // This is the position in sortedItems (after filtering and sorting, before pagination)
            // 
            // If pagination is handled internally (itemsPerPage is set):
            //   - Use pagination offset + current index to get position in sortedItems
            //   - This gives the absolute position in the full sorted list
            // If pagination is handled externally (itemsPerPage is null/undefined):
            //   - items prop is already paginated, so sortedItems only contains current page
            //   - Use index directly, which gives position 0-49 for current page
            //   - For page 1, items 0-4 get priority (correct)
            //   - For page 2+, items 0-4 of that page get priority (acceptable - they're visible)
            // This ensures icons for the first 5 items in the final order get priority
            const paginationOffset = itemsPerPage && itemsPerPage > 0 
              ? (currentPage - 1) * itemsPerPage 
              : 0;
            const originalIndex = paginationOffset + index;
            
            // Ensure priority is only set for items that are actually in the first 5 positions
            // This handles the case where sortedItems might be recalculating
            const isPriority = originalIndex < 5 && sortedItems.length > 0;
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
                    const url = generateItemUrl(item.id, item.nameTW || item.name || 'item');
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
                    priority={isPriority}
                    loadDelay={isPriority ? 0 : (originalIndex >= 5 ? (originalIndex - 5) * 200 : 0)}
                  />
                </td>
                <td className="px-2 sm:px-4 py-2 text-right font-mono text-xs">
                  {getIlvl(item.id) !== null ? (
                    <span className="text-green-400 font-semibold">{getIlvl(item.id)}</span>
                  ) : (
                    <span className="text-gray-400">{item.id}</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-2 text-center">
                  <VersionIcon version={getVersion(item.id)} />
                </td>
                <ItemNameCell itemName={item.name} addToast={addToast} />
                <td className="px-2 sm:px-4 py-2 text-left text-xs">
                  {isLoadingVelocities ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-600/40">
                      <span className="text-gray-500 animate-pulse">...</span>
                    </div>
                  ) : isTradable && velocity !== undefined && velocity !== null ? (
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
                        
                        // Prevent duplicate clicks
                        if (wikiProcessingIds.has(item.id)) {
                          return;
                        }
                        
                        // Mark as processing
                        setWikiProcessingIds(prev => new Set(prev).add(item.id));
                        
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
                        } finally {
                          // Remove from processing set after a short delay to allow window.open to complete
                          // This prevents rapid clicking but allows legitimate re-clicks after the page opens
                          setTimeout(() => {
                            setWikiProcessingIds(prev => {
                              const next = new Set(prev);
                              next.delete(item.id);
                              return next;
                            });
                          }, 1000);
                        }
                      }}
                      disabled={wikiProcessingIds.has(item.id)}
                      className={`transition-colors whitespace-nowrap bg-transparent border-none p-0 ${
                        wikiProcessingIds.has(item.id)
                          ? 'text-gray-500 cursor-not-allowed opacity-50'
                          : 'text-ffxiv-accent hover:text-ffxiv-gold cursor-pointer'
                      }`}
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
