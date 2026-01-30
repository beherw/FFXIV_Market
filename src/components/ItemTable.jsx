// Item table component - replicates ObservableHQ's item selection table
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import ItemImage from './ItemImage';

import { getIlvlsByIds, getRaritiesByIds, getItemPatchByIds, getPatchNames } from '../services/supabaseData';
import { getItemImageUrlSync } from '../utils/itemImage';

// Lazy load patch-names data
let patchNamesDataRef = null;
const loadPatchNamesData = async () => {
  if (patchNamesDataRef) {
    return patchNamesDataRef;
  }
  patchNamesDataRef = await getPatchNames();
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

export default function ItemTable({ items, onSelect, selectedItem, marketableItems, itemVelocities, itemAveragePrices, itemMinListings, itemRecentPurchases, itemTradability, isLoadingVelocities, getSimplifiedChineseName, addToast, currentPage = 1, itemsPerPage = null, selectedRarities: externalSelectedRarities, setSelectedRarities: externalSetSelectedRarities, raritiesData: externalRaritiesData, externalRarityFilter = false, externalRarityCounts = null, isServerDataLoaded = true, isRaritySelectorDisabled = false }) {
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc' - default to desc for highest ilvl first
  const [ilvlsData, setIlvlsData] = useState(null);
  const [raritiesData, setRaritiesData] = useState(null);
  const [itemPatchData, setItemPatchData] = useState(null);
  const [patchNamesData, setPatchNamesData] = useState(null);
  const [internalSelectedRarities, setInternalSelectedRarities] = useState([]); // Multi-select: empty array = show all, [rarityValue1, rarityValue2, ...] = show selected rarities
  const [selectedVersions, setSelectedVersions] = useState([]); // Multi-select: empty array = show all, [version1, version2, ...] = show selected versions
  
  // Use external state if provided, otherwise use internal state
  const selectedRarities = externalSelectedRarities !== undefined ? externalSelectedRarities : internalSelectedRarities;
  const setSelectedRarities = externalSetSelectedRarities !== undefined ? externalSetSelectedRarities : setInternalSelectedRarities;
  const raritiesDataToUse = externalRaritiesData || raritiesData;
  
  // Track previous items to detect when items change (e.g., switching between tradeable/untradeable)
  const prevItemsRef = useRef(items);
  
  // Track which pages should have icons loaded (for preloading)
  // Set of page numbers that should load icons
  const pagesToLoadRef = useRef(new Set([1])); // Start with page 1
  const preloadTimeoutRef = useRef(null);
  const prevCurrentPageRef = useRef(currentPage);
  // State to trigger re-render when pages to load change
  const [pagesToLoadVersion, setPagesToLoadVersion] = useState(0);
  
  // Track which item IDs have already started loading icons (to avoid duplicate loading)
  // This includes items that are cached or currently loading
  const loadedItemsRef = useRef(new Set());
  
  // Track which item IDs are currently processing wiki requests (to prevent duplicate clicks)
  const [wikiProcessingIds, setWikiProcessingIds] = useState(new Set());
  
  // Load ilvls data lazily for sorting
  // For search results: load for all items (marketableItems may be null initially)
  // For other pages: only load for tradeable items when marketableItems is available (efficient)
  // OPTIMIZATION: If items already contain ilvl data, extract it directly instead of querying
  useEffect(() => {
    // Reset ilvlsData when items change (e.g., switching between tradeable/untradeable)
    const itemsChanged = prevItemsRef.current !== items && 
                         (prevItemsRef.current?.length !== items?.length || 
                          (prevItemsRef.current && items && 
                           prevItemsRef.current[0]?.id !== items[0]?.id));
    
    if (itemsChanged) {
      setIlvlsData(null);
    }
    
    // Update ref for next comparison
    prevItemsRef.current = items;
    
    if (items && items.length > 0 && !ilvlsData) {
      // Check if items already contain ilvl data (from join query)
      const firstItem = items[0];
      if (firstItem && 'ilvl' in firstItem && firstItem.ilvl !== undefined) {
        // Extract ilvl data from items
        const ilvlsFromItems = {};
        items.forEach(item => {
          if (item.id && item.ilvl !== undefined && item.ilvl !== null) {
            ilvlsFromItems[item.id.toString()] = item.ilvl;
          }
        });
        
        // Only set if we actually have data
        if (Object.keys(ilvlsFromItems).length > 0) {
          console.log(`[ItemTable] Using ilvl data from items (${Object.keys(ilvlsFromItems).length} items)`);
          setIlvlsData(ilvlsFromItems);
        }
        return;
      }
      
      // Otherwise, load ilvls from database
      let itemIdsToLoad = [];
      
      // Check if we have untradeable items in the list (when combining tradeable + untradeable)
      // If itemTradability is available, check if any items are marked as untradeable
      const hasUntradeableItems = itemTradability && items.some(item => itemTradability[item.id] === false);
      
      if (marketableItems && marketableItems.size > 0 && !hasUntradeableItems) {
        // marketableItems available and no untradeable items: only load for tradeable items (efficient)
        itemIdsToLoad = items
          .filter(item => marketableItems.has(item.id))
          .map(item => item.id)
          .filter(id => id > 0);
      } else {
        // Either marketableItems not loaded yet, or we have untradeable items in the list
        // Load for all items to enable sorting and display - needed for combined display
        itemIdsToLoad = items
          .map(item => item.id)
          .filter(id => id > 0);
      }
      
      if (itemIdsToLoad.length > 0) {
        getIlvlsByIds(itemIdsToLoad).then(data => {
          // Debug: Log sample data to verify structure
          if (Object.keys(data).length > 0) {
            const sampleId = Object.keys(data)[0];
            const sampleValue = data[sampleId];
            console.log(`[ItemTable] Loaded ilvls data: sample id=${sampleId}, ilvl=${sampleValue}`, 
              typeof sampleValue === 'number' ? '(correct)' : `(WRONG TYPE: ${typeof sampleValue})`);
            
            // Check if value equals id (which would indicate swapped columns)
            if (sampleValue === parseInt(sampleId, 10)) {
              console.error(`[ItemTable] ERROR: ilvls data appears to have swapped columns! id=${sampleId}, value=${sampleValue} (value equals id - this is wrong!)`);
            }
          }
          setIlvlsData(data);
        }).catch(error => {
          console.error('[ItemTable] Error loading ilvls:', error);
        });
      }
    }
  }, [items, ilvlsData, marketableItems, itemTradability]);

  // Load rarities data lazily
  // For search results: load for all items (marketableItems may be null initially)
  // For other pages: only load for tradeable items when marketableItems is available (efficient)
  useEffect(() => {
    // Only load if external data is not provided (undefined or null) and internal data is not loaded yet
    if (items && items.length > 0 && (externalRaritiesData === undefined || externalRaritiesData === null) && !raritiesData) {
      let itemIdsToLoad = [];
      
      if (marketableItems && marketableItems.size > 0) {
        // marketableItems available: only load for tradeable items (efficient)
        itemIdsToLoad = items
          .filter(item => marketableItems.has(item.id))
          .map(item => item.id)
          .filter(id => id > 0);
      } else if (marketableItems === null || marketableItems === undefined) {
        // marketableItems not loaded yet (e.g., search results page)
        // Load for all items to enable filtering - this is needed for search results
        itemIdsToLoad = items
          .map(item => item.id)
          .filter(id => id > 0);
      } else {
        // marketableItems is empty Set, no tradeable items
        // Still load rarities for untradeable items to enable filtering
        itemIdsToLoad = items
          .map(item => item.id)
          .filter(id => id > 0);
      }
      
      if (itemIdsToLoad.length > 0) {
        getRaritiesByIds(itemIdsToLoad).then(data => {
          setRaritiesData(data);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, externalRaritiesData, raritiesData, marketableItems]);

  // Load item-patch and patch-names data lazily
  // For search results: load for all items (marketableItems may be null initially)
  // For other pages: only load for tradeable items when marketableItems is available (efficient)
  useEffect(() => {
    if (items && items.length > 0) {
      // Check if items already contain version data (from join query)
      const firstItem = items[0];
      if (firstItem && 'version' in firstItem && firstItem.version !== undefined) {
        // Extract patch data from items
        const patchDataFromItems = {};
        items.forEach(item => {
          if (item.id && item.version !== undefined && item.version !== null) {
            patchDataFromItems[item.id.toString()] = item.version; // version is patch ID
          }
        });
        
        if (Object.keys(patchDataFromItems).length > 0) {
          // Check if patchDataFromItems is different from current itemPatchData
          // Avoid infinite loop by only updating if data actually changed
          const currentPatchKeys = itemPatchData ? Object.keys(itemPatchData).sort().join(',') : '';
          const newPatchKeys = Object.keys(patchDataFromItems).sort().join(',');
          const dataChanged = currentPatchKeys !== newPatchKeys || 
            (itemPatchData && Object.keys(patchDataFromItems).some(id => itemPatchData[id] !== patchDataFromItems[id]));
          
          if (!dataChanged && patchNamesData) {
            // Data already set and patchNamesData loaded, no need to update
            return;
          }
          
          // Load patchNamesData if not already loaded (needed to convert patch ID to version string)
          if (!patchNamesData) {
            loadPatchNamesData().then(patchNames => {
              setPatchNamesData(patchNames);
              console.log(`[ItemTable] Using patch data from items (${Object.keys(patchDataFromItems).length} items)`);
              setItemPatchData(patchDataFromItems);
            }).catch(error => {
              console.error('[ItemTable] Error loading patch names:', error);
            });
          } else if (dataChanged) {
            // patchNamesData already loaded, just set patch data if it changed
            console.log(`[ItemTable] Using patch data from items (${Object.keys(patchDataFromItems).length} items)`);
            setItemPatchData(patchDataFromItems);
          }
          return; // Don't continue to load from database if we're using items data
        }
      }
      
      // Otherwise, load patch data from database
      // Check if we have untradeable items in the list (when combining tradeable + untradeable)
      // If itemTradability is available, check if any items are marked as untradeable
      const hasUntradeableItems = itemTradability && items.some(item => itemTradability[item.id] === false);
      
      // Determine which items need patch data loaded
      let itemIdsToLoad = [];
      if (marketableItems && marketableItems.size > 0 && !hasUntradeableItems) {
        // marketableItems available and no untradeable items: only load for tradeable items (efficient)
        itemIdsToLoad = items
          .filter(item => marketableItems.has(item.id))
          .map(item => item.id)
          .filter(id => id > 0);
      } else {
        // Either marketableItems not loaded yet, or we have untradeable items in the list
        // Load for all items to enable version display and filtering - needed for combined display
        itemIdsToLoad = items
          .map(item => item.id)
          .filter(id => id > 0);
      }
      
      // Check if we need to load patch data
      // If we have untradeable items, we need to ensure all items have patch data loaded
      const needsLoad = !itemPatchData || !patchNamesData || 
        (hasUntradeableItems && itemIdsToLoad.some(id => !itemPatchData[id?.toString()]));
      
      if (needsLoad && itemIdsToLoad.length > 0) {
        // Load patch data for items that don't have it yet
        const itemsNeedingData = hasUntradeableItems && itemPatchData
          ? itemIdsToLoad.filter(id => !itemPatchData[id?.toString()])
          : itemIdsToLoad;
        
        if (itemsNeedingData.length > 0) {
          Promise.all([
            getItemPatchByIds(itemsNeedingData),
            patchNamesData ? Promise.resolve(patchNamesData) : loadPatchNamesData() // patch_names is small, can load all
          ]).then(([patchData, patchNames]) => {
            // Merge new patch data with existing data
            setItemPatchData(prev => ({ ...prev, ...patchData }));
            if (!patchNamesData) {
              setPatchNamesData(patchNames);
            }
          }).catch(error => {
            console.error('[ItemTable] Error loading patch data:', error);
          });
        } else if (!patchNamesData) {
          // Only need to load patch names
          loadPatchNamesData().then(patchNames => {
            setPatchNamesData(patchNames);
          }).catch(error => {
            console.error('[ItemTable] Error loading patch names:', error);
          });
        }
      }
    }
  }, [items, itemPatchData, patchNamesData, marketableItems, itemTradability]);
  
  // Helper function to get ilvl for an item
  const getIlvl = (itemId) => {
    if (!ilvlsData || !itemId) return null;
    const ilvlValue = ilvlsData[itemId.toString()];
    
    // Debug: Check if value equals id (which would indicate swapped columns)
    if (ilvlValue !== undefined && ilvlValue !== null && ilvlValue === parseInt(itemId, 10)) {
      console.warn(`[ItemTable] Warning: ilvl value equals item id for item ${itemId}. This may indicate swapped columns in database.`);
    }
    
    return ilvlValue !== undefined ? ilvlValue : null;
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
  // If all items are untradeable, show them all
  // This should work both during loading and after loading completes
  const filteredItems = useMemo(() => {
    let filtered = items;
    
    // Check if items have isTradable property (from searchItems - already filtered)
    // If they do, trust that and skip marketableItems filtering
    const hasIsTradableProperty = items.length > 0 && items.some(item => item.hasOwnProperty('isTradable'));
    
    if (hasIsTradableProperty) {
      // Items come from searchItems which already filtered correctly
      // Trust the isTradable property - don't filter again
      // Check if ALL items are untradeable
      const allItemsUntradeable = items.length > 0 && items.every(item => item.isTradable === false);
      
      if (allItemsUntradeable) {
        // If all items are untradeable, show them all
        filtered = items;
      } else {
        // Only filter out items explicitly marked as untradeable when there are tradeable items
        filtered = items.filter(item => {
          // If isTradable is explicitly false, hide it
          // If isTradable is true or undefined, show it
          return item.isTradable !== false;
        });
      }
    } else if (marketableItems) {
      // Items don't have isTradable property (e.g., from history)
      // Use marketableItems to filter (fallback behavior)
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
      // If no tradeable items, filtered remains as items (show all untradeable items)
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
  }, [items, isLoadingVelocities, itemTradability, marketableItems, selectedRarities, raritiesDataToUse, externalRarityFilter, selectedVersions, itemPatchData, patchNamesData]);

  // Sort items based on current sort column and direction
  // CRITICAL: This creates the final sorted list after filtering untradeables
  // When sortColumn is 'id', this sorts by ilvl (descending by default)
  // sortedItems is the source of truth for the order in which icons should be loaded
  // IMPORTANT: Items should already be sorted by ilvl descending from query time,
  // so we only re-sort if user explicitly changes sort column/direction
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
          // CRITICAL: Use descending order by default (highest ilvl first)
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
          // Apply sort direction (default: descending for ilvl)
          if (sortDirection === 'desc') {
            return bValue - aValue; // Descending: higher values first
          } else {
            return aValue - bValue; // Ascending: lower values first
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
      } else if (sortColumn === 'tradable') {
        // For tradable column, reverse the logic: ascending puts tradable (1) first, descending puts non-tradable (0) first
        if (aValue < bValue) return sortDirection === 'asc' ? 1 : -1; // Reversed: ascending puts higher value (tradable) first
        if (aValue > bValue) return sortDirection === 'asc' ? -1 : 1; // Reversed: ascending puts higher value (tradable) first
      } else {
        // Normal comparison for other columns (id, name)
        // Note: tradable/untradable separation already happened at the top
        // For 'id' column, sortDirection is already applied in the switch case above
        if (sortColumn !== 'id') {
          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        }
        // For 'id' column, comparison already done in switch case, just need to handle equal case
      }
      
      // If values are equal, use ID as secondary sort (descending for id column, ascending for others)
      if (sortColumn === 'id') {
        return b.id - a.id; // Descending by default for id column
      }
      return a.id - b.id;
    });
  }, [filteredItems, sortColumn, sortDirection, itemTradability, itemVelocities, itemAveragePrices, itemMinListings, itemRecentPurchases, ilvlsData]);

  // Paginate sorted items if pagination is enabled
  // CRITICAL: This creates the list of items for the current page
  // For page 1: items 0-19 (if itemsPerPage = 20)
  // This is the final list of items that icons will be loaded for, in order
  const paginatedItems = useMemo(() => {
    if (!itemsPerPage || itemsPerPage <= 0) {
      return sortedItems;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, currentPage, itemsPerPage]);
  
  // Calculate total pages for preloading logic
  const totalPages = useMemo(() => {
    if (!itemsPerPage || itemsPerPage <= 0) {
      return 1;
    }
    return Math.ceil(sortedItems.length / itemsPerPage);
  }, [sortedItems.length, itemsPerPage]);
  
  // Preload logic: After page 1 loads, start loading pages 2 and 3
  // Estimate: First page has ~20 items, first 10 load immediately, remaining 10 load sequentially
  // Total time: ~500ms (10 * 50ms) + API fetch time (~2-3s) ≈ 3-4 seconds
  // IMPORTANT: Handle user navigating away before preload completes
  useEffect(() => {
    if (!itemsPerPage || itemsPerPage <= 0 || totalPages < 2) {
      return;
    }
    
    // Check if page 1 is ready to load (sort ready)
    const isSortingByIlvl = sortColumn === 'id';
    const hasIlvlData = ilvlsData !== null;
    const isSortReady = !isSortingByIlvl || hasIlvlData;
    
    if (!isSortReady) {
      return; // Wait for sort to complete
    }
    
    // Only start preload timer if:
    // 1. Page 1 is marked for loading
    // 2. Pages 2 or 3 are not yet marked (not already loading)
    // 3. User hasn't navigated to page 2 or 3 yet (if they have, those pages are already loading)
    const shouldPreload = pagesToLoadRef.current.has(1) && 
                          (currentPage === 1 || currentPage > 3) && // Only preload if on page 1 or beyond page 3
                          (!pagesToLoadRef.current.has(2) || !pagesToLoadRef.current.has(3));
    
    if (shouldPreload) {
      // Clear any existing timeout
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
      
      // Estimate first page load time: ~3 seconds
      // Start preloading pages 2 and 3 after 3 seconds
      preloadTimeoutRef.current = setTimeout(() => {
        // Double-check: user might have navigated away during the delay
        // Only add pages if they're not already marked and user hasn't navigated to them
        const pagesToAdd = [];
        if (totalPages >= 2 && !pagesToLoadRef.current.has(2) && currentPage !== 2) {
          pagesToAdd.push(2);
        }
        if (totalPages >= 3 && !pagesToLoadRef.current.has(3) && currentPage !== 3) {
          pagesToAdd.push(3);
        }
        
        if (pagesToAdd.length > 0) {
          pagesToAdd.forEach(page => {
            pagesToLoadRef.current.add(page);
          });
          
          // Force re-render by updating state
          setPagesToLoadVersion(prev => prev + 1);
          console.log(`[ItemTable] Preloading pages: ${pagesToAdd.join(', ')}`);
        }
      }, 3000); // 3 seconds delay
    } else {
      // If user has navigated to page 2 or 3, cancel preload timer
      if (preloadTimeoutRef.current && (currentPage === 2 || currentPage === 3)) {
        clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = null;
      }
    };
  }, [itemsPerPage, totalPages, sortColumn, ilvlsData, currentPage]);
  
  // Check and load adjacent pages when current page changes
  // IMPORTANT: Handle user navigating before preload completes
  useEffect(() => {
    if (!itemsPerPage || itemsPerPage <= 0) {
      return;
    }
    
    // Only process if page actually changed
    if (prevCurrentPageRef.current === currentPage) {
      return;
    }
    
    const previousPage = prevCurrentPageRef.current;
    prevCurrentPageRef.current = currentPage;
    
    // Cancel preload timer if user navigated to a page that was being preloaded
    if (preloadTimeoutRef.current && (currentPage === 2 || currentPage === 3)) {
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = null;
    }
    
    // Immediately mark current page for loading (user is viewing it, must load now)
    // This ensures that if user navigated before preload completed, we still load the page
    if (!pagesToLoadRef.current.has(currentPage)) {
      pagesToLoadRef.current.add(currentPage);
    }
    
    // Check if current page and adjacent pages (current-2, current-1, current+1, current+2) should load
    const pagesToCheck = [];
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      if (!pagesToLoadRef.current.has(i)) {
        pagesToCheck.push(i);
      }
    }
    
    if (pagesToCheck.length > 0) {
      pagesToCheck.forEach(page => {
        pagesToLoadRef.current.add(page);
      });
      
      // Force re-render by updating state
      setPagesToLoadVersion(prev => prev + 1);
      console.log(`[ItemTable] Page ${currentPage} changed (from ${previousPage}), loading adjacent pages: ${pagesToCheck.join(', ')}`);
    } else if (currentPage !== previousPage) {
      // Even if no new pages to add, force re-render to update current page display
      setPagesToLoadVersion(prev => prev + 1);
    }
  }, [currentPage, itemsPerPage, totalPages]);
  
  // Reset pages to load when items change significantly
  useEffect(() => {
    const itemsChanged = prevItemsRef.current !== items && 
                         (prevItemsRef.current?.length !== items?.length || 
                          (prevItemsRef.current && items && 
                           prevItemsRef.current[0]?.id !== items[0]?.id));
    
    if (itemsChanged) {
      // Reset to only page 1
      pagesToLoadRef.current.clear();
      pagesToLoadRef.current.add(1);
      prevCurrentPageRef.current = currentPage;
      
      // Force re-render by updating state
      setPagesToLoadVersion(prev => prev + 1);
      
      // Clear preload timeout
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = null;
      }
    }
  }, [items, currentPage]);

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
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-20 sm:w-24">
              <div className="flex items-center gap-1">
                版本
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
            // Icon loading logic (centralized in ItemTable):
            // Table always initializes with sortColumn === 'id' (ilvl sort)
            // 1. Wait for ilvlsData to load and complete sorting
            // 2. After sorting completes, paginatedItems will have correct first page order (ilvl high to low)
            // 3. Only then start loading icons in the correct order (first 10 parallel, then sequential)
            // 4. Only load icons for page 1 items
            
            const isSortingByIlvl = sortColumn === 'id';
            const hasIlvlData = ilvlsData !== null;
            
            // Use API-based tradability - this is the source of truth
            // Data is already separated before passing to table, so we only need to check itemTradability
            const isTradableFromAPI = itemTradability ? itemTradability[item.id] : undefined;
            
            // Check if this is an untradeable item (we have tradeability data and it's false)
            const isUntradeable = isTradableFromAPI === false;
            
            // For untradeable items, we can start loading icons immediately without waiting for ilvlsData
            // For tradeable items, wait for ilvl sort to complete
            const isSortReady = isUntradeable ? true : (!isSortingByIlvl || hasIlvlData);
            
            // Check if current page should load icons (preloading logic)
            // paginatedItems only contains current page items, so currentPage is the page for all items here
            const shouldLoadThisPage = !itemsPerPage || itemsPerPage <= 0 || pagesToLoadRef.current.has(currentPage);
            
            // Parallel loading optimization: first 10 items load immediately in parallel
            // Remaining items load sequentially to respect rate limits
            // Testing shows 10 concurrent requests = 2.67s for 30 items (vs 10.90s sequential)
            // All configurations tested with 0% failure rate
            // IMPORTANT: Current page (user is viewing) always loads immediately
            // Preload delays only apply to hidden preload area, not the visible current page
            let loadDelay;
            if (!isSortReady || !shouldLoadThisPage) {
              loadDelay = 999999; // Large delay if sort not ready or page not marked for loading
            } else {
              // User is viewing current page: always load immediately (no preload delay)
              // First 10 items of current page load in parallel, rest sequentially
              const pageLocalIndex = index; // Index within current page (0-based)
              
              if (pageLocalIndex < 10) {
                // First 10 items of current page: load immediately in parallel (0ms delay)
                loadDelay = 0;
              } else {
                // Remaining items: sequential loading with 50ms delay per item within page
                loadDelay = (pageLocalIndex - 10) * 50;
              }
            }
            
            // Load icons for all items (both tradeable and untradeable)
            // Users want to see icons for untradeable items too
            // Pass undefined to allow icon loading for all items (ItemImage only blocks if isTradable === false)
            const shouldLoadIcon = true;
            
            const velocity = itemVelocities ? itemVelocities[item.id] : undefined;
            const averagePrice = itemAveragePrices ? itemAveragePrices[item.id] : undefined;
            const minListing = itemMinListings ? itemMinListings[item.id] : undefined;
            const recentPurchase = itemRecentPurchases ? itemRecentPurchases[item.id] : undefined;
            
            return (
              <tr
                key={`${currentPage}-${item.id || index}`}
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
                  {(() => {
                    // Check if this item's icon is already cached or loading
                    const cachedUrl = getItemImageUrlSync(item.id);
                    const isAlreadyLoaded = cachedUrl !== null || loadedItemsRef.current.has(item.id);
                    
                    // Mark as loading if not already marked and should load
                    if (!isAlreadyLoaded && shouldLoadIcon && loadDelay < 999999) {
                      loadedItemsRef.current.add(item.id);
                    }
                    
                    // If already cached, use shorter delay (0ms) since it's instant
                    const effectiveLoadDelay = cachedUrl ? 0 : loadDelay;
                    
                    return (
                      <ItemImage
                        itemId={item.id}
                        alt={item.name}
                        className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded border border-purple-500/30 bg-slate-900/50"
                        priority={false}
                        loadDelay={effectiveLoadDelay}
                        isTradable={shouldLoadIcon ? undefined : false}
                      />
                    );
                  })()}
                </td>
                <td className="px-2 sm:px-4 py-2 text-right font-mono text-xs">
                  {(() => {
                    const ilvl = getIlvl(item.id);
                    // Only show ilvl if it's a valid number and not equal to the item id
                    if (ilvl !== null && ilvl !== undefined && typeof ilvl === 'number' && ilvl !== item.id) {
                      return <span className="text-green-400 font-semibold">{ilvl}</span>;
                    } else if (ilvl === item.id) {
                      // If ilvl equals id, it means the database columns are swapped - show warning
                      console.error(`[ItemTable] ERROR: Item ${item.id} has ilvl value equal to its id. Database columns may be swapped.`);
                      return <span className="text-red-400 font-semibold" title="資料錯誤：ilvl 值等於物品 ID">-</span>;
                    } else {
                      // No ilvl data available - show dash instead of item id
                      return <span className="text-gray-400">-</span>;
                    }
                  })()}
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
                  ) : isTradableFromAPI === true && velocity !== undefined && velocity !== null ? (
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
                  {isTradableFromAPI !== undefined ? (
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
                    <span className="text-gray-500 animate-pulse">...</span>
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
      
      {/* Hidden preload area: Load icons for preloaded pages without displaying them */}
      {/* IMPORTANT: Only preload pages that user is NOT currently viewing */}
      {/* If user navigated to a page before preload completed, main table handles loading */}
      {itemsPerPage && itemsPerPage > 0 && sortedItems.length > 0 && (
        <div className="hidden" aria-hidden="true">
          {Array.from(pagesToLoadRef.current)
            .filter(page => {
              // Only preload pages that:
              // 1. Are not the current page (user is viewing it, main table handles loading)
              // 2. Are valid page numbers
              // 3. User hasn't navigated to them yet (if they have, main table is loading them)
              return page !== currentPage && page <= totalPages;
            })
            .map(page => {
              const startIndex = (page - 1) * itemsPerPage;
              const endIndex = Math.min(startIndex + itemsPerPage, sortedItems.length);
              const pageItems = sortedItems.slice(startIndex, endIndex);
              
              return pageItems.map((item, index) => {
                // Skip if already loaded or cached
                const cachedUrl = getItemImageUrlSync(item.id);
                const isAlreadyLoaded = cachedUrl !== null || loadedItemsRef.current.has(item.id);
                
                if (isAlreadyLoaded) {
                  return null; // Don't render if already loaded
                }
                
                // Double-check: if user navigated to this page, don't preload (main table handles it)
                if (page === currentPage) {
                  return null;
                }
                
                const isSortingByIlvl = sortColumn === 'id';
                const hasIlvlData = ilvlsData !== null;
                const isTradableFromAPI = itemTradability ? itemTradability[item.id] : undefined;
                const isUntradeable = isTradableFromAPI === false;
                const isSortReady = isUntradeable ? true : (!isSortingByIlvl || hasIlvlData);
                
                if (!isSortReady) {
                  return null;
                }
                
                // Mark as loading (only if not already marked by main table)
                if (!loadedItemsRef.current.has(item.id)) {
                  loadedItemsRef.current.add(item.id);
                }
                
                // Calculate delay for preloaded pages
                // Preloaded pages should start loading after page 1 completes
                const pageOffset = (page - 1) * itemsPerPage;
                const globalIndex = pageOffset + index;
                
                let loadDelay;
                if (page === 1) {
                  // Page 1: immediate for first 10, then sequential
                  // (This shouldn't happen since page 1 is currentPage, but handle it anyway)
                  if (globalIndex < 10) {
                    loadDelay = 0;
                  } else {
                    loadDelay = (globalIndex - 10) * 50;
                  }
                } else {
                  // Preloaded pages (2, 3, etc.): start after page 1 completes (~3s) + sequential delay
                  // Page 1 has ~20 items: first 10 load immediately, remaining 10 load sequentially
                  // Estimate: 10 * 50ms = 500ms + API fetch time ≈ 3000ms total
                  const page1CompletionTime = 3000;
                  const preloadBaseDelay = page1CompletionTime;
                  
                  // Sequential loading: each item after the first 10 global items gets 50ms delay
                  loadDelay = preloadBaseDelay + Math.max(0, (globalIndex - 10) * 50);
                }
                
                return (
                  <ItemImage
                    key={`preload-${page}-${item.id}`}
                    itemId={item.id}
                    alt=""
                    className="w-1 h-1"
                    priority={false}
                    loadDelay={loadDelay}
                    isTradable={isTradableFromAPI === false ? false : undefined}
                  />
                );
              });
            })}
        </div>
      )}
    </div>
  );
}
