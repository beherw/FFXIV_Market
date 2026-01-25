import { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import ServerSelector from './components/ServerSelector';
import ItemTable from './components/ItemTable';
import MarketListings from './components/MarketListings';
import MarketHistory from './components/MarketHistory';
import Toast from './components/Toast';
import { searchItems, getItemById, getSimplifiedChineseName, cancelSimplifiedNameFetch } from './services/itemDatabase';
import { getMarketData, getMarketableItems, getItemsVelocity } from './services/universalis';
import { containsChinese } from './utils/chineseConverter';
import { getAssetPath } from './utils/assetPath.js';
import ItemImage from './components/ItemImage';
import HistoryButton from './components/HistoryButton';
import { addItemToHistory } from './utils/itemHistory';
import { addSearchToHistory } from './utils/searchHistory';
import { useHistory } from './hooks/useHistory';
import { hasRecipe, buildCraftingTree, findRelatedItems } from './services/recipeDatabase';
import TopBar from './components/TopBar';
import NotFound from './components/NotFound';

// Lazy load route-based components
const CraftingJobPriceChecker = lazy(() => import('./components/UltimatePriceKing'));
const MSQPriceChecker = lazy(() => import('./components/MSQPriceChecker'));
const CraftingTree = lazy(() => import('./components/CraftingTree'));
const RelatedItems = lazy(() => import('./components/RelatedItems'));
const HistorySection = lazy(() => import('./components/HistorySection'));
const RecentUpdatesSection = lazy(() => import('./components/RecentUpdatesSection'));

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
  const [marketInfo, setMarketInfo] = useState(null);
  const [marketListings, setMarketListings] = useState([]);
  const [marketHistory, setMarketHistory] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
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
  
  // Marketable items and velocity states
  const [marketableItems, setMarketableItems] = useState(null);
  const [searchVelocities, setSearchVelocities] = useState({});
  const [searchAveragePrices, setSearchAveragePrices] = useState({});
  const [searchMinListings, setSearchMinListings] = useState({});
  const [searchRecentPurchases, setSearchRecentPurchases] = useState({});
  const [searchTradability, setSearchTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [isServerSelectorDisabled, setIsServerSelectorDisabled] = useState(true); // Start disabled until server data loads
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const [searchItemsPerPage, setSearchItemsPerPage] = useState(100);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const loadingIndicatorStartTimeRef = useRef(null);

  // Handle search page change
  const handleSearchPageChange = useCallback((newPage) => {
    setSearchCurrentPage(newPage);
    // Scroll to top of results when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Use centralized history hook for history page
  const { historyItems, isLoading: isHistoryLoading, clearHistory } = useHistory();
  
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
  const lastFetchedItemIdsRef = useRef('');
  const imageIntervalRef = useRef(null);
  const manualModeTimeoutRef = useRef(null);
  const searchInProgressRef = useRef(false);
  const lastSearchedTermRef = useRef('');

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
    const isOnUltimatePriceKingPage = location.pathname === '/ultimate-price-king';
    const isOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
    
    // Only run on home page (empty state)
    if (selectedItem || (tradeableResults.length > 0 || untradeableResults.length > 0) || isSearching || isOnHistoryPage || isOnUltimatePriceKingPage || isOnMSQPriceCheckerPage) {
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
        const currentIsOnUltimatePriceKingPage = location.pathname === '/ultimate-price-king';
        const currentIsOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
        
        if (!isManualMode && !selectedItem && tradeableResults.length === 0 && untradeableResults.length === 0 && !isSearching && !currentIsOnHistoryPage && !currentIsOnUltimatePriceKingPage && !currentIsOnMSQPriceCheckerPage && !isShattering) {
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

  // Update document title based on selected item
  useEffect(() => {
    if (selectedItem && selectedItem.name) {
      document.title = `${selectedItem.name}-貝爾市場`;
    } else {
      document.title = '貝爾的FFXIV市場小屋';
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

  // Load marketable items on mount
  useEffect(() => {
    getMarketableItems().then(items => {
      setMarketableItems(items);
    });
  }, []);

  // Sync selectedItem to ref
  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    searchResultsRef.current = showUntradeable ? untradeableResults : tradeableResults;
  }, [tradeableResults, untradeableResults, showUntradeable]);

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
      // Only enable server selector if server data is loaded AND no fetch is in progress
      if (isServerDataLoaded && !velocityFetchInProgressRef.current) {
        setIsServerSelectorDisabled(false);
      }
      velocityFetchInProgressRef.current = false;
      lastFetchedItemIdsRef.current = '';
      return;
    }

    // Get all item IDs from displayed results (only fetch market data for tradeable items)
    const allItemIds = displayedResults.map(item => item.id);

    if (allItemIds.length === 0) {
      setSearchVelocities({});
      setSearchAveragePrices({});
      setSearchMinListings({});
      setSearchRecentPurchases({});
      setSearchTradability({});
      setIsLoadingVelocities(false);
      // Only enable server selector if server data is loaded AND no fetch is in progress
      if (isServerDataLoaded && !velocityFetchInProgressRef.current) {
        setIsServerSelectorDisabled(false);
      }
      velocityFetchInProgressRef.current = false;
      lastFetchedItemIdsRef.current = '';
      return;
    }

    // Create a stable key from item IDs and server option to detect if items or server changed
    const itemIdsKey = [...allItemIds].sort((a, b) => a - b).join(',');
    const serverKey = `${selectedServerOption}`;
    const cacheKey = `${itemIdsKey}|${serverKey}`;
    
    // Clear state if server changed (to avoid showing stale DC prices when switching to server)
    if (lastFetchedItemIdsRef.current && lastFetchedItemIdsRef.current !== cacheKey) {
      const lastServerKey = lastFetchedItemIdsRef.current.split('|')[1];
      if (lastServerKey !== serverKey) {
        setSearchVelocities({});
        setSearchAveragePrices({});
        setSearchMinListings({});
        setSearchRecentPurchases({});
        setSearchTradability({});
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
          
          const batch = allItemIds.slice(startIndex, startIndex + batchSize);
          if (batch.length === 0) {
            return;
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
          
          if (startIndex >= allItemIds.length) {
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
          if (nextIndex < allItemIds.length) {
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
    
    // Cleanup function
    return () => {
      if (velocityFetchAbortControllerRef.current) {
        velocityFetchAbortControllerRef.current.abort();
      }
    };
  }, [tradeableResults, untradeableResults, selectedServerOption, selectedWorld, isServerDataLoaded]);

  // Manage loading indicator display with minimum 1s display time
  // Use same logic as server selector disabled state
  useEffect(() => {
    const currentResults = showUntradeable ? untradeableResults : tradeableResults;
    const shouldShow = isServerSelectorDisabled && 
                       (currentResults.length >= 50 || tradeableResults.length >= 50 || untradeableResults.length >= 50);
    
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
  }, [isServerSelectorDisabled, showUntradeable, tradeableResults.length, untradeableResults.length]);

  // Reset scroll position on mount and route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  // Handle item selection
  const handleItemSelect = useCallback((item) => {
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);
    
    // Clear search text to prevent auto-search from triggering when entering item page
    setSearchText('');
    
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
    
    setSelectedItem(item);
    selectedItemRef.current = item;
    
    addItemToHistory(item.id);
    
    navigate(`/item/${item.id}`, { replace: false });
    
    addToast(`已選擇: ${item.name}`, 'info');
  }, [addToast, navigate]);

  // Initialize from URL on mount and when URL changes
  // SIMPLIFIED: History page now uses useHistory hook, no complex protection needed
  useEffect(() => {
    // Extract itemId early to check if we need to wait for server data
    let itemId = params.id;
    if (!itemId && location.pathname.startsWith('/item/')) {
      const match = location.pathname.match(/^\/item\/(\d+)$/);
      if (match) {
        itemId = match[1];
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
    if (location.pathname === '/ultimate-price-king') {
      lastProcessedURLRef.current = currentURLKey;
      isInitializingFromURLRef.current = false;
      return;
    }

    // Check if we're on item detail page
    if (itemId) {
      const id = parseInt(itemId, 10);
      if (id && !isNaN(id)) {
        const currentSelectedItem = selectedItemRef.current;
        if (!currentSelectedItem || currentSelectedItem.id !== id) {
          const foundItem = searchResultsRef.current.find(item => item.id === id);
          if (foundItem) {
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

            if (!containsChinese(searchQuery.trim())) {
              searchInProgressRef.current = false;
              return;
            }

            setIsSearching(true);
            setIsServerSelectorDisabled(true); // Lock server selection during initial load
            setError(null);

            try {
              const searchResult = await searchItems(searchQuery.trim());
              const { results, converted, originalText, convertedText } = searchResult;
              
              if (lastProcessedURLRef.current !== currentURLKey) {
                searchInProgressRef.current = false;
                return;
              }
              
              // Show toast if conversion happened
              if (converted && convertedText) {
                addToast(`「${originalText}」無搜尋結果，正在嘗試轉譯成「${convertedText}」`, 'info');
              }
              
              // Separate tradeable and untradeable items
              const marketableSet = await getMarketableItems();
              const tradeable = results.filter(item => marketableSet.has(item.id));
              const untradeable = results.filter(item => !marketableSet.has(item.id));
              
              setTradeableResults(tradeable);
              setUntradeableResults(untradeable);
              // If no tradeable items but there are untradeable items, show untradeable by default
              setShowUntradeable(tradeable.length === 0 && untradeable.length > 0);
              searchResultsRef.current = tradeable.length > 0 ? tradeable : untradeable;
              setError(null);
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
                  navigate(`/item/${item.id}`, { replace: true });
                  addToast(`已選擇: ${item.name}`, 'info');
                } else if (previousSearchText !== searchQuery) {
                  // Multiple results - show toast
                  addToast(`找到 ${tradeable.length} 個可交易物品${untradeable.length > 0 ? `、${untradeable.length} 個不可交易物品` : ''}`, 'success');
                }
              }
              // If there are results, velocity fetch will handle re-enabling server selector
            } catch (err) {
              if (lastProcessedURLRef.current !== currentURLKey) {
                searchInProgressRef.current = false;
                return;
              }
              console.error('Search error:', err);
              setError('搜索失敗，請稍後再試');
              setTradeableResults([]);
              setUntradeableResults([]);
              setShowUntradeable(false);
              searchResultsRef.current = [];
              addToast('搜索失敗', 'error');
              // On error, re-enable server selector since velocity fetch won't run
              if (lastProcessedURLRef.current === currentURLKey) {
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
  }, [location.pathname, location.search, isServerDataLoaded, params.id, searchParams, searchText, navigate, addToast, isLoadingDB, datacenters, worlds, handleItemSelect, containsChinese]);

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
  const handleSearch = useCallback(async (searchTerm, skipNavigation = false) => {
    const trimmedTerm = searchTerm ? searchTerm.trim() : '';
    // Prevent duplicate searches - check if same term is already being searched or was just searched
    if (searchInProgressRef.current || (trimmedTerm && trimmedTerm === lastSearchedTermRef.current)) {
      return;
    }
    
    let currentItemId = params.id;
    if (!currentItemId && location.pathname.startsWith('/item/')) {
      const match = location.pathname.match(/^\/item\/(\d+)$/);
      if (match) {
        currentItemId = match[1];
      }
    }
    if (!trimmedTerm) {
      lastSearchedTermRef.current = '';
      setTradeableResults([]);
      setUntradeableResults([]);
      setShowUntradeable(false);
      if (!selectedItemRef.current) {
        setSelectedItem(null);
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
        setError(null);
        setRateLimitMessage(null);
        // Don't navigate if we're on ultimate-price-king, msq-price-checker or history page
        if (!skipNavigation && !currentItemId && location.pathname !== '/ultimate-price-king' && location.pathname !== '/msq-price-checker' && location.pathname !== '/history') {
          navigate('/');
        }
      }
      return;
    }

    if (isLoadingDB || !isServerDataLoaded) {
      addToast('請等待伺服器資料加載完成', 'warning');
      return;
    }

    if (!containsChinese(trimmedTerm)) {
      addToast('請輸入中文進行搜索', 'warning');
      setTradeableResults([]);
      setUntradeableResults([]);
      setShowUntradeable(false);
      setSelectedItem(null);
      setMarketInfo(null);
      setMarketListings([]);
      setMarketHistory([]);
      setError(null);
      setRateLimitMessage(null);
      return;
    }

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

    // Navigate to search results page, except when explicitly skipping navigation
    // Allow navigation from all pages including history, ultimate-price-king and msq-price-checker pages
    if (!skipNavigation && trimmedTerm) {
      navigate(`/search?q=${encodeURIComponent(trimmedTerm)}`, { replace: false });
    }

    try {
      const searchResult = await searchItems(trimmedTerm);
      const { results, converted, originalText, convertedText } = searchResult;
      
      // Show toast if conversion happened
      if (converted && convertedText) {
        addToast(`「${originalText}」無搜尋結果，正在嘗試轉譯成「${convertedText}」`, 'info');
      }
      
      // Separate tradeable and untradeable items
      const marketableSet = await getMarketableItems();
      const tradeable = results.filter(item => marketableSet.has(item.id));
      const untradeable = results.filter(item => !marketableSet.has(item.id));
      
      setTradeableResults(tradeable);
      setUntradeableResults(untradeable);
      // If no tradeable items but there are untradeable items, show untradeable by default
      setShowUntradeable(tradeable.length === 0 && untradeable.length > 0);
      setSearchCurrentPage(1); // Reset to first page on new search
      setError(null);
      
      if (results.length === 0) {
        addToast('未找到相關物品', 'warning');
      } else {
        // Record search keyword to history
        if (trimmedTerm) {
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
          navigate(`/item/${item.id}`, { replace: true });
          addToast(`已選擇: ${item.name}`, 'info');
        } else {
          // Multiple results - show toast
          addToast(`找到 ${tradeable.length} 個可交易物品${untradeable.length > 0 ? `、${untradeable.length} 個不可交易物品` : ''}`, 'success');
        }
      }
    } catch (err) {
      setError(err.message || '搜索失敗，請稍後再試');
      addToast('搜索失敗', 'error');
      setTradeableResults([]);
      setUntradeableResults([]);
      setShowUntradeable(false);
    } finally {
      setIsSearching(false);
      searchInProgressRef.current = false;
      // Clear last searched term after a short delay to allow for legitimate re-searches
      setTimeout(() => {
        if (lastSearchedTermRef.current === trimmedTerm) {
          lastSearchedTermRef.current = '';
        }
      }, 1000);
    }
  }, [addToast, isLoadingDB, selectedServerOption, containsChinese, handleItemSelect, params.id, location.pathname, navigate]);

  // Handle server option change
  const handleServerOptionChange = useCallback((option) => {
    setSelectedServerOption(option);
    // Disable server selector when server is changed - velocity fetch will re-enable it when done
    setIsServerSelectorDisabled(true);
  }, []);

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
      return;
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
  const isOnUltimatePriceKingPage = location.pathname === '/ultimate-price-king';
  const isOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';

  // Check if current route is valid
  const isValidRoute = () => {
    const pathname = location.pathname;
    // Valid routes: /, /history, /ultimate-price-king, /msq-price-checker, /item/:id, /search
    if (pathname === '/' || 
        pathname === '/history' || 
        pathname === '/ultimate-price-king' || 
        pathname === '/msq-price-checker' ||
        pathname === '/search') {
      return true;
    }
    // Check if it's an item page: /item/:id (where id is a number)
    if (pathname.startsWith('/item/')) {
      const match = pathname.match(/^\/item\/(\d+)$/);
      return match !== null;
    }
    return false;
  };

  // Render 404 page if route is invalid
  if (!isValidRoute()) {
    return <NotFound />;
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
        />
      </Suspense>
    );
  }

  // Render crafting job price checker if on that route
  if (isOnUltimatePriceKingPage) {
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
        onUltimatePriceKingClick={() => {
          setSearchText('');
          navigate('/ultimate-price-king');
        }}
        activePage={isOnUltimatePriceKingPage ? 'ultimate-price-king' : isOnMSQPriceCheckerPage ? 'msq-price-checker' : null}
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
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
          ? 'pt-[100px] mid:pt-[120px] detail:pt-24'
          : 'pt-16 mid:pt-24'
      }`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          {/* History Page */}
          {isOnHistoryPage && !selectedItem && (
            <div>
              <div className="mb-6 flex items-center justify-between">
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
                <>
                  <p className="text-sm sm:text-base text-gray-400 mb-4">共 {historyItems.length} 個物品</p>
                  <ItemTable
                    items={historyItems}
                    onSelect={handleItemSelect}
                    selectedItem={selectedItem}
                    marketableItems={marketableItems}
                    itemVelocities={{}}
                    itemAveragePrices={{}}
                    itemMinListings={{}}
                    itemRecentPurchases={{}}
                    itemTradability={{}}
                    isLoadingVelocities={false}
                  />
                </>
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
          {!isOnHistoryPage && (tradeableResults.length > 0 || untradeableResults.length > 0) && !selectedItem && (() => {
            const currentResults = showUntradeable ? untradeableResults : tradeableResults;
            const totalPages = Math.ceil(currentResults.length / searchItemsPerPage);
            const startIndex = (searchCurrentPage - 1) * searchItemsPerPage;
            const endIndex = startIndex + searchItemsPerPage;

            return (
              <div className="mb-6">
                {/* Search Results Header */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold">
                    搜索結果 ({currentResults.length} 個物品)
                  </h2>
                  {selectedWorld && selectedServerOption && (
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
                  {untradeableResults.length > 0 && (
                    <button
                      onClick={() => {
                        setShowUntradeable(!showUntradeable);
                        setSearchCurrentPage(1); // Reset to first page when switching between tradeable/untradeable
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                        showUntradeable
                          ? 'bg-orange-600/40 text-orange-300 border border-orange-500/50 hover:bg-orange-600/60'
                          : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                      }`}
                    >
                      {showUntradeable ? `隱藏 (${untradeableResults.length} 個不可交易)` : `顯示 (${untradeableResults.length} 個不可交易)`}
                    </button>
                  )}
                  {/* Loading Indicator - show only for >=50 items, with minimum 1s display time */}
                  {showLoadingIndicator && currentResults.length >= 50 && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 border border-purple-500/30 rounded-lg">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-ffxiv-gold"></div>
                      <span className="text-xs text-gray-300">載入中</span>
                    </div>
                  )}
                </div>

                {/* Warning for large result sets - show immediately when item count is determined, persist after loading */}
                {currentResults.length > 100 && (
                  <div className={`mb-4 p-4 rounded-lg border-2 ${
                      currentResults.length > 200
                        ? 'bg-red-900/40 border-red-500/50'
                        : 'bg-yellow-900/40 border-yellow-500/50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">⚠️</div>
                        <div className="flex-1">
                          <h3 className={`font-semibold mb-1 ${
                            currentResults.length > 200
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          }`}>
                            {currentResults.length > 200 ? '結果數量過多' : '結果數量較多'}
                          </h3>
                          <p className="text-sm text-gray-300">
                            找到 <span className={`font-bold ${
                              currentResults.length > 200
                                ? 'text-red-400'
                                : 'text-yellow-400'
                            }`}>{currentResults.length}</span> 個物品。
                            數據載入需要一些時間，排序可能會較慢。
                            建議使用更嚴格的關鍵詞進行搜索，或請耐心等待。
                          </p>
                        </div>
                      </div>
                    </div>
                )}

                {/* Server Selector for Search Results */}
                {selectedWorld && (
                  <div className="mb-4 flex items-center gap-3 flex-wrap">
                    <label className="text-sm font-semibold text-ffxiv-gold whitespace-nowrap">
                      伺服器選擇:
                    </label>
                    <ServerSelector
                      datacenters={datacenters}
                      worlds={worlds}
                      selectedWorld={selectedWorld}
                      onWorldChange={setSelectedWorld}
                      selectedServerOption={selectedServerOption}
                      onServerOptionChange={handleServerOptionChange}
                      serverOptions={serverOptions}
                      disabled={isServerSelectorDisabled}
                    />
                  </div>
                )}

                {/* Pagination Controls */}
                {currentResults.length > searchItemsPerPage && (
                  <div className="mb-4 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-gray-300">每頁顯示:</label>
                      <select
                        value={searchItemsPerPage}
                        onChange={(e) => {
                          const newItemsPerPage = parseInt(e.target.value, 10);
                          setSearchItemsPerPage(newItemsPerPage);
                          setSearchCurrentPage(1); // Reset to first page
                        }}
                        className="px-3 py-1.5 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-ffxiv-gold"
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </select>
                      <span className="text-sm text-gray-400">
                        顯示 {startIndex + 1}-{Math.min(endIndex, currentResults.length)} / {currentResults.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSearchPageChange(1)}
                        disabled={searchCurrentPage === 1}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          searchCurrentPage === 1
                            ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                        }`}
                      >
                        首頁
                      </button>
                      <button
                        onClick={() => handleSearchPageChange(searchCurrentPage - 1)}
                        disabled={searchCurrentPage === 1}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          searchCurrentPage === 1
                            ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                        }`}
                      >
                        上一頁
                      </button>
                      <span className="px-3 py-1.5 text-sm text-gray-300">
                        第 {searchCurrentPage} / {totalPages} 頁
                      </span>
                      <button
                        onClick={() => handleSearchPageChange(searchCurrentPage + 1)}
                        disabled={searchCurrentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          searchCurrentPage === totalPages
                            ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                        }`}
                      >
                        下一頁
                      </button>
                      <button
                        onClick={() => handleSearchPageChange(totalPages)}
                        disabled={searchCurrentPage === totalPages}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          searchCurrentPage === totalPages
                            ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                            : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                        }`}
                      >
                        末頁
                      </button>
                    </div>
                  </div>
                )}

                <ItemTable
                  items={currentResults}
                  onSelect={handleItemSelect}
                  selectedItem={selectedItem}
                  marketableItems={marketableItems}
                  itemVelocities={searchVelocities}
                  itemAveragePrices={searchAveragePrices}
                  itemMinListings={searchMinListings}
                  itemRecentPurchases={searchRecentPurchases}
                  itemTradability={searchTradability}
                  isLoadingVelocities={isLoadingVelocities}
                  averagePriceHeader={selectedServerOption === selectedWorld?.section ? '全服平均價格' : '平均價格'}
                  currentPage={searchCurrentPage}
                  itemsPerPage={searchItemsPerPage}
                />
              </div>
            );
          })()}

          {/* Selected Item & Market Data */}
          {selectedItem && (
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
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 mid:gap-2 flex-wrap">
                        <h2 className="text-lg mid:text-xl font-bold text-ffxiv-gold break-words line-clamp-2">
                          {selectedItem.name}
                        </h2>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(selectedItem.name);
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
                      <p className="text-xs mid:text-sm text-gray-400 mt-1">ID: {selectedItem.id}</p>
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
                  
                  {/* Crafting Price Tree Button */}
                  <button
                    onClick={() => setIsCraftingTreeExpanded(!isCraftingTreeExpanded)}
                    disabled={!hasCraftingRecipe || isLoadingCraftingTree}
                    className={`
                      relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all duration-300 overflow-hidden
                      ${hasCraftingRecipe && !isLoadingCraftingTree
                        ? isCraftingTreeExpanded
                          ? 'bg-gradient-to-r from-amber-900/60 via-yellow-800/50 to-orange-900/60 border border-ffxiv-gold/60 text-ffxiv-gold shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                          : 'bg-gradient-to-r from-purple-900/50 via-indigo-900/40 to-purple-900/50 border border-purple-400/40 text-purple-200 hover:text-ffxiv-gold hover:border-ffxiv-gold/50 hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] animate-[craftingPulse_3s_ease-in-out_infinite]'
                        : 'bg-slate-800/30 border border-slate-600/20 text-gray-600 cursor-not-allowed'
                      }
                    `}
                    title={
                      isLoadingCraftingTree 
                        ? '載入配方中...' 
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
                    onClick={() => setIsRelatedItemsExpanded(!isRelatedItemsExpanded)}
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

              {/* Crafting Price Tree - Expandable */}
              {isCraftingTreeExpanded && craftingTree && (
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
              )}

              {/* Related Items - Expandable */}
              {isRelatedItemsExpanded && hasRelatedItems && (
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
              )}

              {/* Market Listings & History - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Market Listings */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold">在售列表</h3>
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
          )}

          {/* Loading Item from URL - Show loading state instead of home page */}
          {(() => {
            const isOnItemPage = location.pathname.startsWith('/item/');
            // Show loading if explicitly loading OR if on item page but item not loaded yet
            const shouldShowLoading = (isLoadingItemFromURL || (isOnItemPage && !selectedItem && !isOnHistoryPage && location.pathname !== '/ultimate-price-king' && location.pathname !== '/msq-price-checker'));
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
                  <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold mb-4">貝爾的FFXIV市場小屋</h2>
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
                        <span className="text-gray-200 font-medium">貝肝煎熬</span>
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
                          <span className="text-amber-400/80">你也可以</span>
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
              <Suspense fallback={
                <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-400/30 border-t-purple-400 mx-auto"></div>
                  <p className="mt-4 text-sm text-gray-400">載入最近更新...</p>
                </div>
              }>
                <RecentUpdatesSection 
                  onItemSelect={handleItemSelect} 
                  selectedDcName={selectedWorld?.section}
                />
              </Suspense>

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
                    href="https://github.com/thewakingsands/ffxiv-datamining-cn" 
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
                        thewakingsands/ffxiv-datamining-cn
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        提供簡體中文物品數據
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
