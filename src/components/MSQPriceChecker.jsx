// MSQ Equipment Price Checker (主線裝備查價)
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Toast from './Toast';
import SearchBar from './SearchBar';
import TopBar from './TopBar';
import TaxRatesModal from './TaxRatesModal';
import SearchResultsTable from './SearchResultsTable.jsx';
import RunningLoader from './RunningLoader';
import { getMarketableItemsByIds } from '../services/universalis';
import { getItemById, getSimplifiedChineseName } from '../services/itemDatabase';
import axios from 'axios';
import { getEquipSlotCategories, getEquipmentByIds, getItemIdsByIlvl } from '../services/supabaseData';
import { APP_VERSION } from '../constants/version';
// Lazy load large data files:
// - ilvlsData (748KB) - loaded when user inputs ilvl
// - equipmentData (6.2MB) - loaded when searching

// Equipment slot category translations to Traditional Chinese
const SLOT_TRANSLATIONS = {
  'MainHand': '主手武器',
  'OffHand': '副手',
  'Head': '頭部',
  'Body': '身體',
  'Gloves': '手套',
  'Waist': '腰部',
  'Legs': '腿部',
  'Feet': '腳部',
  'Ears': '耳環',
  'Neck': '項鍊',
  'Wrists': '手環',
  'Rings': '戒指'
};

