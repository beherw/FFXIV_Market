import { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import ServerSelector from './components/ServerSelector';
import TaxRatesModal from './components/TaxRatesModal';
import SearchResultsTable from './components/SearchResultsTable.jsx';
import MarketListings from './components/MarketListings';
import MarketHistory from './components/MarketHistory';
import ServerUploadTimes from './components/ServerUploadTimes';
import Toast from './components/Toast';
import { formatRelativeTime, formatLocalTime } from './utils/timeFormat';
import { searchItems, searchItemsOCR, getItemById, getSimplifiedChineseName, cancelSimplifiedNameFetch } from './services/itemDatabase';
import { getMarketData, getMarketableItems, getItemsVelocity, getTaxRates } from './services/universalis';
// Removed containsChinese import - no longer restricting to Chinese input
import { getAssetPath } from './utils/assetPath.js';
import ItemImage from './components/ItemImage';
import { cancelAllIconRequests, preloadItemIcon } from './utils/itemImage';
import HistoryButton from './components/HistoryButton';
import { addItemToHistory } from './utils/itemHistory';
import { addSearchToHistory } from './utils/searchHistory';
import { useHistory } from './hooks/useHistory';
import { hasRecipe, buildCraftingTree, findRelatedItems } from './services/recipeDatabase';
import { getIlvls, getItemPatch, getPatchNames } from './services/supabaseData';
import { initializeSupabaseConnection } from './services/supabaseClient';
import TopBar from './components/TopBar';
import NotFound from './components/NotFound';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { APP_VERSION } from './constants/version';
import { generateItemSlug, generateItemUrl } from './utils/urlSlug';
import { detectLanguage, getItemNameForUrl } from './utils/itemLanguage';
import ItemSEO from './components/ItemSEO';

// Lazy load route-based components with error handling
const createLazyComponent = (importFn, componentName) => {
  return lazy(() => 
    importFn().catch(error => {
      console.error(`Failed to load ${componentName}:`, error);
      // Return a fallback component that shows an error message
      return {
        default: () => (
          <div className="bg-gradient-to-br from-red-900/60 via-red-800/40 to-red-900/60 rounded-lg border border-red-500/40 p-6 text-center">
            <div className="text-red-400 mb-2">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-8 w-8 mx-auto" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-300 font-semibold mb-1">載入失敗</p>
            <p className="text-red-400/80 text-sm">無法載入 {componentName}，請重新整理頁面</p>
          </div>
        )
      };
    })
  );
};

const CraftingJobPriceChecker = createLazyComponent(() => import('./components/CraftingInspiration.jsx'), 'CraftingInspiration');
const MSQPriceChecker = createLazyComponent(() => import('./components/MSQPriceChecker.jsx'), 'MSQPriceChecker');
const AdvancedSearch = createLazyComponent(() => import('./components/AdvancedSearch.jsx'), 'AdvancedSearch');
const CraftingTree = createLazyComponent(() => import('./components/CraftingTree.jsx'), 'CraftingTree');
const RelatedItems = createLazyComponent(() => import('./components/RelatedItems.jsx'), 'RelatedItems');
const HistorySection = createLazyComponent(() => import('./components/HistorySection.jsx'), 'HistorySection');
const RecentUpdatesSection = createLazyComponent(() => import('./components/RecentUpdatesSection.jsx'), 'RecentUpdatesSection');
const ObtainMethods = createLazyComponent(() => import('./components/ObtainMethods.jsx'), 'ObtainMethods');

function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  
  // Core states
  const [searchText, setSearchText] = useState('');
  const [tradeableResults, setTradeableResults] = useState([]);
  const [untradeableResults, setUntradeableResults] = useState([]);
  const [showUntradeable, setShowUntradeable] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedWorld, setSelectedWorld] = useState(null);
  const [selectedServerOption, setSelectedServerOption] = useState(null);
  
  useEffect(() => {
    // Track selectedItem changes
  }, [selectedItem]);
  const [marketInfo, setMarketInfo] = useState(null);
  const [marketListings, setMarketListings] = useState([]);
  const [marketHistory, setMarketHistory] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingItemsCount, setSearchingItemsCount] = useState(0); // Track items count during search
  const [isOCRSearchResult, setIsOCRSearchResult] = useState(false); // When true, ItemTable preserves result order (no ilvl sort)
  const [isLoadingMarket, setIsLoadingMarket] = useState(false);
  const [error, setError] = useState(null);
  const [listSize, setListSize] = useState(20);
  const [hqOnly, setHqOnly] = useState(false);
  const [datacenters, setDatacenters] = useState([]);
  const [worlds, setWorlds] = useState({});
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [isServerDataLoaded, setIsServerDataLoaded] = useState(false);
  const [isLoadingItemFromURL, setIsLoadingItemFromURL] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [rateLimitMessage, setRateLimitMessage] = useState(null);
  const [currentImage, setCurrentImage] = useState(() => Math.random() < 0.5 ? getAssetPath('bear.png') : getAssetPath('sheep.png'));
  const [isManualMode, setIsManualMode] = useState(false);
  const [isShattering, setIsShattering] = useState(false);
  const [shatterFragments, setShatterFragments] = useState([]);
  const imageContainerRef = useRef(null);
  const switchCountRef = useRef(0);
  const currentIntervalRef = useRef(3500); // Start at 3.5 seconds
  const craftingTreeRef = useRef(null);
  const prevCraftingTreeExpandedRef = useRef(false);
  
  // Crafting tree states
  const [craftingTree, setCraftingTree] = useState(null);
  const [hasCraftingRecipe, setHasCraftingRecipe] = useState(false);
  const [isCraftingTreeExpanded, setIsCraftingTreeExpanded] = useState(false);
  const [isLoadingCraftingTree, setIsLoadingCraftingTree] = useState(false);
  
  // Load excludeCrystals preference from localStorage (default: true, meaning exclude crystals)
  const [excludeCrystals, setExcludeCrystals] = useState(() => {
    const saved = localStorage.getItem('craftingTreeExcludeCrystals');
    return saved !== null ? saved === 'true' : true; // Default to true (exclude crystals)
  });
  
  // Related items states
  const [hasRelatedItems, setHasRelatedItems] = useState(false);
  const [isRelatedItemsExpanded, setIsRelatedItemsExpanded] = useState(false);
  const [isLoadingRelatedItems, setIsLoadingRelatedItems] = useState(false);
  
  // Obtain methods states
  const [isObtainMethodsExpanded, setIsObtainMethodsExpanded] = useState(false);
  const [isObtainMethodsLoading, setIsObtainMethodsLoading] = useState(false);
  // Track if we should auto-expand obtainable when item changes (e.g., when clicking from obtainable)
  const shouldAutoExpandObtainableRef = useRef(false);
  
  // Button order tracking - tracks which button was clicked last (higher number = more recent)
  const [buttonOrder, setButtonOrder] = useState({
    obtainMethods: 0,
    craftingTree: 0,
    relatedItems: 0
  });
  
  // Track if crafting tree was expanded from ObtainMethods
  const [expandedFromObtainMethods, setExpandedFromObtainMethods] = useState(false);
  
  // Marketable items and velocity states
  const [marketableItems, setMarketableItems] = useState(null);
  const [searchVelocities, setSearchVelocities] = useState({});
  const [searchAveragePrices, setSearchAveragePrices] = useState({});
  const [searchMinListings, setSearchMinListings] = useState({});
  const [searchRecentPurchases, setSearchRecentPurchases] = useState({});
  const [searchTradability, setSearchTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [velocityLoadingProgress, setVelocityLoadingProgress] = useState({ loaded: 0, total: 0 }); // Track loading progress: loaded = items requested, total = items to load
  const [isServerSelectorDisabled, setIsServerSelectorDisabled] = useState(true); // Start disabled until server data loads
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const [searchItemsPerPage, setSearchItemsPerPage] = useState(20);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const loadingIndicatorStartTimeRef = useRef(null);
  
  // Tax rates state
  const [taxRates, setTaxRates] = useState({}); // { worldId: { LimsaLominsa: 5, Gridania: 5, ... } }
  const [isLoadingTaxRates, setIsLoadingTaxRates] = useState(false);
  const [isTaxRatesModalOpen, setIsTaxRatesModalOpen] = useState(false);
  const loadedTaxRatesDcRef = useRef(null); // Track which datacenter's tax rates are currently loaded

  // Handle search page change
  const handleSearchPageChange = useCallback((newPage) => {
    setSearchCurrentPage(newPage);
    // Scroll to top of results when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Use centralized history hook for history page
  const { historyItems, isLoading: isHistoryLoading, clearHistory } = useHistory();
  
  // History page market data states
  const [historyVelocities, setHistoryVelocities] = useState({});
  const [historyAveragePrices, setHistoryAveragePrices] = useState({});
  const [historyMinListings, setHistoryMinListings] = useState({});
  const [historyRecentPurchases, setHistoryRecentPurchases] = useState({});
  const [historyTradability, setHistoryTradability] = useState({});
  const [isLoadingHistoryVelocities, setIsLoadingHistoryVelocities] = useState(false);
  
  // Refs for request management
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);
  const dataReceivedRef = useRef(false);
  const requestInProgressRef = useRef(false);
  const serverLoadRetryCountRef = useRef(0);
  const serverLoadTimeoutRef = useRef(null);
  const serverLoadInProgressRef = useRef(false);
  const serverLoadCompletedRef = useRef(false);
  const serverLoadAbortControllerRef = useRef(null);
  const serverLoadRequestIdRef = useRef(0);
  const selectedItemRef = useRef(null);
  const searchResultsRef = useRef([]);
  const simplifiedNameAbortControllerRef = useRef(null);
  const toastIdCounterRef = useRef(0);
  const lastProcessedURLRef = useRef('');
  const isInitializingFromURLRef = useRef(false);
  const velocityFetchAbortControllerRef = useRef(null);
  const velocityFetchRequestIdRef = useRef(0);
  const velocityFetchInProgressRef = useRef(false);
  const searchAbortControllerRef = useRef(null);
  const lastFetchedItemIdsRef = useRef('');
  const imageIntervalRef = useRef(null);
  const manualModeTimeoutRef = useRef(null);
  const searchInProgressRef = useRef(false);
  const lastSearchedTermRef = useRef('');
  const prevTradeableResultsLengthRef = useRef(0);
  
  // Refs for history page market data fetching
  const historyFetchAbortControllerRef = useRef(null);
  const historyFetchRequestIdRef = useRef(0);
  const historyFetchInProgressRef = useRef(false);
  const lastFetchedHistoryIdsRef = useRef('');
  
  // Cache for ilvls data
  const ilvlsDataRef = useRef(null);
  
  // Helper function to load ilvls data dynamically (targeted - only for specific item IDs)
  const loadIlvlsData = useCallback(async (itemIds = null) => {
    // If itemIds provided, use targeted query
    if (itemIds && itemIds.length > 0) {
      const { getIlvlsByIds } = await import('./services/supabaseData');
      return await getIlvlsByIds(itemIds);
    }
    // Fallback to full load only if no itemIds provided (should rarely happen)
    if (ilvlsDataRef.current) {
      return ilvlsDataRef.current;
    }
    const { getIlvls } = await import('./services/supabaseData');
    ilvlsDataRef.current = await getIlvls();
    return ilvlsDataRef.current;
  }, []);

  // Cache for item-patch and patch-names data
  const itemPatchDataRef = useRef(null);
  const patchNamesDataRef = useRef(null);
  
  // Helper function to load item-patch data dynamically
  const loadItemPatchData = useCallback(async () => {
    if (itemPatchDataRef.current) {
      return itemPatchDataRef.current;
    }
    itemPatchDataRef.current = await getItemPatch();
    return itemPatchDataRef.current;
  }, []);

  // Helper function to load patch-names data dynamically
  const loadPatchNamesData = useCallback(async () => {
    if (patchNamesDataRef.current) {
      return patchNamesDataRef.current;
    }
    patchNamesDataRef.current = await getPatchNames();
    return patchNamesDataRef.current;
  }, []);

  // State for ilvl and version data
  const [ilvlsData, setIlvlsData] = useState(null);
  const [itemPatchData, setItemPatchData] = useState(null);
  const [patchNamesData, setPatchNamesData] = useState(null);

  // Load ilvl and patch data lazily (only when needed, not on mount)
  // This prevents unnecessary data loading on initial page load
  // Data will be loaded when first used (e.g., when displaying search results or item details)

  // Helper function to get ilvl for an item
  const getIlvl = useCallback((itemId) => {
    if (!ilvlsData || !itemId) return null;
    return ilvlsData[itemId.toString()] || null;
  }, [ilvlsData]);

  // Helper function to get version for an item
  const getVersion = useCallback((itemId) => {
    if (!itemPatchData || !patchNamesData || !itemId) return null;
    
    // Get patch ID from item-patch.json
    const patchId = itemPatchData[itemId.toString()];
    if (patchId === undefined || patchId === null) return null;
    
    // Get patch info from patch-names.json
    const patchInfo = patchNamesData[patchId.toString()];
    if (!patchInfo || !patchInfo.version) return null;
    
    // Round down to 1 decimal place
    const versionNum = parseFloat(patchInfo.version);
    if (isNaN(versionNum)) return patchInfo.version;
    
    const rounded = Math.floor(versionNum * 10) / 10;
    return rounded.toFixed(1);
  }, [itemPatchData, patchNamesData]);

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
  const getVersionColor = useCallback((versionString) => {
    if (!versionString) return '#9CA3AF';
    
    // Extract major version number (e.g., "7.4" -> 7, "6.5" -> 6)
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
  }, []);

  // Add toast function
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + (++toastIdCounterRef.current);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  // Remove toast function
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Create shatter effect
  const createShatterEffect = useCallback((imageUrl) => {
    if (!imageContainerRef.current) return;
    
    const container = imageContainerRef.current;
    const img = container.querySelector('img');
    if (!img) return;
    
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const fragmentSize = 8; // 8x8 grid = 64 fragments
    const fragmentWidth = imgRect.width / fragmentSize;
    const fragmentHeight = imgRect.height / fragmentSize;
    
    const fragments = [];
    for (let row = 0; row < fragmentSize; row++) {
      for (let col = 0; col < fragmentSize; col++) {
        const tx = (Math.random() - 0.5) * 500; // Random horizontal movement
        const ty = (Math.random() - 0.5) * 500 + 200; // Random vertical movement (mostly down)
        const rot = (Math.random() - 0.5) * 720; // Random rotation
        
        // Calculate position relative to container
        const relativeX = imgRect.left - containerRect.left;
        const relativeY = imgRect.top - containerRect.top;
        
        fragments.push({
          id: `${row}-${col}`,
          x: relativeX + col * fragmentWidth,
          y: relativeY + row * fragmentHeight,
          width: fragmentWidth,
          height: fragmentHeight,
          tx,
          ty,
          rot,
          bgX: -col * fragmentWidth,
          bgY: -row * fragmentHeight,
          imgWidth: imgRect.width,
          imgHeight: imgRect.height,
        });
      }
    }
    
    setShatterFragments(fragments);
    setIsShattering(true);
    
    // Clear fragments after animation
    setTimeout(() => {
      setShatterFragments([]);
    }, 800);
  }, []);

  // Handle image swap on click - manual mode
  const handleImageClick = useCallback(() => {
    // Clear any pending timeout to return to auto mode
    if (manualModeTimeoutRef.current) {
      clearTimeout(manualModeTimeoutRef.current);
    }
    
    // Enter manual mode
    setIsManualMode(true);
    
    // Stop auto alternation
    if (imageIntervalRef.current) {
      clearTimeout(imageIntervalRef.current);
      imageIntervalRef.current = null;
    }
    
    // Clear any shatter effects if active
    // This ensures clicking during shatter effect immediately stops it
    setIsShattering(false);
    setShatterFragments([]);
    
    // Swap image immediately
    setCurrentImage(prev => prev === getAssetPath('bear.png') ? getAssetPath('sheep.png') : getAssetPath('bear.png'));
    
    // Set timeout to return to auto mode after 0.5 seconds of no clicks
    manualModeTimeoutRef.current = setTimeout(() => {
      setIsManualMode(false);
      manualModeTimeoutRef.current = null;
    }, 500);
  }, []);

  // Auto-alternate images when not in manual mode
  useEffect(() => {
    const isOnHistoryPage = location.pathname === '/history';
    const isOnCraftingInspirationPage = location.pathname === '/crafting-inspiration';
    const isOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
    
    // Only run on home page (empty state)
    if (selectedItem || (tradeableResults.length > 0 || untradeableResults.length > 0) || isSearching || isOnHistoryPage || isOnCraftingInspirationPage || isOnMSQPriceCheckerPage) {
      if (imageIntervalRef.current) {
        clearTimeout(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      // Reset when leaving home page
      switchCountRef.current = 0;
      currentIntervalRef.current = 3500;
      setIsShattering(false);
      setShatterFragments([]);
      return;
    }

    // Don't auto-alternate in manual mode or when shattering
    if (isManualMode || isShattering) {
      if (imageIntervalRef.current) {
        clearTimeout(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      return;
    }

    // Calculate next interval with acceleration
    // Start at 3500ms, accelerate until reaching 100ms (0.1s)
    // Use exponential decay: interval = 3500 * (100/3500)^(switchCount/maxSwitches)
    // Accelerate to reach 100ms in approximately 20 seconds (~18 switches)
    const getNextInterval = () => {
      const maxSwitches = 18; // Adjusted to reach max speed in ~20 seconds
      const minInterval = 100; // 0.1 second
      const maxInterval = 3500;
      
      if (switchCountRef.current >= maxSwitches) {
        return minInterval;
      }
      
      // Exponential decay formula with steeper curve for faster acceleration
      const progress = switchCountRef.current / maxSwitches;
      // Use a slightly steeper curve by adjusting the exponent
      const interval = maxInterval * Math.pow(minInterval / maxInterval, progress * 1.15);
      return Math.max(interval, minInterval);
    };
    
    const scheduleNext = () => {
      if (imageIntervalRef.current) {
        clearTimeout(imageIntervalRef.current);
      }
      
      const interval = getNextInterval();
      currentIntervalRef.current = interval;
      
      imageIntervalRef.current = setTimeout(() => {
        const currentIsOnHistoryPage = location.pathname === '/history';
        const currentIsOnCraftingInspirationPage = location.pathname === '/crafting-inspiration';
        const currentIsOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
        
        if (!isManualMode && !selectedItem && tradeableResults.length === 0 && untradeableResults.length === 0 && !isSearching && !currentIsOnHistoryPage && !currentIsOnCraftingInspirationPage && !currentIsOnMSQPriceCheckerPage && !isShattering) {
          switchCountRef.current++;
          
          // Check if we should trigger shatter effect
          // Trigger when interval reaches 100ms (0.1s) and we've been at 100ms for about 4 seconds
          // At 100ms, 4 seconds = 40 switches
          // We reach 100ms around switch 18 (accelerates to max speed in ~20 seconds), so count switches after that
          const minIntervalReached = interval <= 100;
          const switchesAtMinInterval = Math.max(0, switchCountRef.current - 18);
          
          // Trigger shatter after maintaining 0.1s speed for about 4 seconds (40 switches)
          if (minIntervalReached && switchesAtMinInterval >= 40) {
            // Trigger shatter effect on current image before switching
            // Use setTimeout to ensure the effect triggers after the current render
            setTimeout(() => {
              createShatterEffect(currentImage);
            }, 0);
            
            // After shatter animation (0.8s) + maintain shatter (5-6s), restore and reset
            setTimeout(() => {
              setIsShattering(false);
              setShatterFragments([]);
              
              // Reset counters and restart
              switchCountRef.current = 0;
              currentIntervalRef.current = 3500;
              
              // Restore image (switch to other one)
              setCurrentImage(prev => prev === getAssetPath('bear.png') ? getAssetPath('sheep.png') : getAssetPath('bear.png'));
              
              // Restart the cycle after a brief pause
              setTimeout(() => {
                if (!isManualMode && !selectedItem && tradeableResults.length === 0 && untradeableResults.length === 0 && !isSearching) {
                  scheduleNext();
                }
              }, 100);
            }, 5800); // 0.8s shatter animation + 5s maintain
          } else {
            // Normal switch
            setCurrentImage(prev => prev === getAssetPath('bear.png') ? getAssetPath('sheep.png') : getAssetPath('bear.png'));
            scheduleNext();
          }
        } else {
          imageIntervalRef.current = null;
        }
      }, interval);
    };

    scheduleNext();

    return () => {
      if (imageIntervalRef.current) {
        clearTimeout(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isManualMode, selectedItem, tradeableResults.length, untradeableResults.length, isSearching, location.pathname, isShattering, currentImage, createShatterEffect]);

  // Cleanup on unmount - cancel all queries
  useEffect(() => {
    return () => {
      // Cancel all abort controllers on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (serverLoadAbortControllerRef.current) {
        serverLoadAbortControllerRef.current.abort();
      }
      if (simplifiedNameAbortControllerRef.current) {
        simplifiedNameAbortControllerRef.current.abort();
      }
      if (velocityFetchAbortControllerRef.current) {
        velocityFetchAbortControllerRef.current.abort();
      }
      if (historyFetchAbortControllerRef.current) {
        historyFetchAbortControllerRef.current.abort();
      }
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (imageIntervalRef.current) {
        clearTimeout(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      if (manualModeTimeoutRef.current) {
        clearTimeout(manualModeTimeoutRef.current);
        manualModeTimeoutRef.current = null;
      }
    };
  }, []);

  // Connection is initialized in main.jsx before React renders - no need to duplicate here

  // Update document title based on selected item
  // Note: This will override the fallback title in index.html
  useEffect(() => {
    if (selectedItem) {
      const itemName = selectedItem.nameTW || selectedItem.name || '未知物品';
      document.title = `${itemName} - 繁中XIV市場 - FF14 Market`;
    } else {
      document.title = '繁中XIV市場 - FF14 Market - 貝爾的市場小屋';
    }
  }, [selectedItem]);

  // Load data centers and worlds on mount
  useEffect(() => {
    if (serverLoadCompletedRef.current) {
      return;
    }
    
    serverLoadRetryCountRef.current = 0;
    serverLoadInProgressRef.current = false;
    serverLoadCompletedRef.current = false;
    serverLoadRequestIdRef.current = 0;
    
    if (serverLoadAbortControllerRef.current) {
      serverLoadAbortControllerRef.current.abort();
    }
    
    if (serverLoadTimeoutRef.current) {
      clearTimeout(serverLoadTimeoutRef.current);
      serverLoadTimeoutRef.current = null;
    }

    const loadData = async (isRetry = false) => {
      const currentRequestId = ++serverLoadRequestIdRef.current;
      
      if (isRetry && serverLoadAbortControllerRef.current) {
        serverLoadAbortControllerRef.current.abort();
      }
      
      serverLoadAbortControllerRef.current = new AbortController();
      const abortSignal = serverLoadAbortControllerRef.current.signal;
      
      serverLoadInProgressRef.current = true;
      serverLoadCompletedRef.current = false;
      
      if (serverLoadTimeoutRef.current) {
        clearTimeout(serverLoadTimeoutRef.current);
        serverLoadTimeoutRef.current = null;
      }
      
      serverLoadTimeoutRef.current = setTimeout(() => {
        if (
          currentRequestId === serverLoadRequestIdRef.current &&
          serverLoadInProgressRef.current && 
          !serverLoadCompletedRef.current && 
          !abortSignal.aborted &&
          serverLoadRetryCountRef.current < 3
        ) {
          serverLoadRetryCountRef.current++;
          serverLoadInProgressRef.current = false;
          addToast(`伺服器加載超時，正在重試 (${serverLoadRetryCountRef.current}/3)...`, 'warning');
          loadData(true);
        }
      }, 2000);

      try {
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const dcResponse = await fetch('https://universalis.app/api/v2/data-centers', {
          signal: abortSignal
        });
        
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const dcData = await dcResponse.json();
        
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const worldsResponse = await fetch('https://universalis.app/api/v2/worlds', {
          signal: abortSignal
        });
        
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const worldsData = await worldsResponse.json();
        
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        if (!dcData || !Array.isArray(dcData) || dcData.length === 0 || 
            !worldsData || !Array.isArray(worldsData) || worldsData.length === 0) {
          if (serverLoadRetryCountRef.current < 3) {
            serverLoadRetryCountRef.current++;
            serverLoadInProgressRef.current = false;
            addToast(`伺服器資料為空，正在重試 (${serverLoadRetryCountRef.current}/3)...`, 'warning');
            setTimeout(() => {
              if (currentRequestId === serverLoadRequestIdRef.current) {
                loadData(true);
              }
            }, 2000);
            return;
          }
        }

        const worldsMap = {};
        worldsData.forEach(w => {
          worldsMap[w.id] = w.name;
        });
        setWorlds(worldsMap);
        setDatacenters(dcData);
        setIsServerDataLoaded(true);
        // Enable server selector after server data is loaded (unless velocity fetch is in progress)
        if (!velocityFetchInProgressRef.current) {
          setIsServerSelectorDisabled(false);
        }

        serverLoadInProgressRef.current = false;
        serverLoadCompletedRef.current = true;
        
        if (serverLoadTimeoutRef.current) {
          clearTimeout(serverLoadTimeoutRef.current);
          serverLoadTimeoutRef.current = null;
        }

        const tradChineseDCs = dcData.filter(dc => dc.region && dc.region.startsWith('繁中服'));
        if (tradChineseDCs.length > 0 && tradChineseDCs[0].worlds.length > 0) {
          const firstDC = tradChineseDCs[0];
          const firstWorld = firstDC.worlds[0];
          setSelectedWorld({
            region: firstDC.region,
            section: firstDC.name,
            world: firstWorld,
            dcObj: firstDC,
          });
          setSelectedServerOption(firstDC.name);
        } else if (dcData.length > 0) {
          const firstDC = dcData[0];
          if (firstDC.worlds && firstDC.worlds.length > 0) {
            setSelectedWorld({
              region: firstDC.region || '',
              section: firstDC.name,
              world: firstDC.worlds[0],
              dcObj: firstDC,
            });
            setSelectedServerOption(firstDC.name);
          }
        }

        setIsLoadingDB(false);
        if (isRetry && serverLoadRetryCountRef.current > 0) {
          addToast('伺服器資料加載成功', 'success');
        } else {
          addToast('伺服器資料加載完成', 'success');
        }
      } catch (err) {
        if (err.name === 'AbortError' || abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        serverLoadInProgressRef.current = false;
        
        if (serverLoadTimeoutRef.current) {
          clearTimeout(serverLoadTimeoutRef.current);
          serverLoadTimeoutRef.current = null;
        }
        
        if (serverLoadRetryCountRef.current < 3) {
          serverLoadRetryCountRef.current++;
          addToast(`伺服器加載失敗，正在重試 (${serverLoadRetryCountRef.current}/3)...`, 'warning');
          setTimeout(() => {
            if (currentRequestId === serverLoadRequestIdRef.current) {
              loadData(true);
            }
          }, 2000);
        } else {
          console.error('Failed to load data centers/worlds:', err);
          setError('無法加載服務器列表');
          addToast('無法加載服務器列表，請刷新頁面重試', 'error');
          setIsLoadingDB(false);
        }
      }
    };

    loadData();
    
    return () => {
      if (serverLoadTimeoutRef.current) {
        clearTimeout(serverLoadTimeoutRef.current);
        serverLoadTimeoutRef.current = null;
      }
      if (serverLoadAbortControllerRef.current) {
        serverLoadAbortControllerRef.current.abort();
      }
    };
  }, [addToast]);

  // Load marketable items lazily (only when needed for filtering)
  // This avoids loading 16,670 marketable items on initial page load
  // Load it when we first need it (when fetching velocities or when we have items to filter)
  useEffect(() => {
    // Load marketable items ONLY for displayed items (efficient - uses WHERE IN)
    const allItemIds = [
      ...tradeableResults.map(item => item.id),
      ...untradeableResults.map(item => item.id),
      ...historyItems.map(item => item.id)
    ].filter(id => id > 0);
    
    const needsMarketableItems = 
      allItemIds.length > 0 &&
      !marketableItems &&
      (selectedServerOption && selectedWorld); // Only load when server is selected (needed for filtering)
    
    if (needsMarketableItems) {
      (async () => {
        const { getMarketableItemsByIds } = await import('./services/universalis');
        const items = await getMarketableItemsByIds(allItemIds);
        setMarketableItems(items);
      })();
    }
  }, [tradeableResults.length, untradeableResults.length, historyItems.length, marketableItems, selectedServerOption, selectedWorld]);

  // Fetch tax rates when modal opens or datacenter changes
  useEffect(() => {
    if (!isTaxRatesModalOpen) {
      // Don't fetch if modal is not open
      // Clear loaded DC ref when modal closes
      loadedTaxRatesDcRef.current = null;
      return;
    }

    if (!selectedWorld || !selectedWorld.dcObj || !worlds) {
      setTaxRates({});
      setIsLoadingTaxRates(false);
      loadedTaxRatesDcRef.current = null;
      return;
    }

    const currentDcName = selectedWorld.section;
    
    // Only fetch if we haven't loaded this datacenter's tax rates yet
    // This prevents re-fetching when switching servers within the same datacenter
    if (loadedTaxRatesDcRef.current === currentDcName) {
      // Tax rates already loaded for this datacenter, no need to reload
      return;
    }

    // Fetch tax rates for all worlds in the current data center
    const worldIds = selectedWorld.dcObj.worlds || [];
    if (worldIds.length === 0) {
      setTaxRates({});
      setIsLoadingTaxRates(false);
      loadedTaxRatesDcRef.current = null;
      return;
    }

    // Create abort controller for tax rates requests
    const taxRatesAbortController = new AbortController();
    const taxRatesSignal = taxRatesAbortController.signal;

    setIsLoadingTaxRates(true);
    const fetchPromises = worldIds.map(async (worldId) => {
      try {
        // Check if aborted before making request
        if (taxRatesSignal.aborted) {
          return { worldId, rates: null };
        }
        const rates = await getTaxRates(worldId, { signal: taxRatesSignal });
        return { worldId, rates };
      } catch (error) {
        // Don't log error if request was aborted
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || taxRatesSignal.aborted) {
          return { worldId, rates: null };
        }
        console.error(`Failed to fetch tax rates for world ${worldId}:`, error);
        return { worldId, rates: null };
      }
    });

    Promise.all(fetchPromises).then(results => {
      // Check if aborted before updating state
      if (taxRatesSignal.aborted) {
        return;
      }
      const taxRatesMap = {};
      results.forEach(({ worldId, rates }) => {
        if (rates) {
          taxRatesMap[worldId] = rates;
        }
      });
      setTaxRates(taxRatesMap);
      setIsLoadingTaxRates(false);
      // Mark this datacenter's tax rates as loaded
      loadedTaxRatesDcRef.current = currentDcName;
    }).catch(error => {
      // Don't log error if request was aborted
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || taxRatesSignal.aborted) {
        return;
      }
      console.error('Error fetching tax rates:', error);
      setIsLoadingTaxRates(false);
      loadedTaxRatesDcRef.current = null;
    });

    // Cleanup: abort requests when modal closes or dependencies change
    return () => {
      taxRatesAbortController.abort();
    };
  }, [selectedWorld?.section, worlds, isTaxRatesModalOpen]); // Only depend on datacenter name, not the whole selectedWorld object

  // Sync selectedItem to ref
  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    searchResultsRef.current = showUntradeable ? untradeableResults : tradeableResults;
  }, [tradeableResults, untradeableResults, showUntradeable]);
  
  // Auto-hide untradeable items when tradeable items first appear (initial load)
  // But allow user to manually toggle via button after that
  // Only show untradeable items if there are no tradeable items at all
  useEffect(() => {
    const prevLength = prevTradeableResultsLengthRef.current;
    const currentLength = tradeableResults.length;
    
    // Only auto-hide when tradeable items first appear (transition from 0 to > 0)
    // This allows user to manually toggle after initial load
    if (prevLength === 0 && currentLength > 0) {
      // Tradeable items just appeared - auto-hide untradeable items
      if (showUntradeable) {
        setShowUntradeable(false);
      }
    } else if (currentLength === 0 && untradeableResults.length > 0) {
      // Only show untradeable items if there are NO tradeable items at all
      setShowUntradeable(true);
    }
    
    // Update ref for next comparison
    prevTradeableResultsLengthRef.current = currentLength;
  }, [tradeableResults.length, untradeableResults.length, showUntradeable]);

  // Fetch velocity, average price, and tradability data for search results
  useEffect(() => {
    // Get displayed results first to check if we'll need to fetch
    const displayedResults = showUntradeable ? untradeableResults : tradeableResults;
    const willNeedFetch = displayedResults && displayedResults.length > 0 && selectedServerOption && selectedWorld;
    
    // Cancel any in-progress fetch
    if (velocityFetchAbortControllerRef.current) {
      velocityFetchAbortControllerRef.current.abort();
      velocityFetchInProgressRef.current = false;
      // Only enable if server data is loaded AND we won't need to fetch again
      if (isServerDataLoaded && !willNeedFetch) {
        setIsServerSelectorDisabled(false);
      }
    }
    
    // Reset state if no search results or no server selected
    if (!displayedResults || displayedResults.length === 0 || !selectedServerOption || !selectedWorld) {
      setSearchVelocities({});
      setSearchAveragePrices({});
      setSearchMinListings({});
      setSearchRecentPurchases({});
      setSearchTradability({});
      setIsLoadingVelocities(false);
      setVelocityLoadingProgress({ loaded: 0, total: 0 });
      // Only enable server selector if server data is loaded AND no fetch is in progress
      if (isServerDataLoaded && !velocityFetchInProgressRef.current) {
        setIsServerSelectorDisabled(false);
      }
      velocityFetchInProgressRef.current = false;
      lastFetchedItemIdsRef.current = '';
      return;
    }

    // Get all item IDs from displayed results and sort by ilvl before API query
    (async () => {
      const allItemIds = displayedResults.map(item => item.id);
      
      // Check marketability ONLY for displayed items (efficient - uses WHERE IN)
      const { getMarketableItemsByIds } = await import('./services/universalis');
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
        // CRITICAL: When showing untradeable items, don't clear universalis data
        // Keep the existing data so it's still visible when switching back to tradeable items
        // Only clear data if we're showing tradeable items but they're all filtered out (shouldn't happen)
        if (showUntradeable) {
          // Showing untradeable items - keep existing universalis data, just stop loading
          setIsLoadingVelocities(false);
          setVelocityLoadingProgress({ loaded: 0, total: 0 });
          // Only enable server selector if server data is loaded AND no fetch is in progress
          if (isServerDataLoaded && !velocityFetchInProgressRef.current) {
            setIsServerSelectorDisabled(false);
          }
          velocityFetchInProgressRef.current = false;
          // Clear lastFetchedItemIdsRef so when switching back to tradeable items, it will trigger a new fetch
          // Use a special marker to indicate we're showing untradeable items
          lastFetchedItemIdsRef.current = 'UNTradeable';
          return;
        }
        
        // Only clear data if we're showing tradeable items but have no marketable items
        // This should rarely happen, but handle it gracefully
        setSearchVelocities({});
        setSearchAveragePrices({});
        setSearchMinListings({});
        setSearchRecentPurchases({});
        setSearchTradability({});
        setIsLoadingVelocities(false);
        setVelocityLoadingProgress({ loaded: 0, total: 0 });
        // Only enable server selector if server data is loaded AND no fetch is in progress
        if (isServerDataLoaded && !velocityFetchInProgressRef.current) {
          setIsServerSelectorDisabled(false);
        }
        velocityFetchInProgressRef.current = false;
        lastFetchedItemIdsRef.current = '';
        return;
      }

      // Create a stable key from item IDs and server option to detect if items or server changed
      const itemIdsKey = [...sortedItemIds].sort((a, b) => a - b).join(',');
      const serverKey = `${selectedServerOption}`;
      const cacheKey = `${itemIdsKey}|${serverKey}`;
      
      // Clear state if server changed (to avoid showing stale DC prices when switching to server)
      if (lastFetchedItemIdsRef.current && lastFetchedItemIdsRef.current !== cacheKey) {
        // Handle special case: 'UNTradeable' marker means we were showing untradeable items
        // In this case, we want to fetch new data (don't clear existing data)
        if (lastFetchedItemIdsRef.current === 'UNTradeable') {
          // Don't clear data - we're switching from untradeable to tradeable, keep existing data visible
          // The new fetch will update it
        } else {
          // Normal case: check if server changed
          const lastServerKey = lastFetchedItemIdsRef.current.split('|')[1];
          if (lastServerKey !== serverKey) {
            setSearchVelocities({});
            setSearchAveragePrices({});
            setSearchMinListings({});
            setSearchRecentPurchases({});
            setSearchTradability({});
          }
        }
      }
      
      // Skip if already fetching or if items and server haven't changed
      if (velocityFetchInProgressRef.current || lastFetchedItemIdsRef.current === cacheKey) {
        // If already fetching, ensure server selector stays disabled
        if (velocityFetchInProgressRef.current && isServerDataLoaded) {
          setIsServerSelectorDisabled(true);
        }
        return;
      }

      // Set fetch in progress flag FIRST to prevent early returns from enabling selector
      // This must happen BEFORE any state updates that might trigger re-renders
      velocityFetchInProgressRef.current = true;
      
      // Disable server selector immediately when we have results that need fetching
      // This must happen BEFORE the async fetchData function starts
      if (isServerDataLoaded) {
        setIsServerSelectorDisabled(true);
      }

      // Create new abort controller and request ID
      const currentRequestId = ++velocityFetchRequestIdRef.current;
      velocityFetchAbortControllerRef.current = new AbortController();
      const abortSignal = velocityFetchAbortControllerRef.current.signal;

      const fetchData = async () => {
        setIsLoadingVelocities(true);
        setIsServerSelectorDisabled(true); // Disable server selector until all batches complete
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
            
            // Process batch results
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
                // This is because "全服平均價格" should show DC average when available
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
                    
                    // Only store recentPurchase if world data actually exists
                    if (selectedData !== null) {
                      // Extract region if available
                      const region = selectedData?.region;
                      recentPurchase = { price: recentPurchasePrice };
                      if (region !== undefined) {
                        recentPurchase.region = region;
                      }
                    }
                    // If selectedData is null, recentPurchase remains null (don't store DC prices)
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
            // First 20 items appear quickly, then 50 more, then the rest in batches of 100
            // Use flushSync to force immediate synchronous rendering, breaking React's batching
            if (!abortSignal.aborted && currentRequestId === velocityFetchRequestIdRef.current) {
              flushSync(() => {
                // Merge new batch data with existing state
                setSearchVelocities(prev => ({ ...prev, ...batchVelocities }));
                setSearchAveragePrices(prev => ({ ...prev, ...batchAveragePrices }));
                setSearchMinListings(prev => ({ ...prev, ...batchMinListings }));
                setSearchRecentPurchases(prev => ({ ...prev, ...batchRecentPurchases }));
                setSearchTradability(prev => ({ ...prev, ...batchTradability }));
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
                setSearchTradability(prev => ({ ...prev, ...batchTradability }));
              });
            }
          }
        };
        
        // Process batches recursively, scheduling each in separate event loop tick
        // This ensures React processes each batch's state update before the next one
        const processBatchesRecursively = async (batchNumber, startIndex) => {
          // Check if request was cancelled or superseded
          if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
            return;
          }
          
          if (startIndex >= sortedItemIds.length) {
            return; // All batches processed
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
          }
        };
        
        // Start processing batches
        await processBatchesRecursively(0, 0);
        
        // Mark fetch as complete
        if (!abortSignal.aborted && currentRequestId === velocityFetchRequestIdRef.current) {
          velocityFetchInProgressRef.current = false;
          // Update loading progress to show all items are loaded
          setVelocityLoadingProgress(prev => ({ loaded: prev.total, total: prev.total }));
          // Enable server selector after all batches complete (only if server data is loaded)
          if (isServerDataLoaded) {
            setIsServerSelectorDisabled(false);
          }
          // Remember that we've fetched these items (don't refetch unless they change)
          lastFetchedItemIdsRef.current = cacheKey;
        } else {
          // Request was superseded, reset the in-progress flag
          velocityFetchInProgressRef.current = false;
          // Only enable if server data is loaded AND no other fetch is starting
          // Don't enable here - let the new request handle it
        }
      } catch (error) {
        // Ignore abort errors
        if (error.name === 'AbortError' || abortSignal.aborted) {
          return;
        }
        console.error('Error fetching velocities, average prices, and tradability:', error);
        // On error, reset so it can retry
        if (currentRequestId === velocityFetchRequestIdRef.current) {
          velocityFetchInProgressRef.current = false;
          // Only enable if server data is loaded
          if (isServerDataLoaded) {
            setIsServerSelectorDisabled(false);
          }
          lastFetchedItemIdsRef.current = '';
        }
      } finally {
        // Loading state is now set to false after first batch completes
        // Only reset if request was cancelled or superseded
        if (currentRequestId !== velocityFetchRequestIdRef.current) {
          setIsLoadingVelocities(false);
          // Don't enable server selector here - let the new request handle it
        }
      }
    };
    
    fetchData();
    })(); // Close IIFE
    
    // Cleanup function
    return () => {
      if (velocityFetchAbortControllerRef.current) {
        velocityFetchAbortControllerRef.current.abort();
      }
    };
  }, [tradeableResults, untradeableResults, selectedServerOption, selectedWorld, isServerDataLoaded]);


  // Cancel icon requests when navigating away from search page
  // This ensures item info page icons load immediately without waiting for search page requests
  useEffect(() => {
    const isOnSearchPage = location.pathname === '/search';
    
    // If we're not on the search page, cancel all icon requests immediately
    // This allows item info page icons to load without waiting for queued search page requests
    if (!isOnSearchPage) {
      cancelAllIconRequests();
    }
    
    // Cleanup: cancel icon requests when component unmounts or when leaving search page
    return () => {
      if (!isOnSearchPage) {
        cancelAllIconRequests();
      }
    };
  }, [location.pathname]);

  // Fetch velocity, average price, and tradability data for history page items
  useEffect(() => {
    const isOnHistoryPage = location.pathname === '/history';
    
    // Only fetch if on history page and not loading item details
    if (!isOnHistoryPage || selectedItem) {
      // Reset state if not on history page
      if (!isOnHistoryPage) {
        setHistoryVelocities({});
        setHistoryAveragePrices({});
        setHistoryMinListings({});
        setHistoryRecentPurchases({});
        setHistoryTradability({});
        setIsLoadingHistoryVelocities(false);
        historyFetchInProgressRef.current = false;
        lastFetchedHistoryIdsRef.current = '';
      }
      return;
    }
    
    // Cancel any in-progress fetch
    if (historyFetchAbortControllerRef.current) {
      historyFetchAbortControllerRef.current.abort();
      historyFetchInProgressRef.current = false;
    }
    
    // Reset state if no history items or no server selected
    if (!historyItems || historyItems.length === 0 || !selectedServerOption || !selectedWorld) {
      setHistoryVelocities({});
      setHistoryAveragePrices({});
      setHistoryMinListings({});
      setHistoryRecentPurchases({});
      setHistoryTradability({});
      setIsLoadingHistoryVelocities(false);
      historyFetchInProgressRef.current = false;
      lastFetchedHistoryIdsRef.current = '';
      return;
    }

    // Get all item IDs from history items and sort by ilvl before API query
    (async () => {
      const allItemIds = historyItems.map(item => item.id);
      
      // Check marketability ONLY for history items (efficient - uses WHERE IN)
      const { getMarketableItemsByIds } = await import('./services/universalis');
      const marketableSet = await getMarketableItemsByIds(allItemIds);
      
      // Filter to only marketable items before batch processing
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
        setHistoryVelocities({});
        setHistoryAveragePrices({});
        setHistoryMinListings({});
        setHistoryRecentPurchases({});
        setHistoryTradability({});
        setIsLoadingHistoryVelocities(false);
        historyFetchInProgressRef.current = false;
        lastFetchedHistoryIdsRef.current = '';
        return;
      }

      // Create a stable key from item IDs and server option to detect if items or server changed
      const itemIdsKey = [...sortedItemIds].sort((a, b) => a - b).join(',');
      const serverKey = `${selectedServerOption}`;
      const cacheKey = `${itemIdsKey}|${serverKey}`;
      
      // Clear state if server changed
      if (lastFetchedHistoryIdsRef.current && lastFetchedHistoryIdsRef.current !== cacheKey) {
        const lastServerKey = lastFetchedHistoryIdsRef.current.split('|')[1];
        if (lastServerKey !== serverKey) {
          setHistoryVelocities({});
          setHistoryAveragePrices({});
          setHistoryMinListings({});
          setHistoryRecentPurchases({});
          setHistoryTradability({});
        }
      }
      
      // Skip if already fetching or if items and server haven't changed
      if (historyFetchInProgressRef.current || lastFetchedHistoryIdsRef.current === cacheKey) {
        return;
      }

      // Set fetch in progress flag
      historyFetchInProgressRef.current = true;

      // Create new abort controller and request ID
      const currentRequestId = ++historyFetchRequestIdRef.current;
      historyFetchAbortControllerRef.current = new AbortController();
      const abortSignal = historyFetchAbortControllerRef.current.signal;

      const fetchData = async () => {
        setIsLoadingHistoryVelocities(true);
        try {
          // Determine if we're querying DC or world
          const isDCQuery = selectedServerOption === selectedWorld.section;
          // When world is selected, use world ID; when DC is selected, use DC name
          const queryTarget = isDCQuery 
            ? selectedWorld.section  // DC name
            : selectedServerOption;   // World ID (number)
          
          // Progressive batch sizes: 20, then 50, then 100 per batch
          const processBatch = async (batchNumber, startIndex) => {
            // Check if request was cancelled or superseded
            if (abortSignal.aborted || currentRequestId !== historyFetchRequestIdRef.current) {
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
          
            const itemIdsString = batch.join(',');
          
            try {
              const response = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`, {
                signal: abortSignal
              });
            
              // Check again after fetch
              if (abortSignal.aborted || currentRequestId !== historyFetchRequestIdRef.current) {
                return;
              }
            
              const data = await response.json();
            
              // Process batch results (same logic as search page)
              const batchVelocities = {};
              const batchAveragePrices = {};
              const batchMinListings = {};
              const batchRecentPurchases = {};
              const batchTradability = {};
            
              if (data && data.results) {
                data.results.forEach(item => {
                  const itemId = item.itemId;
                
                  // Helper function to get value
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

                  // For average price, fallback to DC data if world data doesn't exist
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

                  // Extract region field when querying a specific world
                  let minListing = null;
                  if (minListingPrice !== null && minListingPrice !== undefined) {
                    if (!isDCQuery) {
                      const nqWorldPrice = item.nq?.minListing?.world?.price;
                      const hqWorldPrice = item.hq?.minListing?.world?.price;
                    
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
                        selectedData = hqWorldPrice <= nqWorldPrice 
                          ? item.hq?.recentPurchase?.world
                          : item.nq?.recentPurchase?.world;
                      } else if (hqWorldPrice !== undefined) {
                        selectedData = item.hq?.recentPurchase?.world;
                      } else if (nqWorldPrice !== undefined) {
                        selectedData = item.nq?.recentPurchase?.world;
                      }
                    
                      if (selectedData !== null) {
                        const region = selectedData?.region;
                        recentPurchase = { price: recentPurchasePrice };
                        if (region !== undefined) {
                          recentPurchase.region = region;
                        }
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
              }
            
              // Items not in results are non-tradable
              batch.forEach(itemId => {
                if (!batchTradability.hasOwnProperty(itemId)) {
                  batchTradability[itemId] = false;
                }
              });
            
              // Update state immediately after each batch
              if (!abortSignal.aborted && currentRequestId === historyFetchRequestIdRef.current) {
                flushSync(() => {
                  setHistoryVelocities(prev => ({ ...prev, ...batchVelocities }));
                  setHistoryAveragePrices(prev => ({ ...prev, ...batchAveragePrices }));
                  setHistoryMinListings(prev => ({ ...prev, ...batchMinListings }));
                  setHistoryRecentPurchases(prev => ({ ...prev, ...batchRecentPurchases }));
                  setHistoryTradability(prev => ({ ...prev, ...batchTradability }));
                });
              
                // Set loading to false after first batch completes
                if (batchNumber === 0) {
                  setIsLoadingHistoryVelocities(false);
                }
              }
            } catch (error) {
              // Ignore abort errors
              if (error.name === 'AbortError' || abortSignal.aborted) {
                return;
              }
              console.error('Error fetching history market data:', error);
              // Mark batch items as non-tradable on error
              const batchTradability = {};
              batch.forEach(itemId => {
                batchTradability[itemId] = false;
              });
              if (!abortSignal.aborted && currentRequestId === historyFetchRequestIdRef.current) {
                flushSync(() => {
                  setHistoryTradability(prev => ({ ...prev, ...batchTradability }));
                });
              }
            }
          };
        
          // Process batches recursively
          const processBatchesRecursively = async (batchNumber, startIndex) => {
            if (abortSignal.aborted || currentRequestId !== historyFetchRequestIdRef.current) {
              return;
            }
          
            if (startIndex >= sortedItemIds.length) {
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
          
            await processBatch(batchNumber, startIndex);
          
            if (abortSignal.aborted || currentRequestId !== historyFetchRequestIdRef.current) {
              return;
            }
          
            const nextIndex = startIndex + batchSize;
          
            if (nextIndex < sortedItemIds.length) {
              await new Promise(resolve => {
                setTimeout(() => {
                  processBatchesRecursively(batchNumber + 1, nextIndex).then(resolve);
                }, batchNumber === 0 ? 0 : 100);
              });
            }
          };
        
          // Start processing batches
          await processBatchesRecursively(0, 0);
        
          // Mark fetch as complete
          if (!abortSignal.aborted && currentRequestId === historyFetchRequestIdRef.current) {
            historyFetchInProgressRef.current = false;
            lastFetchedHistoryIdsRef.current = cacheKey;
          } else {
            historyFetchInProgressRef.current = false;
          }
        } catch (error) {
          // Ignore abort errors
          if (error.name === 'AbortError' || abortSignal.aborted) {
            return;
          }
          console.error('Error fetching history velocities:', error);
          if (currentRequestId === historyFetchRequestIdRef.current) {
            historyFetchInProgressRef.current = false;
            lastFetchedHistoryIdsRef.current = '';
          }
        } finally {
          if (currentRequestId !== historyFetchRequestIdRef.current) {
            setIsLoadingHistoryVelocities(false);
          }
        }
      };
    
      fetchData();
    })(); // Close IIFE
    
    // Cleanup function
    return () => {
      if (historyFetchAbortControllerRef.current) {
        historyFetchAbortControllerRef.current.abort();
      }
    };
  }, [historyItems, selectedServerOption, selectedWorld, isServerDataLoaded, location.pathname, selectedItem]);

  // Manage loading indicator display with minimum 1s display time
  // Show indicator when loading velocities (isLoadingVelocities) OR when server selector is disabled due to loading
  // This ensures indicator stays visible until ALL batches complete, not just the first batch
  useEffect(() => {
    const currentResults = showUntradeable ? untradeableResults : tradeableResults;
    const hasEnoughItems = currentResults.length >= 50 || tradeableResults.length >= 50 || untradeableResults.length >= 50;
    
    // Show indicator if:
    // 1. Currently loading velocities (isLoadingVelocities), OR
    // 2. Server selector is disabled AND we have enough items (means loading is in progress)
    // This ensures indicator shows during the entire loading process, not just until first batch
    const shouldShow = hasEnoughItems && (isLoadingVelocities || (isServerSelectorDisabled && velocityFetchInProgressRef.current));
    
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
  }, [isLoadingVelocities, isServerSelectorDisabled, showUntradeable, tradeableResults.length, untradeableResults.length]);

  // Reset scroll position on mount and route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  // Handle item selection
  const handleItemSelect = useCallback((item, options = {}) => {
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);
    
    // Clear search text to prevent auto-search from triggering when entering item page
    setSearchText('');
    
    // Cancel all icon requests immediately when selecting an item
    // This ensures item info page icon loads without waiting for queued search page requests
    cancelAllIconRequests();
    
    // If clicking from obtainable, mark that we should auto-expand obtainable for the new item
    // Set this BEFORE updating selectedItem to ensure it's ready when useEffect runs
    if (options.fromObtainable) {
      shouldAutoExpandObtainableRef.current = true;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    retryCountRef.current = 0;
    dataReceivedRef.current = false;
    requestInProgressRef.current = false;
    
    setIsLoadingMarket(true);
    
    // Update selectedItem first, then auto-expand will happen in useEffect
    setSelectedItem(item);
    selectedItemRef.current = item;
    
    addItemToHistory(item.id);
    // Detect language preference and generate URL with appropriate language name
    const preferredLang = detectLanguage(searchParams);
    const itemNameForUrl = getItemNameForUrl(item, preferredLang);
    const itemUrl = generateItemUrl(item.id, itemNameForUrl);
    
    // Preserve server selection in URL if present
    const serverParam = searchParams.get('server');
    const worldParam = searchParams.get('world');
    const finalUrl = serverParam 
      ? `${itemUrl}${worldParam ? `?server=${encodeURIComponent(serverParam)}&world=${encodeURIComponent(worldParam)}` : `?server=${encodeURIComponent(serverParam)}`}`
      : itemUrl;
    
    navigate(finalUrl, { replace: false });
    
    addToast(`已選擇: ${item.name}`, 'info');
  }, [addToast, navigate, searchParams]);

  // Initialize from URL on mount and when URL changes
  // SIMPLIFIED: History page now uses useHistory hook, no complex protection needed
  useEffect(() => {
    // Extract itemId early to check if we need to wait for server data
    // Support both /item/{id} and /item/{id}/{slug} formats
    let itemId = params.id;
    let urlSlug = params.slug;
    if (!itemId && location.pathname.startsWith('/item/')) {
      const match = location.pathname.match(/^\/item\/(\d+)(?:\/(.+))?$/);
      if (match) {
        itemId = match[1];
        urlSlug = match[2]; // May be undefined for old format
      }
    }
    
    // If we're on an item page but server data isn't loaded yet, set loading state
    // This prevents showing the home page while waiting
    if (itemId && !isServerDataLoaded) {
      setIsLoadingItemFromURL(true);
      return;
    }
    
    if (!isServerDataLoaded || isInitializingFromURLRef.current) {
      return;
    }

    const currentURLKey = `${location.pathname}?${location.search}`;
    
    // Skip if we've already processed this exact URL
    if (lastProcessedURLRef.current === currentURLKey) {
      return;
    }

    isInitializingFromURLRef.current = true;
    
    // Clear loading state if it was set
    if (isLoadingItemFromURL) {
      setIsLoadingItemFromURL(false);
    }

    // Apply server selection from query parameters if present
    const serverParam = searchParams.get('server');
    const worldParam = searchParams.get('world');
    const dcParam = searchParams.get('dc');
    
    if (serverParam && isServerDataLoaded) {
      // If server param matches a datacenter, set it as server option
      const dcExists = datacenters.some(dc => dc.name === serverParam);
      if (dcExists || (worldParam && worlds[serverParam])) {
        // Valid server/world from query params
        setSelectedServerOption(serverParam);
        
        // Also set the world if provided
        if (worldParam) {
          const worldToSet = Object.values(worlds).find(w => w && w.name === worldParam);
          if (worldToSet) {
            setSelectedWorld(worldToSet);
          }
        }
      }
    }

    // Handle history page - just clear selectedItem and let useHistory hook handle the data
    if (location.pathname === '/history') {
      setSelectedItem(null);
      selectedItemRef.current = null;
      // Don't touch searchResults - history page uses historyItems from hook
      lastProcessedURLRef.current = currentURLKey;
      isInitializingFromURLRef.current = false;
      return;
    }

    // Handle MSQ price checker page - let component handle state restoration from URL
    if (location.pathname === '/msq-price-checker') {
      lastProcessedURLRef.current = currentURLKey;
      isInitializingFromURLRef.current = false;
      return;
    }

    // Handle secret page - don't interfere with it
    if (location.pathname === '/crafting-inspiration') {
      lastProcessedURLRef.current = currentURLKey;
      isInitializingFromURLRef.current = false;
      return;
    }

    // Check if we're on item detail page
    if (itemId) {
      const id = parseInt(itemId, 10);
      if (id && !isNaN(id)) {
        const currentSelectedItem = selectedItemRef.current;
        // Detect language preference for URL generation
        const preferredLang = detectLanguage(searchParams);
        
        if (!currentSelectedItem || currentSelectedItem.id !== id) {
          const foundItem = searchResultsRef.current.find(item => item.id === id);
          if (foundItem) {
            // Generate correct slug using preferred language name
            const itemNameForUrl = getItemNameForUrl(foundItem, preferredLang);
            const correctSlug = generateItemSlug(itemNameForUrl);
            const decodedUrlSlug = urlSlug ? decodeURIComponent(urlSlug) : null;
            
            // Always redirect if slug is missing (only ID in URL) or doesn't match
            // This ensures /item/12345 redirects to /item/12345/物品名稱
            if (!urlSlug || !decodedUrlSlug || decodedUrlSlug !== correctSlug) {
              const correctUrl = generateItemUrl(id, itemNameForUrl);
              // Preserve server selection and other query params in URL
              const serverParam = searchParams.get('server');
              const worldParam = searchParams.get('world');
              const langParam = searchParams.get('lang');
              const queryParams = new URLSearchParams();
              if (serverParam) queryParams.set('server', serverParam);
              if (worldParam) queryParams.set('world', worldParam);
              if (langParam) queryParams.set('lang', langParam);
              const queryString = queryParams.toString();
              const finalUrl = queryString ? `${correctUrl}?${queryString}` : correctUrl;
              navigate(finalUrl, { replace: true });
              return; // Exit early after redirect
            }
            
            setSelectedItem(foundItem);
            selectedItemRef.current = foundItem;
          } else {
            // Set loading state to prevent showing home page
            setIsLoadingItemFromURL(true);
            getItemById(id)
              .then(item => {
                if (lastProcessedURLRef.current !== currentURLKey) {
                  setIsLoadingItemFromURL(false);
                  return;
                }
                if (item) {
                  // Generate correct slug using preferred language name
                  // Note: getItemById only returns TW name, so we'll use that
                  // In the future, we can enhance getItemById to fetch other languages
                  const itemNameForUrl = getItemNameForUrl(item, preferredLang);
                  const correctSlug = generateItemSlug(itemNameForUrl);
                  const decodedUrlSlug = urlSlug ? decodeURIComponent(urlSlug) : null;
                  
                  // Always redirect if slug is missing (only ID in URL) or doesn't match
                  // This ensures /item/12345 redirects to /item/12345/物品名稱
                  if (!urlSlug || !decodedUrlSlug || decodedUrlSlug !== correctSlug) {
                    const correctUrl = generateItemUrl(id, itemNameForUrl);
                    // Preserve server selection and other query params in URL
                    const serverParam = searchParams.get('server');
                    const worldParam = searchParams.get('world');
                    const langParam = searchParams.get('lang');
                    const queryParams = new URLSearchParams();
                    if (serverParam) queryParams.set('server', serverParam);
                    if (worldParam) queryParams.set('world', worldParam);
                    if (langParam) queryParams.set('lang', langParam);
                    const queryString = queryParams.toString();
                    const finalUrl = queryString ? `${correctUrl}?${queryString}` : correctUrl;
                    navigate(finalUrl, { replace: true });
                    setIsLoadingItemFromURL(false);
                    return; // Exit early after redirect
                  }
                  
                  setSelectedItem(item);
                  selectedItemRef.current = item;
                  setIsLoadingItemFromURL(false);
                } else {
                  setIsLoadingItemFromURL(false);
                  addToast('找不到該物品', 'error');
                  navigate('/');
                }
              })
              .catch(error => {
                setIsLoadingItemFromURL(false);
                if (lastProcessedURLRef.current !== currentURLKey) {
                  return;
                }
                console.error('Failed to load item:', error);
                addToast('載入物品失敗', 'error');
                navigate('/');
              });
          }
        } else {
          // Item already loaded, but check if slug needs updating
          const itemNameForUrl = getItemNameForUrl(currentSelectedItem, preferredLang);
          const correctSlug = generateItemSlug(itemNameForUrl);
          const decodedUrlSlug = urlSlug ? decodeURIComponent(urlSlug) : null;
          
          // Always redirect if slug is missing (only ID in URL) or doesn't match
          // This ensures /item/12345 redirects to /item/12345/物品名稱
          if (!urlSlug || !decodedUrlSlug || decodedUrlSlug !== correctSlug) {
            const correctUrl = generateItemUrl(id, itemNameForUrl);
            // Preserve server selection and other query params in URL
            const serverParam = searchParams.get('server');
            const worldParam = searchParams.get('world');
            const langParam = searchParams.get('lang');
            const queryParams = new URLSearchParams();
            if (serverParam) queryParams.set('server', serverParam);
            if (worldParam) queryParams.set('world', worldParam);
            if (langParam) queryParams.set('lang', langParam);
            const queryString = queryParams.toString();
            const finalUrl = queryString ? `${correctUrl}?${queryString}` : correctUrl;
            navigate(finalUrl, { replace: true });
          }
        }
      }
    }

    // Check if we're on search page
    const searchQuery = searchParams.get('q');
    if (searchQuery && searchQuery.trim() !== '') {
      if (!itemId) {
        setSelectedItem(null);
        selectedItemRef.current = null;
        
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
        setRateLimitMessage(null);
        
        const previousSearchText = searchText;
        
        if (searchText !== searchQuery) {
          setSearchText(searchQuery);
        }
        
        const needsSearch = (tradeableResults.length === 0 && untradeableResults.length === 0) || previousSearchText !== searchQuery;
        
        // Reset page immediately when search query changes to prevent showing old results
        if (previousSearchText !== searchQuery) {
          setSearchCurrentPage(1);
        }
        
        if (needsSearch && !searchInProgressRef.current) {
          searchInProgressRef.current = true;
          const performSearch = async () => {
            if (lastProcessedURLRef.current !== currentURLKey) {
              searchInProgressRef.current = false;
              return;
            }

            if (isLoadingDB || !isServerDataLoaded) {
              searchInProgressRef.current = false;
              return;
            }

            // Removed Chinese input restriction - now supports all languages

            setIsSearching(true);
            setIsServerSelectorDisabled(true); // Lock server selection during initial load
            setError(null);

            // Cancel any previous search
            if (searchAbortControllerRef.current) {
              searchAbortControllerRef.current.abort();
            }
            searchAbortControllerRef.current = new AbortController();
            const searchSignal = searchAbortControllerRef.current.signal;

            // CRITICAL: Clear results IMMEDIATELY when new search starts
            // This prevents old results from being displayed during new search
            // isSearching flag will be true, so UI can show loading state instead of empty
            setTradeableResults([]);
            setUntradeableResults([]);
            setShowUntradeable(false);
            setSearchingItemsCount(0); // Reset count when starting new search

            try {
              const searchResult = await searchItems(searchQuery.trim(), false, searchSignal);
              const { results, converted, originalText, convertedText, searchedSimplified } = searchResult;
              
              // Update searching items count for display
              if (results.length > 0) {
                setSearchingItemsCount(results.length);
              }
              
              if (lastProcessedURLRef.current !== currentURLKey) {
                searchInProgressRef.current = false;
                return;
              }
              
              // Show toast if conversion happened
              if (converted && convertedText) {
                if (searchedSimplified) {
                  if (results.length > 0) {
                    addToast(`「${originalText}」繁體搜尋無資料，在簡體中文資料庫找到結果！`, 'warning');
                  }
                } else {
                  addToast(`「${originalText}」無搜尋結果，正在嘗試轉譯成「${convertedText}」`, 'info');
                }
              }
              
              // STEP 1: Get all search results (includes both marketable and non-marketable)
              // Keep old display visible - no state changes yet to avoid flickering
              
              // STEP 2: Verify tradeability and separate items BEFORE any state update
              const resultIds = results.map(item => item.id).filter(id => id > 0);
              const { getMarketableItemsByIds } = await import('./services/universalis');
              const marketableSet = await getMarketableItemsByIds(resultIds, searchSignal);
              
              // Check if search was aborted or superseded
              if (lastProcessedURLRef.current !== currentURLKey || searchSignal.aborted) {
                searchInProgressRef.current = false;
                return;
              }
              
              // STEP 3: Separate marketable and non-marketable items
              const marketableItems = results.filter(item => marketableSet.has(item.id));
              const nonMarketableItems = results.filter(item => !marketableSet.has(item.id));
              
              // STEP 4: NOW update state - ONLY after separation is complete
              // CRITICAL: Use flushSync to ensure ALL state updates are synchronous and atomic
              // Set isSearching to false INSIDE flushSync to ensure it happens together with results
              // This prevents any intermediate renders with incorrect data
              flushSync(() => {
                setShowUntradeable(false); // Always show marketable by default
                setTradeableResults(marketableItems); // Only marketable items - NEVER contains non-marketable
                setUntradeableResults(nonMarketableItems); // Store non-marketable separately - NEVER mixed with marketable
                setSearchCurrentPage(1); // Reset to first page
                searchResultsRef.current = marketableItems.length > 0 ? marketableItems : nonMarketableItems;
                setError(null);
                setIsSearching(false); // Search complete - set INSIDE flushSync to ensure atomic update
              });
              
              prevTradeableResultsLengthRef.current = 0;
              
              // STEP 5: Show toast with counts
              if (results.length > 1 && previousSearchText !== searchQuery) {
                addToast(`找到 ${marketableItems.length} 個可交易物品${nonMarketableItems.length > 0 ? `、${nonMarketableItems.length} 個不可交易物品` : ''}`, 'success');
              }
              
              // Note: ItemTable will now render only marketableItems (from tradeableResults)
              // Velocity/price fetching will only happen for marketable items
              // Button will show nonMarketableItems count and be disabled until loading completes
              
              if (results.length === 0) {
                addToast('未找到相關物品', 'warning');
                // No results means velocity fetch won't run, so re-enable server selector here
                if (lastProcessedURLRef.current === currentURLKey) {
                  setIsServerSelectorDisabled(false);
                }
              } else {
                // Auto-redirect if there's exactly one result (tradeable or untradeable)
                if (results.length === 1) {
                  // Single result - redirect to it regardless of tradeable status
                  // Use replace: true to replace the /search?q=... entry in history
                  const item = results[0];
                  setSelectedItem(item);
                  selectedItemRef.current = item;
                  addItemToHistory(item.id);
                  // Use preferred language for URL
                  const preferredLang = detectLanguage(searchParams);
                  const itemNameForUrl = getItemNameForUrl(item, preferredLang);
                  const itemUrl = generateItemUrl(item.id, itemNameForUrl);
                  // Preserve server selection in URL
                  const serverParam = searchParams.get('server');
                  const worldParam = searchParams.get('world');
                  const finalUrl = serverParam 
                    ? `${itemUrl}${worldParam ? `?server=${encodeURIComponent(serverParam)}&world=${encodeURIComponent(worldParam)}` : `?server=${encodeURIComponent(serverParam)}`}`
                    : itemUrl;
                  navigate(finalUrl, { replace: true });
                  addToast(`已選擇: ${item.name}`, 'info');
                }
              }
              // If there are results, velocity fetch will handle re-enabling server selector
            } catch (err) {
              // Ignore abort errors
              if (err.name === 'AbortError' || searchSignal.aborted) {
                searchInProgressRef.current = false;
                return;
              }
              if (lastProcessedURLRef.current !== currentURLKey) {
                searchInProgressRef.current = false;
                return;
              }
              console.error('Search error:', err);
              
              // If we have results but tradeability verification failed, show all as marketable (fallback)
              if (results && results.length > 0) {
                setShowUntradeable(false);
                setTradeableResults(results);
                setUntradeableResults([]);
                searchResultsRef.current = results;
                if (results.length > 1 && previousSearchText !== searchQuery) {
                  addToast(`找到 ${results.length} 個物品`, 'success');
                }
                if (results.length === 1) {
                  const item = results[0];
                  setSelectedItem(item);
                  selectedItemRef.current = item;
                  addItemToHistory(item.id);
                  // Use preferred language for URL
                  const preferredLang = detectLanguage(searchParams);
                  const itemNameForUrl = getItemNameForUrl(item, preferredLang);
                  const itemUrl = generateItemUrl(item.id, itemNameForUrl);
                  // Preserve server selection in URL
                  const serverParam = searchParams.get('server');
                  const worldParam = searchParams.get('world');
                  const finalUrl = serverParam 
                    ? `${itemUrl}${worldParam ? `?server=${encodeURIComponent(serverParam)}&world=${encodeURIComponent(worldParam)}` : `?server=${encodeURIComponent(serverParam)}`}`
                    : itemUrl;
                  navigate(finalUrl, { replace: true });
                  addToast(`已選擇: ${item.name}`, 'info');
                }
              } else {
                // No results or search failed completely
                setError('搜索失敗，請稍後再試');
                setTradeableResults([]);
                setUntradeableResults([]);
                setShowUntradeable(false);
                searchResultsRef.current = [];
                addToast('搜索失敗', 'error');
                // On error, re-enable server selector since velocity fetch won't run
                setIsServerSelectorDisabled(false);
              }
            } finally {
              if (lastProcessedURLRef.current === currentURLKey) {
                setIsSearching(false);
              }
              searchInProgressRef.current = false;
            }
          };
          
          performSearch();
        }
      }
    } else if (!itemId && location.pathname === '/') {
      // We're on home page - clear search state but NOT history-related state
      // Cancel any in-progress search queries
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }
      
      const currentSelectedItem = selectedItemRef.current;
      const currentSearchResults = searchResultsRef.current;
      if (currentSelectedItem || currentSearchResults.length > 0 || searchText) {
        setSelectedItem(null);
        selectedItemRef.current = null;
        setTradeableResults([]);
        setUntradeableResults([]);
        setShowUntradeable(false);
        searchResultsRef.current = [];
        setSearchText('');
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
      }
    }

    lastProcessedURLRef.current = currentURLKey;
    isInitializingFromURLRef.current = false;
  }, [location.pathname, location.search, isServerDataLoaded, params.id, searchParams, searchText, navigate, addToast, isLoadingDB, datacenters, worlds, handleItemSelect]);

  // Handle return to home page
  const handleReturnHome = useCallback(() => {
    setSelectedItem(null);
    selectedItemRef.current = null;
    setTradeableResults([]);
    setUntradeableResults([]);
    setShowUntradeable(false);
    searchResultsRef.current = [];
    setSearchText('');
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    retryCountRef.current = 0;
    dataReceivedRef.current = false;
    requestInProgressRef.current = false;
    
    navigate('/', { replace: false });
  }, [navigate]);

  // Handle search
  const handleSearch = useCallback(async (searchTerm, skipNavigation = false, isOCR = false, ocrOptions = null) => {
    const trimmedTerm = searchTerm ? searchTerm.trim() : '';
    // Prevent concurrent searches - only check if a search is already in progress
    if (searchInProgressRef.current) {
      return;
    }
    
    let currentItemId = params.id;
    if (!currentItemId && location.pathname.startsWith('/item/')) {
      const match = location.pathname.match(/^\/item\/(\d+)(?:\/(.+))?$/);
      if (match) {
        currentItemId = match[1];
      }
    }
    if (!trimmedTerm) {
      lastSearchedTermRef.current = '';
      setTradeableResults([]);
      setUntradeableResults([]);
      setShowUntradeable(false);
      setSearchingItemsCount(0);
      if (!selectedItemRef.current) {
        setSelectedItem(null);
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
        setError(null);
        setRateLimitMessage(null);
        // Don't navigate if we're on crafting-inspiration, msq-price-checker, advanced-search or history page
        if (!skipNavigation && !currentItemId && location.pathname !== '/crafting-inspiration' && location.pathname !== '/msq-price-checker' && location.pathname !== '/advanced-search' && location.pathname !== '/history') {
          navigate('/');
        }
      }
      return;
    }

    if (isLoadingDB || !isServerDataLoaded) {
      addToast('請等待伺服器資料加載完成', 'warning');
      return;
    }

    // Removed Chinese input restriction - now supports all languages

    searchInProgressRef.current = true;
    if (trimmedTerm) {
      lastSearchedTermRef.current = trimmedTerm;
    }
    setIsSearching(true);
    setError(null);
    
    setSelectedItem(null);
    selectedItemRef.current = null;
    
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setRateLimitMessage(null);
    
    // Cancel all pending icon requests from previous search
    cancelAllIconRequests();
    
    // Clear market data states to force reload
    setSearchVelocities({});
    setSearchAveragePrices({});
    setSearchMinListings({});
    setSearchRecentPurchases({});
    setSearchTradability({});
    lastFetchedItemIdsRef.current = ''; // Clear cache to force market data reload

    // Navigate to search results page, except when explicitly skipping navigation
    // Allow navigation from all pages including history, crafting-inspiration and msq-price-checker pages
    if (!skipNavigation && trimmedTerm) {
      navigate(`/search?q=${encodeURIComponent(trimmedTerm)}`, { replace: false });
    }

    try {
      // Cancel any previous search
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      searchAbortControllerRef.current = new AbortController();
      const searchSignal = searchAbortControllerRef.current.signal;
      
      // CRITICAL: Clear results IMMEDIATELY when new search starts
      // This prevents old results from being displayed during new search
      // isSearching flag will be true, so UI can show loading state instead of empty
      setTradeableResults([]);
      setUntradeableResults([]);
      setShowUntradeable(false);
      setSearchingItemsCount(0); // Reset count when starting new search
      setIsSearching(true);
      
      // Use OCR search if isOCR flag is set, otherwise use regular search
      const searchResult = isOCR 
        ? await searchItemsOCR(trimmedTerm, searchSignal, ocrOptions || undefined)
        : await searchItems(trimmedTerm, false, searchSignal);
      const { results, converted, originalText, convertedText, searchedSimplified } = searchResult;
      
      // Update searching items count for display
      if (results.length > 0) {
        setSearchingItemsCount(results.length);
      }
      
      // Show toast if conversion happened
      if (converted && convertedText) {
        if (searchedSimplified) {
          if (results.length > 0) {
            addToast(`「${originalText}」繁體搜尋無資料，在簡體中文資料庫找到結果！`, 'warning');
          }
        } else {
          addToast(`「${originalText}」無搜尋結果，正在嘗試轉譯成「${convertedText}」`, 'info');
        }
      }
      
      // STEP 1: Get all search results (includes both marketable and non-marketable)
      // CRITICAL: isSearching=true, so table will NOT render anything during verification
      // tradeableResults and untradeableResults are empty arrays, so table has NO data
      
      // STEP 2: Verify tradeability and separate items BEFORE any state update
      // During this step, isSearching=true, so table remains hidden with no data
      const resultIds = results.map(item => item.id).filter(id => id > 0);
      const { getMarketableItemsByIds } = await import('./services/universalis');
      const marketableSet = await getMarketableItemsByIds(resultIds, searchSignal);
      
      // Check if search was aborted
      if (searchSignal.aborted) {
        return;
      }
      
      // STEP 3: Separate marketable and non-marketable items
      const marketableItems = results.filter(item => marketableSet.has(item.id));
      const nonMarketableItems = results.filter(item => !marketableSet.has(item.id));
      
      // STEP 4: NOW update state - ONLY after separation is complete
      // CRITICAL: Use flushSync to ensure ALL state updates are synchronous and atomic
      // Set isSearching to false INSIDE flushSync to ensure it happens together with results
      // This prevents any intermediate renders with incorrect data
      flushSync(() => {
        setShowUntradeable(false); // Always show marketable by default
        setTradeableResults(marketableItems); // Only marketable items - NEVER contains non-marketable
        setUntradeableResults(nonMarketableItems); // Store non-marketable separately - NEVER mixed with marketable
        setSearchCurrentPage(1); // Reset to first page
        setError(null);
        setIsSearching(false); // Search complete - set INSIDE flushSync to ensure atomic update
        setSearchingItemsCount(0); // Reset count after search completes
        setIsOCRSearchResult(isOCR); // Preserve result order in ItemTable for OCR (no ilvl sort)
      });
      
      prevTradeableResultsLengthRef.current = 0;
      
      // STEP 5: Show toast with counts
      if (results.length > 1) {
        addToast(`找到 ${marketableItems.length} 個可交易物品${nonMarketableItems.length > 0 ? `、${nonMarketableItems.length} 個不可交易物品` : ''}`, 'success');
      }
      
      // Note: ItemTable will now render only marketableItems (from tradeableResults)
      // Velocity/price fetching will only happen for marketable items
      // Button will show nonMarketableItems count and be disabled until loading completes
      
      if (results.length === 0) {
        addToast('未找到相關物品', 'warning');
        // No results means velocity fetch won't run, so re-enable server selector here
        setIsServerSelectorDisabled(false);
      } else {
        // Record search keyword to history (skip OCR searches)
        if (trimmedTerm && !isOCR) {
          addSearchToHistory(trimmedTerm);
        }
        
        // Auto-redirect if there's exactly one result (tradeable or untradeable)
        if (results.length === 1) {
          // Single result - redirect to it regardless of tradeable status
          // Use replace: true to replace the /search?q=... entry in history
          const item = results[0];
          setSelectedItem(item);
          selectedItemRef.current = item;
          addItemToHistory(item.id);
          // Use preferred language for URL
          const preferredLang = detectLanguage(searchParams);
          const itemNameForUrl = getItemNameForUrl(item, preferredLang);
          const itemUrl = generateItemUrl(item.id, itemNameForUrl);
          // Preserve server selection in URL
          const serverParam = searchParams.get('server');
          const worldParam = searchParams.get('world');
          const finalUrl = serverParam 
            ? `${itemUrl}${worldParam ? `?server=${encodeURIComponent(serverParam)}&world=${encodeURIComponent(worldParam)}` : `?server=${encodeURIComponent(serverParam)}`}`
            : itemUrl;
          navigate(finalUrl, { replace: true });
          addToast(`已選擇: ${item.name}`, 'info');
        }
      }
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError' || searchSignal.aborted) {
        return;
      }
      setError(err.message || '搜索失敗，請稍後再試');
      addToast('搜索失敗', 'error');
      setTradeableResults([]);
      setUntradeableResults([]);
      setShowUntradeable(false);
      setSearchingItemsCount(0);
      setIsOCRSearchResult(false);
    } finally {
      setIsSearching(false);
      setSearchingItemsCount(0); // Reset count when search completes (success or error)
      searchInProgressRef.current = false;
      // Clear last searched term after a short delay to allow for legitimate re-searches
      setTimeout(() => {
        if (lastSearchedTermRef.current === trimmedTerm) {
          lastSearchedTermRef.current = '';
        }
      }, 1000);
    }
  }, [addToast, isLoadingDB, selectedServerOption, handleItemSelect, params.id, location.pathname, navigate]);

  // Handle server option change
  const handleServerOptionChange = useCallback((option) => {
    // Update selectedWorld first, then selectedServerOption to ensure consistency
    if (option && datacenters && worlds) {
      // If option is a number (worldId), find the datacenter containing this world
      if (typeof option === 'number') {
        const dc = datacenters.find(dc => dc.worlds && dc.worlds.includes(option));
        if (dc && dc.worlds && dc.worlds.length > 0) {
          const worldName = worlds[option];
          const newWorld = {
            region: dc.region || '',
            section: dc.name,
            world: worldName,
            dcObj: dc,
          };
          setSelectedWorld(newWorld);
          setSelectedServerOption(option);
        }
      } 
      // If option is a string (datacenter name), find the datacenter and set first world
      else if (typeof option === 'string') {
        const dc = datacenters.find(dc => dc.name === option);
        if (dc && dc.worlds && dc.worlds.length > 0) {
          const firstWorldId = dc.worlds[0];
          const firstWorldName = worlds[firstWorldId];
          const newWorld = {
            region: dc.region || '',
            section: dc.name,
            world: firstWorldName,
            dcObj: dc,
          };
          setSelectedWorld(newWorld);
          setSelectedServerOption(option);
        }
      }
    } else {
      // Fallback: just update selectedServerOption if we can't find the world
      setSelectedServerOption(option);
    }
    
    // Disable server selector when server is changed - velocity fetch will re-enable it when done
    setIsServerSelectorDisabled(true);
  }, [datacenters, worlds]);

  // Preload item icon immediately when item info page loads
  // This ensures icon request is processed before prices/obtainable methods/etc
  useEffect(() => {
    if (!selectedItem || !selectedItem.id) {
      return;
    }

    // Preload icon immediately - this will queue the request first
    // The ItemImage component will use the cached result when it renders
    preloadItemIcon(selectedItem.id).catch(error => {
      // Silently ignore errors - ItemImage component will handle retries
      if (error.message !== 'Request cancelled') {
        // Only log non-cancellation errors
      }
    });
  }, [selectedItem?.id]); // Only depend on item ID to avoid unnecessary reloads

  // Load market data when item or server changes
  useEffect(() => {
    if (isLoadingDB || !selectedItem || !selectedServerOption) {
      setMarketInfo(null);
      setMarketListings([]);
      setMarketHistory([]);
      return;
    }

    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    abortControllerRef.current = new AbortController();

    const currentRequestId = ++requestIdRef.current;
    
    const requestItemId = selectedItem.id;
    const requestItemName = selectedItem.name;
    const requestServerOption = selectedServerOption;
    
    retryCountRef.current = 0;
    dataReceivedRef.current = false;
    requestInProgressRef.current = false;
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const loadMarketData = async (isRetry = false) => {
      if (isRetry && abortControllerRef.current) {
        abortControllerRef.current.abort();
        const newAbortController = new AbortController();
        abortControllerRef.current = newAbortController;
      }

      setIsLoadingMarket(true);
      setError(null);
      setRateLimitMessage(null);
      
      requestInProgressRef.current = true;
      dataReceivedRef.current = false;
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      retryTimeoutRef.current = setTimeout(() => {
        if (
          requestInProgressRef.current && 
          !dataReceivedRef.current && 
          retryCountRef.current < 3 && 
          currentRequestId === requestIdRef.current && 
          !abortControllerRef.current?.signal.aborted &&
          selectedItem?.id === requestItemId &&
          selectedServerOption === requestServerOption
        ) {
          retryCountRef.current++;
          requestInProgressRef.current = false;
          addToast(`請求超時，正在重試 (${retryCountRef.current}/3)...`, 'warning');
          loadMarketData(true);
        }
      }, 1500);

      try {
        const options = {
          listings: listSize,
          entries: listSize,
          signal: abortControllerRef.current.signal,
        };

        if (selectedItem.canBeHQ && hqOnly) {
          options.hq = true;
        }

        const data = await getMarketData(requestServerOption, requestItemId, options);

        if (
          abortControllerRef.current?.signal.aborted || 
          currentRequestId !== requestIdRef.current ||
          selectedItem?.id !== requestItemId ||
          selectedServerOption !== requestServerOption
        ) {
          requestInProgressRef.current = false;
          return;
        }

        dataReceivedRef.current = true;
        requestInProgressRef.current = false;
        
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }

        setMarketInfo(data);

        if (data) {
          const isDataCenterSearch = selectedWorld && requestServerOption === selectedWorld.section;
          
          const allListings = (data.listings || [])
            .map(listing => ({
              itemName: requestItemName,
              pricePerUnit: listing.pricePerUnit,
              quantity: listing.quantity,
              total: listing.total,
              retainerName: listing.retainerName,
              worldName: listing.worldName || (isDataCenterSearch ? (data.dcName || requestServerOption) : (data.worldName || requestServerOption)),
              hq: listing.hq || false,
            }))
            .sort((a, b) => a.pricePerUnit - b.pricePerUnit);
          
          const listings = allListings.slice(0, listSize);

          const allHistory = (data.recentHistory || [])
            .map(entry => ({
              itemName: requestItemName,
              pricePerUnit: entry.pricePerUnit,
              quantity: entry.quantity,
              total: entry.total,
              buyerName: entry.buyerName,
              worldName: entry.worldName || (isDataCenterSearch ? (data.dcName || requestServerOption) : (data.worldName || requestServerOption)),
              timestamp: entry.timestamp,
              hq: entry.hq || false,
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
          
          const history = allHistory.slice(0, listSize);

          if (
            currentRequestId === requestIdRef.current && 
            !abortControllerRef.current?.signal.aborted &&
            selectedItem?.id === requestItemId &&
            selectedServerOption === requestServerOption
          ) {
            setMarketListings(listings);
            setMarketHistory(history);
            if (isRetry && retryCountRef.current > 0) {
              addToast('數據加載成功', 'success');
            }
          }
        }
      } catch (err) {
        requestInProgressRef.current = false;
        
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        if (
          currentRequestId === requestIdRef.current &&
          selectedItem?.id === requestItemId &&
          selectedServerOption === requestServerOption
        ) {
          if (err.message && err.message.includes('請求頻率過高')) {
            setRateLimitMessage('請求頻率過高，請稍後再試');
            addToast('請求頻率過高，請稍後再試', 'warning');
            setTimeout(() => {
              if (
                currentRequestId === requestIdRef.current && 
                !abortControllerRef.current?.signal.aborted &&
                selectedItem?.id === requestItemId &&
                selectedServerOption === requestServerOption
              ) {
                setRefreshKey(prev => prev + 1);
              }
            }, 3000);
          } else {
            if (err.response?.status === 404) {
              setError('此物品在市場數據中不存在，可能無法在市場板交易');
              addToast('此物品在市場數據中不存在', 'warning');
              return;
            }
            
            if (retryCountRef.current < 3) {
              retryCountRef.current++;
              addToast(`請求失敗，正在重試 (${retryCountRef.current}/3)...`, 'warning');
              setTimeout(() => {
                if (
                  currentRequestId === requestIdRef.current && 
                  !abortControllerRef.current?.signal.aborted &&
                  selectedItem?.id === requestItemId &&
                  selectedServerOption === requestServerOption
                ) {
                  loadMarketData(true);
                }
              }, 500);
            } else {
              setError(err.message);
              addToast('加載市場數據失敗', 'error');
            }
          }
        }
      } finally {
        if (currentRequestId === requestIdRef.current && (dataReceivedRef.current || retryCountRef.current >= 3 || !requestInProgressRef.current)) {
          setIsLoadingMarket(false);
        }
      }
    };

    loadMarketData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [isLoadingDB, selectedItem, selectedServerOption, listSize, hqOnly, worlds, refreshKey, addToast, selectedWorld]);

  // Pre-fetch Simplified Chinese name when entering item info page
  useEffect(() => {
    if (!selectedItem) {
      if (simplifiedNameAbortControllerRef.current) {
        cancelSimplifiedNameFetch();
        simplifiedNameAbortControllerRef.current = null;
      }
      return;
    }

    const abortController = new AbortController();
    simplifiedNameAbortControllerRef.current = abortController;

    getSimplifiedChineseName(selectedItem.id, abortController.signal)
      .then(simplifiedName => {
        if (abortController.signal.aborted) {
          return;
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`Pre-fetched Simplified Chinese name for item ${selectedItem.id}:`, simplifiedName);
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Failed to pre-fetch Simplified Chinese name:', error);
        }
      });

    return () => {
      if (simplifiedNameAbortControllerRef.current === abortController) {
        cancelSimplifiedNameFetch();
        simplifiedNameAbortControllerRef.current = null;
      }
    };
  }, [selectedItem]);

  // Load crafting recipe when item changes
  useEffect(() => {
    if (!selectedItem) {
      setCraftingTree(null);
      setHasCraftingRecipe(false);
      setIsCraftingTreeExpanded(false);
      setHasRelatedItems(false);
      setIsRelatedItemsExpanded(false);
      setIsObtainMethodsExpanded(false);
      setButtonOrder({ obtainMethods: 0, craftingTree: 0, relatedItems: 0 });
      shouldAutoExpandObtainableRef.current = false;
      return;
    }
    
    // Auto-expand obtainable if we clicked from obtainable
    // Use setTimeout to ensure this happens after React has updated the DOM
    // This prevents race conditions where component mounts before selectedItem is fully set
    if (shouldAutoExpandObtainableRef.current) {
      // Use a small delay to ensure selectedItem is fully updated in the component tree
      const timeoutId = setTimeout(() => {
        setIsObtainMethodsExpanded(true);
        setButtonOrder(prev => ({ ...prev, obtainMethods: Math.max(...Object.values(prev)) + 1 }));
        shouldAutoExpandObtainableRef.current = false; // Reset flag after using it
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }

    // Check if item has a recipe
    setIsLoadingCraftingTree(true);
    setCraftingTree(null);
    setIsCraftingTreeExpanded(false);
    
    hasRecipe(selectedItem.id)
      .then(async (hasCraft) => {
        setHasCraftingRecipe(hasCraft);
        
        if (hasCraft) {
          // Build the crafting tree with excludeCrystals parameter
          const tree = await buildCraftingTree(selectedItem.id, 1, new Set(), 0, excludeCrystals);
          setCraftingTree(tree);
        }
        
        setIsLoadingCraftingTree(false);
      })
      .catch(error => {
        console.error('Failed to load crafting recipe:', error);
        setHasCraftingRecipe(false);
        setCraftingTree(null);
        setIsLoadingCraftingTree(false);
      });

    // Check if item is used as ingredient in any recipe
    setIsLoadingRelatedItems(true);
    setIsRelatedItemsExpanded(false);
    
    findRelatedItems(selectedItem.id)
      .then(ids => {
        setHasRelatedItems(ids.length > 0);
        setIsLoadingRelatedItems(false);
      })
      .catch(error => {
        console.error('Failed to check related items:', error);
        setHasRelatedItems(false);
        setIsLoadingRelatedItems(false);
      });
  }, [selectedItem]);

  // Update crafting tree when excludeCrystals changes (without collapsing)
  useEffect(() => {
    if (!selectedItem || !hasCraftingRecipe) return;

    setIsLoadingCraftingTree(true);
    
    buildCraftingTree(selectedItem.id, 1, new Set(), 0, excludeCrystals)
      .then(tree => {
        setCraftingTree(tree);
        setIsLoadingCraftingTree(false);
      })
      .catch(error => {
        console.error('Failed to rebuild crafting tree:', error);
        setIsLoadingCraftingTree(false);
      });
  }, [excludeCrystals, selectedItem, hasCraftingRecipe]);

  // Scroll to crafting tree when it's expanded from ObtainMethods
  useEffect(() => {
    // Only scroll if it changed from false to true (expanded) AND was expanded from ObtainMethods
    if (isCraftingTreeExpanded && !prevCraftingTreeExpandedRef.current && expandedFromObtainMethods) {
      // Use requestAnimationFrame to wait for next paint, then scroll
      const scrollToTree = () => {
        // Try multiple times with increasing delays to ensure DOM is ready
        const attemptScroll = (attempt = 0) => {
          if (craftingTreeRef.current) {
            // Calculate offset to account for fixed header
            const element = craftingTreeRef.current;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - 100; // 100px offset from top
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
            
            // Reset the flag after scrolling
            setExpandedFromObtainMethods(false);
          } else if (attempt < 5) {
            // Retry up to 5 times with increasing delays
            setTimeout(() => attemptScroll(attempt + 1), 100 * (attempt + 1));
          } else {
            // Give up after 5 attempts
            setExpandedFromObtainMethods(false);
          }
        };
        
        // Start scrolling after a short delay
        requestAnimationFrame(() => {
          setTimeout(() => attemptScroll(), 100);
        });
      };
      
      scrollToTree();
    }
    prevCraftingTreeExpandedRef.current = isCraftingTreeExpanded;
  }, [isCraftingTreeExpanded, expandedFromObtainMethods, craftingTree]);

  // Handle excludeCrystals toggle
  const handleExcludeCrystalsChange = useCallback((newValue) => {
    setExcludeCrystals(newValue);
    localStorage.setItem('craftingTreeExcludeCrystals', newValue.toString());
  }, []);

  const serverOptions = selectedWorld
    ? [selectedWorld.section, ...selectedWorld.dcObj.worlds]
    : [];

  // Determine what to show based on current route
  const isOnHistoryPage = location.pathname === '/history';
  const isOnCraftingInspirationPage = location.pathname === '/crafting-inspiration';
  const isOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
  const isOnAdvancedSearchPage = location.pathname === '/advanced-search';

  // Check if current route is valid
  const isValidRoute = () => {
    const pathname = location.pathname;
    // Valid routes: /, /history, /crafting-inspiration, /msq-price-checker, /advanced-search, /item/:id, /search
    if (pathname === '/' || 
        pathname === '/history' || 
        pathname === '/crafting-inspiration' || 
        pathname === '/msq-price-checker' ||
        pathname === '/advanced-search' ||
        pathname === '/search') {
      return true;
    }
    // Check if it's an item page: /item/:id or /item/:id/:slug (where id is a number)
    if (pathname.startsWith('/item/')) {
      const match = pathname.match(/^\/item\/(\d+)(?:\/(.+))?$/);
      return match !== null;
    }
    return false;
  };

  // Render 404 page if route is invalid
  if (!isValidRoute()) {
    return <NotFound />;
  }

  // Render Advanced Search if on that route
  if (isOnAdvancedSearchPage) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold"></div>
        </div>
      }>
        <AdvancedSearch
          addToast={addToast}
          removeToast={removeToast}
          toasts={toasts}
          datacenters={datacenters}
          worlds={worlds}
          selectedWorld={selectedWorld}
          onWorldChange={setSelectedWorld}
          selectedServerOption={selectedServerOption}
          onServerOptionChange={handleServerOptionChange}
          serverOptions={selectedWorld && selectedWorld.dcObj ? [selectedWorld.section, ...selectedWorld.dcObj.worlds] : []}
          isServerDataLoaded={isServerDataLoaded}
          onItemSelect={handleItemSelect}
          onSearch={handleSearch}
          searchText={searchText}
          setSearchText={setSearchText}
          isSearching={isSearching}
          onTaxRatesClick={() => {
            setIsTaxRatesModalOpen(true);
          }}
          isTaxRatesModalOpen={isTaxRatesModalOpen}
          setIsTaxRatesModalOpen={setIsTaxRatesModalOpen}
          taxRates={taxRates}
          isLoadingTaxRates={isLoadingTaxRates}
        />
      </Suspense>
    );
  }

  // Render MSQ price checker if on that route
  if (isOnMSQPriceCheckerPage) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold"></div>
        </div>
      }>
        <MSQPriceChecker
          addToast={addToast}
          removeToast={removeToast}
          toasts={toasts}
          datacenters={datacenters}
          worlds={worlds}
          selectedWorld={selectedWorld}
          onWorldChange={setSelectedWorld}
          selectedServerOption={selectedServerOption}
          onServerOptionChange={handleServerOptionChange}
          serverOptions={selectedWorld && selectedWorld.dcObj ? [selectedWorld.section, ...selectedWorld.dcObj.worlds] : []}
          isServerDataLoaded={isServerDataLoaded}
          onItemSelect={handleItemSelect}
          onSearch={handleSearch}
          searchText={searchText}
          setSearchText={setSearchText}
          isSearching={isSearching}
          onTaxRatesClick={() => {
            setIsTaxRatesModalOpen(true);
          }}
          isTaxRatesModalOpen={isTaxRatesModalOpen}
          setIsTaxRatesModalOpen={setIsTaxRatesModalOpen}
          taxRates={taxRates}
          isLoadingTaxRates={isLoadingTaxRates}
        />
      </Suspense>
    );
  }

  // Render crafting job price checker if on that route
  if (isOnCraftingInspirationPage) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold"></div>
        </div>
      }>
        <CraftingJobPriceChecker 
          addToast={addToast} 
          removeToast={removeToast} 
          toasts={toasts}
          datacenters={datacenters}
          worlds={worlds}
          selectedWorld={selectedWorld}
          onWorldChange={setSelectedWorld}
          selectedServerOption={selectedServerOption}
          onServerOptionChange={handleServerOptionChange}
          serverOptions={selectedWorld && selectedWorld.dcObj ? [selectedWorld.section, ...selectedWorld.dcObj.worlds] : []}
          onSearch={handleSearch}
          searchText={searchText}
          setSearchText={setSearchText}
          isSearching={isSearching}
          isServerDataLoaded={isServerDataLoaded}
          onItemSelect={handleItemSelect}
          onTaxRatesClick={() => {
            setIsTaxRatesModalOpen(true);
          }}
          isTaxRatesModalOpen={isTaxRatesModalOpen}
          setIsTaxRatesModalOpen={setIsTaxRatesModalOpen}
          taxRates={taxRates}
          isLoadingTaxRates={isLoadingTaxRates}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white">
      <TopBar
        onSearch={handleSearch}
        isSearching={isSearching}
        searchText={searchText}
        setSearchText={setSearchText}
        isServerDataLoaded={isServerDataLoaded}
        selectedDcName={selectedWorld?.section}
        onItemSelect={handleItemSelect}
        selectedItem={selectedItem}
        getSimplifiedChineseName={getSimplifiedChineseName}
        addToast={addToast}
        showNavigationButtons={true}
        onCraftingInspirationClick={() => {
          setSearchText('');
          navigate('/crafting-inspiration');
        }}
        activePage={isOnCraftingInspirationPage ? 'crafting-inspiration' : isOnMSQPriceCheckerPage ? 'msq-price-checker' : isOnAdvancedSearchPage ? 'advanced-search' : null}
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
        }}
        onAdvancedSearchClick={() => {
          setSearchText('');
          navigate('/advanced-search');
        }}
        onTaxRatesClick={() => {
          setIsTaxRatesModalOpen(true);
        }}
        searchResults={showUntradeable ? untradeableResults : tradeableResults}
        marketableItems={marketableItems}
      />


      {/* Toast Notifications */}
      <div className={`fixed right-2 mid:right-4 left-2 mid:left-auto z-50 space-y-2 max-w-sm mid:max-w-none ${
        selectedItem 
          ? 'top-[100px] mid:top-[120px] detail:top-24'
          : 'top-[60px] mid:top-4'
      }`}>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Loading Indicator */}
      {isLoadingDB && (
        <div className="fixed top-14 mid:top-4 left-1/2 transform -translate-x-1/2 z-[60]">
          <div className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 backdrop-blur-sm px-3 mid:px-4 py-2 rounded-lg border border-ffxiv-gold/30 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ffxiv-gold"></div>
            <span className="text-xs mid:text-sm text-gray-300">正在載入伺服器...</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`pb-8 ${
        selectedItem 
          ? 'pt-[200px] md:pt-[180px] lg:pt-[160px] xl:pt-24'
          : 'pt-16 mid:pt-24'
      }`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          {/* History Page */}
          {isOnHistoryPage && !selectedItem && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-bold text-ffxiv-gold flex items-center gap-3">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6 sm:h-8 sm:w-8" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    歷史記錄
                  </h2>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('確定要清空所有歷史記錄嗎？')) {
                      clearHistory();
                    }
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-red-800/60 hover:bg-red-700/70 text-gray-200 hover:text-white rounded-md border border-red-500/40 hover:border-red-400/60 transition-all duration-200 flex items-center gap-2"
                  title="清空歷史記錄"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 sm:h-5 sm:w-5" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                    />
                  </svg>
                  <span>清空歷史記錄</span>
                </button>
              </div>
              
              {isHistoryLoading ? (
                <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-8 sm:p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ffxiv-gold mx-auto"></div>
                  <p className="mt-4 text-sm text-gray-400">載入歷史記錄...</p>
                </div>
              ) : historyItems.length > 0 ? (
                <SearchResultsTable
                  items={historyItems}
                  selectedWorld={selectedWorld}
                  selectedServerOption={selectedServerOption}
                  onWorldChange={setSelectedWorld}
                  onServerOptionChange={handleServerOptionChange}
                  datacenters={datacenters}
                  worlds={worlds}
                  serverOptions={serverOptions}
                  isServerSelectorDisabled={isLoadingHistoryVelocities}
                  marketableItems={marketableItems}
                  itemVelocities={historyVelocities}
                  itemAveragePrices={historyAveragePrices}
                  itemMinListings={historyMinListings}
                  itemRecentPurchases={historyRecentPurchases}
                  itemTradability={historyTradability}
                  isLoadingVelocities={isLoadingHistoryVelocities}
                  averagePriceHeader={selectedServerOption === selectedWorld?.section ? '全服平均價格' : '平均價格'}
                  getSimplifiedChineseName={getSimplifiedChineseName}
                  addToast={addToast}
                  title="歷史記錄"
                  showLoadingIndicator={false}
                  showWarningForLargeResults={false}
                  onSelect={handleItemSelect}
                />
              ) : (
                <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-8 sm:p-12 text-center">
                  <div className="text-6xl mb-4">📜</div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-ffxiv-gold mb-2">暫無歷史記錄</h2>
                  <p className="text-sm sm:text-base text-gray-400">查看物品詳情後，會自動保存到歷史記錄</p>
                </div>
              )}
            </div>
          )}

          {/* Search Results (not on history page) */}
          {/* SearchResultsTable now handles both loading state and results display */}
          {!isOnHistoryPage && !selectedItem && (() => {
            // Determine which items to display based on showUntradeable flag
            // Default: show ONLY marketable items (tradeableResults)
            // When button clicked: show ONLY non-marketable items (untradeableResults)
            const itemsToDisplay = showUntradeable ? untradeableResults : tradeableResults;
            
            // If searching and no results yet, SearchResultsTable will show RunningLoader
            // If not searching and no results, don't render anything
            if (!isSearching && itemsToDisplay.length === 0) {
              return null;
            }
            
            // No filtering needed - data is already separated correctly
            // itemsToDisplay contains ONLY the items we want to show

            return (
              <SearchResultsTable
                items={itemsToDisplay}
                filteredItems={itemsToDisplay}
                selectedWorld={selectedWorld}
                selectedServerOption={selectedServerOption}
                onWorldChange={setSelectedWorld}
                onServerOptionChange={handleServerOptionChange}
                datacenters={datacenters}
                worlds={worlds}
                serverOptions={serverOptions}
                isServerSelectorDisabled={isServerSelectorDisabled}
                marketableItems={marketableItems}
                velocityLoadingProgress={velocityLoadingProgress}
                itemVelocities={searchVelocities}
                itemAveragePrices={searchAveragePrices}
                itemMinListings={searchMinListings}
                itemRecentPurchases={searchRecentPurchases}
                itemTradability={searchTradability}
                isLoadingVelocities={isLoadingVelocities}
                showLoadingIndicator={showLoadingIndicator}
                isSearching={isSearching}
                searchingItemsCount={searchingItemsCount}
                averagePriceHeader={selectedServerOption === selectedWorld?.section ? '全服平均價格' : '平均價格'}
                getSimplifiedChineseName={getSimplifiedChineseName}
                addToast={addToast}
                title="搜索結果"
                titleSuffix=""
                showUntradeableButton={true}
                untradeableCount={untradeableResults.length}
                tradeableCount={tradeableResults.length}
                onToggleUntradeable={(newValue) => {
                  setShowUntradeable(newValue);
                  setSearchCurrentPage(1); // Reset to first page when switching
                }}
                isShowUntradeable={showUntradeable}
                isRaritySelectorDisabled={isServerSelectorDisabled}
                externalCurrentPage={searchCurrentPage}
                externalItemsPerPage={searchItemsPerPage}
                onExternalPageChange={(newPage) => {
                  // Check if target page has data before changing
                  const targetStartIndex = (newPage - 1) * searchItemsPerPage;
                  const targetEndIndex = newPage * searchItemsPerPage;
                  const targetPageItems = itemsToDisplay.slice(targetStartIndex, targetEndIndex);
                  
                  if (targetPageItems.length === 0 && isServerSelectorDisabled) {
                    addToast('該頁面資料正在載入中，請稍候...', 'warning');
                    return;
                  }
                  handleSearchPageChange(newPage);
                }}
                onExternalItemsPerPageChange={(newItemsPerPage) => {
                  setSearchItemsPerPage(newItemsPerPage);
                  setSearchCurrentPage(1);
                }}
                defaultItemsPerPage={20}
                itemsPerPageOptions={[20, 30, 50, 100, 200]}
                onSelect={handleItemSelect}
                preserveItemOrder={isOCRSearchResult}
              />
            );
          })()}

          {/* Selected Item & Market Data */}
          {selectedItem && (
            <>
              <ItemSEO item={selectedItem} />
              <div className="space-y-4 sm:space-y-6">
              {/* Item Info & Controls */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-3 sm:p-4">
                {/* First Row: Item Image, Name & Server Selector */}
                <div className="flex flex-col detail:flex-row detail:items-center detail:justify-between gap-4 detail:gap-4 mb-3 mid:mb-4">
                  <div className="flex items-center gap-3 mid:gap-4 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      <ItemImage
                        itemId={selectedItem.id}
                        alt={selectedItem.name}
                        className="w-16 h-16 mid:w-20 mid:h-20 object-contain rounded-lg border-2 border-ffxiv-gold/30 bg-slate-900/50 p-2 shadow-lg"
                        priority={true}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 mid:gap-2 flex-wrap">
                        <div className="flex flex-col gap-1">
                          {selectedItem.searchLanguageName && selectedItem.nameTW && selectedItem.searchLanguageName !== selectedItem.nameTW
                            ? (
                                <>
                                  <h2 className="text-lg mid:text-xl font-bold text-ffxiv-gold break-words line-clamp-2">
                                    {selectedItem.searchLanguageName}
                                  </h2>
                                  <h3 className="text-slate-300/80 font-medium text-sm mid:text-base break-words line-clamp-2 mt-0.5 italic">
                                    {selectedItem.nameTW}
                                  </h3>
                                </>
                              )
                            : (
                                <h2 className="text-lg mid:text-xl font-bold text-ffxiv-gold break-words line-clamp-2">
                                  {selectedItem.name}
                                </h2>
                              )
                          }
                          {/* Show tag if item doesn't have Traditional Chinese name */}
                          {!selectedItem.nameTW && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-900/40 border border-amber-500/50 rounded text-xs font-medium text-amber-300 w-fit mt-1">
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="h-3 w-3" 
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
                              繁中服數據查無此物
                            </span>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const nameToCopy = selectedItem.searchLanguageName && selectedItem.nameTW && selectedItem.searchLanguageName !== selectedItem.nameTW
                                ? `${selectedItem.searchLanguageName} (${selectedItem.nameTW})`
                                : selectedItem.name;
                              await navigator.clipboard.writeText(nameToCopy);
                              addToast('已複製物品名稱', 'success');
                            } catch (err) {
                              console.error('Failed to copy:', err);
                              addToast('複製失敗', 'error');
                            }
                          }}
                          className="flex-shrink-0 p-1 mid:p-1.5 text-gray-400 hover:text-ffxiv-gold hover:bg-purple-800/40 rounded-md border border-transparent hover:border-purple-500/40 transition-all duration-200"
                          title="複製物品名稱"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-4 w-4 mid:h-4 mid:w-4" 
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
                      <div className="flex items-center gap-3 mid:gap-4 mt-1 flex-wrap">
                        {(() => {
                          const ilvl = getIlvl(selectedItem.id);
                          const version = getVersion(selectedItem.id);
                          return (
                            <>
                              {version && (
                                <span 
                                  className="inline-flex items-center px-2 py-0.5 rounded-md border text-xs mid:text-sm font-bold whitespace-nowrap"
                                  style={{
                                    background: `linear-gradient(135deg, ${getVersionColor(version)}20 0%, ${getVersionColor(version)}10 100%)`,
                                    borderColor: `${getVersionColor(version)}50`,
                                    color: getVersionColor(version),
                                    boxShadow: `0 1px 3px ${getVersionColor(version)}20`,
                                  }}
                                >
                                  版本: {version}
                                </span>
                              )}
                              {ilvl !== null && (
                                <span className="text-xs mid:text-sm text-green-400 font-semibold">
                                  ilvl: {ilvl}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 detail:gap-4 overflow-x-auto min-w-0 detail:flex-shrink-0 detail:max-w-none relative z-10 scroll-pl-1 -ml-1 pl-1">
                    <ServerSelector
                      datacenters={datacenters}
                      worlds={worlds}
                      selectedWorld={selectedWorld}
                      onWorldChange={setSelectedWorld}
                      selectedServerOption={selectedServerOption}
                      onServerOptionChange={handleServerOptionChange}
                      serverOptions={serverOptions}
                    />
                  </div>
                </div>
                
                {/* Second Row: Controls (Quantity & HQ) */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <label className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">數量:</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="1"
                      value={listSize}
                      onChange={(e) => setListSize(parseInt(e.target.value, 10))}
                      className="flex-1 sm:w-32 h-1.5 bg-purple-800/50 rounded-lg appearance-none cursor-pointer accent-ffxiv-gold"
                    />
                    <span className="text-xs sm:text-sm text-ffxiv-gold w-8 sm:w-10 font-medium text-right">{listSize}</span>
                  </div>
                  
                  {selectedItem.canBeHQ && (
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={hqOnly}
                          onChange={(e) => setHqOnly(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`
                          w-10 h-6 rounded-full transition-all duration-300 ease-in-out
                          ${hqOnly 
                            ? 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 shadow-[0_0_15px_rgba(212,175,55,0.5)]' 
                            : 'bg-purple-800/50 border-2 border-purple-600/50'
                          }
                          group-hover:scale-105
                        `}>
                          <div className={`
                            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ease-in-out
                            ${hqOnly ? 'translate-x-4' : 'translate-x-0'}
                            shadow-md
                          `}>
                            {hqOnly && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-ffxiv-gold">★</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`
                        text-xs sm:text-sm font-semibold transition-colors duration-200
                        ${hqOnly 
                          ? 'text-ffxiv-gold' 
                          : 'text-gray-400 group-hover:text-gray-300'
                        }
                      `}>
                        HQ
                      </span>
                    </label>
                  )}
                  
                  {/* Obtain Methods Button */}
                  <button
                    onClick={() => {
                      // Prevent toggling while loading to avoid confusion
                      if (isObtainMethodsLoading) {
                        return;
                      }
                      setIsObtainMethodsExpanded(!isObtainMethodsExpanded);
                      setButtonOrder(prev => ({ ...prev, obtainMethods: Math.max(...Object.values(prev)) + 1 }));
                    }}
                    disabled={isObtainMethodsLoading}
                    className={`
                      relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all duration-300 overflow-hidden
                      ${isObtainMethodsLoading
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                      }
                      ${isObtainMethodsExpanded
                        ? 'bg-gradient-to-r from-blue-900/60 via-cyan-800/50 to-blue-900/60 border border-blue-400/60 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                        : 'bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-blue-900/50 border border-blue-400/40 text-blue-200 hover:text-blue-300 hover:border-blue-400/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                      }
                    `}
                    title={isObtainMethodsLoading ? '載入中...' : (isObtainMethodsExpanded ? '收起取得方式' : '展開取得方式')}
                  >
                    {/* Shimmer effect for active button */}
                    {!isObtainMethodsExpanded && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"></div>
                    )}
                    
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${isObtainMethodsExpanded ? 'rotate-90' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap tracking-wide">取得方式</span>
                  </button>

                  {/* Crafting Price Tree Button */}
                  <button
                    onClick={() => {
                      // Prevent expanding if still loading or craftingTree is not ready
                      if (isLoadingCraftingTree || !hasCraftingRecipe || !craftingTree) {
                        return;
                      }
                      const wasExpanded = isCraftingTreeExpanded;
                      setIsCraftingTreeExpanded(!isCraftingTreeExpanded);
                      setButtonOrder(prev => ({ ...prev, craftingTree: Math.max(...Object.values(prev)) + 1 }));
                      // Reset flag when clicking button directly (not from ObtainMethods)
                      if (!wasExpanded) {
                        setExpandedFromObtainMethods(false);
                      }
                    }}
                    disabled={!hasCraftingRecipe || isLoadingCraftingTree || !craftingTree}
                    className={`
                      relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all duration-300 overflow-hidden
                      ${hasCraftingRecipe && !isLoadingCraftingTree && craftingTree
                        ? isCraftingTreeExpanded
                          ? 'bg-gradient-to-r from-amber-900/60 via-yellow-800/50 to-orange-900/60 border border-ffxiv-gold/60 text-ffxiv-gold shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                          : 'bg-gradient-to-r from-purple-900/50 via-indigo-900/40 to-purple-900/50 border border-purple-400/40 text-purple-200 hover:text-ffxiv-gold hover:border-ffxiv-gold/50 hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] animate-[craftingPulse_3s_ease-in-out_infinite]'
                        : 'bg-slate-800/30 border border-slate-600/20 text-gray-600 cursor-not-allowed'
                      }
                    `}
                    title={
                      isLoadingCraftingTree 
                        ? '載入配方中...' 
                        : !craftingTree && hasCraftingRecipe
                          ? '準備中...'
                        : hasCraftingRecipe 
                          ? (isCraftingTreeExpanded ? '收起製作價格樹' : '展開製作價格樹')
                          : '此物品無製作配方'
                    }
                  >
                    {/* Shimmer effect for active button */}
                    {hasCraftingRecipe && !isLoadingCraftingTree && !isCraftingTreeExpanded && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"></div>
                    )}
                    
                    {isLoadingCraftingTree ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400/30 border-t-purple-400"></div>
                    ) : (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${isCraftingTreeExpanded ? 'rotate-90' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    )}
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap tracking-wide">製作價格樹</span>
                  </button>

                  {/* Related Items Button */}
                  <button
                    onClick={() => {
                      setIsRelatedItemsExpanded(!isRelatedItemsExpanded);
                      setButtonOrder(prev => ({ ...prev, relatedItems: Math.max(...Object.values(prev)) + 1 }));
                    }}
                    disabled={!hasRelatedItems || isLoadingRelatedItems}
                    className={`
                      flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all duration-300
                      ${hasRelatedItems && !isLoadingRelatedItems
                        ? isRelatedItemsExpanded
                          ? 'bg-gradient-to-r from-amber-900/60 via-yellow-800/50 to-orange-900/60 border border-ffxiv-gold/60 text-ffxiv-gold'
                          : 'bg-gradient-to-r from-purple-900/50 via-indigo-900/40 to-purple-900/50 border border-purple-400/40 text-purple-200 hover:text-ffxiv-gold hover:border-ffxiv-gold/50'
                        : 'bg-slate-800/30 border border-slate-600/20 text-gray-600 cursor-not-allowed'
                      }
                    `}
                    title={
                      isLoadingRelatedItems 
                        ? '載入中...' 
                        : hasRelatedItems 
                          ? (isRelatedItemsExpanded ? '收起相關物品' : '展開相關物品')
                          : '此物品未被用作材料'
                    }
                  >
                    {isLoadingRelatedItems ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-400/30 border-t-purple-400"></div>
                    ) : (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${isRelatedItemsExpanded ? 'rotate-90' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                    <span className="text-xs sm:text-sm font-semibold whitespace-nowrap tracking-wide">相關物品</span>
                  </button>
                </div>
              </div>

              {/* Expandable sections - dynamically ordered by last click */}
              {(() => {
                const sections = [];
                
                // Crafting Price Tree
                if (isCraftingTreeExpanded && craftingTree && !isLoadingCraftingTree) {
                  sections.push({
                    key: 'craftingTree',
                    order: buttonOrder.craftingTree,
                    component: (
                      <div 
                        key="craftingTreeContainer" 
                        ref={craftingTreeRef}
                        className="scroll-mt-20"
                      >
                        <ErrorBoundary fallbackMessage="製作價格樹載入失敗，請重新整理頁面">
                          <Suspense fallback={
                            <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-8 text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400/30 border-t-purple-400 mx-auto"></div>
                              <p className="mt-4 text-sm text-gray-400">載入製作價格樹...</p>
                            </div>
                          }>
                            <CraftingTree
                              tree={craftingTree}
                              selectedServerOption={selectedServerOption}
                              selectedWorld={selectedWorld}
                              worlds={worlds}
                              onItemSelect={handleItemSelect}
                              excludeCrystals={excludeCrystals}
                              onExcludeCrystalsChange={handleExcludeCrystalsChange}
                            />
                          </Suspense>
                        </ErrorBoundary>
                      </div>
                    )
                  });
                }
                
                // Related Items
                if (isRelatedItemsExpanded && hasRelatedItems) {
                  sections.push({
                    key: 'relatedItems',
                    order: buttonOrder.relatedItems,
                    component: (
                      <ErrorBoundary key="relatedItems" fallbackMessage="相關物品載入失敗，請重新整理頁面">
                        <Suspense fallback={
                          <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400/30 border-t-purple-400 mx-auto"></div>
                            <p className="mt-4 text-sm text-gray-400">載入相關物品...</p>
                          </div>
                        }>
                          <RelatedItems
                            itemId={selectedItem?.id}
                            onItemClick={handleItemSelect}
                          />
                        </Suspense>
                      </ErrorBoundary>
                    )
                  });
                }
                
                // Obtain Methods
                if (isObtainMethodsExpanded && selectedItem && selectedItem.id) {
                  sections.push({
                    key: 'obtainMethods',
                    order: buttonOrder.obtainMethods,
                    component: (
                      <div key="obtainMethods" className="relative bg-gradient-to-br from-slate-900/95 via-indigo-950/20 to-slate-900/95 rounded-xl border border-indigo-600/20 shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(99,102,241,0.1)] p-4 sm:p-6 mt-4 overflow-hidden backdrop-blur-sm">
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 bg-indigo-500 rounded-full blur-3xl"></div>
                        </div>
                        <div className="absolute inset-0 rounded-xl border border-indigo-500/10 pointer-events-none"></div>
                        <div className="relative z-10">
                          <ErrorBoundary fallbackMessage="取得方式載入失敗，請重新整理頁面">
                            <Suspense fallback={
                              <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400/30 border-t-indigo-400 mx-auto"></div>
                                <p className="mt-4 text-sm text-gray-400">載入取得方式...</p>
                              </div>
                            }>
                              <ObtainMethods
                                itemId={selectedItem.id}
                                onItemClick={handleItemSelect}
                                onLoadingChange={setIsObtainMethodsLoading}
                              onExpandCraftingTree={() => {
                                // Prevent expanding if still loading or craftingTree is not ready
                                if (isLoadingCraftingTree || !hasCraftingRecipe || !craftingTree) {
                                  return;
                                }
                                const wasExpanded = isCraftingTreeExpanded;
                                setIsCraftingTreeExpanded(prev => !prev);
                                // Set flag if expanding (not collapsing)
                                if (!wasExpanded) {
                                  setExpandedFromObtainMethods(true);
                                }
                              }}
                              isCraftingTreeExpanded={isCraftingTreeExpanded}
                            />
                          </Suspense>
                          </ErrorBoundary>
                        </div>
                      </div>
                    )
                  });
                }
                
                // Sort by order (descending - highest order first, meaning last clicked appears on top)
                sections.sort((a, b) => b.order - a.order);
                
                return (
                  <>
                    {sections.map(section => section.component)}
                  </>
                );
              })()}

              {/* Server Upload Times - Show when DC is selected */}
              {selectedWorld && selectedServerOption === selectedWorld.section && marketInfo && (
                <ServerUploadTimes
                  worldUploadTimes={marketInfo.worldUploadTimes || marketInfo.lastUploadTimes || {}}
                  worlds={worlds}
                  dcWorlds={selectedWorld.dcObj?.worlds || []}
                />
              )}

              {/* Market Listings & History - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Market Listings */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold">在售列表</h3>
                      {/* Show upload time when a single server is selected */}
                      {(() => {
                        // Check if a single server (not DC) is selected
                        const isSingleServer = selectedWorld && selectedServerOption && String(selectedServerOption) !== String(selectedWorld.section);
                        if (!isSingleServer || !marketInfo) return null;
                        
                        // For single server queries, Universalis API returns lastUploadTime directly
                        let uploadTime = marketInfo.lastUploadTime;
                        
                        // Fallback: check worldUploadTimes/lastUploadTimes objects (in case structure differs)
                        if (!uploadTime) {
                          const worldUploadTimes = marketInfo.worldUploadTimes || marketInfo.lastUploadTimes || {};
                          const serverId = typeof selectedServerOption === 'string' ? parseInt(selectedServerOption) : selectedServerOption;
                          uploadTime = worldUploadTimes[serverId] || worldUploadTimes[String(serverId)];
                        }
                        
                        return uploadTime ? (
                          <span className="group relative inline-flex items-center gap-1 text-xs sm:text-sm text-gray-400 font-normal cursor-pointer">
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              className="h-3 w-3 text-gray-400 flex-shrink-0" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                              />
                            </svg>
                            {formatRelativeTime(uploadTime)}
                            {/* Tooltip on hover showing local time */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900/95 backdrop-blur-sm text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999] border border-slate-600/50">
                              {formatLocalTime(uploadTime)}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-0">
                                <div className="border-4 border-transparent border-t-slate-900/95"></div>
                              </div>
                            </div>
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <button
                      onClick={() => setRefreshKey(prev => prev + 1)}
                      className="text-xs px-2 sm:px-3 py-1 bg-purple-800/60 hover:bg-purple-700/70 rounded border border-purple-500/40 transition-colors"
                    >
                      刷新
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col">
                    {isLoadingMarket ? (
                      <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-12 text-center flex-1 flex items-center justify-center">
                        {rateLimitMessage ? (
                          <>
                            <div className="text-4xl mb-4">⏳</div>
                            <p className="text-sm text-yellow-400 mb-2">{rateLimitMessage}</p>
                            <p className="text-xs text-gray-500">將在3秒後自動重試...</p>
                          </>
                        ) : (
                          <>
                            <div className="relative inline-block">
                              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold mx-auto"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-6 w-6 bg-ffxiv-gold/20 rounded-full animate-pulse"></div>
                              </div>
                            </div>
                            <p className="mt-4 text-sm text-gray-400 animate-pulse">正在加載市場數據...</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col">
                        <MarketListings listings={marketListings} onRefresh={() => setRefreshKey(prev => prev + 1)} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Market History */}
                <div className="flex flex-col">
                  <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold mb-2 sm:mb-3">歷史交易</h3>
                  <div className="flex-1 flex flex-col">
                    {isLoadingMarket ? (
                      <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-12 text-center flex-1 flex items-center justify-center">
                        {rateLimitMessage ? (
                          <>
                            <div className="text-4xl mb-4">⏳</div>
                            <p className="text-sm text-yellow-400 mb-2">{rateLimitMessage}</p>
                            <p className="text-xs text-gray-500">將在3秒後自動重試...</p>
                          </>
                        ) : (
                          <>
                            <div className="relative inline-block">
                              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold mx-auto"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-6 w-6 bg-ffxiv-gold/20 rounded-full animate-pulse"></div>
                              </div>
                            </div>
                            <p className="mt-4 text-sm text-gray-400 animate-pulse">正在加載歷史數據...</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col">
                        <MarketHistory history={marketHistory} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* Loading Item from URL - Show loading state instead of home page */}
          {(() => {
            const isOnItemPage = location.pathname.startsWith('/item/');
            // Show loading if explicitly loading OR if on item page but item not loaded yet
            const shouldShowLoading = (isLoadingItemFromURL || (isOnItemPage && !selectedItem && !isOnHistoryPage && location.pathname !== '/crafting-inspiration' && location.pathname !== '/msq-price-checker'));
            return shouldShowLoading && (
              <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-12 text-center">
                <div className="relative inline-block">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold mx-auto"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-6 w-6 bg-ffxiv-gold/20 rounded-full animate-pulse"></div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-400 animate-pulse">正在載入物品...</p>
              </div>
            );
          })()}

          {/* Empty State - Show welcome content before search (not on history page) */}
          {(() => {
            // Check if we're on an item page path - if so, don't show home page even if item isn't loaded yet
            const isOnItemPage = location.pathname.startsWith('/item/');
            // Don't show home page if we're loading an item from URL or if we're on an item page path
            return !selectedItem && tradeableResults.length === 0 && untradeableResults.length === 0 && !isSearching && !isOnHistoryPage && !isLoadingItemFromURL && !isOnItemPage;
          })() && (
            <div className="space-y-4 sm:space-y-8">
              {/* Welcome Section */}
              <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-8 relative z-10">
                  <div className="text-center mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold mb-4">FFXIV繁中市場小屋</h2>
                  {/* Bear/Sheep Image */}
                  <div className="mb-4 sm:mb-6 flex justify-center items-center">
                    <div 
                      ref={imageContainerRef}
                      className="image-shatter-container relative"
                    >
                      <img 
                        src={currentImage} 
                        alt="Random icon" 
                        onClick={handleImageClick}
                        draggable={false}
                        className={`w-16 h-16 sm:w-24 sm:h-24 object-contain cursor-pointer hover:scale-110 transition-transform duration-300 image-shatter-main ${isShattering ? 'shattering' : ''}`}
                      />
                      {shatterFragments.map(fragment => (
                        <div
                          key={fragment.id}
                          className="image-shatter-fragment"
                          style={{
                            '--fragment-width': `${fragment.width}px`,
                            '--fragment-height': `${fragment.height}px`,
                            '--image-url': `url(${currentImage})`,
                            '--image-width': `${fragment.imgWidth}px`,
                            '--image-height': `${fragment.imgHeight}px`,
                            '--bg-x': `${fragment.bgX}px`,
                            '--bg-y': `${fragment.bgY}px`,
                            '--tx': `${fragment.tx}px`,
                            '--ty': `${fragment.ty}px`,
                            '--rot': `${fragment.rot}deg`,
                            left: `${fragment.x}px`,
                            top: `${fragment.y}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Main Page Search Bar */}
                  <div className="max-w-md mx-auto h-10 sm:h-12 relative z-20">
                    <SearchBar 
                      onSearch={handleSearch} 
                      isLoading={isSearching}
                      value={searchText}
                      onChange={setSearchText}
                      disabled={!isServerDataLoaded}
                      disabledTooltip={!isServerDataLoaded ? '請等待伺服器資料載入完成' : undefined}
                      selectedDcName={selectedWorld?.section}
                      onItemSelect={handleItemSelect}
                      showOCRButton={false}
                    />
                  </div>
                </div>
                
                {/* Tips and Author Info Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                  {/* Tips Section */}
                  <div className="bg-gradient-to-br from-slate-800/40 via-purple-900/15 to-slate-800/40 rounded-lg border border-purple-500/20 p-4 sm:p-6 card-glow hover:border-purple-400/30 transition-all duration-300 flex flex-col h-full">
                    <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold mb-3 sm:mb-4 flex items-center gap-2">
                      <span className="text-xl">💡</span>
                      <span>使用提示</span>
                    </h3>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-gray-300">
                      <li className="flex items-start gap-2.5">
                        <span className="text-ffxiv-gold flex-shrink-0 mt-0.5 font-bold">•</span>
                        <span>支持多關鍵詞搜索，用空格分隔（例如：「陳舊的 地圖」）</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-ffxiv-gold flex-shrink-0 mt-0.5 font-bold">•</span>
                        <span>查看物品詳情會自動保存到歷史記錄，最多保存10個物品，可在搜索欄旁的歷史記錄按鈕查看</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-ffxiv-gold flex-shrink-0 mt-0.5 font-bold">•</span>
                        <span>目前新版本會需要作者手動更新後端，如有功能異常請聯繫作者DC：wuperbear</span>
                      </li>
                    </ul>
                    <div className="pt-5 flex-grow">
                      <p className="text-gray-300 leading-relaxed mb-0 text-xs sm:text-sm flex items-center gap-1.5">
                        抓我玩這遊戲的人
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4 text-purple-400" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            d="M12 4v16m0 0l-6-6m6 6l6-6" 
                          />
                        </svg>
                        <span className="text-purple-400/80">沒有她就沒有這個網頁</span>
                      </p>
                    </div>
                    <div className="pt-2 mt-4 border-t border-purple-500/20">
                      <a 
                        href="https://www.twitch.tv/mehhamya" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 h-[42px] bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 rounded-lg border border-purple-500/30 hover:border-purple-400/50 transition-all duration-200 group shadow-lg hover:shadow-purple-500/20 hover:scale-105"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4 text-purple-400 group-hover:text-purple-300 transition-colors" 
                          fill="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                        </svg>
                        <span className="text-purple-300 group-hover:text-purple-200 font-medium">Twitch</span>
                      </a>
                    </div>
                  </div>

                  {/* Author Info Section */}
                  <div className="bg-gradient-to-br from-slate-800/40 via-pink-900/15 to-slate-800/40 rounded-lg border border-pink-500/20 p-4 sm:p-6 card-glow hover:border-pink-400/30 transition-all duration-300 flex flex-col h-full">
                    <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold mb-3 sm:mb-4 flex items-center gap-2">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5 text-ffxiv-gold" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                        />
                      </svg>
                      <span>作者簡介</span>
                    </h3>
                    <div className="space-y-3 text-xs sm:text-sm text-gray-300 flex-grow">
                      <div className="flex items-start gap-2.5">
                        <span className="text-ffxiv-gold flex-shrink-0 mt-0.5 font-semibold">遊戲ID：</span>
                        <span className="text-gray-200 font-medium">貝肝煎熬（貝爾）</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="text-ffxiv-gold flex-shrink-0 mt-0.5 font-semibold">伺服器：</span>
                        <span className="text-gray-200">巴哈姆特（轉服開啟後迦樓羅）</span>
                      </div>
                      <div>
                        <p className="text-gray-300 leading-relaxed mb-2">
                          有幫助到你的話，看到就打個招呼吧~ 
                          <span className="text-ffxiv-gold">（賣我便宜點！）</span>
                        </p>
                        <p className="text-gray-400 text-xs sm:text-sm italic flex items-center gap-1.5 mb-0 mt-5">
                          或者...
                          <span className="text-amber-400/80">鼓勵我</span>
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-4 w-4 text-amber-400" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              d="M12 4v16m0 0l-6-6m6 6l6-6" 
                            />
                          </svg>
                        </p>
                      </div>
                    </div>
                    <div className="pt-2 mt-4 border-t border-pink-500/20 flex gap-3">
                      <a 
                        href="https://portaly.cc/beher" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 h-[42px] bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 rounded-lg border border-amber-500/30 hover:border-amber-400/50 transition-all duration-200 group shadow-lg hover:shadow-amber-500/20 hover:scale-105"
                      >
                        <span className="text-amber-400 group-hover:text-amber-300 transition-colors text-lg">☕</span>
                        <span className="text-amber-300 group-hover:text-amber-200 font-medium">送我咖啡</span>
                      </a>
                      <a 
                        href="https://forum.gamer.com.tw/C.php?bsn=17608&snA=28740" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 h-[42px] bg-gradient-to-r from-[#11AAC1]/20 to-[#11AAC1]/30 hover:from-[#11AAC1]/30 hover:to-[#11AAC1]/40 rounded-lg border border-[#11AAC1]/30 hover:border-[#11AAC1]/50 transition-all duration-200 group shadow-lg hover:shadow-[#11AAC1]/20 hover:scale-105 text-[#11AAC1]"
                      >
                        <img 
                          src={getAssetPath('baha_icon.png')} 
                          alt="巴哈姆特" 
                          className="h-5 w-5 transition-colors"
                        />
                        <span className="font-medium">與巴友分享</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* History Items Section - Show on home page below welcome section */}
              <Suspense fallback={
                <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400/30 border-t-purple-400 mx-auto"></div>
                  <p className="mt-4 text-sm text-gray-400">載入歷史記錄...</p>
                </div>
              }>
                <HistorySection onItemSelect={handleItemSelect} />
              </Suspense>
              
              {/* Recent Updates Section - Show on home page below history section */}
              {/* Only render when selectedWorld is available to avoid unnecessary component/data loading */}
              {selectedWorld?.section && (
                <Suspense fallback={
                  <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400/30 border-t-purple-400 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-400">載入最近更新...</p>
                  </div>
                }>
                  <RecentUpdatesSection 
                    onItemSelect={handleItemSelect} 
                    selectedDcName={selectedWorld.section}
                  />
                </Suspense>
              )}

              {/* Credits Section - Show on home page at the bottom */}
              <div className="bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-600/30 p-4 sm:p-6 mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-semibold text-slate-300 mb-3 sm:mb-4 flex items-center gap-2">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-5 w-5 text-ffxiv-gold" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
                    />
                  </svg>
                  致謝
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4">
                  本專案得以實現，感謝以下優秀的服務與資料來源：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <a 
                    href="https://universalis.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-lg flex items-center justify-center border border-blue-500/30 group-hover:border-blue-400/50">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Universalis API
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        提供完整的市場看板數據
                      </div>
                    </div>
                  </a>

                  <a 
                    href="https://xivapi.com/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-lg flex items-center justify-center border border-purple-500/30 group-hover:border-purple-400/50">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                        XIVAPI
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        提供物品圖片與遊戲數據
                      </div>
                    </div>
                  </a>

                  <a 
                    href="https://github.com/ffxiv-teamcraft/ffxiv-teamcraft" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600/20 to-indigo-800/20 rounded-lg flex items-center justify-center border border-indigo-500/30 group-hover:border-indigo-400/50">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" 
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                        FFXIV Teamcraft
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        提供製作配方數據
                      </div>
                    </div>
                  </a>

                  <a 
                    href="https://garlandtools.org/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200 group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-lg flex items-center justify-center border border-green-500/30 group-hover:border-green-400/50">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" 
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Garland Tools
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        提供職業等ico
                      </div>
                    </div>
                  </a>
                </div>
                {/* Version Info */}
                <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-600/30">
                  <p className="text-xs text-slate-500 text-center">
                    版本號: <span className="text-ffxiv-gold font-semibold">{APP_VERSION}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
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
        onServerOptionChange={handleServerOptionChange}
      />
    </div>
  );
}

export default App;
