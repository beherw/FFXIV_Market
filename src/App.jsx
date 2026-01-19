import { useState, useCallback, useEffect, useRef } from 'react';
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
import ItemImage from './components/ItemImage';
import HistoryButton from './components/HistoryButton';
import HistorySection from './components/HistorySection';
import { addItemToHistory } from './utils/itemHistory';
import { useHistory } from './hooks/useHistory';
import CraftingTree from './components/CraftingTree';
import { hasRecipe, buildCraftingTree, findRelatedItems } from './services/recipeDatabase';
import CraftingJobPriceChecker from './components/UltimatePriceKing';
import MSQPriceChecker from './components/MSQPriceChecker';
import RelatedItems from './components/RelatedItems';

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
  const [currentImage, setCurrentImage] = useState(() => Math.random() < 0.5 ? '/bear.png' : '/sheep.png');
  const [isManualMode, setIsManualMode] = useState(false);
  
  // Crafting tree states
  const [craftingTree, setCraftingTree] = useState(null);
  const [hasCraftingRecipe, setHasCraftingRecipe] = useState(false);
  const [isCraftingTreeExpanded, setIsCraftingTreeExpanded] = useState(false);
  const [isLoadingCraftingTree, setIsLoadingCraftingTree] = useState(false);
  
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

  // Add toast function
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + (++toastIdCounterRef.current);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  // Remove toast function
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
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
      clearInterval(imageIntervalRef.current);
      imageIntervalRef.current = null;
    }
    
    // Swap image immediately
    setCurrentImage(prev => prev === '/bear.png' ? '/sheep.png' : '/bear.png');
    
    // Set timeout to return to auto mode after 2 seconds of no clicks
    manualModeTimeoutRef.current = setTimeout(() => {
      setIsManualMode(false);
      manualModeTimeoutRef.current = null;
    }, 2000);
  }, []);

  // Auto-alternate images when not in manual mode
  useEffect(() => {
    const isOnHistoryPage = location.pathname === '/history';
    const isOnUltimatePriceKingPage = location.pathname === '/ultimate-price-king';
    const isOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
    
    // Only run on home page (empty state)
    if (selectedItem || (tradeableResults.length > 0 || untradeableResults.length > 0) || isSearching || isOnHistoryPage || isOnUltimatePriceKingPage || isOnMSQPriceCheckerPage) {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      return;
    }

    // Don't auto-alternate in manual mode
    if (isManualMode) {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
      return;
    }

    // Set up auto alternation (random interval between 2-5 seconds)
    const getRandomInterval = () => Math.random() * 3000 + 2000; // 2000-5000ms
    
    const scheduleNext = () => {
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
      }
      imageIntervalRef.current = setTimeout(() => {
        const currentIsOnHistoryPage = location.pathname === '/history';
        const currentIsOnUltimatePriceKingPage = location.pathname === '/ultimate-price-king';
        const currentIsOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';
        if (!isManualMode && !selectedItem && tradeableResults.length === 0 && untradeableResults.length === 0 && !isSearching && !currentIsOnHistoryPage && !currentIsOnUltimatePriceKingPage && !currentIsOnMSQPriceCheckerPage) {
          setCurrentImage(prev => prev === '/bear.png' ? '/sheep.png' : '/bear.png');
          scheduleNext();
        } else {
          imageIntervalRef.current = null;
        }
      }, getRandomInterval());
    };

    scheduleNext();

    return () => {
      if (imageIntervalRef.current) {
        clearTimeout(imageIntervalRef.current);
        imageIntervalRef.current = null;
      }
    };
  }, [isManualMode, selectedItem, tradeableResults.length, untradeableResults.length, isSearching, location.pathname]);

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
    // Cancel any in-progress fetch
    if (velocityFetchAbortControllerRef.current) {
      velocityFetchAbortControllerRef.current.abort();
      velocityFetchInProgressRef.current = false;
    }
    
    // Reset state if no search results or no server selected
    const displayedResults = showUntradeable ? untradeableResults : tradeableResults;
    if (!displayedResults || displayedResults.length === 0 || !selectedServerOption || !selectedWorld) {
      setSearchVelocities({});
      setSearchAveragePrices({});
      setSearchMinListings({});
      setSearchRecentPurchases({});
      setSearchTradability({});
      setIsLoadingVelocities(false);
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
      velocityFetchInProgressRef.current = false;
      lastFetchedItemIdsRef.current = '';
      return;
    }

    // Create a stable key from item IDs and server option to detect if items or server changed
    const itemIdsKey = [...allItemIds].sort((a, b) => a - b).join(',');
    const serverKey = `${selectedServerOption}`;
    const cacheKey = `${itemIdsKey}|${serverKey}`;
    
    // Skip if already fetching or if items and server haven't changed
    if (velocityFetchInProgressRef.current || lastFetchedItemIdsRef.current === cacheKey) {
      return;
    }

    // Create new abort controller and request ID
    const currentRequestId = ++velocityFetchRequestIdRef.current;
    velocityFetchAbortControllerRef.current = new AbortController();
    const abortSignal = velocityFetchAbortControllerRef.current.signal;
    velocityFetchInProgressRef.current = true;

    const fetchData = async () => {
      setIsLoadingVelocities(true);
      try {
        // Determine if we're querying DC or world
        const isDCQuery = selectedServerOption === selectedWorld.section;
        // When world is selected, use world ID; when DC is selected, use DC name
        const queryTarget = isDCQuery 
          ? selectedWorld.section  // DC name
          : selectedServerOption;   // World ID (number)
        
        // Batch requests if more than 100 items
        const batchSize = 100;
        const allVelocities = {};
        const allAveragePrices = {};
        const allMinListings = {};
        const allRecentPurchases = {};
        const allTradability = {};
        
        // Process all batches first, then update state once at the end
        for (let i = 0; i < allItemIds.length; i += batchSize) {
          // Check if request was cancelled or superseded
          if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
            return;
          }
          
          const batch = allItemIds.slice(i, i + batchSize);
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
            
            if (data && data.results) {
              data.results.forEach(item => {
                const itemId = item.itemId;
                
                // Helper function to get value preferring world over dc
                const getValue = (nqData, hqData, field) => {
                  // For world queries, prefer world value, fallback to dc
                  // For DC queries, use dc value
                  const nqWorld = nqData?.world?.[field];
                  const hqWorld = hqData?.world?.[field];
                  const nqDc = nqData?.dc?.[field];
                  const hqDc = hqData?.dc?.[field];
                  
                  // Prefer world values if they exist, otherwise use dc
                  const nqValue = nqWorld !== undefined ? nqWorld : nqDc;
                  const hqValue = hqWorld !== undefined ? hqWorld : hqDc;
                  
                  // Compare NQ and HQ, return the appropriate value based on field type
                  if (field === 'quantity') {
                    // For velocity, add NQ and HQ together (use whichever is available)
                    if (nqValue !== undefined || hqValue !== undefined) {
                      return (nqValue || 0) + (hqValue || 0);
                    }
                  } else {
                    // For prices, pick lower (cheaper)
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
                
                // Get velocity - compare NQ and HQ, pick higher, prefer world over dc
                const velocity = getValue(
                  item.nq?.dailySaleVelocity,
                  item.hq?.dailySaleVelocity,
                  'quantity'
                );
                
                // Get average price - compare NQ and HQ, pick lower (cheaper), prefer world over dc
                const averagePrice = getValue(
                  item.nq?.averageSalePrice,
                  item.hq?.averageSalePrice,
                  'price'
                );
                
                // Get min listing - compare NQ and HQ, pick lower, prefer world over dc
                const minListing = getValue(
                  item.nq?.minListing,
                  item.hq?.minListing,
                  'price'
                );
                
                // Get recent purchase - compare NQ and HQ, pick lower, prefer world over dc
                const recentPurchase = getValue(
                  item.nq?.recentPurchase,
                  item.hq?.recentPurchase,
                  'price'
                );
                
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
            
            // Items not in results are non-tradable
            batch.forEach(itemId => {
              if (!allTradability.hasOwnProperty(itemId)) {
                allTradability[itemId] = false;
              }
            });
          } catch (error) {
            // Ignore abort errors
            if (error.name === 'AbortError' || abortSignal.aborted) {
              return;
            }
            console.error('Error fetching market data:', error);
            batch.forEach(itemId => {
              if (!allTradability.hasOwnProperty(itemId)) {
                allTradability[itemId] = false;
              }
            });
          }
        }
        
        // Only update state if this is still the current request
        if (!abortSignal.aborted && currentRequestId === velocityFetchRequestIdRef.current) {
          setSearchVelocities(allVelocities);
          setSearchAveragePrices(allAveragePrices);
          setSearchMinListings(allMinListings);
          setSearchRecentPurchases(allRecentPurchases);
          setSearchTradability(allTradability);
          // Mark fetch as complete - items have been fetched successfully
          velocityFetchInProgressRef.current = false;
          // Remember that we've fetched these items (don't refetch unless they change)
          lastFetchedItemIdsRef.current = cacheKey;
        } else {
          // Request was superseded, reset the in-progress flag
          velocityFetchInProgressRef.current = false;
          // Don't update lastFetchedItemIdsRef - let the new request handle it
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
          lastFetchedItemIdsRef.current = '';
        }
      } finally {
        // Only update loading state if this is still the current request
        if (currentRequestId === velocityFetchRequestIdRef.current) {
          setIsLoadingVelocities(false);
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
  }, [tradeableResults, untradeableResults, selectedServerOption, selectedWorld]);

  // Reset scroll position on mount and route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

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

    // Handle MSQ price checker page - just apply server selection from URL, let component handle the rest
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
        
        if (needsSearch) {
          const performSearch = async () => {
            if (lastProcessedURLRef.current !== currentURLKey) {
              return;
            }

            if (isLoadingDB || !isServerDataLoaded) {
              return;
            }

            if (!containsChinese(searchQuery.trim())) {
              return;
            }

            setIsSearching(true);
            setError(null);

            try {
              const results = await searchItems(searchQuery.trim());
              
              if (lastProcessedURLRef.current !== currentURLKey) {
                return;
              }
              
              // Separate tradeable and untradeable items
              const marketableSet = await getMarketableItems();
              const tradeable = results.filter(item => marketableSet.has(item.id));
              const untradeable = results.filter(item => !marketableSet.has(item.id));
              
              setTradeableResults(tradeable);
              setUntradeableResults(untradeable);
              setShowUntradeable(false);
              searchResultsRef.current = tradeable;
              setError(null);
              if (results.length === 0) {
                addToast('未找到相關物品', 'warning');
              } else {
                if (previousSearchText !== searchQuery) {
                  addToast(`找到 ${tradeable.length} 個可交易物品${untradeable.length > 0 ? `、${untradeable.length} 個不可交易物品` : ''}`, 'success');
                }
                if (tradeable.length === 1) {
                  const item = tradeable[0];
                  setSelectedItem(item);
                  selectedItemRef.current = item;
                  navigate(`/item/${item.id}`, { replace: false });
                }
              }
            } catch (err) {
              if (lastProcessedURLRef.current !== currentURLKey) {
                return;
              }
              console.error('Search error:', err);
              setError('搜索失敗，請稍後再試');
              setTradeableResults([]);
              setUntradeableResults([]);
              setShowUntradeable(false);
              searchResultsRef.current = [];
              addToast('搜索失敗', 'error');
            } finally {
              if (lastProcessedURLRef.current === currentURLKey) {
                setIsSearching(false);
              }
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
  }, [location.pathname, location.search, isServerDataLoaded, params.id, searchParams, searchText, navigate, addToast, isLoadingDB, datacenters, worlds]);

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

  // Handle item selection
  const handleItemSelect = useCallback((item) => {
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
    
    setIsLoadingMarket(true);
    
    setSelectedItem(item);
    selectedItemRef.current = item;
    
    addItemToHistory(item.id);
    
    navigate(`/item/${item.id}`, { replace: false });
    
    addToast(`已選擇: ${item.name}`, 'info');
  }, [addToast, navigate]);

  // Handle search
  const handleSearch = useCallback(async (searchTerm, skipNavigation = false) => {
    let currentItemId = params.id;
    if (!currentItemId && location.pathname.startsWith('/item/')) {
      const match = location.pathname.match(/^\/item\/(\d+)$/);
      if (match) {
        currentItemId = match[1];
      }
    }
    if (!searchTerm || searchTerm.trim() === '') {
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

    if (!containsChinese(searchTerm.trim())) {
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

    setIsSearching(true);
    setError(null);
    
    setSelectedItem(null);
    selectedItemRef.current = null;
    
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setRateLimitMessage(null);

    // Don't navigate if we're on ultimate-price-king, msq-price-checker or history page
    if (!skipNavigation && location.pathname !== '/ultimate-price-king' && location.pathname !== '/msq-price-checker' && location.pathname !== '/history') {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`, { replace: false });
    }

    try {
      const results = await searchItems(searchTerm.trim());
      
      // Separate tradeable and untradeable items
      const marketableSet = await getMarketableItems();
      const tradeable = results.filter(item => marketableSet.has(item.id));
      const untradeable = results.filter(item => !marketableSet.has(item.id));
      
      setTradeableResults(tradeable);
      setUntradeableResults(untradeable);
      setShowUntradeable(false); // Default to showing tradeable items
      setError(null);
      
      if (results.length === 0) {
        addToast('未找到相關物品', 'warning');
      } else {
        addToast(`找到 ${tradeable.length} 個可交易物品${untradeable.length > 0 ? `、${untradeable.length} 個不可交易物品` : ''}`, 'success');
        if (tradeable.length === 1) {
          handleItemSelect(tradeable[0]);
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
    }
  }, [addToast, isLoadingDB, selectedServerOption, containsChinese, handleItemSelect, params.id, location.pathname, navigate]);

  // Handle server option change
  const handleServerOptionChange = useCallback((option) => {
    setSelectedServerOption(option);
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
          // Build the crafting tree
          const tree = await buildCraftingTree(selectedItem.id);
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

  const serverOptions = selectedWorld
    ? [selectedWorld.section, ...selectedWorld.dcObj.worlds]
    : [];

  // Determine what to show based on current route
  const isOnHistoryPage = location.pathname === '/history';
  const isOnUltimatePriceKingPage = location.pathname === '/ultimate-price-king';
  const isOnMSQPriceCheckerPage = location.pathname === '/msq-price-checker';

  // Render MSQ price checker if on that route
  if (isOnMSQPriceCheckerPage) {
    return (
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
    );
  }

  // Render crafting job price checker if on that route
  if (isOnUltimatePriceKingPage) {
    return (
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white">
      {/* Logo - Desktop: Fixed Top Left, Mobile: Inside search bar row */}
      <button
        onClick={handleReturnHome}
        className="fixed z-[60] mid:flex items-center justify-center hover:opacity-80 transition-opacity duration-200 cursor-pointer mid:top-4 mid:left-4 hidden mid:w-12 mid:h-12 bg-transparent border-none p-0"
        title="返回主頁"
      >
        <img 
          src="/logo.png" 
          alt="返回主頁" 
          className="w-full h-full object-contain pointer-events-none transition-all duration-200"
          style={isServerDataLoaded ? {
            filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6)) drop-shadow(0 0 16px rgba(251, 191, 36, 0.4))',
            opacity: 1
          } : {
            opacity: 0.5
          }}
        />
      </button>

      {/* Fixed Search Bar - Top Row */}
      <div className={`fixed top-2 left-0 right-0 mid:top-4 mid:right-auto z-50 ${
        selectedItem 
          ? 'px-1.5 mid:px-0 mid:left-20 py-1 mid:py-0'
          : 'px-1.5 mid:pl-20 mid:pr-0 py-1 mid:py-0'
      } mid:w-auto`}>
        <div className="relative flex items-center gap-1.5 mid:gap-3">
          {/* Mobile Logo - Always visible on mobile, left of search bar */}
          <button
            onClick={handleReturnHome}
            className="mid:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity duration-200 cursor-pointer bg-transparent border-none p-0"
            title="返回主頁"
          >
            <img 
              src="/logo.png" 
              alt="返回主頁" 
              className="w-full h-full object-contain pointer-events-none transition-all duration-200"
              style={isServerDataLoaded ? {
                filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6)) drop-shadow(0 0 16px rgba(251, 191, 36, 0.4))',
                opacity: 1
              } : {
                opacity: 0.5
              }}
            />
          </button>

          {/* Search Bar */}
          <div className={`min-w-0 h-9 mid:h-12 ${
            selectedItem 
              ? 'flex-1 mid:flex-initial mid:w-80 detail:w-96 min-w-[100px]' 
              : 'flex-1 mid:flex-initial mid:w-[420px] detail:w-[520px] min-w-[100px]'
          }`}>
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

          {/* History Button - hidden on mobile for item info page (moves to second row) */}
          <div className={`flex-shrink-0 ${selectedItem ? 'hidden mid:block' : ''}`}>
            <HistoryButton onItemSelect={handleItemSelect} />
          </div>

          {/* Crafting Job Price Checker Button - hidden on mobile for item info page (moves to second row) */}
          <div className={`flex-shrink-0 ${selectedItem ? 'hidden mid:block' : ''}`}>
            <button
              onClick={() => navigate('/ultimate-price-king')}
              className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 mid:px-3 detail:px-4 h-9 mid:h-12 gap-1.5 mid:gap-2 ${
                isOnUltimatePriceKingPage 
                  ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
                  : 'border-purple-500/30 hover:border-ffxiv-gold/50'
              }`}
              title="製造職找價"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mid:h-5 mid:w-5 text-ffxiv-gold" 
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
              <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold hidden mid:inline">製造職</span>
              <span className="text-xs font-semibold text-ffxiv-gold mid:hidden">職</span>
            </button>
          </div>

          {/* MSQ Equipment Price Checker Button - hidden on mobile for item info page (moves to second row) */}
          <div className={`flex-shrink-0 ${selectedItem ? 'hidden mid:block' : ''}`}>
            <button
              onClick={() => navigate('/msq-price-checker')}
              className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 mid:px-3 detail:px-4 h-9 mid:h-12 gap-1.5 mid:gap-2 ${
                isOnMSQPriceCheckerPage 
                  ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
                  : 'border-purple-500/30 hover:border-ffxiv-gold/50'
              }`}
              title="主線裝備查價"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 mid:h-5 mid:w-5 text-ffxiv-gold" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold hidden mid:inline">主線裝備</span>
              <span className="text-xs font-semibold text-ffxiv-gold mid:hidden">裝備</span>
            </button>
          </div>
        </div>
      </div>

      {/* Second Row - Data Center & External Links */}
      <div className={`fixed left-2 mid:left-auto mid:right-4 right-2 z-50 flex flex-wrap items-center gap-1.5 mid:gap-2 ${
        selectedItem 
          ? 'top-[60px] mid:top-4'
          : 'top-[60px] mid:top-4'
      }`}>
        {/* History Button - Mobile only in second row for item info page */}
        {selectedItem && (
          <div className="mid:hidden flex-shrink-0">
            <HistoryButton onItemSelect={handleItemSelect} compact />
          </div>
        )}

        {/* Crafting Job Price Checker Button - Mobile only in second row for item info page */}
        {selectedItem && (
          <div className="mid:hidden flex-shrink-0">
            <button
              onClick={() => navigate('/ultimate-price-king')}
              className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 h-8 gap-1.5 ${
                isOnUltimatePriceKingPage 
                  ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
                  : 'border-purple-500/30 hover:border-ffxiv-gold/50'
              }`}
              title="製造職找價"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 text-ffxiv-gold" 
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
              <span className="text-xs font-semibold text-ffxiv-gold">職</span>
            </button>
          </div>
        )}

        {/* MSQ Equipment Price Checker Button - Mobile only in second row for item info page */}
        {selectedItem && (
          <div className="mid:hidden flex-shrink-0">
            <button
              onClick={() => navigate('/msq-price-checker')}
              className={`bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 h-8 gap-1.5 ${
                isOnMSQPriceCheckerPage 
                  ? 'border-ffxiv-gold/70 shadow-[0_0_10px_rgba(212,175,55,0.3)]' 
                  : 'border-purple-500/30 hover:border-ffxiv-gold/50'
              }`}
              title="主線裝備查價"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-4 w-4 text-ffxiv-gold" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="text-xs font-semibold text-ffxiv-gold">裝</span>
            </button>
          </div>
        )}
        
        {/* External Links - Show when item is selected */}
        {selectedItem && (
          <>
            <div className="mid:hidden w-px h-5 bg-slate-600/50"></div>
            <button
              onClick={async () => {
                try {
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
                } catch (error) {
                  console.error('Failed to open Wiki link:', error);
                  addToast('無法打開Wiki連結', 'error');
                }
              }}
              className="px-2 mid:px-3 h-8 mid:h-10 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors flex items-center"
            >
              Wiki
            </button>
            <a
              href={`https://www.garlandtools.org/db/#item/${selectedItem.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 mid:px-3 h-8 mid:h-10 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors flex items-center"
            >
              Garland
            </a>
            <a
              href={`https://universalis.app/market/${selectedItem.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 mid:px-3 h-8 mid:h-10 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors flex items-center"
            >
              Market
            </a>
          </>
        )}
      </div>


      {/* Toast Notifications */}
      <div className={`fixed right-2 mid:right-4 left-2 mid:left-auto z-50 space-y-2 max-w-sm mid:max-w-none ${
        selectedItem 
          ? 'top-[100px] mid:top-4'
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
          ? 'pt-[108px] mid:pt-24'
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
          {!isOnHistoryPage && (tradeableResults.length > 0 || untradeableResults.length > 0) && !selectedItem && (
            <div className="mb-6">
              {/* Search Results Header */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold">
                  搜索結果 ({showUntradeable ? untradeableResults.length : tradeableResults.length} 個物品)
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
                    onClick={() => setShowUntradeable(!showUntradeable)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      showUntradeable
                        ? 'bg-orange-600/40 text-orange-300 border border-orange-500/50 hover:bg-orange-600/60'
                        : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                    }`}
                  >
                    {showUntradeable ? `隱藏 (${untradeableResults.length} 個不可交易)` : `顯示 (${untradeableResults.length} 個不可交易)`}
                  </button>
                )}
              </div>

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
                  />
                </div>
              )}
              <ItemTable
                items={showUntradeable ? untradeableResults : tradeableResults}
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
              />
            </div>
          )}

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
                  <div className="flex items-center gap-3 detail:gap-4 overflow-x-auto min-w-0 detail:flex-shrink-0 detail:max-w-none">
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
                <CraftingTree
                  tree={craftingTree}
                  selectedServerOption={selectedServerOption}
                  selectedWorld={selectedWorld}
                  worlds={worlds}
                  onItemSelect={handleItemSelect}
                />
              )}

              {/* Related Items - Expandable */}
              {isRelatedItemsExpanded && hasRelatedItems && (
                <RelatedItems
                  itemId={selectedItem?.id}
                  onItemClick={handleItemSelect}
                />
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
                    <img 
                      src={currentImage} 
                      alt="Random icon" 
                      onClick={handleImageClick}
                      draggable={false}
                      className="w-16 h-16 sm:w-24 sm:h-24 object-contain opacity-50 cursor-pointer hover:opacity-70 transition-opacity"
                    />
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                  <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-indigo-900/30 rounded-lg p-3 sm:p-4 border border-purple-500/30">
                    <div className="text-2xl mb-2">🔍</div>
                    <h3 className="text-xs sm:text-sm font-semibold text-ffxiv-gold mb-1">快速搜索</h3>
                    <p className="text-xs text-gray-400">支持繁體中文和簡體中文輸入</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-indigo-900/30 rounded-lg p-3 sm:p-4 border border-purple-500/30">
                    <div className="text-2xl mb-2">🌐</div>
                    <h3 className="text-xs sm:text-sm font-semibold text-ffxiv-gold mb-1">全服搜索</h3>
                    <p className="text-xs text-gray-400">選擇數據中心可查看所有服務器價格</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-indigo-900/30 rounded-lg p-3 sm:p-4 border border-purple-500/30 sm:col-span-2 lg:col-span-1">
                    <div className="text-2xl mb-2">📊</div>
                    <h3 className="text-xs sm:text-sm font-semibold text-ffxiv-gold mb-1">價格對比</h3>
                    <p className="text-xs text-gray-400">實時查看市場價格和歷史交易</p>
                  </div>
                </div>
              </div>

              {/* History Items Section - Show on home page below welcome section */}
              <HistorySection onItemSelect={handleItemSelect} />

              {/* Tips Section */}
              <div className="bg-gradient-to-br from-slate-800/40 via-purple-900/15 to-slate-800/40 rounded-lg border border-purple-500/20 p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold mb-3 sm:mb-4">💡 使用提示</h3>
                <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold flex-shrink-0">•</span>
                    <span>支持多關鍵詞搜索，用空格分隔（例如：「陳舊的 地圖」）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold flex-shrink-0">•</span>
                    <span>可以調整查詢數量（10-100）和過濾HQ物品</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold flex-shrink-0">•</span>
                    <span>查看物品詳情會自動保存到歷史記錄，最多保存10個物品，可在搜索欄旁的歷史記錄按鈕查看</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