export default function MSQPriceChecker({
  addToast,
  removeToast,
  toasts,
  datacenters,
  worlds,
  selectedWorld,
  onWorldChange,
  selectedServerOption,
  onServerOptionChange,
  serverOptions,
  isServerDataLoaded,
  onItemSelect,
  onSearch,
  searchText,
  setSearchText,
  isSearching,
  onTaxRatesClick,
  isTaxRatesModalOpen,
  setIsTaxRatesModalOpen,
  taxRates,
  isLoadingTaxRates
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [ilvlInput, setIlvlInput] = useState('');
  const [ilvlInputValidation, setIlvlInputValidation] = useState(null);
  const [ilvlInfoMessage, setIlvlInfoMessage] = useState(null);
  const ilvlValidationTimeoutRef = useRef(null);
  const runningLoaderRef = useRef(null);
  const isInitializingFromURLRef = useRef(false);
  const lastProcessedURLRef = useRef('');
  const previousServerOptionRef = useRef(null);
  
  const [selectedEquipCategory, setSelectedEquipCategory] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [tradeableResults, setTradeableResults] = useState([]);
  const [untradeableResults, setUntradeableResults] = useState([]);
  const [showUntradeable, setShowUntradeable] = useState(false);
  const [itemVelocities, setItemVelocities] = useState({});
  const [itemAveragePrices, setItemAveragePrices] = useState({});
  const [itemMinListings, setItemMinListings] = useState({});
  const [itemRecentPurchases, setItemRecentPurchases] = useState({});
  const [itemTradability, setItemTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [marketableItems, setMarketableItems] = useState(null);
  
  // Cache for dynamically loaded data
  const equipmentDataRef = useRef(null);

  // Cache for equip slot categories
  const equipSlotCategoriesDataRef = useRef(null);
  const [equipSlotCategoriesLoaded, setEquipSlotCategoriesLoaded] = useState(false);
  
  // Load equip slot categories on mount
  useEffect(() => {
    getEquipSlotCategories().then(data => {
      equipSlotCategoriesDataRef.current = data;
      setEquipSlotCategoriesLoaded(true);
    });
  }, []);

  // Helper function to load equipmentData for specific item IDs
  // Can optionally filter by equipSlotCategory
  const loadEquipmentDataByIds = useCallback(async (itemIds, equipSlotCategoryId = null) => {
    if (!itemIds || itemIds.length === 0) {
      return {};
    }
    return await getEquipmentByIds(itemIds);
  }, []);

  // No longer need to load all ilvls - we query directly by ilvl value

  // Restore state from URL parameters on mount or when returning from item page
  // Only restore state, do NOT auto-trigger search
  useEffect(() => {
    if (isInitializingFromURLRef.current) {
      return;
    }

    const currentURLKey = `${location.pathname}?${location.search}`;
    
    // Skip if we've already processed this exact URL
    if (lastProcessedURLRef.current === currentURLKey) {
      return;
    }

    const ilvlParam = searchParams.get('ilvl');
    const categoryParam = searchParams.get('category');

    // If we have URL parameters, restore state only (no auto-search)
    if (ilvlParam) {
      const numValue = parseInt(ilvlParam, 10);
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 999) {
        isInitializingFromURLRef.current = true;
        setIlvlInput(ilvlParam);
        
        // Validate URL parameter - just check range, don't load all ilvls for validation
        // The actual search will only happen when user clicks search button
        setIlvlInputValidation({
          valid: true,
          message: `物品等級: ${numValue}`
        });
        
        // Restore category if present
        if (categoryParam) {
          setSelectedEquipCategory(categoryParam);
        } else {
          setSelectedEquipCategory(null);
        }
        
        lastProcessedURLRef.current = currentURLKey;
        // Reset initialization flag after a short delay to allow state updates
        setTimeout(() => {
          isInitializingFromURLRef.current = false;
        }, 100);
      }
    } else {
      lastProcessedURLRef.current = currentURLKey;
    }
  }, [location.pathname, location.search, searchParams]);

  // Get equipment categories from equip-slot-categories
  const equipmentCategories = useMemo(() => {
    const categories = new Map();
    
    // Iterate through equip-slot-categories to get all unique slot types
    const equipSlotCategoriesData = equipSlotCategoriesDataRef.current || {};
    Object.entries(equipSlotCategoriesData).forEach(([categoryId, slots]) => {
      // Skip if slots is not an object
      if (!slots || typeof slots !== 'object') return;
      
      Object.entries(slots).forEach(([slotName, value]) => {
        // Skip id field, SoulCrystal, and Waist
        if (slotName === 'id' || slotName === 'SoulCrystal' || slotName === 'Waist') return;
        
        if (value === 1 || value === -1) { // 1 or -1 means this slot is part of this category
          // Group FingerL and FingerR as "Rings"
          const displayName = (slotName === 'FingerL' || slotName === 'FingerR') 
            ? 'Rings' 
            : slotName;
          
          if (!categories.has(displayName)) {
            categories.set(displayName, {
              name: displayName,
              translatedName: SLOT_TRANSLATIONS[displayName] || displayName
            });
          }
        }
      });
    });
    
    // Custom order for equipment slots (Waist is excluded)
    const customOrder = ['MainHand', 'OffHand', 'Head', 'Body', 'Gloves', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrists', 'Rings'];
    
    // Sort by custom order
    return Array.from(categories.values()).sort((a, b) => {
      const indexA = customOrder.indexOf(a.name);
      const indexB = customOrder.indexOf(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [equipSlotCategoriesLoaded]); // Recompute when data loads

  // Helper function to check if an item's equip slot matches the selected category
  const itemMatchesEquipCategory = useCallback((itemId, selectedCategory, equipmentData) => {
    if (!selectedCategory) return true;
    
    const equipInfo = equipmentData[itemId.toString()];
    if (!equipInfo || equipInfo.equipSlotCategory === undefined || equipInfo.equipSlotCategory === null) return false;
    
    const categoryId = equipInfo.equipSlotCategory;
    const equipSlotCategoriesData = equipSlotCategoriesDataRef.current || {};
    const categorySlots = equipSlotCategoriesData[categoryId.toString()];
    
    if (!categorySlots) return false;
    
    // Check if the selected category matches any slot in this category
    if (selectedCategory === 'Rings') {
      // Check for FingerL or FingerR
      return categorySlots['FingerL'] === 1 || categorySlots['FingerL'] === -1 ||
             categorySlots['FingerR'] === 1 || categorySlots['FingerR'] === -1;
    } else if (selectedCategory === 'SoulCrystal') {
      // Skip SoulCrystal
      return false;
    } else {
      // Regular slot matching
      return categorySlots[selectedCategory] === 1 || categorySlots[selectedCategory] === -1;
    }
  }, []);

  // Helper function to check if an item matches any of the provided categories
  const itemMatchesAnyCategory = useCallback((itemId, equipmentData) => {
    const equipInfo = equipmentData[itemId.toString()];
    if (!equipInfo || equipInfo.equipSlotCategory === undefined || equipInfo.equipSlotCategory === null) return false;
    
    const categoryId = equipInfo.equipSlotCategory;
    const equipSlotCategoriesData = equipSlotCategoriesDataRef.current || {};
    const categorySlots = equipSlotCategoriesData[categoryId.toString()];
    
    if (!categorySlots) return false;
    
    // Get current equipment categories (use the memoized value)
    const currentCategories = equipmentCategories;
    
    // Check if the item matches any of the categories we provide
    return currentCategories.some(category => {
      if (category.name === 'Rings') {
        // Check for FingerL or FingerR
        return categorySlots['FingerL'] === 1 || categorySlots['FingerL'] === -1 ||
               categorySlots['FingerR'] === 1 || categorySlots['FingerR'] === -1;
      } else if (category.name === 'SoulCrystal') {
        // Skip SoulCrystal
        return false;
      } else {
        // Regular slot matching
        return categorySlots[category.name] === 1 || categorySlots[category.name] === -1;
      }
    });
  }, [equipmentCategories]);

  // Handle ilvl input change
  const handleIlvlInputChange = useCallback((value) => {
    setIlvlInput(value);

    // Clear existing timeout
    if (ilvlValidationTimeoutRef.current) {
      clearTimeout(ilvlValidationTimeoutRef.current);
    }

    // Debounce validation after 1 second
    ilvlValidationTimeoutRef.current = setTimeout(async () => {
      const numValue = parseInt(value, 10);

      if (value === '') {
        setIlvlInputValidation(null);
        return;
      }

      if (isNaN(numValue) || numValue < 1 || numValue > 999) {
        setIlvlInputValidation({
          valid: false,
          message: '請輸入1-999之間的數字'
        });
        setIlvlInfoMessage(null); // Clear info message when validation fails
        return;
      }

      // Validate input - just check range, don't load all ilvls for validation
      // The actual search will load ilvls when needed
      // This avoids loading 50,900 ilvls just to validate user input
      setIlvlInputValidation({
        valid: true,
        message: `物品等級: ${numValue}`
      });
      setIlvlInfoMessage(null); // Clear info message when user changes input
    }, 1000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (ilvlValidationTimeoutRef.current) {
        clearTimeout(ilvlValidationTimeoutRef.current);
      }
    };
  }, []);

  // Extract price fetching logic into a separate function that can be reused
  const fetchPricesForItems = useCallback(async (itemIdsToQuery, finalItemIds) => {
    if (!selectedWorld || !selectedServerOption) {
      addToast('請選擇伺服器', 'warning');
      setIsLoadingVelocities(false);
      return;
    }

    setIsLoadingVelocities(true);

    const isDCQuery = selectedServerOption === selectedWorld.section;
    const queryTarget = isDCQuery
      ? selectedWorld.section
      : selectedServerOption;

    const batchSize = 100;
    const allVelocities = {};
    const allAveragePrices = {};
    const allMinListings = {};
    const allRecentPurchases = {};
    const allTradability = {};

    // Fetch market data in batches (100 items per request)
    // Only query API for tradeable items to avoid 400 errors
    for (let i = 0; i < itemIdsToQuery.length; i += batchSize) {
      const batch = itemIdsToQuery.slice(i, i + batchSize);
      const itemIdsString = batch.join(',');

      try {
        const response = await axios.get(
          `https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`
        );

        const data = response.data;
        if (data && data.results) {
          data.results.forEach(item => {
            const itemId = item.itemId;

            const getValue = (nqData, hqData, field) => {
              const nqWorld = nqData?.world?.[field];
              const hqWorld = hqData?.world?.[field];
              const nqDc = nqData?.dc?.[field];
              const hqDc = hqData?.dc?.[field];

              // When querying a specific server (!isDCQuery), only use world data, don't fallback to DC
              // When querying DC (isDCQuery), use DC data
              const nqValue = isDCQuery 
                ? (nqDc !== undefined ? nqDc : nqWorld)
                : (nqWorld !== undefined ? nqWorld : undefined);
              const hqValue = isDCQuery
                ? (hqDc !== undefined ? hqDc : hqWorld)
                : (hqWorld !== undefined ? hqWorld : undefined);

              if (field === 'quantity') {
                if (nqValue !== undefined || hqValue !== undefined) {
                  return (nqValue || 0) + (hqValue || 0);
                }
              } else {
                if (nqValue !== undefined && hqValue !== undefined) {
                  return Math.min(nqValue, hqValue);
                } else if (hqValue !== undefined) {
                  return hqValue;
                } else if (nqValue !== undefined) {
                  return nqValue;
                }
              }
              return null;
            };

            const velocity = getValue(
              item.nq?.dailySaleVelocity,
              item.hq?.dailySaleVelocity,
              'quantity'
            );

            const averagePrice = getValue(
              item.nq?.averageSalePrice,
              item.hq?.averageSalePrice,
              'price'
            );

            const minListingPrice = getValue(
              item.nq?.minListing,
              item.hq?.minListing,
              'price'
            );

            const recentPurchasePrice = getValue(
              item.nq?.recentPurchase,
              item.hq?.recentPurchase,
              'price'
            );

            // Extract region field when querying a specific world (not DC)
            let minListing = null;
            if (minListingPrice !== null && minListingPrice !== undefined) {
              if (!isDCQuery) {
                // When world is selected, only use world data, don't fallback to DC
                const nqWorldPrice = item.nq?.minListing?.world?.price;
                const hqWorldPrice = item.hq?.minListing?.world?.price;
                
                // Determine which one (NQ or HQ) has the better price, then get its region
                let selectedData = null;
                if (nqWorldPrice !== undefined && hqWorldPrice !== undefined) {
                  selectedData = hqWorldPrice <= nqWorldPrice 
                    ? item.hq?.minListing?.world
                    : item.nq?.minListing?.world;
                } else if (hqWorldPrice !== undefined) {
                  selectedData = item.hq?.minListing?.world;
                } else if (nqWorldPrice !== undefined) {
                  selectedData = item.nq?.minListing?.world;
                }
                
                // Extract region if available
                const region = selectedData?.region;
                minListing = { price: minListingPrice };
                if (region !== undefined) {
                  minListing.region = region;
                }
              } else {
                // When DC is selected, just store the price
                minListing = minListingPrice;
              }
            }

            let recentPurchase = null;
            if (recentPurchasePrice !== null && recentPurchasePrice !== undefined) {
              if (!isDCQuery) {
                // When world is selected, only use world data, don't fallback to DC
                const nqWorldPrice = item.nq?.recentPurchase?.world?.price;
                const hqWorldPrice = item.hq?.recentPurchase?.world?.price;
                
                // Determine which one (NQ or HQ) has the better price, then get its region
                let selectedData = null;
                if (nqWorldPrice !== undefined && hqWorldPrice !== undefined) {
                  selectedData = hqWorldPrice <= nqWorldPrice 
                    ? item.hq?.recentPurchase?.world
                    : item.nq?.recentPurchase?.world;
                } else if (hqWorldPrice !== undefined) {
                  selectedData = item.hq?.recentPurchase?.world;
                } else if (nqWorldPrice !== undefined) {
                  selectedData = item.nq?.recentPurchase?.world;
                }
                
                // Extract region if available
                const region = selectedData?.region;
                recentPurchase = { price: recentPurchasePrice };
                if (region !== undefined) {
                  recentPurchase.region = region;
                }
              } else {
                // When DC is selected, just store the price
                recentPurchase = recentPurchasePrice;
              }
            }

            if (velocity !== null && velocity !== undefined) {
              allVelocities[itemId] = velocity;
            }
            if (averagePrice !== null && averagePrice !== undefined) {
              allAveragePrices[itemId] = Math.round(averagePrice);
            }
            if (minListing !== null && minListing !== undefined) {
              allMinListings[itemId] = minListing;
            }
            if (recentPurchase !== null && recentPurchase !== undefined) {
              allRecentPurchases[itemId] = recentPurchase;
            }
            allTradability[itemId] = true;
          });
        }

        batch.forEach(itemId => {
          if (!allTradability.hasOwnProperty(itemId)) {
            allTradability[itemId] = false;
          }
        });
      } catch (error) {
        console.error('Error fetching market data:', error);
        batch.forEach(itemId => {
          if (!allTradability.hasOwnProperty(itemId)) {
            allTradability[itemId] = false;
          }
        });
      }
    }

    // Mark all untradeable items (not in itemIdsToQuery) as non-tradable
    finalItemIds.forEach(itemId => {
      if (!itemIdsToQuery.includes(itemId)) {
        allTradability[itemId] = false;
      }
    });

    setItemVelocities(allVelocities);
    setItemAveragePrices(allAveragePrices);
    setItemMinListings(allMinListings);
    setItemRecentPurchases(allRecentPurchases);
    setItemTradability(allTradability);
    setIsLoadingVelocities(false);
  }, [selectedWorld, selectedServerOption, addToast]);

  // Auto-refetch prices when server changes (if there are already search results)
  useEffect(() => {
    // Skip if searching (search will handle price fetching)
    if (isSearchingLocal) {
      return;
    }

    // Only refetch if we have search results and server is selected
    if (searchResults.length === 0 || !selectedWorld || !selectedServerOption) {
      return;
    }

    // Check if server actually changed (not just initial load or search results update)
    const currentServerKey = `${selectedServerOption}`;
    const previousServerKey = previousServerOptionRef.current ? `${previousServerOptionRef.current}` : null;
    const serverChanged = previousServerKey !== null && previousServerKey !== currentServerKey;
    
    // Update ref for next comparison
    previousServerOptionRef.current = selectedServerOption;

    // Only refetch if server actually changed
    if (!serverChanged) {
      return;
    }

    // Get tradeable item IDs from search results
    const tradeableItemIds = searchResults
      .map(item => item.id)
      .filter(id => marketableItems && marketableItems.has(id));

    // Only refetch if there are tradeable items
    if (tradeableItemIds.length === 0) {
      return;
    }

    console.log(`[MSQPriceChecker] Server changed from ${previousServerKey} to ${currentServerKey}, auto-refetching prices for ${tradeableItemIds.length} items`);
    
    // Fetch prices for existing search results
    fetchPricesForItems(tradeableItemIds, searchResults.map(item => item.id));
  }, [selectedServerOption, selectedWorld, searchResults.length, marketableItems, fetchPricesForItems, isSearchingLocal]);

  // Perform search
  const handleSearchLocal = useCallback(async () => {
    if (isSearchingLocal) return;

    const numValue = parseInt(ilvlInput, 10);
    if (isNaN(numValue) || numValue < 1 || numValue > 999) {
      addToast('請輸入有效的物品等級', 'error');
      return;
    }

    // Set loading state immediately
    setIsSearchingLocal(true);
    
    // Scroll to RunningLoader immediately when search starts
    setTimeout(() => {
      runningLoaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // Update URL parameters to persist state using navigate for better history control
    // Only update if params are different to avoid unnecessary history manipulation
    const currentIlvl = searchParams.get('ilvl');
    const currentCategory = searchParams.get('category');
    const paramsChanged = currentIlvl !== ilvlInput || currentCategory !== (selectedEquipCategory || '');
    
    if (paramsChanged) {
      const newSearchParams = new URLSearchParams();
      newSearchParams.set('ilvl', ilvlInput);
      if (selectedEquipCategory) {
        newSearchParams.set('category', selectedEquipCategory);
      } else {
        newSearchParams.delete('category');
      }
      // Use navigate with replace: true to update current entry without creating new one
      // This ensures proper browser history when navigating back from item pages
      navigate(`/msq-price-checker?${newSearchParams.toString()}`, { replace: true });
    }

    setSearchResults([]);
    setTradeableResults([]);
    setUntradeableResults([]);
    setShowUntradeable(false);
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});

    try {
      // Ensure equip slot categories are loaded
      if (!equipSlotCategoriesDataRef.current) {
        equipSlotCategoriesDataRef.current = await getEquipSlotCategories();
        setEquipSlotCategoriesLoaded(true);
      }
      
      // Query item IDs directly by ilvl value from database (no need to load all ilvls)
      let itemIds = await getItemIdsByIlvl(numValue);
      console.log(`[MSQPriceChecker] Found ${itemIds.length} items with ilvl ${numValue}`);

      if (itemIds.length === 0) {
        setIlvlInfoMessage('未找到該物品等級的物品');
        setSearchResults([]);
        setTradeableResults([]);
        setUntradeableResults([]);
        setShowUntradeable(false);
        setIsLoadingVelocities(false);
        setIsSearchingLocal(false);
        return;
      }
      
      // Clear info message when search succeeds
      setIlvlInfoMessage(null);

      // Load equipment data only for items with matching ilvl
      const equipmentData = await loadEquipmentDataByIds(itemIds);
      console.log(`[MSQPriceChecker] Loaded equipment data for ${Object.keys(equipmentData).length} items`);

      // Filter by equipment category
      // If a specific category is selected, filter by that category
      // If "全部分類" is selected (null), filter to only items that match any of our provided categories
      if (selectedEquipCategory) {
        itemIds = itemIds.filter(itemId => 
          itemMatchesEquipCategory(itemId, selectedEquipCategory, equipmentData)
        );
      } else {
        // When "全部分類" is selected, only show items that match at least one of our provided categories
        itemIds = itemIds.filter(itemId => 
          itemMatchesAnyCategory(itemId, equipmentData)
        );
      }

      console.log(`[MSQPriceChecker] After category filter: ${itemIds.length} items`);
      
      if (itemIds.length === 0) {
        addToast('該裝備分類中沒有相符的物品', 'warning');
        setSearchResults([]);
        setTradeableResults([]);
        setUntradeableResults([]);
        setShowUntradeable(false);
        setIsLoadingVelocities(false);
        setIsSearchingLocal(false);
        return;
      }

      // Filter out non-tradeable items - only check these specific items (efficient)
      const marketableSet = await getMarketableItemsByIds(itemIds);
      setMarketableItems(marketableSet); // Set for ItemTable component
      const tradeableItemIds = itemIds.filter(id => marketableSet.has(id));
      console.log(`[MSQPriceChecker] Tradeable items: ${tradeableItemIds.length} out of ${itemIds.length}`);

      // If all items are untradeable, show all items by default (but don't query API for them)
      const finalItemIds = tradeableItemIds.length > 0 ? tradeableItemIds : itemIds;
      const itemsToQueryAPI = tradeableItemIds.length > 0 ? tradeableItemIds : []; // Only query API for tradeable items
      if (tradeableItemIds.length === 0) {
        console.log(`[MSQPriceChecker] All items are untradeable, showing all ${itemIds.length} items (no API query)`);
      }

      // Fetch item details for display (show all items, including untradeable)
      // Use batch query instead of individual queries for better performance
      const { getTwItemsByIds } = await import('../services/supabaseData');
      const itemsData = await getTwItemsByIds(finalItemIds);
      const items = finalItemIds.map(id => {
        const itemData = itemsData[id];
        if (!itemData || !itemData.tw) {
          return null;
        }
        const cleanName = itemData.tw.replace(/^["']|["']$/g, '').trim();
        return {
          id,
          name: cleanName,
          nameTW: cleanName,
          searchLanguageName: null,
          description: '',
          itemLevel: '',
          shopPrice: '',
          inShop: false,
        };
      }).filter(item => item !== null);

      if (items.length === 0) {
        addToast('無法獲取物品信息', 'error');
        setSearchResults([]);
        setTradeableResults([]);
        setUntradeableResults([]);
        setShowUntradeable(false);
        setIsLoadingVelocities(false);
        setIsSearchingLocal(false);
        return;
      }

      console.log(`[MSQPriceChecker] Fetched ${items.length} item details`);

      // Sort by ilvl品級 and 需求等級
      // Use existing equipmentData (already filtered to matching ilvl items)
      const itemsWithInfo = items.map(item => {
        const equipInfo = equipmentData[item.id.toString()];
        return {
          ...item,
          ilvl品級: numValue,
          需求等級: equipInfo?.level || 0,
          equipSlotCategory: equipInfo?.equipSlotCategory,
          jobs: equipInfo?.jobs || []
        };
      }).sort((a, b) => {
        // Sort by level first, then by name
        if (a.需求等級 !== b.需求等級) {
          return a.需求等級 - b.需求等級;
        }
        return a.name.localeCompare(b.name);
      });

      console.log(`[MSQPriceChecker] Setting search results: ${itemsWithInfo.length} items`);
      
      // Separate tradeable and untradeable items
      const tradeableItems = itemsWithInfo.filter(item => tradeableItemIds.includes(item.id));
      const untradeableItems = itemsWithInfo.filter(item => !tradeableItemIds.includes(item.id));
      
      setTradeableResults(tradeableItems);
      setUntradeableResults(untradeableItems);
      setShowUntradeable(false); // Default to showing tradeable items
      
      // Set searchResults based on what should be displayed
      const itemsToDisplay = tradeableItems.length > 0 ? tradeableItems : untradeableItems;
      setSearchResults(itemsToDisplay);

      // Fetch prices using the extracted function
      await fetchPricesForItems(itemsToQueryAPI, finalItemIds);
      setIsSearchingLocal(false);
    } catch (error) {
      console.error('Search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
      setIsSearchingLocal(false);
    }
  }, [ilvlInput, selectedEquipCategory, selectedWorld, selectedServerOption, addToast, itemMatchesEquipCategory, itemMatchesAnyCategory, searchParams, setSearchParams, loadEquipmentDataByIds, fetchPricesForItems]);

  // Update searchResults when showUntradeable changes
  useEffect(() => {
    const itemsToDisplay = showUntradeable ? untradeableResults : tradeableResults;
    // Only update if we have results to avoid clearing during search
    if (tradeableResults.length > 0 || untradeableResults.length > 0) {
      setSearchResults(itemsToDisplay);
    }
  }, [showUntradeable, tradeableResults, untradeableResults]);

  const maxRange = 50;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white">
      <TopBar
        onSearch={onSearch}
        isSearching={isSearching}
        searchText={searchText}
        setSearchText={setSearchText}
        isServerDataLoaded={isServerDataLoaded}
        selectedDcName={selectedWorld?.section}
        onItemSelect={onItemSelect}
        showNavigationButtons={true}
        activePage="msq-price-checker"
        onTaxRatesClick={onTaxRatesClick}
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
        }}
        onCraftingInspirationClick={() => {
          setSearchText('');
          navigate('/crafting-inspiration');
        }}
        onAdvancedSearchClick={() => {
          setSearchText('');
          navigate('/advanced-search');
        }}
      />

      {/* Toast Notifications */}
      <div className="fixed right-2 mid:right-4 left-2 mid:left-auto z-50 space-y-2 max-w-sm mid:max-w-none top-[60px] mid:top-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      <div className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-ffxiv-gold mb-2">
              主線裝備查價
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              主線拿到的箱子可以快速查看市場價格。
            </p>
          </div>

          {/* Search Controls */}
          <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6 mb-6">
            {/* ILVL Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
                物品等級 (ilvl品級)
              </label>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ilvlInput}
                    onChange={(e) => handleIlvlInputChange(e.target.value)}
                    placeholder="輸入物品等級..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold"
                    min="1"
                    max="999"
                  />
                  {ilvlInputValidation && (
                    <div className={`mt-2 text-xs ${ilvlInputValidation.valid ? 'text-green-400' : 'text-yellow-400'}`}>
                      {ilvlInputValidation.message}
                    </div>
                  )}
                  {ilvlInfoMessage && (
                    <div className="mt-2 text-xs text-blue-400 bg-blue-900/20 border border-blue-500/30 rounded px-3 py-2">
                      {ilvlInfoMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Equipment Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
                裝備分類 (可選)
              </label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/30 rounded-lg border border-purple-500/20">
                <button
                  onClick={() => setSelectedEquipCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedEquipCategory === null
                      ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                      : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                  }`}
                >
                  全部分類
                </button>
                {equipmentCategories.map(category => {
                  const isSelected = selectedEquipCategory === category.name;
                  return (
                    <button
                      key={category.name}
                      onClick={() => setSelectedEquipCategory(category.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                          : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                      }`}
                    >
                      {category.translatedName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearchLocal}
              disabled={isSearchingLocal || !ilvlInput || !ilvlInputValidation?.valid}
              className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                isSearchingLocal || !ilvlInput || !ilvlInputValidation?.valid
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
              }`}
            >
              {isSearchingLocal && (
                <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isSearchingLocal ? '搜索中...' : '搜索'}
            </button>
          </div>

          {/* Running Loader - Show when searching but no results yet */}
          {isSearchingLocal && searchResults.length === 0 && (
            <div ref={runningLoaderRef} className="mt-8 flex justify-center items-center min-h-[300px]">
              <RunningLoader />
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <SearchResultsTable
              items={searchResults}
              selectedWorld={selectedWorld}
              selectedServerOption={selectedServerOption}
              onWorldChange={onWorldChange}
              onServerOptionChange={onServerOptionChange}
              datacenters={datacenters}
              worlds={worlds}
              serverOptions={serverOptions}
              isServerSelectorDisabled={isLoadingVelocities}
              marketableItems={marketableItems}
              itemVelocities={itemVelocities}
              itemAveragePrices={itemAveragePrices}
              itemMinListings={itemMinListings}
              itemRecentPurchases={itemRecentPurchases}
              itemTradability={itemTradability}
              isLoadingVelocities={isLoadingVelocities}
              showLoadingIndicator={isLoadingVelocities}
              averagePriceHeader={selectedServerOption === selectedWorld?.section ? '全服平均價格' : '平均價格'}
              getSimplifiedChineseName={getSimplifiedChineseName}
              addToast={addToast}
              title="搜索結果"
              untradeableCount={untradeableResults.length}
              tradeableCount={tradeableResults.length}
              onToggleUntradeable={(newValue) => {
                setShowUntradeable(newValue);
              }}
              isShowUntradeable={showUntradeable}
              onSelect={(item) => {
                if (onItemSelect) {
                  // Prepare navigation URL with server param
                  const params = new URLSearchParams();
                  if (selectedServerOption) {
                    params.set('server', selectedServerOption);
                  }
                  const queryString = params.toString();
                  const itemUrl = `/item/${item.id}${queryString ? '?' + queryString : ''}`;
                  
                  // Call onItemSelect which will navigate to /item/${item.id} (without server param)
                  onItemSelect(item);
                  
                  // Immediately replace that navigation with our URL that includes server param
                  // This ensures only one history entry is created
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      navigate(itemUrl, { replace: true });
                    });
                  });
                }
              }}
            />
          )}

        </div>
        
        {/* Version Info */}
        <div className="mt-6 pt-4 border-t border-slate-600/30">
          <p className="text-xs text-slate-500 text-center">
            版本號: <span className="text-ffxiv-gold font-semibold">{APP_VERSION}</span>
          </p>
        </div>
      </div>

      {/* Tax Rates Modal */}
      <TaxRatesModal
        isOpen={isTaxRatesModalOpen}
        onClose={() => setIsTaxRatesModalOpen(false)}
        taxRates={taxRates}
        worlds={worlds}
        isLoading={isLoadingTaxRates}
        selectedWorld={selectedWorld}
        selectedServerOption={selectedServerOption}
        onServerOptionChange={onServerOptionChange}
      />
    </div>
  );
}
