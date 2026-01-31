// Advanced Search Component (進階搜尋)
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Toast from './Toast';
import TopBar from './TopBar';
import TaxRatesModal from './TaxRatesModal';
import SearchResultsTable from './SearchResultsTable.jsx';
import ServerSelector from './ServerSelector';
// RunningLoader is now handled by SearchResultsTable component for centralized loading display
import { getMarketableItems, getMarketableItemsByIds } from '../services/universalis';
import { searchItems, getSimplifiedChineseName, getItemById } from '../services/itemDatabase';
import { loadRecipeDatabase, loadRecipesByJobAndLevel } from '../services/recipeDatabase';
import { getTwJobAbbr, getTwItemUICategories, getTwItems, getIlvlsByIds, getRaritiesByIds, getEquipmentByIds, getEquipmentByJobs, getUICategoriesByIds, getTwItemById, getTwItemsByIds, getItemIdsByCategories, getItemIdsByIlvlRange } from '../services/supabaseData';
import { APP_VERSION } from '../constants/version';
import { generateItemUrl } from '../utils/urlSlug';

export default function AdvancedSearch({
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
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('filter'); // 'batch' or 'filter'
  const BATCH_SEARCH_DISABLED = true; // 批量搜索功能暂时禁用
  const [batchInput, setBatchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [untradeableResults, setUntradeableResults] = useState([]);
  const [showUntradeable, setShowUntradeable] = useState(false);
  const hasInitializedFromURLRef = useRef(false);
  const lastProcessedURLRef = useRef('');
  const [itemVelocities, setItemVelocities] = useState({});
  const [itemAveragePrices, setItemAveragePrices] = useState({});
  const [itemMinListings, setItemMinListings] = useState({});
  const [itemRecentPurchases, setItemRecentPurchases] = useState({});
  const [itemTradability, setItemTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [marketableItems, setMarketableItems] = useState(null);
  const [isBatchSearching, setIsBatchSearching] = useState(false);
  const [tooManyItemsWarning, setTooManyItemsWarning] = useState(null);
  const MAX_ITEMS_LIMIT = 500; // Maximum number of items to process
  const [batchFuzzySearch, setBatchFuzzySearch] = useState(true); // Fuzzy search toggle for batch search (default: true = fuzzy search)
  
  // Filter search state
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isFilterSearching, setIsFilterSearching] = useState(false);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(999);
  const [minLevelFocused, setMinLevelFocused] = useState(false);
  const [maxLevelFocused, setMaxLevelFocused] = useState(false);
  const [itemNameFilter, setItemNameFilter] = useState(''); // Item name filter text
  const [filterFuzzySearch, setFilterFuzzySearch] = useState(true); // Fuzzy search toggle for filter search (true = fuzzy, false = exact) (default: fuzzy enabled)
  const [categorySearchTerm, setCategorySearchTerm] = useState(''); // Category search filter text
  
  // Category filter list - categories to exclude from search results
  const EXCLUDED_CATEGORIES = [
    62, // 靈魂水晶 (Soul Crystal)
  ];
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  
  // Loading indicator state (same as main search page)
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const loadingIndicatorStartTimeRef = useRef(null);
  const resultsTableRef = useRef(null);
  
  // Refs for request management
  const velocityFetchAbortControllerRef = useRef(null);
  const velocityFetchRequestIdRef = useRef(0);
  const velocityFetchInProgressRef = useRef(false);
  const [velocityFetchInProgress, setVelocityFetchInProgress] = useState(false); // State version for reactivity
  const lastFetchedItemIdsRef = useRef(''); // Track last fetched item IDs and server to avoid duplicate fetches
  const [velocityLoadingProgress, setVelocityLoadingProgress] = useState({ loaded: 0, total: 0 });
  const filterSearchRequestIdRef = useRef(0);
  const batchSearchRequestIdRef = useRef(0);
  const [isSearchButtonDisabled, setIsSearchButtonDisabled] = useState(false);
  const categorySearchInputRef = useRef(null);
  const categoryScrollContainerRef = useRef(null);
  const [shouldDisableCategoryScrollState, setShouldDisableCategoryScrollState] = useState(false);
  
  // Debounce timer for job selection
  const jobDebounceTimerRef = useRef(null);
  
  // Disabled categories based on selected jobs
  const [disabledCategories, setDisabledCategories] = useState(new Set());
  
  // Cache for Supabase data
  const twJobAbbrDataRef = useRef(null);
  const twItemUICategoriesDataRef = useRef(null);
  const twItemsDataRef = useRef(null);
  
  // State to trigger re-render when data loads
  const [jobAbbrLoaded, setJobAbbrLoaded] = useState(false);
  const [itemUICategoriesLoaded, setItemUICategoriesLoaded] = useState(false);
  
  // Cache for ilvls data (per-item basis, not full table)
  const ilvlsCacheRef = useRef({});
  
  // Helper function to load ilvls data for specific item IDs (targeted query)
  const loadIlvlsData = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) {
      return {};
    }
    
    // Check cache first
    const uncachedIds = itemIds.filter(id => !ilvlsCacheRef.current.hasOwnProperty(id));
    
    if (uncachedIds.length > 0) {
      // Load only uncached items
      const ilvlsData = await getIlvlsByIds(uncachedIds);
      // Merge into cache
      Object.assign(ilvlsCacheRef.current, ilvlsData);
    }
    
    // Return ilvls for requested items
    const result = {};
    itemIds.forEach(id => {
      if (ilvlsCacheRef.current.hasOwnProperty(id)) {
        result[id] = ilvlsCacheRef.current[id];
      }
    });
    
    return result;
  }, []);

  // Cache for rarities data (per-item basis, not full table)
  const raritiesCacheRef = useRef({});
  const [raritiesData, setRaritiesData] = useState(null);
  const [selectedRarities, setSelectedRarities] = useState([]); // Multi-select: empty array = show all, [rarityValue1, rarityValue2, ...] = show selected rarities
  
  // Helper function to load rarities data for specific item IDs (targeted query)
  const loadRaritiesData = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) {
      return {};
    }
    
    // Check cache first
    const uncachedIds = itemIds.filter(id => !raritiesCacheRef.current.hasOwnProperty(id));
    
    if (uncachedIds.length > 0) {
      // Load only uncached items
      const raritiesData = await getRaritiesByIds(uncachedIds);
      // Merge into cache
      Object.assign(raritiesCacheRef.current, raritiesData);
    }
    
    // Return rarities for requested items
    const result = {};
    itemIds.forEach(id => {
      if (raritiesCacheRef.current.hasOwnProperty(id)) {
        result[id] = raritiesCacheRef.current[id];
      }
    });
    
    return result;
  }, []);

  // Calculate disabled categories based on selected jobs
  // All jobs (battle, crafting, gathering) should disable miscellaneous categories
  const calculateDisabledCategories = useCallback((jobs) => {
    const disabled = new Set();
    
    if (jobs.length === 0) {
      return disabled;
    }
    
    // Equipment category IDs (weapons, armor, accessories)
    const equipmentCategoryIdsSet = new Set([
      // Weapons (already handled by generic categories)
      // Armor
      34, 35, 36, 37, 38, // 頭部防具、身體防具、腿部防具、手部防具、腳部防具
      112, // 套裝 (moved to equipment section but originally in miscellaneous)
      // Accessories
      40, 41, 42, 43, // 項鍊、耳飾、手鐲、戒指
      // Soul crystal
      62, // 靈魂水晶
    ]);
    
    // If any job is selected (battle, crafting, or gathering), disable miscellaneous
    // All jobs only have equipment categories, disable miscellaneous
    const twItemUICategoriesData = twItemUICategoriesDataRef.current || {};
    Object.entries(twItemUICategoriesData).forEach(([id, data]) => {
      const categoryId = parseInt(id, 10);
      // If it's not an equipment category and not excluded, disable it
      if (!equipmentCategoryIdsSet.has(categoryId) && !EXCLUDED_CATEGORIES.includes(categoryId) && categoryId !== 11) {
        disabled.add(categoryId);
      }
    });
    
    return disabled;
  }, []);

  // Load Supabase data on mount (only small tables, not full item/rarity tables)
  useEffect(() => {
    const loadAllData = async () => {
      try {
        const [jobAbbr, itemUICategories] = await Promise.all([
          getTwJobAbbr(),
          getTwItemUICategories(),
        ]);
        twJobAbbrDataRef.current = jobAbbr;
        twItemUICategoriesDataRef.current = itemUICategories;
        // Trigger re-render so useMemo hooks can recompute with loaded data
        setJobAbbrLoaded(true);
        setItemUICategoriesLoaded(true);
        // Don't load getTwItems() or getRarities() on mount - load lazily when needed
        // twItemsDataRef will be loaded lazily when category filter is used
      } catch (error) {
        console.error('Error loading Supabase data:', error);
      }
    };
    loadAllData();
  }, []);

  // Update disabled categories when selectedJobs changes (with debounce)
  // Also clear non-set miscellaneous categories when jobs are selected
  useEffect(() => {
    // Clear existing debounce timer
    if (jobDebounceTimerRef.current) {
      clearTimeout(jobDebounceTimerRef.current);
    }
    
    // If jobs are selected, clear non-set miscellaneous categories from selectedCategories
    if (selectedJobs.length > 0) {
      setSelectedCategories(prev => {
        // Filter out miscellaneous categories except set (112)
        // Miscellaneous categories are those not in equipmentCategoryIds (excluding 11 and 112)
        const equipmentCategoryIdsSet = new Set([
          34, 35, 36, 37, 38, // Armor
          112, // 套裝 (keep this one)
          40, 41, 42, 43, // Accessories
          62, // Soul crystal
        ]);
        
        return prev.filter(catId => {
          // Keep generic categories (main_weapon, offhand_weapon)
          if (typeof catId === 'string') {
            return true;
          }
          
          // Keep equipment categories (including set 112)
          if (equipmentCategoryIdsSet.has(catId)) {
            return true;
          }
          
          // Keep shield (11) - it's not miscellaneous
          if (catId === 11) {
            return true;
          }
          
          // Remove all other categories (miscellaneous except set)
          return false;
        });
      });
    }
    
    // Set debounce timer to update disabled categories after 500ms
    jobDebounceTimerRef.current = setTimeout(() => {
      const disabled = calculateDisabledCategories(selectedJobs);
      setDisabledCategories(disabled);
    }, 500);
    
    // Cleanup function
    return () => {
      if (jobDebounceTimerRef.current) {
        clearTimeout(jobDebounceTimerRef.current);
      }
    };
  }, [selectedJobs, calculateDisabledCategories]);

  // Reset to first page when rarity filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRarities]);

  // Reset to first page if currentPage exceeds totalPages (safety check for pagination)
  useEffect(() => {
    if (searchResults.length > 0 || untradeableResults.length > 0) {
      // When showUntradeable is true, combine both lists; otherwise show only tradeable
      const currentResults = showUntradeable ? [...searchResults, ...untradeableResults] : searchResults;
      const totalPages = Math.ceil(currentResults.length / itemsPerPage);
      if (totalPages > 0 && currentPage > totalPages) {
        setCurrentPage(1);
      }
    }
  }, [searchResults.length, untradeableResults.length, showUntradeable, itemsPerPage, currentPage]);

  // Cache for equipment data (per-job basis, not full table)
  const equipmentCacheRef = useRef({});
  
  // Helper function to load equipment data for specific jobs (targeted query)
  const loadEquipmentByJobs = useCallback(async (jobAbbrs) => {
    if (!jobAbbrs || jobAbbrs.length === 0) {
      return {};
    }
    
    // Create cache key
    const cacheKey = jobAbbrs.sort().join(',');
    
    // Check cache first
    if (equipmentCacheRef.current[cacheKey]) {
      return equipmentCacheRef.current[cacheKey];
    }
    
    // Load equipment matching these jobs
    const equipmentData = await getEquipmentByJobs(jobAbbrs);
    
    // Cache it
    equipmentCacheRef.current[cacheKey] = equipmentData;
    
    return equipmentData;
  }, []);
  
  // Helper function to load equipment data for specific item IDs (targeted query)
  const loadEquipmentByIds = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) {
      return {};
    }
    
    // Create cache key
    const cacheKey = [...new Set(itemIds)].sort((a, b) => a - b).join(',');
    
    // Check cache first
    if (equipmentCacheRef.current[`ids:${cacheKey}`]) {
      return equipmentCacheRef.current[`ids:${cacheKey}`];
    }
    
    // Load equipment for these item IDs
    const equipmentData = await getEquipmentByIds(itemIds);
    
    // Cache it
    equipmentCacheRef.current[`ids:${cacheKey}`] = equipmentData;
    
    return equipmentData;
  }, []);

  // Cache for UI categories data (per-item basis, not full table)
  const uiCategoriesCacheRef = useRef({});
  
  // Helper function to load UI categories data for specific item IDs (targeted query)
  const loadUICategoriesByIds = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) {
      return {};
    }
    
    // Create cache key
    const cacheKey = [...new Set(itemIds)].sort((a, b) => a - b).join(',');
    
    // Check cache first
    if (uiCategoriesCacheRef.current[cacheKey]) {
      return uiCategoriesCacheRef.current[cacheKey];
    }
    
    // Load ui_categories for these item IDs
    const uiCategoriesData = await getUICategoriesByIds(itemIds);
    
    // Cache it
    uiCategoriesCacheRef.current[cacheKey] = uiCategoriesData;
    
    return uiCategoriesData;
  }, []);

  // Map job ID to job abbreviation
  const getJobAbbreviation = useCallback((jobId) => {
    const jobAbbrMap = {
      // Base classes (lower tier)
      1: 'GLA', 2: 'PGL', 3: 'MRD', 4: 'LNC', 5: 'ARC', 6: 'CNJ', 7: 'THM',
      // Production jobs
      8: 'CRP', 9: 'BSM', 10: 'ARM', 11: 'GSM', 12: 'LTW', 13: 'WVR', 14: 'ALC', 15: 'CUL',
      // Gathering jobs
      16: 'MIN', 17: 'BTN', 18: 'FSH',
      // Battle jobs (higher tier)
      19: 'PLD', 20: 'MNK', 21: 'WAR', 22: 'DRG', 23: 'BRD', 24: 'WHM', 25: 'BLM',
      26: 'ACN', 27: 'SMN', 28: 'SCH', 29: 'ROG', 30: 'NIN',
      31: 'MCH', 32: 'DRK', 33: 'AST', 34: 'SAM', 35: 'RDM', 36: 'BLU',
      37: 'GNB', 38: 'DNC', 39: 'RPR', 40: 'SGE', 41: 'VPR', 42: 'PCT',
    };
    return jobAbbrMap[jobId];
  }, []);

  // Handle batch search
  const handleBatchSearch = useCallback(async (inputOverride = null) => {
    // Batch search is disabled
    if (BATCH_SEARCH_DISABLED) {
      addToast('批量搜索功能暂时不可用，敬请期待', 'info');
      return;
    }
    // Prevent multiple clicks within 1.5 seconds
    if (isSearchButtonDisabled) return;

    // Cancel any ongoing search requests
    const currentRequestId = ++batchSearchRequestIdRef.current;
    
    // Cancel all ongoing market data fetches
    if (velocityFetchAbortControllerRef.current) {
      velocityFetchAbortControllerRef.current.abort();
      velocityFetchAbortControllerRef.current = null;
    }
    
    // Increment velocity fetch request ID to cancel any ongoing market data requests
    velocityFetchRequestIdRef.current++;
    velocityFetchInProgressRef.current = false;
    setVelocityFetchInProgress(false);
    setIsLoadingVelocities(false);

    // Clear table immediately at the start of search
    setSearchResults([]);
    setUntradeableResults([]);
    setSelectedRarities([]); // Reset rarity filter on new search
    setShowUntradeable(false);
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});
    setCurrentPage(1);

    // Use override input if provided (for URL parameter), otherwise use batchInput state
    // Ensure inputToUse is always a string (handle case where inputOverride might be an event object)
    let inputToUse;
    if (inputOverride !== null && typeof inputOverride === 'string') {
      inputToUse = inputOverride;
    } else {
      inputToUse = typeof batchInput === 'string' ? batchInput : String(batchInput || '');
    }
    
    // Parse batch input - support both comma-separated and newline-separated item names
    const inputLines = inputToUse.trim().split(/[,\n]/).map(line => line.trim()).filter(line => line);
    
    if (inputLines.length === 0) {
      addToast('請輸入至少一個物品名稱', 'error');
      return;
    }

    // Remove duplicate item names (case-insensitive)
    const uniqueItemNames = [];
    const seenNames = new Set();
    for (const name of inputLines) {
      const normalizedName = name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueItemNames.push(name);
      }
    }

    // Limit to 100 searches per batch
    if (uniqueItemNames.length > 100) {
      addToast('一次最多只能搜尋100個物品名稱', 'warning');
      uniqueItemNames.splice(100);
    }

    // Show message if duplicates were removed
    if (uniqueItemNames.length < inputLines.length) {
      const removedCount = inputLines.length - uniqueItemNames.length;
      addToast(`已移除 ${removedCount} 個重複的物品名稱`, 'info');
    }

    // Don't update URL - display results in current page like filter search
    // Results will be shown in the table below, same as filter search

    // Disable search button for 1.5 seconds
    setIsSearchButtonDisabled(true);
    setTimeout(() => {
      setIsSearchButtonDisabled(false);
    }, 1500);

    try {
      setIsBatchSearching(true);

      // Check if this request was superseded
      if (currentRequestId !== batchSearchRequestIdRef.current) {
        setIsBatchSearching(false);
        return;
      }
      
      // Search for each unique item name
      const allSearchResults = [];
      const searchPromises = uniqueItemNames.map(async (itemName) => {
        try {
          if (!batchFuzzySearch) {
            // Exact search mode: only return items with exactly matching names (case-insensitive)
            // First get potential matches using substring search (for efficiency)
            const substringResult = await searchItems(itemName, false);
            
            // Filter to only exact matches - item name must exactly equal search text
            const trimmedName = itemName.trim().toLowerCase();
            let exactMatches = [];
            
            if (substringResult.results && substringResult.results.length > 0) {
              exactMatches = substringResult.results.filter(item => {
                const itemNameLower = (item.name || '').trim().toLowerCase();
                // Exact match: item name must exactly equal search text (case-insensitive)
                return itemNameLower === trimmedName;
              });
            }
            
            // Return only exact matches, or empty array if no exact match found (no fallback)
            return exactMatches;
          } else {
            // Fuzzy search mode: use fuzzy matching directly
            const searchResult = await searchItems(itemName, true);
            return searchResult.results || [];
          }
        } catch (error) {
          console.error(`Error searching for "${itemName}":`, error);
          return [];
        }
      });
      
      const searchResultsArray = await Promise.all(searchPromises);
      
      // Check if this request was superseded
      if (currentRequestId !== batchSearchRequestIdRef.current) {
        setIsBatchSearching(false);
        return;
      }
      
      // Flatten and deduplicate results by item ID
      const itemsMap = new Map();
      searchResultsArray.forEach(results => {
        results.forEach(item => {
          if (!itemsMap.has(item.id)) {
            itemsMap.set(item.id, item);
          }
        });
      });
      
      const allItems = Array.from(itemsMap.values());
      
      if (allItems.length === 0) {
        addToast('未找到任何物品', 'warning');
        setIsBatchSearching(false);
        return;
      }

      // Filter out non-tradeable items using targeted marketable API (optimized)
      const itemIds = allItems.map(item => item.id);
      const marketableSet = await getMarketableItemsByIds(itemIds);
      
      // Check if this request was superseded
      if (currentRequestId !== batchSearchRequestIdRef.current) {
        setIsBatchSearching(false);
        return;
      }
      
      setMarketableItems(marketableSet);
      const tradeableItems = allItems.filter(item => marketableSet.has(item.id));

      if (tradeableItems.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        setIsBatchSearching(false);
        return;
      }

      // Load ilvls data and sort by ilvl (descending, highest first), then by ID if no ilvl
      // Use targeted query to load only ilvls for these specific items
      const itemIdsForSort = tradeableItems.map(item => item.id);
      const ilvlsData = await loadIlvlsData(itemIdsForSort);
      
      // Check if this request was superseded
      if (currentRequestId !== batchSearchRequestIdRef.current) {
        setIsBatchSearching(false);
        return;
      }
      const itemsSorted = tradeableItems.sort((a, b) => {
        const aIlvl = ilvlsData[a.id?.toString()] || null;
        const bIlvl = ilvlsData[b.id?.toString()] || null;
        
        // If both have ilvl, sort by ilvl descending (highest first)
        if (aIlvl !== null && bIlvl !== null) {
          return bIlvl - aIlvl;
        }
        // If only one has ilvl, prioritize it
        if (aIlvl !== null) return -1;
        if (bIlvl !== null) return 1;
        // If neither has ilvl, sort by ID descending
        return b.id - a.id;
      });

      // Check if this request was superseded before setting results
      if (currentRequestId !== batchSearchRequestIdRef.current) {
        setIsBatchSearching(false);
        return;
      }
      
      setSearchResults(itemsSorted);
      
      // Load rarities for search results (for rarity filter)
      const itemIdsForRarities = itemsSorted.map(item => item.id);
      loadRaritiesData(itemIdsForRarities).then(raritiesForItems => {
        setRaritiesData(prev => ({ ...prev, ...raritiesForItems }));
      }).catch(error => {
        console.error('Error loading rarities:', error);
      });

      // Fetch market data using progressive batch sizes (20, 50, 100)
      if (!selectedWorld || !selectedServerOption) {
        addToast('請選擇伺服器', 'warning');
        setIsBatchSearching(false);
        return;
      }

      // Cancel any previous fetch
      if (velocityFetchAbortControllerRef.current) {
        velocityFetchAbortControllerRef.current.abort();
      }

      const marketDataRequestId = ++velocityFetchRequestIdRef.current;
      velocityFetchAbortControllerRef.current = new AbortController();
      const abortSignal = velocityFetchAbortControllerRef.current.signal;
      velocityFetchInProgressRef.current = true;
      setVelocityFetchInProgress(true);

      setIsLoadingVelocities(true);

      const isDCQuery = selectedServerOption === selectedWorld.section;
      const queryTarget = isDCQuery
        ? selectedWorld.section
        : selectedServerOption;

      // Extract IDs and sort by ilvl (descending, highest first) before API query
      // itemsSorted is already sorted by ilvl, so just extract IDs
      const tradeableItemIds = itemsSorted.map(item => item.id);
      const allVelocities = {};
      const allAveragePrices = {};
      const allMinListings = {};
      const allRecentPurchases = {};
      const allTradability = {};

      // Progressive batch sizes: 20, then 50, then 100 per batch
      const processBatch = async (batchNumber, startIndex) => {
        // Check if request was cancelled or superseded
        if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || currentRequestId !== batchSearchRequestIdRef.current) {
          return;
        }
        
        // Determine batch size: first batch = 20, second batch = 50, rest = 100
        let batchSize;
        if (batchNumber === 0) {
          batchSize = 20; // First batch: 20 items for fast initial display
        } else if (batchNumber === 1) {
          batchSize = 50; // Second batch: 50 items
        } else {
          batchSize = 100; // Remaining batches: 100 items each
        }
        
        const batch = tradeableItemIds.slice(startIndex, startIndex + batchSize);
        if (batch.length === 0) {
          return;
        }
        
        const itemIdsString = batch.join(',');
        
        try {
          const response = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`, {
            signal: abortSignal
          });
          
          // Check again after fetch
          if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || currentRequestId !== batchSearchRequestIdRef.current) {
            return;
          }
          
          const data = await response.json();
          
          if (data && data.results) {
            data.results.forEach(item => {
              const itemId = item.itemId;

              const getValue = (nqData, hqData, field) => {
                const nqWorld = nqData?.world?.[field];
                const hqWorld = hqData?.world?.[field];
                const nqDc = nqData?.dc?.[field];
                const hqDc = hqData?.dc?.[field];

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

              // For average price, always fallback to DC data if world data doesn't exist (even when server is selected)
              let averagePrice = null;
              if (!isDCQuery) {
                // When server is selected, try world first, then fallback to DC
                const nqWorld = item.nq?.averageSalePrice?.world?.price;
                const hqWorld = item.hq?.averageSalePrice?.world?.price;
                const nqDc = item.nq?.averageSalePrice?.dc?.price;
                const hqDc = item.hq?.averageSalePrice?.dc?.price;
                
                const nqValue = nqWorld !== undefined ? nqWorld : nqDc;
                const hqValue = hqWorld !== undefined ? hqWorld : hqDc;
                
                if (nqValue !== undefined && hqValue !== undefined) {
                  averagePrice = Math.min(nqValue, hqValue);
                } else if (hqValue !== undefined) {
                  averagePrice = hqValue;
                } else if (nqValue !== undefined) {
                  averagePrice = nqValue;
                }
              } else {
                // When DC is selected, use DC data
                averagePrice = getValue(
                  item.nq?.averageSalePrice,
                  item.hq?.averageSalePrice,
                  'price'
                );
              }

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
                  
                  // Only store minListing if world data actually exists
                  if (selectedData !== null) {
                    // Extract region if available
                    const region = selectedData?.region;
                    minListing = { price: minListingPrice };
                    if (region !== undefined) {
                      minListing.region = region;
                    }
                  }
                  // If selectedData is null, minListing remains null (don't store DC prices)
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

          // Update state after each batch for progressive display
          setItemVelocities(prev => ({ ...prev, ...allVelocities }));
          setItemAveragePrices(prev => ({ ...prev, ...allAveragePrices }));
          setItemMinListings(prev => ({ ...prev, ...allMinListings }));
          setItemRecentPurchases(prev => ({ ...prev, ...allRecentPurchases }));
          setItemTradability(prev => ({ ...prev, ...allTradability }));
        } catch (error) {
          if (error.name === 'AbortError') {
            return; // Request was cancelled, ignore
          }
          console.error('Error fetching market data:', error);
          batch.forEach(itemId => {
            if (!allTradability.hasOwnProperty(itemId)) {
              allTradability[itemId] = false;
            }
          });
        }
      };

      // Process batches sequentially
      let currentIndex = 0;
      let batchNumber = 0;
      while (currentIndex < tradeableItemIds.length) {
        await processBatch(batchNumber, currentIndex);
        
        // Check if request was cancelled
        if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || currentRequestId !== batchSearchRequestIdRef.current) {
          setIsLoadingVelocities(false);
          setIsBatchSearching(false);
          return;
        }
        
        // Determine next batch size
        let batchSize;
        if (batchNumber === 0) {
          batchSize = 20;
        } else if (batchNumber === 1) {
          batchSize = 50;
        } else {
          batchSize = 100;
        }
        
        currentIndex += batchSize;
        batchNumber++;
      }

      // Final state update
      setItemVelocities(allVelocities);
      setItemAveragePrices(allAveragePrices);
      setItemMinListings(allMinListings);
      setItemRecentPurchases(allRecentPurchases);
      setItemTradability(allTradability);
      // Check if this request was superseded before final state update
      if (currentRequestId !== batchSearchRequestIdRef.current) {
        setIsLoadingVelocities(false);
        setIsBatchSearching(false);
        return;
      }
      
      setIsLoadingVelocities(false);
      setIsBatchSearching(false);
      
      addToast(`找到 ${tradeableItems.length} 個可交易物品`, 'success');
    } catch (error) {
      console.error('Search error:', error);
      // Only show error if this request wasn't cancelled
      if (currentRequestId === batchSearchRequestIdRef.current) {
        addToast('搜索失敗，請稍後再試', 'error');
        setIsLoadingVelocities(false);
        setIsBatchSearching(false);
      }
    }
  }, [batchInput, selectedWorld, selectedServerOption, addToast, isSearchButtonDisabled, batchFuzzySearch]);

  // Initialize from URL parameters on mount and when URL changes
  useEffect(() => {
    if (!isServerDataLoaded) {
      return;
    }

    const currentURLKey = `${location.pathname}?${location.search}`;
    
    // Skip if we've already processed this exact URL
    if (lastProcessedURLRef.current === currentURLKey) {
      return;
    }

    // Check if we're on advanced-search page
    if (location.pathname !== '/advanced-search') {
      lastProcessedURLRef.current = currentURLKey;
      return;
    }

    // Check for search query parameter
    const searchQuery = searchParams.get('q');
    if (searchQuery && searchQuery.trim() !== '') {
      // Batch search is disabled, ignore URL query parameter
      // Force switch to filter tab if somehow on batch tab
      if (activeTab === 'batch') {
        setActiveTab('filter');
      }
      hasInitializedFromURLRef.current = false;
    } else {
      // No query parameter - clear search if we had results from URL
      if (hasInitializedFromURLRef.current && searchResults.length > 0) {
        setSearchResults([]);
        setItemVelocities({});
        setItemAveragePrices({});
        setItemMinListings({});
        setItemRecentPurchases({});
        setItemTradability({});
        setCurrentPage(1);
      }
      hasInitializedFromURLRef.current = false;
    }

    lastProcessedURLRef.current = currentURLKey;
  }, [location.pathname, location.search, searchParams, isServerDataLoaded, batchInput, activeTab, searchResults.length, isBatchSearching, isFilterSearching, isSearching]);

  // Force switch to filter tab if batch search is disabled and user is on batch tab
  useEffect(() => {
    if (BATCH_SEARCH_DISABLED && activeTab === 'batch') {
      setActiveTab('filter');
    }
  }, [activeTab]);

  // Manage loading indicator (same logic as main search page)
  useEffect(() => {
    // When showUntradeable is true, combine both lists; otherwise show only tradeable
    const currentResults = activeTab === 'filter' 
      ? (showUntradeable ? [...searchResults, ...untradeableResults] : searchResults)
      : searchResults;
    // Show loading indicator when searching or loading velocities, for >=50 items
    // Match the logic from main search page
    const shouldShow = (isLoadingVelocities || isFilterSearching || velocityFetchInProgress) && 
                       (currentResults.length >= 50 || searchResults.length >= 50 || untradeableResults.length >= 50);
    
    if (shouldShow) {
      // Start showing indicator
      if (!loadingIndicatorStartTimeRef.current) {
        loadingIndicatorStartTimeRef.current = Date.now();
        setShowLoadingIndicator(true);
      } else {
        setShowLoadingIndicator(true);
      }
    } else {
      // Hide indicator, but ensure minimum 1s display time
      if (loadingIndicatorStartTimeRef.current) {
        const elapsed = Date.now() - loadingIndicatorStartTimeRef.current;
        const remaining = Math.max(0, 1000 - elapsed);
        
        if (remaining > 0) {
          // Wait for remaining time before hiding
          const timeout = setTimeout(() => {
            setShowLoadingIndicator(false);
            loadingIndicatorStartTimeRef.current = null;
          }, remaining);
          
          return () => clearTimeout(timeout);
        } else {
          // Already shown for at least 1s, hide immediately
          setShowLoadingIndicator(false);
          loadingIndicatorStartTimeRef.current = null;
        }
      } else {
        setShowLoadingIndicator(false);
      }
    }
  }, [isLoadingVelocities, isFilterSearching, velocityFetchInProgress, showUntradeable, searchResults.length, untradeableResults.length, activeTab]);

  // Helper function to get background color class based on job role
  // FF14官方颜色: Tank (#2d3a80), Healer (#346624), DPS (#732828)
  const getJobRoleBgColor = (role) => {
    switch (role) {
      case 'tank':
        return 'bg-blue-600/15'; // 深蓝色 - 坦克 (降低透明度使其更自然)
      case 'healer':
        return 'bg-green-600/15'; // 深绿色 - 辅助 (降低透明度使其更自然)
      case 'melee':
      case 'ranged':
      case 'caster':
        return 'bg-red-600/15'; // 深红色 - 输出 (降低透明度使其更自然)
      case 'crafting':
      case 'gathering':
        return 'bg-gray-500/15'; // 灰色 - 生产职业 (降低透明度使其更自然)
      default:
        return 'bg-slate-900/50';
    }
  };

  // Job icons mapping with Garland Tools URLs - separated into 生產 and 戰鬥職業
  // Only show higher tier jobs (exclude base classes 1-7, 26, 29)
  // Depend on jobAbbrLoaded to trigger recomputation when data loads
  const { craftingJobs, gatheringJobs, battleJobsByRole } = useMemo(() => {
    // Mapping of lower tier classes to their higher tier jobs
    // We'll exclude these lower tier IDs: 1-7 (base classes), 26 (ACN), 29 (ROG)
    const lowerTierClasses = new Set([1, 2, 3, 4, 5, 6, 7, 26, 29]);
    
    // Role definitions for battle jobs: 1=Tank, 2=Physical DPS, 3=Ranged Physical DPS, 4=Healer, 5=Magical DPS
    const jobRoles = {
      // Tanks (Role 1)
      19: 'tank',    // PLD
      21: 'tank',    // WAR
      32: 'tank',    // DRK
      37: 'tank',    // GNB
      
      // Healers (Role 4)
      24: 'healer',  // WHM
      28: 'healer',  // SCH
      33: 'healer',  // AST
      40: 'healer',  // SGE
      
      // Physical Melee DPS (Role 2)
      20: 'melee',   // MNK
      22: 'melee',   // DRG
      30: 'melee',   // NIN
      34: 'melee',   // SAM
      39: 'melee',   // RPR
      41: 'melee',   // VPR
      
      // Physical Ranged DPS (Role 3)
      23: 'ranged',  // BRD
      31: 'ranged',  // MCH
      38: 'ranged',  // DNC
      
      // Magical DPS (Role 5)
      25: 'caster',  // BLM
      27: 'caster',  // SMN
      35: 'caster',  // RDM
      36: 'caster',  // BLU
      42: 'caster',  // PCT
    };
    
    const crafting = [];
    const gathering = [];
    const battleByRole = {
      tank: [],
      healer: [],
      melee: [],
      ranged: [],
      caster: [],
    };
    
    const twJobAbbrData = twJobAbbrDataRef.current || {};
    Object.entries(twJobAbbrData).forEach(([id, data]) => {
      const jobId = parseInt(id, 10);
      
      // Skip lower tier classes
      if (lowerTierClasses.has(jobId)) return;
      
      const abbr = getJobAbbreviation(jobId);
      if (!abbr) return; // Skip if no abbreviation mapping
      
      // 生產職業: 8-15 (crafting)
      if (jobId >= 8 && jobId <= 15) {
        const jobData = {
          id: jobId,
          name: data.tw,
          iconUrl: `https://garlandtools.org/files/icons/job/${abbr}.png`,
          role: 'crafting',
        };
        crafting.push(jobData);
      }
      // 採集職業: 16-18 (gathering)
      else if (jobId >= 16 && jobId <= 18) {
        const jobData = {
          id: jobId,
          name: data.tw,
          iconUrl: `https://garlandtools.org/files/icons/job/${abbr}.png`,
          role: 'gathering',
        };
        gathering.push(jobData);
      }
      // 戰鬥職業: Only higher tier jobs (19-42, excluding lower tier)
      else if (jobId >= 19 && jobId <= 42) {
        const role = jobRoles[jobId];
        if (role && battleByRole[role]) {
          const jobData = {
            id: jobId,
            name: data.tw,
            iconUrl: `https://garlandtools.org/files/icons/job/${abbr}.png`,
            role: role,
          };
          battleByRole[role].push(jobData);
        }
      }
    });
    
    // Sort by ID within each category
    crafting.sort((a, b) => a.id - b.id);
    gathering.sort((a, b) => a.id - b.id);
    Object.keys(battleByRole).forEach(role => {
      battleByRole[role].sort((a, b) => a.id - b.id);
    });
    
    return { craftingJobs: crafting, gatheringJobs: gathering, battleJobsByRole: battleByRole };
  }, [jobAbbrLoaded, getJobAbbreviation]); // Recompute when job data loads or getJobAbbreviation changes

  // Map job-specific weapon categories to generic categories
  // Job-specific weapon categories that should be hidden and mapped to generic ones
  const jobSpecificWeaponCategories = new Set([
    1,   // 格鬥武器 (MNK)
    2,   // 單手劍 (PLD/DRK)
    3,   // 大斧 (WAR)
    4,   // 弓 (BRD)
    5,   // 長槍 (DRG)
    6,   // 單手咒杖 (BLM)
    7,   // 雙手咒杖 (BLM)
    8,   // 單手幻杖 (WHM)
    9,   // 雙手幻杖 (WHM)
    10,  // 魔導書 (SMN/SCH)
    84,  // 雙劍 (NIN)
    87,  // 雙手劍 (DRK)
    88,  // 火槍 (MCH)
    89,  // 天球儀 (AST)
    96,  // 武士刀 (SAM)
    97,  // 刺劍 (RDM)
    98,  // 魔導書（學者專用）(SCH)
    105, // 青魔杖 (BLU)
    106, // 槍刃 (GNB)
    107, // 投擲武器 (DNC)
    108, // 雙手鐮刀 (RPR)
    109, // 賢具 (SGE)
    110, // 二刀流武器 (VPR)
    111, // 筆 (PCT)
  ]);

  // Job-specific tool categories that should be hidden and mapped to generic ones
  const jobSpecificToolCategories = new Set([
    12,  // 木工工具（主工具）
    13,  // 木工工具（副工具）
    14,  // 鍛造工具（主工具）
    15,  // 鍛造工具（副工具）
    16,  // 甲冑工具（主工具）
    17,  // 甲冑工具（副工具）
    18,  // 金工工具（主工具）
    19,  // 金工工具（副工具）
    20,  // 皮革工具（主工具）
    21,  // 皮革工具（副工具）
    22,  // 裁縫工具（主工具）
    23,  // 裁縫工具（副工具）
    24,  // 鍊金工具（主工具）
    25,  // 鍊金工具（副工具）
    26,  // 烹調工具（主工具）
    27,  // 烹調工具（副工具）
    28,  // 採掘工具（主工具）
    29,  // 採掘工具（副工具）
    30,  // 園藝工具（主工具）
    31,  // 園藝工具（副工具）
    32,  // 捕魚用具（主工具）
    33,  // 釣餌
    99,  // 捕魚用具（副工具）
  ]);

  // Map job IDs to their main weapon category IDs
  const jobToWeaponCategoryMap = {
    // Battle jobs
    19: [2],      // PLD - 單手劍
    20: [1],      // MNK - 格鬥武器
    21: [3],      // WAR - 大斧
    22: [5],      // DRG - 長槍
    23: [4],      // BRD - 弓
    24: [8, 9],   // WHM - 單手幻杖/雙手幻杖
    25: [6, 7],   // BLM - 單手咒杖/雙手咒杖
    27: [10],     // SMN - 魔導書
    28: [10, 98], // SCH - 魔導書/魔導書（學者專用）
    30: [84],     // NIN - 雙劍
    31: [88],     // MCH - 火槍
    32: [2, 87],  // DRK - 單手劍/雙手劍
    33: [89],     // AST - 天球儀
    34: [96],     // SAM - 武士刀
    35: [97],     // RDM - 刺劍
    36: [105],    // BLU - 青魔杖
    37: [106],    // GNB - 槍刃
    38: [107],    // DNC - 投擲武器
    39: [108],    // RPR - 雙手鐮刀
    40: [109],    // SGE - 賢具
    41: [110],    // VPR - 二刀流武器
    42: [111],    // PCT - 筆
  };

  // Map production job IDs to their main tool category IDs (separate maps for main and offhand)
  const jobToProductionMainToolMap = {
    8: 12,   // CRP - 木工工具（主工具）
    9: 14,   // BSM - 鍛造工具（主工具）
    10: 16,  // ARM - 甲冑工具（主工具）
    11: 18,  // GSM - 金工工具（主工具）
    12: 20,  // LTW - 皮革工具（主工具）
    13: 22,  // WVR - 裁縫工具（主工具）
    14: 24,  // ALC - 鍊金工具（主工具）
    15: 26,  // CUL - 烹調工具（主工具）
  };

  const jobToProductionOffhandToolMap = {
    8: 13,   // CRP - 木工工具（副工具）
    9: 15,   // BSM - 鍛造工具（副工具）
    10: 17,  // ARM - 甲冑工具（副工具）
    11: 19,  // GSM - 金工工具（副工具）
    12: 21,  // LTW - 皮革工具（副工具）
    13: 23,  // WVR - 裁縫工具（副工具）
    14: 25,  // ALC - 鍊金工具（副工具）
    15: 27,  // CUL - 烹調工具（副工具）
  };

  // Map battle job IDs to their offhand weapon category IDs
  const jobToOffhandWeaponMap = {
    19: 11,  // PLD - 盾
  };

  // Map gathering job IDs to their tool category IDs
  const jobToGatheringMainToolMap = {
    16: 28,  // MIN - 採掘工具（主工具）
    17: 30,  // BTN - 園藝工具（主工具）
    18: 32,  // FSH - 捕魚用具（主工具）
  };

  const jobToGatheringOffhandToolMap = {
    16: 29,  // MIN - 採掘工具（副工具）
    17: 31,  // BTN - 園藝工具（副工具）
    18: 99,  // FSH - 捕魚用具（副工具）
  };

  // Generic category groups - unified to main weapon and offhand weapon
  const genericCategoryGroups = {
    '主武器': [
      // Battle weapons
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 84, 87, 88, 89, 96, 97, 98, 105, 106, 107, 108, 109, 110, 111,
      // Production main tools
      12, 14, 16, 18, 20, 22, 24, 26,
      // Gathering main tools
      28, 30, 32,
    ],
    '副手武器': [
      // Battle offhand
      11, // 盾
      // Production offhand tools
      13, 15, 17, 19, 21, 23, 25, 27,
      // Gathering offhand tools
      29, 31, 33, 99,
    ],
  };

  // Equipment category IDs (weapons, armor, accessories)
  const equipmentCategoryIds = new Set([
    // Weapons (already handled by generic categories)
    // Armor
    34, 35, 36, 37, 38, // 頭部防具、身體防具、腿部防具、手部防具、腳部防具
    112, // 套裝
    // Accessories
    40, 41, 42, 43, // 項鍊、耳飾、手鐲、戒指
    // Soul crystal
    62, // 靈魂水晶
  ]);

  // Item categories from tw-item-ui-categories.json (filtered to remove job-specific weapon categories)
  // Depend on itemUICategoriesLoaded to trigger recomputation when data loads
  const itemCategories = useMemo(() => {
    const twItemUICategoriesData = twItemUICategoriesDataRef.current || {};
    const allCategories = Object.entries(twItemUICategoriesData)
      .map(([id, data]) => ({
        id: parseInt(id, 10),
        name: data.tw,
      }))
      .filter(cat => !jobSpecificWeaponCategories.has(cat.id) && !jobSpecificToolCategories.has(cat.id) && !EXCLUDED_CATEGORIES.includes(cat.id)); // Exclude categories in EXCLUDED_CATEGORIES
    
    // Separate equipment and miscellaneous categories
    // Exclude shield (11) from miscellaneous categories
    const equipmentCategories = allCategories.filter(cat => equipmentCategoryIds.has(cat.id));
    const miscellaneousCategories = allCategories
      .filter(cat => !equipmentCategoryIds.has(cat.id) && cat.id !== 11) // Exclude shield (11) from miscellaneous
      .map(cat => {
        // Map category 63 (其他) to "坐騎/鳥甲"
        if (cat.id === 63 || cat.name === '其他') {
          return { ...cat, name: '坐騎/鳥甲' };
        }
        return cat;
      });
    
    // Sort equipment categories with custom order: head(34), set(112), body(35), hand(37), leg(36), feet(38), then accessories (earring, necklace, bracelet, ring)
    const equipmentOrder = [34, 112, 35, 37, 36, 38, 41, 40, 42, 43, 62];
    equipmentCategories.sort((a, b) => {
      const indexA = equipmentOrder.indexOf(a.id);
      const indexB = equipmentOrder.indexOf(b.id);
      // If both are in the custom order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only one is in the custom order, it comes first
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // If neither is in the custom order, sort by ID
      return a.id - b.id;
    });
    // Sort miscellaneous categories by ID, but move "停止流通道具" (39) to the end
    miscellaneousCategories.sort((a, b) => {
      // If one is "停止流通道具" (39), it goes to the end
      if (a.id === 39) return 1;
      if (b.id === 39) return -1;
      // Otherwise sort by ID
      return a.id - b.id;
    });
    
    // Add generic categories - unified to main weapon and offhand weapon
    const genericCategories = [
      { id: 'main_weapon', name: '主手', isGeneric: true },
      { id: 'offhand_weapon', name: '副手', isGeneric: true },
    ];
    
    // Separate equipment into groups:
    // 1. Armor (head, set, body, hand, leg, feet): 34, 112, 35, 37, 36, 38
    // 2. Accessories: 41, 40, 42, 43 (earring, necklace, bracelet, ring)
    // 3. Others (soul crystal, etc.): 62
    const armorIds = [34, 112, 35, 37, 36, 38]; // Include set (112) after head (34)
    const accessoryIds = [41, 40, 42, 43];
    const armorCategories = equipmentCategories.filter(cat => armorIds.includes(cat.id));
    const accessoryCategories = equipmentCategories.filter(cat => accessoryIds.includes(cat.id));
    const otherEquipmentCategories = equipmentCategories
      .filter(cat => !armorIds.includes(cat.id) && !accessoryIds.includes(cat.id))
      .map(cat => {
        // Map category 63 (其他) to "坐騎/鳥甲"
        if (cat.id === 63 || cat.name === '其他') {
          return { ...cat, name: '坐騎/鳥甲' };
        }
        // Also map category 62 (靈魂水晶) to "坐騎/鳥甲" if it exists
        if (cat.id === 62) {
          return { ...cat, name: '坐騎/鳥甲' };
        }
        return cat;
      });
    
    return {
      weapons: genericCategories, // 主手、副手
      armor: armorCategories, // 头部、身体、手、腿、脚
      accessories: accessoryCategories, // 项链、耳饰、手镯、戒指
      otherEquipment: otherEquipmentCategories, // 其他裝備（如坐騎/鳥甲）
      miscellaneous: miscellaneousCategories,
    };
  }, [itemUICategoriesLoaded]); // Recompute when category data loads

  // Filter categories based on search term and disabled state
  const filteredItemCategories = useMemo(() => {
    const filterCategory = (category) => {
      // First check if category matches search term
      if (categorySearchTerm.trim()) {
        const searchTermLower = categorySearchTerm.toLowerCase().trim();
        if (!category.name.toLowerCase().includes(searchTermLower)) {
          return false;
        }
      }
      return true;
    };

    return {
      weapons: itemCategories.weapons.filter(filterCategory),
      armor: itemCategories.armor.filter(filterCategory),
      accessories: itemCategories.accessories.filter(filterCategory),
      otherEquipment: itemCategories.otherEquipment.filter(filterCategory),
      miscellaneous: itemCategories.miscellaneous.filter(filterCategory),
    };
  }, [itemCategories, categorySearchTerm]);

  // Helper function to check if a category is disabled
  const isCategoryDisabled = useCallback((categoryId) => {
    const id = typeof categoryId === 'string' ? categoryId : categoryId;
    // Generic categories (main_weapon, offhand_weapon) are never disabled
    if (id === 'main_weapon' || id === 'offhand_weapon') {
      return false;
    }
    return disabledCategories.has(parseInt(id, 10));
  }, [disabledCategories]);

  // Check if scroll should be disabled when jobs are selected (filtering)
  // Disable scroll when jobs are selected since disabled categories are at the bottom
  useEffect(() => {
    const checkScrollNeeded = () => {
      if (!categoryScrollContainerRef.current) {
        return;
      }
      
      const container = categoryScrollContainerRef.current;
      
      // If jobs are selected, scroll to top first, then disable scroll
      if (selectedJobs.length > 0) {
        // Scroll to top first
        container.scrollTop = 0;
        // Then disable scroll after a brief delay to ensure scroll completes
        setTimeout(() => {
          setShouldDisableCategoryScrollState(true);
        }, 50);
        return;
      }
      
      // If no jobs selected, check if content actually needs scrolling
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      // If content fits within container, disable scroll
      // Add small buffer (2px) to account for rounding errors
      const needsScroll = scrollHeight > clientHeight + 2;
      
      setShouldDisableCategoryScrollState(!needsScroll);
    };
    
    // Check immediately
    checkScrollNeeded();
    
    // Also check after a short delay to account for rendering
    const timeoutId = setTimeout(checkScrollNeeded, 100);
    
    return () => clearTimeout(timeoutId);
  }, [selectedJobs, filteredItemCategories, categorySearchTerm]);

  // Handle job toggle
  const handleJobToggle = useCallback((jobId) => {
    setSelectedJobs(prev => {
      if (prev.includes(jobId)) {
        return prev.filter(j => j !== jobId);
      } else {
        return [...prev, jobId];
      }
    });
  }, []);

  // Handle category toggle
  const handleCategoryToggle = useCallback((categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(c => c !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
    // Clear the search term after selecting/deselecting a category
    setCategorySearchTerm('');
    // Keep focus on the search input so user can continue typing
    setTimeout(() => {
      if (categorySearchInputRef.current) {
        categorySearchInputRef.current.focus();
      }
    }, 0);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  // Shared function to perform filter search logic
  // OPTIMIZED QUERY ORDER - Always use targeted queries, never load all data
  // 
  // Query order (designed to minimize data transfer):
  // 1. Categories filter → getItemIdsByCategories() - Query ui_categories table by category IDs
  // 2. Jobs filter → getEquipmentByJobs() - Query equipment table by job abbreviations
  // 3. Intersect results if both filters are selected
  // 4. Level filter → getEquipmentByIds() - Query equipment table by itemIds (already filtered)
  // 5. Name filter → getTwItemById() - Query tw_items table by itemIds (already filtered)
  // 6. Marketable filter → getMarketableItemsByIds() - Query market_items table by itemIds
  // 7. Ilvls/Rarities → getIlvlsByIds() / getRaritiesByIds() - Only for final results
  //
  // Tables queried:
  // - ui_categories: By category IDs (WHERE category IN (...))
  // - equipment: By job abbreviations (WHERE jobs @> '["PLD"]') or by itemIds (WHERE id IN (...))
  // - tw_recipes_by_job_level: By job IDs and level range (WHERE job IN (...) AND level BETWEEN ...)
  // - tw_items: By itemIds only (WHERE id IN (...)) - NEVER load all items
  // - market_items: By itemIds only (WHERE id IN (...)) - NEVER load all items
  // - ilvls: By itemIds only (WHERE id IN (...)) - NEVER load all items
  // - rarities: By itemIds only (WHERE id IN (...)) - NEVER load all items
  //
  // Returns { itemIds, tradeableItemIds, untradeableItemIds, marketableSet } or null if error
  // skipLimitCheck: if true, skip the MAX_ITEMS_LIMIT check (for "continue search" button)
  const performFilterSearchLogic = useCallback(async (skipLimitCheck = false) => {
    if (selectedJobs.length === 0 && selectedCategories.length === 0) {
      addToast('請至少選擇一個職業或分類', 'warning');
      return null;
    }

    if (!selectedWorld || !selectedServerOption) {
      addToast('請選擇伺服器', 'warning');
      return null;
    }

    // OPTIMIZED QUERY ORDER: Always start with the filter that returns the fewest results
    // This minimizes data transfer and processing time
    
    // Check for main/offhand weapon categories (needed for job compatibility filtering later)
    const hasMainWeaponCategory = selectedCategories.includes('main_weapon');
    const hasOffhandWeaponCategory = selectedCategories.includes('offhand_weapon');
    
    let itemIds = new Set();
    
    // STEP 1: Filter by categories FIRST (if selected) - this can dramatically reduce item count
    // Query ui_categories table directly by category IDs to get itemIds
    if (selectedCategories.length > 0) {
      // Map generic categories to specific categories
      let categoryIdsToFilter = new Set();
      
      selectedCategories.forEach(catId => {
        if (catId === 'main_weapon') {
          // When "主手" is selected, map to job-specific categories if jobs are selected
          if (selectedJobs.length > 0) {
            // Map to job-specific categories based on selected jobs
            selectedJobs.forEach(jobId => {
              // Battle weapons
              const weaponCategories = jobToWeaponCategoryMap[jobId];
              if (weaponCategories) {
                weaponCategories.forEach(catId => categoryIdsToFilter.add(catId));
              }
              // Production main tools
              const productionMainTool = jobToProductionMainToolMap[jobId];
              if (productionMainTool) {
                categoryIdsToFilter.add(productionMainTool);
              }
              // Gathering main tools
              const gatheringMainTool = jobToGatheringMainToolMap[jobId];
              if (gatheringMainTool) {
                categoryIdsToFilter.add(gatheringMainTool);
              }
            });
          } else {
            // If no jobs selected, include ALL main weapon/tool categories
            genericCategoryGroups['主武器'].forEach(catId => categoryIdsToFilter.add(catId));
          }
        } else if (catId === 'offhand_weapon') {
          // When "副手" is selected, map to job-specific categories if jobs are selected
          if (selectedJobs.length > 0) {
            // Map to job-specific offhand categories based on selected jobs
            selectedJobs.forEach(jobId => {
              // Battle offhand
              const offhandWeapon = jobToOffhandWeaponMap[jobId];
              if (offhandWeapon) {
                categoryIdsToFilter.add(offhandWeapon);
              }
              // Production offhand tools
              const productionOffhandTool = jobToProductionOffhandToolMap[jobId];
              if (productionOffhandTool) {
                categoryIdsToFilter.add(productionOffhandTool);
              }
              // Gathering offhand tools
              const gatheringOffhandTool = jobToGatheringOffhandToolMap[jobId];
              if (gatheringOffhandTool) {
                categoryIdsToFilter.add(gatheringOffhandTool);
              }
            });
          } else {
            // If no jobs selected, include ALL offhand weapon/tool categories
            genericCategoryGroups['副手武器'].forEach(catId => categoryIdsToFilter.add(catId));
          }
        } else {
          // Regular category ID
          categoryIdsToFilter.add(parseInt(catId, 10));
        }
      });
      
      console.log(`[AdvancedSearch] Step 1 - Category filter: ${Array.from(categoryIdsToFilter).join(', ')}`);
      
      // Query ui_categories table directly by category IDs (NO need to load all items!)
      const categoryItemIds = await getItemIdsByCategories(Array.from(categoryIdsToFilter));
      console.log(`[AdvancedSearch] Found ${categoryItemIds.length} items matching categories`);
      
      // Filter out excluded categories
      // Note: getItemIdsByCategories already returns items matching the specified categories
      // We need to filter out items that are in EXCLUDED_CATEGORIES
      if (categoryItemIds.length > 0) {
        const uiCategoriesData = await loadUICategoriesByIds(categoryItemIds);
        categoryItemIds.forEach(itemId => {
          const itemCategoryId = uiCategoriesData[itemId];
          // Include item if it doesn't have a category in EXCLUDED_CATEGORIES
          // If itemCategoryId is undefined/null, include it (might be a valid item without category data)
          if (!itemCategoryId || !EXCLUDED_CATEGORIES.includes(itemCategoryId)) {
            itemIds.add(itemId);
          }
        });
        console.log(`[AdvancedSearch] After excluding categories: ${itemIds.size} items`);
      }
    }
    
    // STEP 2: Filter by jobs (if selected) - intersect with category results
    // Separate production and battle jobs
    const productionJobIds = selectedJobs.filter(jobId => jobId >= 8 && jobId <= 18);
    const battleJobIds = selectedJobs.filter(jobId => (jobId >= 1 && jobId <= 7) || (jobId >= 19 && jobId <= 42));
    
    let jobItemIds = new Set();
    
    // Filter by production jobs (using recipes and equipment)
    if (productionJobIds.length > 0) {
      // Use targeted query to load only recipes for selected jobs
      const { recipes } = await loadRecipesByJobAndLevel(productionJobIds, 1, 100);
      recipes.forEach(recipe => {
        if (recipe.result) {
          jobItemIds.add(recipe.result);
        }
      });
      
      // Also add production tools from equipment - use targeted query by jobs
      const productionJobAbbrs = productionJobIds.map(jobId => getJobAbbreviation(jobId)).filter(abbr => abbr);
      if (productionJobAbbrs.length > 0) {
        const equipmentData = await loadEquipmentByJobs(productionJobAbbrs);
        Object.keys(equipmentData).forEach(itemId => {
          jobItemIds.add(parseInt(itemId, 10));
        });
      }
    }

    // Filter by battle jobs - use targeted query by jobs
    if (battleJobIds.length > 0) {
      const battleJobAbbrs = battleJobIds.map(jobId => getJobAbbreviation(jobId)).filter(abbr => abbr);
      if (battleJobAbbrs.length > 0) {
        const equipmentData = await loadEquipmentByJobs(battleJobAbbrs);
        Object.keys(equipmentData).forEach(itemId => {
          jobItemIds.add(parseInt(itemId, 10));
        });
        console.log(`[AdvancedSearch] Step 2 - Found ${jobItemIds.size} items for jobs: ${battleJobAbbrs.join(', ')}`);
      }
    }
    
    // Intersect category results with job results (if both are selected)
    if (selectedCategories.length > 0 && selectedJobs.length > 0) {
      // If both category and job filters are selected, take intersection
      const intersection = new Set();
      itemIds.forEach(itemId => {
        if (jobItemIds.has(itemId)) {
          intersection.add(itemId);
        }
      });
      itemIds = intersection;
      console.log(`[AdvancedSearch] After category + job intersection: ${itemIds.size} items`);
    } else if (selectedJobs.length > 0 && selectedCategories.length === 0) {
      // If only jobs selected (no categories), use job results
      itemIds = jobItemIds;
    }
    // If only categories selected (no jobs), itemIds already set from category filter above
    
    // If jobs are selected and we have "主手" or "副手" category, filter by job compatibility
    // This ensures that when user selects a job + "主手", they see all main hand weapons that job can use
    if (selectedJobs.length > 0 && (hasMainWeaponCategory || hasOffhandWeaponCategory) && itemIds.size > 0) {
      const itemIdsArray = Array.from(itemIds);
      const equipmentData = await loadEquipmentByIds(itemIdsArray);
      const selectedJobAbbrs = selectedJobs.map(jobId => getJobAbbreviation(jobId)).filter(abbr => abbr);
      const jobCompatibleItems = new Set();
      
      itemIds.forEach(itemId => {
        const equipment = equipmentData[itemId];
        if (equipment && equipment.jobs && Array.isArray(equipment.jobs)) {
          // Check if any selected job can use this item
          const canUse = selectedJobAbbrs.some(jobAbbr => equipment.jobs.includes(jobAbbr));
          if (canUse) {
            jobCompatibleItems.add(itemId);
          }
        } else {
          // If no equipment data or no jobs field, include it (might be non-equipment item)
          // But for weapons, we should have equipment data, so this is a safety net
          jobCompatibleItems.add(itemId);
        }
      });
      
      console.log(`[AdvancedSearch] Job compatibility filter: ${jobCompatibleItems.size} items compatible with jobs ${selectedJobAbbrs.join(', ')}`);
      itemIds = jobCompatibleItems;
    }
    
    // Exclude items in excluded categories (if we haven't already done so)
    if (selectedCategories.length === 0 && itemIds.size > 0) {
      const itemIdsArray = Array.from(itemIds);
      const uiCategoriesData = await loadUICategoriesByIds(itemIdsArray);
      const filteredItemIds = new Set();
      itemIds.forEach(itemId => {
        const itemCategoryId = uiCategoriesData[itemId];
        // Include item if it doesn't have a category in EXCLUDED_CATEGORIES
        // If itemCategoryId is undefined/null, include it (might be a valid item without category data)
        if (!itemCategoryId || !EXCLUDED_CATEGORIES.includes(itemCategoryId)) {
          filteredItemIds.add(itemId);
        }
      });
      itemIds = filteredItemIds;
      console.log(`[AdvancedSearch] After excluding categories (no category filter): ${itemIds.size} items`);
    }

    // Filter by equipment level range if specified (LevelEquip, not ilvl)
    // Use targeted query since we already have itemIds
    if (minLevel > 1 || maxLevel < 999) {
      const itemIdsArray = Array.from(itemIds);
      const equipmentData = await loadEquipmentByIds(itemIdsArray);
      const filteredByLevel = new Set();
      itemIds.forEach(itemId => {
        const equipment = equipmentData[itemId];
        // Include items without equipment level if range is not restrictive (default range)
        if (!equipment || equipment.level === undefined || equipment.level === null) {
          // If no equipment level data, include it only if range is default (1-999)
          if (minLevel === 1 && maxLevel === 999) {
            filteredByLevel.add(itemId);
          }
        } else {
          // Include items within equipment level range
          if (equipment.level >= minLevel && equipment.level <= maxLevel) {
            filteredByLevel.add(itemId);
          }
        }
      });
      itemIds = filteredByLevel;
    }

    // Filter by item name BEFORE checking tradeable status (must be after job/category/level filters)
    // This ensures we only send matching items to API
    if (itemNameFilter.trim()) {
      const filteredByName = new Set();
      const searchWords = itemNameFilter.trim().split(/\s+/).filter(w => w);
      
      // Simple fuzzy matching function (same as in itemDatabase.js)
      const fuzzyMatch = (searchText, itemName) => {
        const searchChars = Array.from(searchText.toLowerCase());
        const itemChars = Array.from(itemName.toLowerCase());
        
        // If exact substring match, return true
        if (itemName.toLowerCase().includes(searchText.toLowerCase())) {
          return true;
        }
        
        // Check if all search characters appear in item name
        let matchedChars = 0;
        let itemIndex = 0;
        let consecutiveMatches = 0;
        let maxConsecutive = 0;
        
        for (let i = 0; i < searchChars.length; i++) {
          const searchChar = searchChars[i];
          let found = false;
          
          // Try to find the character in order first
          for (let j = itemIndex; j < itemChars.length; j++) {
            if (itemChars[j] === searchChar) {
              matchedChars++;
              found = true;
              if (j === itemIndex) {
                consecutiveMatches++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
              } else {
                consecutiveMatches = 1;
              }
              itemIndex = j + 1;
              break;
            }
          }
          
          // If not found in order, search from beginning
          if (!found) {
            for (let j = 0; j < itemChars.length; j++) {
              if (itemChars[j] === searchChar) {
                matchedChars++;
                found = true;
                consecutiveMatches = 1;
                itemIndex = j + 1;
                break;
              }
            }
          }
          
          if (!found) {
            consecutiveMatches = 0;
          }
        }
        
        // Calculate similarity score
        const charMatchRatio = matchedChars / searchChars.length;
        const orderBonus = maxConsecutive / searchChars.length * 0.3;
        const similarity = charMatchRatio * 0.7 + orderBonus;
        
        // Only return matches with similarity >= 0.6
        return similarity >= 0.6;
      };
      
      // Filter items by name before checking tradeable status
      // Use batch query to load item names efficiently (targeted query)
      const itemIdsArray = Array.from(itemIds);
      const itemNamesMap = {};
      
      // Check cache first and separate cached vs uncached items
      const uncachedItemIds = [];
      itemIdsArray.forEach(itemId => {
        if (twItemsDataRef.current?.[itemId.toString()]) {
          itemNamesMap[itemId] = twItemsDataRef.current[itemId.toString()].tw;
        } else {
          uncachedItemIds.push(itemId);
        }
      });
      
      // Load uncached item names in batch (much more efficient than individual queries)
      if (uncachedItemIds.length > 0) {
        const twItemsData = await getTwItemsByIds(uncachedItemIds);
        
        // Update cache and itemNamesMap
        if (!twItemsDataRef.current) {
          twItemsDataRef.current = {};
        }
        Object.entries(twItemsData).forEach(([itemId, data]) => {
          if (data && data.tw) {
            twItemsDataRef.current[itemId] = data;
            itemNamesMap[parseInt(itemId, 10)] = data.tw;
          }
        });
      }
      
      itemIds.forEach(itemId => {
        const itemName = itemNamesMap[itemId];
        // If item has name data, check if it matches
        if (itemName) {
          let matches = false;
          
          if (filterFuzzySearch) {
            // Fuzzy matching: check if all words have fuzzy matches
            matches = searchWords.every(word => fuzzyMatch(word, itemName));
          } else {
            // Exact matching: item name must exactly match the search string (case-insensitive)
            const itemNameLower = itemName.toLowerCase();
            const searchStringLower = itemNameFilter.trim().toLowerCase();
            matches = itemNameLower === searchStringLower;
          }
          
          if (matches) {
            filteredByName.add(itemId);
          }
        }
        // If item doesn't have name data, exclude it from name-filtered results
        // (This is intentional - we can't match items without names)
      });
      itemIds = filteredByName;
    }

    // Check if any items match the filters (after job/category/level/name filtering)
    if (itemIds.size === 0) {
      addToast('未找到符合條件的物品', 'warning');
      return null;
    }

    // Separate tradeable and untradeable items (AFTER name filtering)
    // Use targeted query to check marketability for specific item IDs (optimized)
    const allItemIds = Array.from(itemIds);
    const marketableSet = await getMarketableItemsByIds(allItemIds);
    // Note: Don't call setMarketableItems here - it will be set in handleFilterSearch using the returned marketableSet
    let tradeableItemIds = allItemIds.filter(id => marketableSet.has(id));
    const untradeableItemIds = allItemIds.filter(id => !marketableSet.has(id));

    // Verify that we have at least some items (tradeable or untradeable)
    // Note: tradeableItemIds.length + untradeableItemIds.length should always equal allItemIds.length
    // So if allItemIds.length > 0, at least one of them must be > 0
    // This check is a safety net in case of unexpected data issues
    if (tradeableItemIds.length === 0 && untradeableItemIds.length === 0) {
      // This should never happen if allItemIds.length > 0, but handle it just in case
      console.error('[AdvancedSearch] Unexpected: allItemIds.length > 0 but both tradeable and untradeable are empty', {
        allItemIdsLength: allItemIds.length,
        marketableSetSize: marketableSet.size
      });
      addToast('查詢市場資料時發生錯誤，請稍後再試', 'error');
      return null;
    }

    // If no tradeable items but there are untradeable items, show untradeable by default
    if (tradeableItemIds.length === 0 && untradeableItemIds.length > 0) {
      setShowUntradeable(true);
    }

    // Sort item IDs by ilvl (descending, highest first) before API query
    // Use targeted query to load only ilvls for these specific items
    const ilvlsData = await loadIlvlsData(tradeableItemIds);
    tradeableItemIds = tradeableItemIds.sort((a, b) => {
      const aIlvl = ilvlsData[a?.toString()] || null;
      const bIlvl = ilvlsData[b?.toString()] || null;
      
      // If both have ilvl, sort by ilvl descending (highest first)
      if (aIlvl !== null && bIlvl !== null) {
        return bIlvl - aIlvl;
      }
      // If only one has ilvl, prioritize it
      if (aIlvl !== null) return -1;
      if (bIlvl !== null) return 1;
      // If neither has ilvl, sort by ID descending
      return b - a;
    });

    // Check if too many items (only check tradeable items for limit)
    // Skip this check if skipLimitCheck is true (for "continue search" button)
    if (!skipLimitCheck && tradeableItemIds.length > MAX_ITEMS_LIMIT) {
      setTooManyItemsWarning({
        total: tradeableItemIds.length,
        limit: MAX_ITEMS_LIMIT
      });
      return null; // Return null to indicate warning was set
    }

    return { 
      itemIds: Array.from(itemIds), 
      tradeableItemIds, 
      untradeableItemIds,
      marketableSet 
    };
  }, [selectedJobs, selectedCategories, selectedWorld, selectedServerOption, minLevel, maxLevel, itemNameFilter, filterFuzzySearch, addToast, loadRecipeDatabase, loadEquipmentByJobs, loadEquipmentByIds, loadUICategoriesByIds, loadIlvlsData, getJobAbbreviation]);

  // Handle filter search
  const handleFilterSearch = useCallback(async () => {
    // If already searching, cancel the search
    if (isFilterSearching) {
      // Increment request ID to cancel ongoing search
      filterSearchRequestIdRef.current++;
      // Cancel any ongoing market data fetches
      if (velocityFetchAbortControllerRef.current) {
        velocityFetchAbortControllerRef.current.abort();
        velocityFetchAbortControllerRef.current = null;
      }
      setIsFilterSearching(false);
      setIsLoadingVelocities(false);
      setVelocityFetchInProgress(false);
      return;
    }
    
    // Clear warning first, even if button is disabled, so button can be enabled after timeout
    setTooManyItemsWarning(null);
    
    // Prevent multiple clicks within 1.5 seconds
    if (isSearchButtonDisabled) return;

    // Cancel any ongoing search requests
    const currentRequestId = ++filterSearchRequestIdRef.current;
    
    // Cancel all ongoing market data fetches
    if (velocityFetchAbortControllerRef.current) {
      velocityFetchAbortControllerRef.current.abort();
      velocityFetchAbortControllerRef.current = null;
    }
    
    // Increment velocity fetch request ID to cancel any ongoing market data requests
    velocityFetchRequestIdRef.current++;
    velocityFetchInProgressRef.current = false;
    setVelocityFetchInProgress(false);
    setIsLoadingVelocities(false);
    
    // Scroll to results table when search starts
    setTimeout(() => {
      if (resultsTableRef.current) {
        resultsTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Fallback: scroll to top if ref not available yet
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);

    // Clear table immediately at the start of search
    setSearchResults([]);
    setUntradeableResults([]);
    setShowUntradeable(false);
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});
    setSelectedRarities([]); // Reset rarity filter on new search
    setCurrentPage(1); // Reset to first page on new search

    // Disable search button for 1.5 seconds
    setIsSearchButtonDisabled(true);
    setTimeout(() => {
      setIsSearchButtonDisabled(false);
    }, 1500);

    try {
      setIsFilterSearching(true);

      // Check if this request was superseded
      if (currentRequestId !== filterSearchRequestIdRef.current) {
        setIsFilterSearching(false);
        return;
      }

      // Use shared filter search logic
      const result = await performFilterSearchLogic();
      
      // Check if this request was superseded
      if (currentRequestId !== filterSearchRequestIdRef.current) {
        setIsFilterSearching(false);
        return;
      }
      
      if (!result) {
        setIsFilterSearching(false);
        return; // Error or warning already handled in performFilterSearchLogic
      }

      const { tradeableItemIds, untradeableItemIds, marketableSet } = result;
      
      // Check if this request was superseded
      if (currentRequestId !== filterSearchRequestIdRef.current) {
        setIsFilterSearching(false);
        return;
      }
      
      setTooManyItemsWarning(null);

      // CRITICAL: Use marketableSet from performFilterSearchLogic (already queried with targeted query)
      // performFilterSearchLogic already called setMarketableItems, but React state updates are async
      // So we use the returned marketableSet directly to avoid unnecessary full table query
      setMarketableItems(marketableSet);

      // CRITICAL: Double-check that tradeableItemIds only contains tradeable items
      // This matches handleBatchSearch behavior - filter BEFORE setting searchResults
      // performFilterSearchLogic already filtered, but we ensure consistency here
      const verifiedTradeableItemIds = tradeableItemIds.filter(id => marketableSet.has(id));
      console.log(`[AdvancedSearch] handleFilterSearch: tradeableItemIds = ${tradeableItemIds.length}, verifiedTradeableItemIds = ${verifiedTradeableItemIds.length}, marketableSet.size = ${marketableSet.size}`);

      // Load ilvls data for sorting - use targeted query for these specific items
      const allItemIdsForSort = [...verifiedTradeableItemIds, ...untradeableItemIds];
      console.log(`[AdvancedSearch] handleFilterSearch: Loading ilvls for ${allItemIdsForSort.length} items (${verifiedTradeableItemIds.length} tradeable + ${untradeableItemIds.length} untradeable)`);
      const ilvlsData = await loadIlvlsData(allItemIdsForSort);
      
      // Check again if this request was superseded
      if (currentRequestId !== filterSearchRequestIdRef.current) {
        setIsFilterSearching(false);
        return;
      }

      // Load all items at once (simple approach like main search)
      // Let SearchResultsTable handle loading display
      const loadAllItems = async (itemIds, isTradeable) => {
        // Check if this search request was superseded
        if (currentRequestId !== filterSearchRequestIdRef.current) {
          return [];
        }
        
        // Filter and sort itemIds
        const filteredItemIds = isTradeable 
          ? itemIds.filter(id => marketableSet.has(id))
          : itemIds;
        
        const sortedItemIds = [...filteredItemIds].sort((a, b) => {
          const aIlvl = ilvlsData[a?.toString()] || null;
          const bIlvl = ilvlsData[b?.toString()] || null;
          
          // Sort by ilvl descending (highest first)
          if (aIlvl !== null && bIlvl !== null) {
            return bIlvl - aIlvl;
          }
          // If only one has ilvl, prioritize it
          if (aIlvl !== null) return -1;
          if (bIlvl !== null) return 1;
          // If neither has ilvl, sort by ID descending
          return b - a;
        });
        
        // Load all items at once using batch query (optimized)
        const { getTwItemsByIds } = await import('../services/supabaseData');
        const itemsData = await getTwItemsByIds(sortedItemIds);
        const allItems = sortedItemIds.map(id => {
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
        
        // Check again if search was cancelled
        if (currentRequestId !== filterSearchRequestIdRef.current) {
          return [];
        }
        
        // Filter items using marketableSet
        const filteredItems = isTradeable
          ? allItems.filter(item => marketableSet.has(item.id))
          : allItems;
        
        // Sort items by ilvl (descending, highest first)
        const sortedItems = filteredItems.sort((a, b) => {
          const aIlvl = ilvlsData[a.id?.toString()] || null;
          const bIlvl = ilvlsData[b.id?.toString()] || null;
          
          if (aIlvl !== null && bIlvl !== null) {
            return bIlvl - aIlvl;
          }
          if (aIlvl !== null) return -1;
          if (bIlvl !== null) return 1;
          return b.id - a.id;
        });
        
        // Load rarities for all items
        const itemIdsForRarities = sortedItems.map(item => item.id);
        const raritiesForItems = await loadRaritiesData(itemIdsForRarities);
        
        // Check again before updating state
        if (currentRequestId !== filterSearchRequestIdRef.current) {
          return [];
        }
        
        // Update rarities state
        setRaritiesData(prev => ({ ...prev, ...raritiesForItems }));
        
        // Mark untradeable items as non-tradable
        if (!isTradeable) {
          const untradeableTradability = {};
          sortedItems.forEach(item => {
            untradeableTradability[item.id] = false;
          });
          setItemTradability(prev => ({ ...prev, ...untradeableTradability }));
        }
        
        return sortedItems;
      };

      // Load all items at once (simple approach like main search)
      // Let SearchResultsTable handle loading display
      let tradeableItems = [];
      let untradeableItems = [];
      
      if (verifiedTradeableItemIds.length > 0) {
        // Load tradeable items
        tradeableItems = await loadAllItems(verifiedTradeableItemIds, true);
        
        // Check if this request was superseded
        if (currentRequestId !== filterSearchRequestIdRef.current) {
          setIsFilterSearching(false);
          return;
        }
        
        // Also load untradeable items if they exist
        if (untradeableItemIds.length > 0) {
          untradeableItems = await loadAllItems(untradeableItemIds, false);
          
          // Check again if this request was superseded
          if (currentRequestId !== filterSearchRequestIdRef.current) {
            setIsFilterSearching(false);
            return;
          }
        }
      } else if (untradeableItemIds.length > 0) {
        // Only show untradeable items if there are NO tradeable items
        untradeableItems = await loadAllItems(untradeableItemIds, false);
        
        // Check if this request was superseded
        if (currentRequestId !== filterSearchRequestIdRef.current) {
          setIsFilterSearching(false);
          return;
        }
      }

      // Check if this request was superseded before updating state
      if (currentRequestId !== filterSearchRequestIdRef.current) {
        setIsFilterSearching(false);
        return;
      }

      // Update state with all items at once (like main search)
      flushSync(() => {
        setShowUntradeable(false); // Always show tradeable by default
        setSearchResults(tradeableItems);
        setUntradeableResults(untradeableItems);
        setCurrentPage(1); // Reset to first page
        setIsFilterSearching(false); // Search complete - set INSIDE flushSync to ensure atomic update
      });

      // Show toast with results count
      if (tradeableItems.length > 0 || untradeableItems.length > 0) {
        addToast(`找到 ${tradeableItems.length} 個可交易物品${untradeableItems.length > 0 ? `、${untradeableItems.length} 個不可交易物品` : ''}`, 'success');
      }

      // Start market data fetching in background (non-blocking)
      // This is handled by SearchResultsTable component, but we can trigger it here if needed
      if (selectedWorld && selectedServerOption && tradeableItems.length > 0) {
        // Market data will be fetched by SearchResultsTable when it detects items
        // No need to manually trigger here
      }
    } catch (error) {
      // Check if this request was superseded
      if (currentRequestId !== filterSearchRequestIdRef.current) {
        return;
      }
      console.error('Filter search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
      setIsFilterSearching(false);
    }
  }, [selectedJobs, selectedCategories, selectedWorld, selectedServerOption, addToast, isFilterSearching, isSearching, itemNameFilter, minLevel, maxLevel, filterFuzzySearch, isSearchButtonDisabled]);

  // Fetch velocity, average price, and tradability data for search results (like main search page)
  // This loads prices for ALL items when searchResults or selectedServerOption changes
  useEffect(() => {
    // Get displayed results first to check if we'll need to fetch
    const displayedResults = showUntradeable ? untradeableResults : searchResults;
    const willNeedFetch = displayedResults && displayedResults.length > 0 && selectedServerOption && selectedWorld;
    
    // Cancel any in-progress fetch
    if (velocityFetchAbortControllerRef.current) {
      velocityFetchAbortControllerRef.current.abort();
      velocityFetchInProgressRef.current = false;
      setVelocityFetchInProgress(false);
    }
    
    // Reset state if no search results or no server selected
    if (!displayedResults || displayedResults.length === 0 || !selectedServerOption || !selectedWorld) {
      setItemVelocities({});
      setItemAveragePrices({});
      setItemMinListings({});
      setItemRecentPurchases({});
      setItemTradability({});
      setIsLoadingVelocities(false);
      setVelocityLoadingProgress({ loaded: 0, total: 0 });
      velocityFetchInProgressRef.current = false;
      setVelocityFetchInProgress(false);
      lastFetchedItemIdsRef.current = '';
      return;
    }

    // Get all item IDs from displayed results and sort by ilvl before API query
    (async () => {
      const allItemIds = displayedResults.map(item => item.id);
      
      // Check marketability ONLY for displayed items (efficient - uses WHERE IN)
      const marketableSet = await getMarketableItemsByIds(allItemIds);
      
      // Filter to only marketable items before batch processing
      // This ensures batch processing only handles tradeable items
      const marketableItemIds = allItemIds.filter(id => marketableSet.has(id));
      
      // Load ilvls data ONLY for marketable items (efficient - uses WHERE IN)
      const ilvlsData = await loadIlvlsData(marketableItemIds);
      
      // Sort item IDs by ilvl (descending, highest first), then by ID if no ilvl
      const sortedItemIds = marketableItemIds.sort((a, b) => {
        const aIlvl = ilvlsData[a?.toString()] || null;
        const bIlvl = ilvlsData[b?.toString()] || null;
        
        // If both have ilvl, sort by ilvl descending (highest first)
        if (aIlvl !== null && bIlvl !== null) {
          return bIlvl - aIlvl;
        }
        // If only one has ilvl, prioritize it
        if (aIlvl !== null) return -1;
        if (bIlvl !== null) return 1;
        // If neither has ilvl, sort by ID descending
        return b - a;
      });

      if (sortedItemIds.length === 0) {
        setItemVelocities({});
        setItemAveragePrices({});
        setItemMinListings({});
        setItemRecentPurchases({});
        setItemTradability({});
        setIsLoadingVelocities(false);
        setVelocityLoadingProgress({ loaded: 0, total: 0 });
        velocityFetchInProgressRef.current = false;
        setVelocityFetchInProgress(false);
        lastFetchedItemIdsRef.current = '';
        return;
      }

      // Create a stable key from item IDs and server option to detect if items or server changed
      const itemIdsKey = [...sortedItemIds].sort((a, b) => a - b).join(',');
      const serverKey = `${selectedServerOption}`;
      const cacheKey = `${itemIdsKey}|${serverKey}`;
      
      // Clear state if server changed (to avoid showing stale DC prices when switching to server)
      if (lastFetchedItemIdsRef.current && lastFetchedItemIdsRef.current !== cacheKey) {
        const lastServerKey = lastFetchedItemIdsRef.current.split('|')[1];
        if (lastServerKey !== serverKey) {
          setItemVelocities({});
          setItemAveragePrices({});
          setItemMinListings({});
          setItemRecentPurchases({});
          setItemTradability({});
        }
      }
      
      // Skip if already fetching or if items and server haven't changed
      if (velocityFetchInProgressRef.current || lastFetchedItemIdsRef.current === cacheKey) {
        return;
      }

      // Set fetch in progress flag FIRST to prevent early returns
      velocityFetchInProgressRef.current = true;
      setVelocityFetchInProgress(true);

      // Create new abort controller and request ID
      const currentRequestId = ++velocityFetchRequestIdRef.current;
      velocityFetchAbortControllerRef.current = new AbortController();
      const abortSignal = velocityFetchAbortControllerRef.current.signal;

      const fetchData = async () => {
        setIsLoadingVelocities(true);
        // Initialize loading progress: total = all items to load
        setVelocityLoadingProgress({ loaded: 0, total: sortedItemIds.length });
        try {
          // Determine if we're querying DC or world
          const isDCQuery = selectedServerOption === selectedWorld.section;
          // When world is selected, use world ID; when DC is selected, use DC name
          const queryTarget = isDCQuery 
            ? selectedWorld.section  // DC name
            : selectedServerOption;   // World ID (number)
          
          // Progressive batch sizes: 20, then 50, then 100 per batch
          // Process each batch in a separate async function to break React's batching
          const processBatch = async (batchNumber, startIndex) => {
            // Check if request was cancelled or superseded
            if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
              return;
            }
            
            // Determine batch size: first batch = 20, second batch = 50, rest = 100
            let batchSize;
            if (batchNumber === 0) {
              batchSize = 20; // First batch: 20 items for fast initial display
            } else if (batchNumber === 1) {
              batchSize = 50; // Second batch: 50 items
            } else {
              batchSize = 100; // Remaining batches: 100 items each
            }
            
            const batch = sortedItemIds.slice(startIndex, startIndex + batchSize);
            if (batch.length === 0) {
              return;
            }
            
            // Update loading progress: mark this batch as requested (before sending request)
            if (!abortSignal.aborted && currentRequestId === velocityFetchRequestIdRef.current) {
              setVelocityLoadingProgress(prev => ({
                loaded: Math.min(prev.loaded + batch.length, prev.total),
                total: prev.total
              }));
            }
            
            const itemIdsString = batch.join(',');
            
            try {
              const response = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`, {
                signal: abortSignal
              });
              
              // Check again after fetch
              if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
                return;
              }
              
              const data = await response.json();
              
              // Process batch results (same logic as App.jsx)
              const batchVelocities = {};
              const batchAveragePrices = {};
              const batchMinListings = {};
              const batchRecentPurchases = {};
              const batchTradability = {};
              
              if (data && data.results) {
                data.results.forEach(item => {
                  const itemId = item.itemId;
                  
                  // Helper function to get value - when querying a specific server (!isDCQuery), only use world data, don't fallback to DC
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

                  // For average price, always fallback to DC data if world data doesn't exist (even when server is selected)
                  let averagePrice = null;
                  if (!isDCQuery) {
                    // When server is selected, try world first, then fallback to DC
                    const nqWorld = item.nq?.averageSalePrice?.world?.price;
                    const hqWorld = item.hq?.averageSalePrice?.world?.price;
                    const nqDc = item.nq?.averageSalePrice?.dc?.price;
                    const hqDc = item.hq?.averageSalePrice?.dc?.price;
                    
                    const nqValue = nqWorld !== undefined ? nqWorld : nqDc;
                    const hqValue = hqWorld !== undefined ? hqWorld : hqDc;
                    
                    if (nqValue !== undefined && hqValue !== undefined) {
                      averagePrice = Math.min(nqValue, hqValue);
                    } else if (hqValue !== undefined) {
                      averagePrice = hqValue;
                    } else if (nqValue !== undefined) {
                      averagePrice = nqValue;
                    }
                  } else {
                    // When DC is selected, use DC data
                    averagePrice = getValue(
                      item.nq?.averageSalePrice,
                      item.hq?.averageSalePrice,
                      'price'
                    );
                  }

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
                      
                      // Only store minListing if world data actually exists
                      if (selectedData !== null) {
                        // Extract region if available
                        const region = selectedData?.region;
                        minListing = { price: minListingPrice };
                        if (region !== undefined) {
                          minListing.region = region;
                        }
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
                      
                      // Only store recentPurchase if world data actually exists
                      if (selectedData !== null) {
                        // Extract region if available
                        const region = selectedData?.region;
                        recentPurchase = { price: recentPurchasePrice };
                        if (region !== undefined) {
                          recentPurchase.region = region;
                        }
                      }
                    } else {
                      // When DC is selected, just store the price
                      recentPurchase = recentPurchasePrice;
                    }
                  }
                  
                  if (velocity !== null && velocity !== undefined) {
                    batchVelocities[itemId] = velocity;
                  }
                  if (averagePrice !== null && averagePrice !== undefined) {
                    batchAveragePrices[itemId] = Math.round(averagePrice);
                  }
                  if (minListing !== null && minListing !== undefined) {
                    batchMinListings[itemId] = minListing;
                  }
                  if (recentPurchase !== null && recentPurchase !== undefined) {
                    batchRecentPurchases[itemId] = recentPurchase;
                  }
                  batchTradability[itemId] = true;
                });
              }
              
              // Items not in results are non-tradable
              batch.forEach(itemId => {
                if (!batchTradability.hasOwnProperty(itemId)) {
                  batchTradability[itemId] = false;
                }
              });
              
              // Update state immediately after each batch (progressive rendering)
              // Use flushSync to force immediate synchronous rendering, breaking React's batching
              if (!abortSignal.aborted && currentRequestId === velocityFetchRequestIdRef.current) {
                flushSync(() => {
                  // Merge new batch data with existing state
                  setItemVelocities(prev => ({ ...prev, ...batchVelocities }));
                  setItemAveragePrices(prev => ({ ...prev, ...batchAveragePrices }));
                  setItemMinListings(prev => ({ ...prev, ...batchMinListings }));
                  setItemRecentPurchases(prev => ({ ...prev, ...batchRecentPurchases }));
                  setItemTradability(prev => ({ ...prev, ...batchTradability }));
                });
                
                // Set loading to false after first batch completes to show immediate feedback
                // Subsequent batches will continue loading in background
                if (batchNumber === 0) {
                  setIsLoadingVelocities(false);
                }
              }
            } catch (error) {
              // Ignore abort errors
              if (error.name === 'AbortError' || abortSignal.aborted) {
                return;
              }
              console.error('Error fetching market data:', error);
              // Mark batch items as non-tradable on error
              const batchTradability = {};
              batch.forEach(itemId => {
                batchTradability[itemId] = false;
              });
              // Update state even on error to mark items as non-tradable
              if (!abortSignal.aborted && currentRequestId === velocityFetchRequestIdRef.current) {
                flushSync(() => {
                  setItemTradability(prev => ({ ...prev, ...batchTradability }));
                });
              }
            }
          };
          
          // Process batches recursively, scheduling each in separate event loop tick
          const processBatchesRecursively = async (batchNumber, startIndex) => {
            // Check if request was cancelled or superseded
            if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
              return;
            }
            
            if (startIndex >= sortedItemIds.length) {
              // All batches processed
              velocityFetchInProgressRef.current = false;
              setVelocityFetchInProgress(false);
              lastFetchedItemIdsRef.current = cacheKey;
              return;
            }
            
            // Determine batch size
            let batchSize;
            if (batchNumber === 0) {
              batchSize = 20;
            } else if (batchNumber === 1) {
              batchSize = 50;
            } else {
              batchSize = 100;
            }
            
            // Process this batch
            await processBatch(batchNumber, startIndex);
            
            // Check if we should continue
            if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
              return;
            }
            
            const nextIndex = startIndex + batchSize;
            
            // Schedule next batch in next event loop tick to break React batching
            if (nextIndex < sortedItemIds.length) {
              // Use setTimeout to ensure next batch runs in separate event loop tick
              // No delay for first batch (render immediately), small delay for others to allow browser to paint
              await new Promise(resolve => {
                setTimeout(() => {
                  processBatchesRecursively(batchNumber + 1, nextIndex).then(resolve);
                }, batchNumber === 0 ? 0 : 100); // No delay for first batch, 100ms for others
              });
            } else {
              // All batches processed
              velocityFetchInProgressRef.current = false;
              setVelocityFetchInProgress(false);
              lastFetchedItemIdsRef.current = cacheKey;
            }
          };
          
          // Start processing batches
          await processBatchesRecursively(0, 0);
        } catch (error) {
          // Ignore abort errors
          if (error.name === 'AbortError' || abortSignal.aborted) {
            return;
          }
          console.error('Error in fetchData:', error);
          velocityFetchInProgressRef.current = false;
          setVelocityFetchInProgress(false);
          setIsLoadingVelocities(false);
          setVelocityLoadingProgress({ loaded: 0, total: 0 });
        }
      };
      
      // Start fetching data
      fetchData();
    })();
  }, [searchResults, untradeableResults, showUntradeable, selectedServerOption, selectedWorld, loadIlvlsData]);

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
        activePage="advanced-search"
        onTaxRatesClick={onTaxRatesClick}
        onAdvancedSearchClick={() => {
          setSearchText('');
          navigate('/advanced-search');
        }}
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
        }}
        onCraftingInspirationClick={() => {
          setSearchText('');
          navigate('/crafting-inspiration');
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
              進階搜尋
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              批量搜尋多個物品的市場價格，或使用篩選條件進行搜尋。
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 flex gap-2 border-b border-purple-500/30">
            <button
              onClick={() => {
                setActiveTab('filter');
                // Clear batch input when switching to filter tab
                setBatchInput('');
                setTooManyItemsWarning(null);
                // Reset level range to default
                setMinLevel(1);
                setMaxLevel(999);
                // Reset item name filter
                setItemNameFilter('');
                // Reset untradeable display state
                setShowUntradeable(false);
                // Clear all search results and market data
                setSearchResults([]);
                setUntradeableResults([]);
                setItemVelocities({});
                setItemAveragePrices({});
                setItemMinListings({});
                setItemRecentPurchases({});
                setItemTradability({});
                setCurrentPage(1);
                // Cancel any ongoing requests
                if (velocityFetchAbortControllerRef.current) {
                  velocityFetchAbortControllerRef.current.abort();
                }
                setIsLoadingVelocities(false);
              }}
              className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                activeTab === 'filter'
                  ? 'text-ffxiv-gold border-ffxiv-gold'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              篩選搜尋
            </button>
            <div 
              className="relative"
              title={BATCH_SEARCH_DISABLED ? "敬请期待" : ""}
            >
              <button
                onClick={() => {
                  // Batch search is disabled
                  if (BATCH_SEARCH_DISABLED) {
                    return;
                  }
                  setActiveTab('batch');
                  // Clear filter selections when switching to batch tab
                  setSelectedJobs([]);
                  setSelectedCategories([]);
                  setTooManyItemsWarning(null);
                  // Reset level range to default
                  setMinLevel(1);
                  setMaxLevel(999);
                  // Reset item name filter
                  setItemNameFilter('');
                  // Reset untradeable display state
                  setShowUntradeable(false);
                  setUntradeableResults([]);
                  // Clear all search results and market data
                  setSearchResults([]);
                  setItemVelocities({});
                  setItemAveragePrices({});
                  setItemMinListings({});
                  setItemRecentPurchases({});
                  setItemTradability({});
                  setCurrentPage(1);
                  // Cancel any ongoing requests
                  if (velocityFetchAbortControllerRef.current) {
                    velocityFetchAbortControllerRef.current.abort();
                  }
                  setIsLoadingVelocities(false);
                }}
                disabled={BATCH_SEARCH_DISABLED}
                className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                  BATCH_SEARCH_DISABLED
                    ? 'text-gray-500 border-transparent cursor-not-allowed opacity-50'
                    : activeTab === 'batch'
                      ? 'text-ffxiv-gold border-ffxiv-gold'
                      : 'text-gray-400 border-transparent hover:text-gray-300'
                }`}
              >
                批量搜尋（開發中）
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'batch' && !BATCH_SEARCH_DISABLED && (
            <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6 mb-6">
              {/* Batch Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
                  物品名稱列表（每行一個或逗號分隔）
                </label>
                <textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="輸入物品名稱，例如：&#10;精金錠&#10;秘銀錠&#10;山銅錠&#10;或：精金錠, 秘銀錠, 山銅錠"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold min-h-[200px] text-sm"
                />
                <div className="mt-2 text-xs text-gray-400">
                  一次最多可搜尋100個物品名稱（支援繁體/簡體中文）
                </div>
              </div>

              {/* Exact Search Toggle */}
              <div className="mb-6">
                <label className="flex items-center cursor-pointer group" title={!batchFuzzySearch ? "關閉精確搜尋" : "開啟精確搜尋"}>
                  <input
                    type="checkbox"
                    checked={!batchFuzzySearch}
                    onChange={(e) => setBatchFuzzySearch(!e.target.checked)}
                    disabled={isBatchSearching || isSearching}
                    className="sr-only"
                  />
                  <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                    isBatchSearching || isSearching
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    !batchFuzzySearch
                      ? 'bg-ffxiv-gold/80'
                      : 'bg-slate-600/60'
                  }`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      !batchFuzzySearch ? 'translate-x-4' : 'translate-x-0'
                    }`}></div>
                  </div>
                  <span className={`ml-2 text-sm whitespace-nowrap select-none ${
                    isBatchSearching || isSearching
                      ? 'text-gray-500'
                      : !batchFuzzySearch
                        ? 'text-ffxiv-gold'
                        : 'text-gray-300'
                  }`}>
                    精確搜尋
                  </span>
                </label>
              </div>

              {/* Server Selector */}
              {selectedWorld && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
                    伺服器選擇
                  </label>
                  <ServerSelector
                    datacenters={datacenters}
                    worlds={worlds}
                    selectedWorld={selectedWorld}
                    onWorldChange={onWorldChange}
                    selectedServerOption={selectedServerOption}
                    onServerOptionChange={onServerOptionChange}
                    serverOptions={serverOptions}
                    disabled={isLoadingVelocities}
                  />
                </div>
              )}

              {/* Search Button */}
              <button
                onClick={() => handleBatchSearch()}
                disabled={isBatchSearching || isSearching || isSearchButtonDisabled || !batchInput.trim() || BATCH_SEARCH_DISABLED}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  isBatchSearching || isSearching || !batchInput.trim() || BATCH_SEARCH_DISABLED
                    ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
                }`}
              >
                {isBatchSearching || isSearching ? '搜索中...' : '搜索'}
              </button>
            </div>
          )}

          {activeTab === 'filter' && (
            <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6 mb-6">
              {/* Bug Report Notice */}
              <div className="bg-slate-700/80 border border-slate-500/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-200 leading-relaxed">
                  這個頁面測試量過於龐大，作者個人時間有限。各位使用大大有發現bug歡迎參考主頁上的巴哈或dc方式回報，感激感激
                </p>
              </div>

              {/* Job Icons and Categories Selection - Side by Side, Height Determined by Crafting Jobs */}
              <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Job Icons Selection - Left Side */}
                <div>
                  <label className="block text-sm font-semibold text-ffxiv-gold mb-4">
                    選擇職業
                  </label>
                  
                  {/* 戰鬥職業 - 4 rows, all left-aligned */}
                  <div className="space-y-[0.86821875rem]">
                    {/* Row 1: Tanks and Healers */}
                    <div className="flex flex-wrap gap-2">
                      {battleJobsByRole.tank.map(job => {
                        const isSelected = selectedJobs.includes(job.id);
                        return (
                          <button
                            key={job.id}
                            onClick={() => handleJobToggle(job.id)}
                            title={job.name}
                            className={`p-2 rounded-lg border transition-all relative ${
                              isSelected
                                ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                            }`}
                          >
                            <img 
                              src={job.iconUrl} 
                              alt={job.name}
                              className="w-8 h-8 object-contain relative z-10"
                            />
                          </button>
                        );
                      })}
                      {battleJobsByRole.tank.length > 0 && battleJobsByRole.healer.length > 0 && (
                        <div className="w-px h-8 bg-purple-500/20 mx-1"></div>
                      )}
                      {battleJobsByRole.healer.map(job => {
                        const isSelected = selectedJobs.includes(job.id);
                        return (
                          <button
                            key={job.id}
                            onClick={() => handleJobToggle(job.id)}
                            title={job.name}
                            className={`p-2 rounded-lg border transition-all relative ${
                              isSelected
                                ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                            }`}
                          >
                            <img 
                              src={job.iconUrl} 
                              alt={job.name}
                              className="w-8 h-8 object-contain relative z-10"
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 2: Melee and Ranged Physical */}
                    <div className="flex flex-wrap gap-2 pt-[0.5788125rem] border-t border-purple-500/10">
                      {battleJobsByRole.melee.map(job => {
                        const isSelected = selectedJobs.includes(job.id);
                        return (
                          <button
                            key={job.id}
                            onClick={() => handleJobToggle(job.id)}
                            title={job.name}
                            className={`p-2 rounded-lg border transition-all relative ${
                              isSelected
                                ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                            }`}
                          >
                            <img 
                              src={job.iconUrl} 
                              alt={job.name}
                              className="w-8 h-8 object-contain relative z-10"
                            />
                          </button>
                        );
                      })}
                      {battleJobsByRole.melee.length > 0 && battleJobsByRole.ranged.length > 0 && (
                        <div className="w-px h-8 bg-purple-500/20 mx-1"></div>
                      )}
                      {battleJobsByRole.ranged.map(job => {
                        const isSelected = selectedJobs.includes(job.id);
                        return (
                          <button
                            key={job.id}
                            onClick={() => handleJobToggle(job.id)}
                            title={job.name}
                            className={`p-2 rounded-lg border transition-all relative ${
                              isSelected
                                ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                            }`}
                          >
                            <img 
                              src={job.iconUrl} 
                              alt={job.name}
                              className="w-8 h-8 object-contain relative z-10"
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 3: Magical DPS and Gathering Jobs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-[0.5788125rem] border-t border-purple-500/10">
                      {/* Magical DPS */}
                      {battleJobsByRole.caster.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {battleJobsByRole.caster.map(job => {
                            const isSelected = selectedJobs.includes(job.id);
                            return (
                              <button
                                key={job.id}
                                onClick={() => handleJobToggle(job.id)}
                                title={job.name}
                                className={`p-2 rounded-lg border transition-all relative ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                    : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                                }`}
                              >
                                <img 
                                  src={job.iconUrl} 
                                  alt={job.name}
                                  className="w-8 h-8 object-contain relative z-10"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Gathering Jobs */}
                      <div className="flex flex-wrap gap-2">
                        {gatheringJobs.map(job => {
                          const isSelected = selectedJobs.includes(job.id);
                          return (
                            <button
                              key={job.id}
                              onClick={() => handleJobToggle(job.id)}
                              title={job.name}
                              className={`p-2 rounded-lg border transition-all relative ${
                                isSelected
                                  ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                  : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                              }`}
                            >
                              <img
                                src={job.iconUrl} 
                                alt={job.name}
                                className="w-8 h-8 object-contain relative z-10"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 4: Crafting Jobs */}
                    <div className="flex flex-wrap gap-2 pt-[0.5788125rem] border-t border-purple-500/20">
                      {craftingJobs.map(job => {
                        const isSelected = selectedJobs.includes(job.id);
                        return (
                          <button
                            key={job.id}
                            onClick={() => handleJobToggle(job.id)}
                            title={job.name}
                            className={`p-2 rounded-lg border transition-all relative ${
                              isSelected
                                ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                : `${getJobRoleBgColor(job.role)} border-purple-500/30 hover:border-purple-500/50`
                            }`}
                          >
                            <img 
                              src={job.iconUrl} 
                              alt={job.name}
                              className="w-8 h-8 object-contain relative z-10"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedJobs.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      已選擇 {selectedJobs.length} 個職業
                    </div>
                  )}
                </div>

                {/* Item Categories Selection - Right Side */}
                <div className="flex flex-col">
                  <label className="block text-sm font-semibold text-ffxiv-gold mb-4">
                    選擇物品分類
                  </label>
                  <div className="border border-purple-500/30 rounded-lg p-3 bg-slate-900/30 h-[290px] flex flex-col">
                    {/* Category Search Bar - Inside the box */}
                    <div className="mb-3 flex-shrink-0">
                      <div className="relative">
                        <div className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 z-10">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <input
                          ref={categorySearchInputRef}
                          type="text"
                          value={categorySearchTerm}
                          onChange={(e) => setCategorySearchTerm(e.target.value)}
                          placeholder="篩選搜尋分類"
                          className="w-full pl-9 pr-3 py-2 bg-slate-800/60 backdrop-blur-sm border border-purple-500/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:border-ffxiv-gold focus:ring-ffxiv-gold/50 transition-all text-xs"
                        />
                        {categorySearchTerm && (
                          <button
                            onClick={() => setCategorySearchTerm('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            title="清除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div 
                      ref={categoryScrollContainerRef}
                      className={`flex-1 ${shouldDisableCategoryScrollState ? 'overflow-hidden' : 'overflow-y-auto'}`}
                    >
                      <div className="space-y-3">
                      {/* Equipment Categories Section */}
                      {([...filteredItemCategories.weapons, ...filteredItemCategories.armor, ...filteredItemCategories.otherEquipment, ...filteredItemCategories.accessories].length > 0) && (
                      <div>
                        <div className="text-xs font-semibold text-ffxiv-gold mb-2 px-1">裝備類</div>
                        
                        {/* First row: 主手、副手、其他裝備 */}
                        {([...filteredItemCategories.weapons, ...filteredItemCategories.armor, ...filteredItemCategories.otherEquipment].length > 0) && (
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          {[...filteredItemCategories.weapons, ...filteredItemCategories.armor, ...filteredItemCategories.otherEquipment].map(category => {
                            const categoryId = typeof category.id === 'string' ? category.id : category.id.toString();
                            const isSelected = selectedCategories.some(selectedId => {
                              const selectedIdStr = typeof selectedId === 'string' ? selectedId : selectedId.toString();
                              return selectedIdStr === categoryId;
                            });
                            const isDisabled = isCategoryDisabled(category.id);
                            return (
                              <button
                                key={category.id}
                                onClick={() => !isDisabled && handleCategoryToggle(category.id)}
                                disabled={isDisabled}
                                className={`px-2 py-1.5 rounded text-xs transition-all text-center ${
                                  isDisabled
                                    ? 'bg-slate-900/30 border border-slate-700/30 text-gray-600 cursor-not-allowed opacity-40'
                                    : isSelected
                                    ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border border-ffxiv-gold text-ffxiv-gold'
                                    : 'bg-slate-800/50 border border-purple-500/20 text-gray-300 hover:border-purple-500/40'
                                }`}
                              >
                                {category.name}
                              </button>
                            );
                          })}
                        </div>
                        )}
                        
                        {/* Second row: 飾品類 */}
                        {filteredItemCategories.accessories.length > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          {filteredItemCategories.accessories.map(category => {
                            const categoryId = typeof category.id === 'string' ? category.id : category.id.toString();
                            const isSelected = selectedCategories.some(selectedId => {
                              const selectedIdStr = typeof selectedId === 'string' ? selectedId : selectedId.toString();
                              return selectedIdStr === categoryId;
                            });
                            const isDisabled = isCategoryDisabled(category.id);
                            return (
                              <button
                                key={category.id}
                                onClick={() => !isDisabled && handleCategoryToggle(category.id)}
                                disabled={isDisabled}
                                className={`px-2 py-1.5 rounded text-xs transition-all text-center ${
                                  isDisabled
                                    ? 'bg-slate-900/30 border border-slate-700/30 text-gray-600 cursor-not-allowed opacity-40'
                                    : isSelected
                                    ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border border-ffxiv-gold text-ffxiv-gold'
                                    : 'bg-slate-800/50 border border-purple-500/20 text-gray-300 hover:border-purple-500/40'
                                }`}
                              >
                                {category.name}
                              </button>
                            );
                          })}
                        </div>
                        )}
                      </div>
                      )}
                      
                      {/* Separator - only show if both sections have content */}
                      {([...filteredItemCategories.weapons, ...filteredItemCategories.armor, ...filteredItemCategories.otherEquipment, ...filteredItemCategories.accessories].length > 0) && 
                       filteredItemCategories.miscellaneous.length > 0 && (
                      <div className="border-t border-purple-500/30 my-2"></div>
                      )}
                      
                      {/* Miscellaneous Categories Section */}
                      {filteredItemCategories.miscellaneous.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-400 mb-2 px-1">雜物類</div>
                        <div className="grid grid-cols-4 gap-2">
                          {filteredItemCategories.miscellaneous.map(category => {
                            // Handle both string IDs (generic categories) and number IDs
                            const categoryId = typeof category.id === 'string' ? category.id : category.id.toString();
                            const isSelected = selectedCategories.some(selectedId => {
                              const selectedIdStr = typeof selectedId === 'string' ? selectedId : selectedId.toString();
                              return selectedIdStr === categoryId;
                            });
                            const isDisabled = isCategoryDisabled(category.id);
                            return (
                              <button
                                key={category.id}
                                onClick={() => !isDisabled && handleCategoryToggle(category.id)}
                                disabled={isDisabled}
                                className={`px-2 py-1.5 rounded text-xs transition-all text-center ${
                                  isDisabled
                                    ? 'bg-slate-900/30 border border-slate-700/30 text-gray-600 cursor-not-allowed opacity-40'
                                    : isSelected
                                    ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border border-ffxiv-gold text-ffxiv-gold'
                                    : 'bg-slate-800/50 border border-purple-500/20 text-gray-300 hover:border-purple-500/40'
                                }`}
                              >
                                {category.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      )}
                      
                      {/* Empty state when no categories match search */}
                      {categorySearchTerm.trim() && 
                       filteredItemCategories.weapons.length === 0 &&
                       filteredItemCategories.armor.length === 0 &&
                       filteredItemCategories.accessories.length === 0 &&
                       filteredItemCategories.otherEquipment.length === 0 &&
                       filteredItemCategories.miscellaneous.length === 0 && (
                        <div className="py-8 text-center">
                          <div className="text-sm text-gray-400">
                            沒有找到匹配「{categorySearchTerm}」的分類
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      已選擇 {selectedCategories.length} 個分類
                    </div>
                  )}
                  <div className="mt-2 text-xs text-yellow-400">
                  </div>
                </div>
              </div>

              {/* Too Many Items Warning */}
              {tooManyItemsWarning && (
                <div className="mb-4 p-4 bg-yellow-900/40 border-2 border-yellow-500/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div className="flex-1">
                      <h3 className="text-yellow-400 font-semibold mb-2">
                        找到的物品過多
                      </h3>
                      <p className="text-sm text-gray-300 mb-3">
                        找到 <span className="text-yellow-400 font-bold">{tooManyItemsWarning.total}</span> 個可交易物品，
                        超過建議上限 <span className="text-yellow-400 font-bold">{tooManyItemsWarning.limit}</span> 個。
                        處理過多物品可能會導致搜索時間過長或性能問題。
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={async () => {
                            // Cancel any ongoing search requests
                            const continueSearchRequestId = ++filterSearchRequestIdRef.current;
                            
                            // Cancel all ongoing market data fetches
                            if (velocityFetchAbortControllerRef.current) {
                              velocityFetchAbortControllerRef.current.abort();
                              velocityFetchAbortControllerRef.current = null;
                            }
                            
                            // Increment velocity fetch request ID to cancel any ongoing market data requests
                            velocityFetchRequestIdRef.current++;
                            velocityFetchInProgressRef.current = false;
                            setVelocityFetchInProgress(false);
                            setIsLoadingVelocities(false);

                            setTooManyItemsWarning(null);
                            setIsFilterSearching(true);
                            setIsSearchButtonDisabled(false); // Clear disabled state for continue search
                            setSearchResults([]);
                            setUntradeableResults([]);
                            setShowUntradeable(false);
                            setItemVelocities({});
                            setItemAveragePrices({});
                            setItemMinListings({});
                            setItemRecentPurchases({});
                            setItemTradability({});
                            setSelectedRarities([]); // Reset rarity filter on continue search

                            // Disable search button for 1.5 seconds
                            setIsSearchButtonDisabled(true);
                            setTimeout(() => {
                              setIsSearchButtonDisabled(false);
                            }, 1500);

                            try {
                              // Use shared filter search logic with skipLimitCheck=true
                              // This allows continuing search even when over limit (user already confirmed)
                              const result = await performFilterSearchLogic(true);
                              
                              // Check if this request was superseded
                              if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                setIsFilterSearching(false);
                                return;
                              }
                              
                              if (!result) {
                                setIsFilterSearching(false);
                                return; // Error already handled in performFilterSearchLogic
                              }

                              let { tradeableItemIds, untradeableItemIds, marketableSet } = result;
                              
                              // Check if this request was superseded
                              if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                setIsFilterSearching(false);
                                return;
                              }

                              // CRITICAL: Use marketableSet from performFilterSearchLogic (already queried with targeted query)
                              // This avoids unnecessary full table query
                              setMarketableItems(marketableSet);
                              
                              // CRITICAL: Double-check that tradeableItemIds only contains tradeable items
                              // This matches handleBatchSearch behavior - filter BEFORE setting searchResults
                              const verifiedTradeableItemIds = tradeableItemIds.filter(id => marketableSet.has(id));

                              // Limit to MAX_ITEMS_LIMIT (this is the "continue search" path)
                              // Use verifiedTradeableItemIds instead of tradeableItemIds
                              const limitedTradeableItemIds = verifiedTradeableItemIds.slice(0, MAX_ITEMS_LIMIT);
                              addToast(`已限制為前 ${limitedTradeableItemIds.length} 個物品，正在獲取市場數據...`, 'warning');

                              // Load ilvls data for sorting - use targeted query for these specific items
                              const allItemIdsForSortContinue = [...limitedTradeableItemIds, ...untradeableItemIds];
                              const ilvlsData = await loadIlvlsData(allItemIdsForSortContinue);
                              
                              // Check again if this request was superseded
                              if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                setIsFilterSearching(false);
                                return;
                              }

                              // Use the same unified progressive loading function as handleFilterSearch
                              // This ensures consistent behavior for both <500 and >500 items
                              // The only difference is the input: limitedTradeableItemIds (limited to MAX_ITEMS_LIMIT)
                              const loadItemsProgressively = async (itemIds, isTradeable) => {
                                // Check if this search request was superseded
                                if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                  return;
                                }
                                
                                // Use ilvlsData (already loaded above)
                                const ilvlsDataForSort = ilvlsData;
                                
                                // CRITICAL: For tradeable items, itemIds should already be filtered
                                const filteredItemIds = isTradeable 
                                  ? itemIds.filter(id => marketableSet.has(id))
                                  : itemIds;
                                
                                const sortedItemIds = [...filteredItemIds].sort((a, b) => {
                                  const aIlvl = ilvlsDataForSort[a?.toString()] || null;
                                  const bIlvl = ilvlsDataForSort[b?.toString()] || null;
                                  
                                  if (aIlvl !== null && bIlvl !== null) {
                                    return bIlvl - aIlvl;
                                  }
                                  if (aIlvl !== null) return -1;
                                  if (bIlvl !== null) return 1;
                                  return b - a;
                                });

                                // Load first batch (20 items) - load full data BEFORE displaying to prevent jumping
                                const INITIAL_BATCH_SIZE = 20;
                                const initialBatch = sortedItemIds.slice(0, INITIAL_BATCH_SIZE);
                                
                                const verifiedInitialBatch = isTradeable 
                                  ? initialBatch.filter(id => marketableSet.has(id))
                                  : initialBatch;
                                
                                // Load full item details synchronously for initial batch BEFORE displaying
                                // This prevents multiple re-renders and data jumping
                                // Use batch query instead of individual queries (optimized)
                                const { getTwItemsByIds } = await import('../services/supabaseData');
                                const itemsData = await getTwItemsByIds(verifiedInitialBatch);
                                const initialItems = verifiedInitialBatch.map(id => {
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
                                
                                // Check if search was cancelled or superseded
                                if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                  return;
                                }
                                
                                // CRITICAL: Filter items using marketableSet to ensure only tradeable items
                                const filteredInitialItems = isTradeable
                                  ? initialItems.filter(item => marketableSet.has(item.id))
                                  : initialItems;
                                
                                const initialItemsSorted = filteredInitialItems.sort((a, b) => {
                                  const aIlvl = ilvlsDataForSort[a.id?.toString()] || null;
                                  const bIlvl = ilvlsDataForSort[b.id?.toString()] || null;
                                  
                                  if (aIlvl !== null && bIlvl !== null) {
                                    return bIlvl - aIlvl;
                                  }
                                  if (aIlvl !== null) return -1;
                                  if (bIlvl !== null) return 1;
                                  return b.id - a.id;
                                });
                                
                                // Load rarities for these items (for rarity filter)
                                const itemIdsForRaritiesContinue = initialItemsSorted.map(item => item.id);
                                const raritiesForItemsContinue = await loadRaritiesData(itemIdsForRaritiesContinue);
                                
                                // Check again before updating state
                                if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                  return;
                                }
                                
                                // Update rarities state
                                setRaritiesData(prev => ({ ...prev, ...raritiesForItemsContinue }));
                                
                                // Display initial batch with full item details (only once, no jumping)
                                if (isTradeable) {
                                  setSearchResults([]);
                                  setShowUntradeable(false);
                                  flushSync(() => {
                                    setSearchResults(initialItemsSorted);
                                  });
                                } else {
                                  // For untradeable items, use the same initialBatch
                                // Use batch query instead of individual queries (optimized)
                                const { getTwItemsByIds: getTwItemsByIdsUntradeable } = await import('../services/supabaseData');
                                const untradeableItemsData = await getTwItemsByIdsUntradeable(initialBatch);
                                const untradeableInitialItems = initialBatch.map(id => {
                                  const itemData = untradeableItemsData[id];
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
                                  
                                  // Check if search was cancelled or superseded
                                  if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                    return;
                                  }
                                  
                                  const untradeableInitialItemsSorted = untradeableInitialItems.sort((a, b) => {
                                    const aIlvl = ilvlsDataForSort[a.id?.toString()] || null;
                                    const bIlvl = ilvlsDataForSort[b.id?.toString()] || null;
                                    
                                    if (aIlvl !== null && bIlvl !== null) {
                                      return bIlvl - aIlvl;
                                    }
                                    if (aIlvl !== null) return -1;
                                    if (bIlvl !== null) return 1;
                                    return b.id - a.id;
                                  });
                                  
                                  // Check again before updating state
                                  if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                    return;
                                  }
                                  
                                  // Display untradeable results with full details (only once, no jumping)
                                  setUntradeableResults([]);
                                  flushSync(() => {
                                    setUntradeableResults(untradeableInitialItemsSorted);
                                  });
                                  
                                  // Mark all untradeable items as non-tradable in itemTradability
                                  // This ensures ItemTable can properly display ilvl, version, and tradability columns
                                  const untradeableTradabilityContinue = {};
                                  untradeableInitialItemsSorted.forEach(item => {
                                    untradeableTradabilityContinue[item.id] = false;
                                  });
                                  setItemTradability(prev => ({ ...prev, ...untradeableTradabilityContinue }));
                                }

                                // Start loading market data immediately (non-blocking)
                                if (selectedWorld && selectedServerOption && sortedItemIds.length > 0 && isTradeable) {
                                  if (velocityFetchAbortControllerRef.current) {
                                    velocityFetchAbortControllerRef.current.abort();
                                  }

                                  const marketDataRequestId = ++velocityFetchRequestIdRef.current;
                                  velocityFetchAbortControllerRef.current = new AbortController();
                                  const abortSignal = velocityFetchAbortControllerRef.current.signal;
                                  velocityFetchInProgressRef.current = true;
                                  setVelocityFetchInProgress(true);
                                  setIsLoadingVelocities(true);

                                  // Start market data fetch in background (non-blocking)
                                  (async () => {
                                    const isDCQuery = selectedServerOption === selectedWorld.section;
                                    const queryTarget = isDCQuery ? selectedWorld.section : selectedServerOption;
                                    
                                    // Helper function to get value from market data
                                    const getValue = (nqData, hqData, field) => {
                                      const nqWorld = nqData?.world?.[field];
                                      const hqWorld = hqData?.world?.[field];
                                      const nqDc = nqData?.dc?.[field];
                                      const hqDc = hqData?.dc?.[field];
                                      const nqValue = isDCQuery ? (nqDc !== undefined ? nqDc : nqWorld) : (nqWorld !== undefined ? nqWorld : undefined);
                                      const hqValue = isDCQuery ? (hqDc !== undefined ? hqDc : hqWorld) : (hqWorld !== undefined ? hqWorld : undefined);
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

                                    // Process a single batch of market data
                                    const processMarketBatch = async (batchNumber, startIndex) => {
                                      // Check if search was cancelled or superseded
                                      if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                        return;
                                      }
                                      
                                      let batchSize;
                                      if (batchNumber === 0) {
                                        batchSize = 20;
                                      } else if (batchNumber === 1) {
                                        batchSize = 50;
                                      } else {
                                        batchSize = 100;
                                      }
                                      
                                      const batch = sortedItemIds.slice(startIndex, startIndex + batchSize);
                                      if (batch.length === 0) {
                                        return;
                                      }
                                      
                                      const itemIdsString = batch.join(',');
                                      
                                      try {
                                        const response = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`, {
                                          signal: abortSignal
                                        });
                                        
                                        if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                          return;
                                        }
                                        
                                        const data = await response.json();
                                        
                                        if (data && data.results) {
                                          const batchVelocities = {};
                                          const batchAveragePrices = {};
                                          const batchMinListings = {};
                                          const batchRecentPurchases = {};
                                          const batchTradability = {};
                                          
                                          data.results.forEach(item => {
                                            const itemId = item.itemId;
                                            
                                            const velocity = getValue(item.nq?.dailySaleVelocity, item.hq?.dailySaleVelocity, 'quantity');
                                            let averagePrice = null;
                                            if (!isDCQuery) {
                                              const nqWorld = item.nq?.averageSalePrice?.world?.price;
                                              const hqWorld = item.hq?.averageSalePrice?.world?.price;
                                              const nqDc = item.nq?.averageSalePrice?.dc?.price;
                                              const hqDc = item.hq?.averageSalePrice?.dc?.price;
                                              const nqValue = nqWorld !== undefined ? nqWorld : nqDc;
                                              const hqValue = hqWorld !== undefined ? hqWorld : hqDc;
                                              if (nqValue !== undefined && hqValue !== undefined) {
                                                averagePrice = Math.min(nqValue, hqValue);
                                              } else if (hqValue !== undefined) {
                                                averagePrice = hqValue;
                                              } else if (nqValue !== undefined) {
                                                averagePrice = nqValue;
                                              }
                                            } else {
                                              averagePrice = getValue(item.nq?.averageSalePrice, item.hq?.averageSalePrice, 'price');
                                            }
                                            
                                            const minListingPrice = getValue(item.nq?.minListing, item.hq?.minListing, 'price');
                                            const recentPurchasePrice = getValue(item.nq?.recentPurchase, item.hq?.recentPurchase, 'price');
                                            
                                            let minListing = null;
                                            if (minListingPrice !== null && minListingPrice !== undefined) {
                                              if (!isDCQuery) {
                                                const nqWorldPrice = item.nq?.minListing?.world?.price;
                                                const hqWorldPrice = item.hq?.minListing?.world?.price;
                                                let selectedData = null;
                                                if (nqWorldPrice !== undefined && hqWorldPrice !== undefined) {
                                                  selectedData = hqWorldPrice <= nqWorldPrice ? item.hq?.minListing?.world : item.nq?.minListing?.world;
                                                } else if (hqWorldPrice !== undefined) {
                                                  selectedData = item.hq?.minListing?.world;
                                                } else if (nqWorldPrice !== undefined) {
                                                  selectedData = item.nq?.minListing?.world;
                                                }
                                                if (selectedData !== null) {
                                                  const region = selectedData?.region;
                                                  minListing = { price: minListingPrice };
                                                  if (region !== undefined) {
                                                    minListing.region = region;
                                                  }
                                                }
                                              } else {
                                                minListing = minListingPrice;
                                              }
                                            }
                                            
                                            let recentPurchase = null;
                                            if (recentPurchasePrice !== null && recentPurchasePrice !== undefined) {
                                              if (!isDCQuery) {
                                                const nqWorldPrice = item.nq?.recentPurchase?.world?.price;
                                                const hqWorldPrice = item.hq?.recentPurchase?.world?.price;
                                                let selectedData = null;
                                                if (nqWorldPrice !== undefined && hqWorldPrice !== undefined) {
                                                  selectedData = hqWorldPrice <= nqWorldPrice ? item.hq?.recentPurchase?.world : item.nq?.recentPurchase?.world;
                                                } else if (hqWorldPrice !== undefined) {
                                                  selectedData = item.hq?.recentPurchase?.world;
                                                } else if (nqWorldPrice !== undefined) {
                                                  selectedData = item.nq?.recentPurchase?.world;
                                                }
                                                const region = selectedData?.region;
                                                recentPurchase = { price: recentPurchasePrice };
                                                if (region !== undefined) {
                                                  recentPurchase.region = region;
                                                }
                                              } else {
                                                recentPurchase = recentPurchasePrice;
                                              }
                                            }
                                            
                                            if (velocity !== null && velocity !== undefined) {
                                              batchVelocities[itemId] = velocity;
                                            }
                                            if (averagePrice !== null && averagePrice !== undefined) {
                                              batchAveragePrices[itemId] = Math.round(averagePrice);
                                            }
                                            if (minListing !== null && minListing !== undefined) {
                                              batchMinListings[itemId] = minListing;
                                            }
                                            if (recentPurchase !== null && recentPurchase !== undefined) {
                                              batchRecentPurchases[itemId] = recentPurchase;
                                            }
                                            batchTradability[itemId] = true;
                                          });
                                          
                                          batch.forEach(itemId => {
                                            if (!batchTradability.hasOwnProperty(itemId)) {
                                              batchTradability[itemId] = false;
                                            }
                                          });
                                          
                                          if (!abortSignal.aborted && marketDataRequestId === velocityFetchRequestIdRef.current && continueSearchRequestId === filterSearchRequestIdRef.current) {
                                            flushSync(() => {
                                              setItemVelocities(prev => ({ ...prev, ...batchVelocities }));
                                              setItemAveragePrices(prev => ({ ...prev, ...batchAveragePrices }));
                                              setItemMinListings(prev => ({ ...prev, ...batchMinListings }));
                                              setItemRecentPurchases(prev => ({ ...prev, ...batchRecentPurchases }));
                                              setItemTradability(prev => ({ ...prev, ...batchTradability }));
                                              // Update loading progress
                                              setVelocityLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + batch.length }));
                                            });
                                            
                                            if (batchNumber === 0) {
                                              setIsLoadingVelocities(false);
                                            }
                                          }
                                        }
                                      } catch (error) {
                                        if (error.name === 'AbortError' || abortSignal.aborted) {
                                          return;
                                        }
                                        console.error('Error fetching market data:', error);
                                        const batchTradability = {};
                                        batch.forEach(itemId => {
                                          batchTradability[itemId] = false;
                                        });
                                        if (!abortSignal.aborted && marketDataRequestId === velocityFetchRequestIdRef.current && continueSearchRequestId === filterSearchRequestIdRef.current) {
                                          flushSync(() => {
                                            setItemTradability(prev => ({ ...prev, ...batchTradability }));
                                          });
                                        }
                                      }
                                    };

                                    // Process batches recursively with non-blocking delays
                                    const processBatchesRecursively = async (batchNumber, startIndex) => {
                                      if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                        return;
                                      }
                                      
                                      if (startIndex >= sortedItemIds.length) {
                                        if (marketDataRequestId === velocityFetchRequestIdRef.current && continueSearchRequestId === filterSearchRequestIdRef.current && !abortSignal.aborted) {
                                          setIsLoadingVelocities(false);
                                          velocityFetchInProgressRef.current = false;
                                          setVelocityFetchInProgress(false);
                                          setVelocityLoadingProgress({ loaded: 0, total: 0 });
                                        }
                                        return;
                                      }
                                      
                                      await processMarketBatch(batchNumber, startIndex);
                                      
                                      if (abortSignal.aborted || marketDataRequestId !== velocityFetchRequestIdRef.current || continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                        return;
                                      }
                                      
                                      let batchSize;
                                      if (batchNumber === 0) {
                                        batchSize = 20;
                                      } else if (batchNumber === 1) {
                                        batchSize = 50;
                                      } else {
                                        batchSize = 100;
                                      }
                                      
                                      const nextIndex = startIndex + batchSize;
                                      
                                      if (nextIndex < sortedItemIds.length) {
                                        await new Promise(resolve => {
                                          setTimeout(() => {
                                            processBatchesRecursively(batchNumber + 1, nextIndex).then(resolve);
                                          }, batchNumber === 0 ? 0 : 100);
                                        });
                                      } else {
                                        if (marketDataRequestId === velocityFetchRequestIdRef.current && continueSearchRequestId === filterSearchRequestIdRef.current && !abortSignal.aborted) {
                                          setIsLoadingVelocities(false);
                                          velocityFetchInProgressRef.current = false;
                                          setVelocityFetchInProgress(false);
                                          setVelocityLoadingProgress({ loaded: 0, total: 0 });
                                        }
                                      }
                                    };
                                    
                                    try {
                                      await processBatchesRecursively(0, 0);
                                    } catch (error) {
                                      if (error.name !== 'AbortError') {
                                        console.error('Error in market data fetch:', error);
                                      }
                                    }
                                  })().catch(error => {
                                    if (error.name !== 'AbortError') {
                                      console.error('Error in market data fetch:', error);
                                    }
                                  });
                                }

                                // Load remaining items in batches (non-blocking progressive loading)
                                const REMAINING_BATCH_SIZE = 50;
                                
                                const processRemainingBatches = async (batchIndex) => {
                                  // Check if search was cancelled or superseded
                                  if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                    return;
                                  }
                                  
                                  const startIndex = INITIAL_BATCH_SIZE + (batchIndex * REMAINING_BATCH_SIZE);
                                  
                                  if (startIndex >= sortedItemIds.length) {
                                    return;
                                  }
                                  
                                  const batch = sortedItemIds.slice(startIndex, startIndex + REMAINING_BATCH_SIZE);
                                  if (batch.length === 0) {
                                    return;
                                  }
                                  
                                  // Use batch query instead of individual queries (optimized)
                                  const { getTwItemsByIds: getTwItemsByIdsBatch } = await import('../services/supabaseData');
                                  const batchItemsData = await getTwItemsByIdsBatch(batch);
                                  const batchItems = batch.map(id => {
                                    const itemData = batchItemsData[id];
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
                                  
                                  // Check again if search was cancelled
                                  if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                    return;
                                  }
                                  
                                  const filteredBatchItems = isTradeable 
                                    ? batchItems.filter(item => marketableSet.has(item.id))
                                    : batchItems;
                                  
                                  const batchItemsSorted = filteredBatchItems.sort((a, b) => {
                                    const aIlvl = ilvlsData[a.id?.toString()] || null;
                                    const bIlvl = ilvlsData[b.id?.toString()] || null;
                                    
                                    if (aIlvl !== null && bIlvl !== null) {
                                      return bIlvl - aIlvl;
                                    }
                                    if (aIlvl !== null) return -1;
                                    if (bIlvl !== null) return 1;
                                    return b.id - a.id;
                                  });

                                  // Check again before updating state
                                  if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                    return;
                                  }

                                  // Load rarities for this batch (for rarity filter)
                                  const batchItemIdsContinue = batchItemsSorted.map(item => item.id);
                                  loadRaritiesData(batchItemIdsContinue).then(raritiesForBatchContinue => {
                                    setRaritiesData(prev => ({ ...prev, ...raritiesForBatchContinue }));
                                  }).catch(error => {
                                    console.error('Error loading rarities for batch:', error);
                                  });

                                  // Use flushSync to ensure atomic updates and prevent table jumping
                                  if (isTradeable) {
                                    flushSync(() => {
                                      setSearchResults(prev => {
                                        // Since batchItemsSorted is already sorted and prev is already sorted,
                                        // we can simply append without re-sorting to avoid layout shifts
                                        return [...prev, ...batchItemsSorted];
                                      });
                                    });
                                  } else {
                                    // Load untradeable items even if there are tradeable items
                                    // This allows users to view untradeable items via the button
                                    flushSync(() => {
                                      setUntradeableResults(prev => {
                                        // Since batchItemsSorted is already sorted and prev is already sorted,
                                        // we can simply append without re-sorting to avoid layout shifts
                                        return [...prev, ...batchItemsSorted];
                                      });
                                    });
                                  }
                                  
                                  await new Promise(resolve => {
                                    setTimeout(() => {
                                      processRemainingBatches(batchIndex + 1).then(resolve);
                                    }, 50);
                                  });
                                };
                                
                                if (sortedItemIds.length > INITIAL_BATCH_SIZE) {
                                  processRemainingBatches(0).catch(error => {
                                    console.error('Error loading remaining batches:', error);
                                  });
                                }
                              };

                              // Start loading tradeable items progressively using unified function
                              if (limitedTradeableItemIds.length > 0) {
                                // Keep track of untradeable items even when we have tradeable items
                                setShowUntradeable(false);
                                
                                loadItemsProgressively(limitedTradeableItemIds, true).catch(error => {
                                  console.error('Error loading tradeable items progressively:', error);
                                });
                                
                                // Also load untradeable items in background if they exist
                                if (untradeableItemIds.length > 0) {
                                  loadItemsProgressively(untradeableItemIds, false).catch(error => {
                                    console.error('Error loading untradeable items:', error);
                                  });
                                }
                              } else if (untradeableItemIds.length > 0) {
                                loadItemsProgressively(untradeableItemIds, false).catch(error => {
                                  console.error('Error loading untradeable items:', error);
                                });
                              }

                              // Check if this request was superseded before showing toast
                              if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                setIsFilterSearching(false);
                                return;
                              }

                              // Show toast with results count
                              if (limitedTradeableItemIds.length > 0 || untradeableItemIds.length > 0) {
                                addToast(`找到 ${limitedTradeableItemIds.length} 個可交易物品${untradeableItemIds.length > 0 ? `、${untradeableItemIds.length} 個不可交易物品` : ''}`, 'success');
                              }

                              setIsFilterSearching(false);
                            } catch (error) {
                              // Check if this request was superseded
                              if (continueSearchRequestId !== filterSearchRequestIdRef.current) {
                                return;
                              }
                              console.error('Continue search error:', error);
                              addToast('搜索失敗，請稍後再試', 'error');
                              setIsLoadingVelocities(false);
                              setIsFilterSearching(false);
                              setVelocityLoadingProgress({ loaded: 0, total: 0 });
                            }
                          }}
                          className="confirm-button-attention py-3"
                        >
                          <span className="flex items-center gap-2">
                            <span>確認</span>
                            <span>繼續搜索（限制為前 {MAX_ITEMS_LIMIT} 個）</span>
                          </span>
                        </button>
                        <button
                          onClick={() => setTooManyItemsWarning(null)}
                          className="px-4 py-2 bg-slate-700/50 border border-gray-500/50 rounded-lg text-gray-300 hover:bg-slate-700/70 transition-all text-sm font-medium"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Item Name Filter, Search Button and Clear Filters Button */}
              <div className="mb-6 flex gap-3">
                {/* Item Name Filter Input */}
                <div className="w-[40%] relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={itemNameFilter}
                    onChange={(e) => setItemNameFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isFilterSearching && !isSearching && (selectedJobs.length > 0 || selectedCategories.length > 0) && !tooManyItemsWarning) {
                        handleFilterSearch();
                      }
                    }}
                    placeholder="物品名篩選（多關鍵詞用空格分隔）"
                    disabled={isFilterSearching || isSearching}
                    className={`w-full py-3 pl-10 pr-20 rounded-lg bg-slate-900/90 backdrop-blur-sm border text-white placeholder-gray-400 focus:outline-none focus:ring-1 transition-all text-sm shadow-lg ${
                      isFilterSearching || isSearching
                        ? 'border-slate-700/30 cursor-not-allowed opacity-60'
                        : 'border-purple-500/40 focus:border-ffxiv-gold focus:ring-ffxiv-gold/50 shadow-purple-500/20'
                    }`}
                  />
                  {/* Exact Search Toggle Button - positioned on the right side of input */}
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 flex items-center gap-1.5">
                    <label className="flex items-center cursor-pointer group" title={!filterFuzzySearch ? "關閉精準搜尋" : "開啟精準搜尋"}>
                      <input
                        type="checkbox"
                        checked={!filterFuzzySearch}
                        onChange={(e) => setFilterFuzzySearch(!e.target.checked)}
                        disabled={isFilterSearching || isSearching}
                        className="sr-only"
                      />
                      <div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                        isFilterSearching || isSearching
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      } ${
                        !filterFuzzySearch
                          ? 'bg-ffxiv-gold/80'
                          : 'bg-slate-600/60'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                          !filterFuzzySearch ? 'translate-x-4' : 'translate-x-0'
                        }`}></div>
                      </div>
                    </label>
                    <span className={`text-xs whitespace-nowrap select-none ${
                      isFilterSearching || isSearching
                        ? 'text-gray-500'
                        : !filterFuzzySearch
                          ? 'text-ffxiv-gold'
                          : 'text-gray-400'
                    }`}>
                      精準
                    </span>
                  </div>
                </div>
                  <button
                    onClick={handleFilterSearch}
                    disabled={isFilterSearching || isSearching || isSearchButtonDisabled || (selectedJobs.length === 0 && selectedCategories.length === 0) || tooManyItemsWarning !== null}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all relative overflow-hidden ${
                      isFilterSearching || isSearching
                        ? 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
                        : isSearchButtonDisabled || (selectedJobs.length === 0 && selectedCategories.length === 0) || tooManyItemsWarning !== null
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
                    }`}
                  >
                    {isFilterSearching || isSearching ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>載入中...</span>
                      </span>
                    ) : (
                      '搜索'
                    )}
                    {(isFilterSearching || isSearching) && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] pointer-events-none"></div>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      // If searching, cancel the search first
                      if (isFilterSearching) {
                        // Increment request ID to cancel ongoing search
                        filterSearchRequestIdRef.current++;
                        // Cancel any ongoing market data fetches
                        if (velocityFetchAbortControllerRef.current) {
                          velocityFetchAbortControllerRef.current.abort();
                          velocityFetchAbortControllerRef.current = null;
                        }
                        setIsFilterSearching(false);
                        setIsLoadingVelocities(false);
                        setVelocityFetchInProgress(false);
                        setVelocityLoadingProgress({ loaded: 0, total: 0 });
                      }
                      
                      // Clear all filter selections
                      setSelectedJobs([]);
                      setSelectedCategories([]);
                      setMinLevel(1);
                      setMaxLevel(999);
                      setItemNameFilter('');
                      setSearchResults([]);
                      setUntradeableResults([]);
                      setShowUntradeable(false);
                      setItemVelocities({});
                      setItemAveragePrices({});
                      setItemMinListings({});
                      setItemRecentPurchases({});
                      setItemTradability({});
                      setCurrentPage(1);
                      setTooManyItemsWarning(null);
                    }}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                      isFilterSearching || isSearching
                        ? 'bg-red-600/80 text-white border border-red-500/70 hover:bg-red-600 hover:border-red-400 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]'
                        : 'bg-red-600/60 text-white border border-red-500/50 hover:bg-red-600/80 hover:border-red-400/70 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]'
                    }`}
                  >
                    {isFilterSearching || isSearching ? '停止搜尋' : '清空篩選'}
                  </button>
              </div>

              {/* Level Range and Server Selector */}
              {selectedWorld && (
                <div className="mb-6 flex flex-row items-center justify-between gap-6">
                  {/* Level Range Input */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={minLevelFocused ? (minLevel === 1 ? '' : minLevel) : minLevel}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            setMinLevel(1);
                            return;
                          }
                          const value = parseInt(inputValue);
                          if (!isNaN(value)) {
                            const clampedValue = Math.max(1, Math.min(999, value));
                            setMinLevel(clampedValue);
                            if (clampedValue > maxLevel) {
                              setMaxLevel(clampedValue);
                            }
                          }
                        }}
                        onFocus={() => {
                          setMinLevelFocused(true);
                        }}
                        onBlur={(e) => {
                          setMinLevelFocused(false);
                          if (e.target.value === '' || e.target.value === '1') {
                            setMinLevel(1);
                          }
                        }}
                        disabled={isLoadingVelocities || isFilterSearching}
                        placeholder="1"
                        className="w-40 pl-3 pr-12 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      />
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <span className="text-xs text-gray-400" title="ilvl">ilvl</span>
                      </div>
                    </div>
                    <div className="text-gray-400">~</div>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={maxLevelFocused ? (maxLevel === 999 ? '' : maxLevel) : maxLevel}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue === '') {
                          setMaxLevel(999);
                          return;
                        }
                        const value = parseInt(inputValue);
                        if (!isNaN(value)) {
                          const clampedValue = Math.max(1, Math.min(999, value));
                          setMaxLevel(clampedValue);
                          if (clampedValue < minLevel) {
                            setMinLevel(clampedValue);
                          }
                        }
                      }}
                      onFocus={() => {
                        setMaxLevelFocused(true);
                      }}
                      onBlur={(e) => {
                        setMaxLevelFocused(false);
                        if (e.target.value === '' || e.target.value === '999') {
                          setMaxLevel(999);
                        }
                      }}
                      disabled={isLoadingVelocities || isFilterSearching}
                      placeholder="999"
                      className="w-40 px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                  </div>

                  {/* Server Selector */}
                  <div className="ml-auto">
                    <ServerSelector
                      datacenters={datacenters}
                      worlds={worlds}
                      selectedWorld={selectedWorld}
                      onWorldChange={onWorldChange}
                      selectedServerOption={selectedServerOption}
                      onServerOptionChange={onServerOptionChange}
                      serverOptions={serverOptions}
                      disabled={isLoadingVelocities || isFilterSearching}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {/* Note: RunningLoader is now handled by SearchResultsTable component for centralized loading display */}
          {(() => {
            // CRITICAL: Only render if we have tradeable items OR (no tradeable items AND untradeable items)
            // This prevents untradeable items from being displayed when tradeable items exist
            // Note: RunningLoader is now handled by SearchResultsTable component
            const hasTradeableItems = searchResults.length > 0;
            const shouldRender = activeTab === 'filter' 
              ? (hasTradeableItems || (!hasTradeableItems && untradeableResults.length > 0) || isFilterSearching)
              : (activeTab === 'batch' && !BATCH_SEARCH_DISABLED && (searchResults.length > 0 || isBatchSearching));
            
            if (!shouldRender) return null;
            
            // Determine which results to show based on activeTab and showUntradeable
            // When showUntradeable is true, combine tradeable and untradeable items together
            // When showUntradeable is false, show only tradeable items
            let allResultsForRarityCount;
            let currentResults;
            
            if (activeTab === 'filter') {
              if (showUntradeable) {
                // Combine tradeable and untradeable items when button is clicked
                allResultsForRarityCount = [...searchResults, ...untradeableResults];
                currentResults = [...searchResults, ...untradeableResults];
              } else {
                // Show only tradeable items by default
                allResultsForRarityCount = searchResults;
                currentResults = searchResults;
              }
            } else if (activeTab === 'batch' && !BATCH_SEARCH_DISABLED) {
              allResultsForRarityCount = searchResults;
              currentResults = searchResults;
            } else {
              allResultsForRarityCount = [];
              currentResults = [];
            }
            
            // Calculate rarity counts for ALL results (before filtering)
            // This allows users to see all available rarities regardless of current page
            const allResultsRarityCounts = (() => {
              if (!raritiesData) return {};
              const counts = {};
              allResultsForRarityCount.forEach(item => {
                const rarity = raritiesData[item.id?.toString()] !== undefined 
                  ? raritiesData[item.id.toString()] 
                  : 0;
                counts[rarity] = (counts[rarity] || 0) + 1;
              });
              return counts;
            })();
            
            // Calculate filtered items count (same logic as ItemTable)
            // This simulates the filtering that happens inside ItemTable
            let filteredResults = currentResults;
            if (marketableItems) {
              const hasTradeableItems = currentResults.some(item => {
                const tradable = itemTradability?.[item.id];
                return tradable === true;
              });
              
              if (hasTradeableItems) {
                filteredResults = currentResults.filter(item => {
                  const tradable = itemTradability?.[item.id];
                  return tradable === true;
                });
              }
            }
            
            // Filter by rarity BEFORE pagination (so it applies to all pages)
            // Multi-select: filter items that match any selected rarity
            if (selectedRarities.length > 0 && raritiesData) {
              currentResults = currentResults.filter(item => {
                const itemRarity = raritiesData[item.id?.toString()] !== undefined 
                  ? raritiesData[item.id.toString()] 
                  : 0;
                return selectedRarities.includes(itemRarity);
              });
              // Also filter filteredResults by rarity
              filteredResults = filteredResults.filter(item => {
                const itemRarity = raritiesData[item.id?.toString()] !== undefined 
                  ? raritiesData[item.id.toString()] 
                  : 0;
                return selectedRarities.includes(itemRarity);
              });
            }
            
            // Pagination is now handled by SearchResultsTable component
            
            return (
              <div ref={resultsTableRef}>
              <SearchResultsTable
                items={currentResults}
                filteredItems={filteredResults}
                selectedWorld={selectedWorld}
                selectedServerOption={selectedServerOption}
                onWorldChange={onWorldChange}
                onServerOptionChange={onServerOptionChange}
                datacenters={datacenters}
                worlds={worlds}
                serverOptions={serverOptions}
                isServerSelectorDisabled={!isServerDataLoaded || isLoadingVelocities || velocityFetchInProgress || isBatchSearching || isFilterSearching}
                marketableItems={marketableItems}
                itemVelocities={itemVelocities}
                itemAveragePrices={itemAveragePrices}
                itemMinListings={itemMinListings}
                itemRecentPurchases={itemRecentPurchases}
                itemTradability={itemTradability}
                isLoadingVelocities={isLoadingVelocities}
                velocityLoadingProgress={velocityLoadingProgress}
                showLoadingIndicator={showLoadingIndicator}
                isSearching={isFilterSearching || isBatchSearching}
                searchingItemsCount={searchResults.length + untradeableResults.length}
                averagePriceHeader="平均價格"
                getSimplifiedChineseName={getSimplifiedChineseName}
                addToast={addToast}
                title="搜索結果"
                titleSuffix={filteredResults.length !== currentResults.length ? `，顯示 ${filteredResults.length} 個` : ''}
                showUntradeableButton={activeTab === 'filter' && untradeableResults.length > 0 && searchResults.length > 0}
                untradeableCount={untradeableResults.length}
                tradeableCount={searchResults.length}
                onToggleUntradeable={setShowUntradeable}
                isShowUntradeable={showUntradeable}
                selectedRarities={selectedRarities}
                setSelectedRarities={setSelectedRarities}
                raritiesData={raritiesData}
                externalRarityFilter={true}
                externalRarityCounts={allResultsRarityCounts}
                isRaritySelectorDisabled={!isServerDataLoaded || isLoadingVelocities || velocityFetchInProgress || isBatchSearching || isFilterSearching}
                externalCurrentPage={currentPage}
                externalItemsPerPage={itemsPerPage}
                onExternalPageChange={handlePageChange}
                onExternalItemsPerPageChange={(newItemsPerPage) => {
                  setItemsPerPage(newItemsPerPage);
                  setCurrentPage(1);
                }}
                defaultItemsPerPage={50}
                itemsPerPageOptions={[50, 100, 200]}
                scrollRef={resultsTableRef}
                onSelect={(item) => {
                  if (onItemSelect) {
                    const params = new URLSearchParams();
                    if (selectedServerOption) {
                      params.set('server', selectedServerOption);
                    }
                    const queryString = params.toString();
                    const itemUrlPath = generateItemUrl(item.id, item.nameTW || item.name || 'item');
                    const itemUrl = `${itemUrlPath}${queryString ? '?' + queryString : ''}`;
                    
                    onItemSelect(item);
                    
                    // Open in new tab
                    window.open(itemUrl, '_blank');
                  }
                }}
              />
              </div>
            );
          })()}
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
