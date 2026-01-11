import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import ServerSelector from './components/ServerSelector';
import ItemTable from './components/ItemTable';
import MarketListings from './components/MarketListings';
import MarketHistory from './components/MarketHistory';
import Toast from './components/Toast';
import { searchItems, getItemById } from './services/itemDatabase';
import { getMarketData } from './services/universalis';
import { containsChinese } from './utils/chineseConverter';
import ItemImage from './components/ItemImage';

function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState([]);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const [rateLimitMessage, setRateLimitMessage] = useState(null);
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
  const isInitializingFromURLRef = useRef(false);
  const lastProcessedURLRef = useRef('');
  const searchResultsRef = useRef([]);

  // Add toast function
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  // Remove toast function
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Load data centers and worlds on mount
  useEffect(() => {
    // Don't retry if data is already loaded successfully
    // Check the refs instead of state to avoid dependency issues
    if (serverLoadCompletedRef.current) {
      return;
    }
    
    // Reset retry count and flags for new load attempt
    serverLoadRetryCountRef.current = 0;
    serverLoadInProgressRef.current = false;
    serverLoadCompletedRef.current = false;
    serverLoadRequestIdRef.current = 0;
    
    // Abort any existing request
    if (serverLoadAbortControllerRef.current) {
      serverLoadAbortControllerRef.current.abort();
    }
    
    // Clear any existing timeout
    if (serverLoadTimeoutRef.current) {
      clearTimeout(serverLoadTimeoutRef.current);
      serverLoadTimeoutRef.current = null;
    }

    const loadData = async (isRetry = false) => {
      // Generate a unique request ID for this attempt
      const currentRequestId = ++serverLoadRequestIdRef.current;
      
      // Abort previous request if this is a retry
      if (isRetry && serverLoadAbortControllerRef.current) {
        serverLoadAbortControllerRef.current.abort();
      }
      
      // Create new AbortController for this request
      serverLoadAbortControllerRef.current = new AbortController();
      const abortSignal = serverLoadAbortControllerRef.current.signal;
      
      serverLoadInProgressRef.current = true;
      serverLoadCompletedRef.current = false;
      
      // Clear any existing timeout
      if (serverLoadTimeoutRef.current) {
        clearTimeout(serverLoadTimeoutRef.current);
        serverLoadTimeoutRef.current = null;
      }
      
      // Set timeout to check if data is loaded within 2 seconds
      serverLoadTimeoutRef.current = setTimeout(() => {
        // Only retry if:
        // 1. This is still the current request (not superseded)
        // 2. Loading is still in progress
        // 3. Data hasn't been completed
        // 4. Request hasn't been aborted
        // 5. We haven't exceeded max retries
        if (
          currentRequestId === serverLoadRequestIdRef.current &&
          serverLoadInProgressRef.current && 
          !serverLoadCompletedRef.current && 
          !abortSignal.aborted &&
          serverLoadRetryCountRef.current < 3
        ) {
          serverLoadRetryCountRef.current++;
          serverLoadInProgressRef.current = false; // Mark previous attempt as no longer in progress
          addToast(`伺服器加載超時，正在重試 (${serverLoadRetryCountRef.current}/3)...`, 'warning');
          // Retry the load
          loadData(true);
        }
      }, 2000);

      try {
        // Check if request was aborted before starting fetch
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const dcResponse = await fetch('https://universalis.app/api/v2/data-centers', {
          signal: abortSignal
        });
        
        // Check again after first fetch
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const dcData = await dcResponse.json();
        
        // Check again after parsing first response
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const worldsResponse = await fetch('https://universalis.app/api/v2/worlds', {
          signal: abortSignal
        });
        
        // Check again after second fetch
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        const worldsData = await worldsResponse.json();
        
        // Final check before updating state
        if (abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        // Check if data is empty or invalid, retry if needed (before setting states)
        if (!dcData || !Array.isArray(dcData) || dcData.length === 0 || 
            !worldsData || !Array.isArray(worldsData) || worldsData.length === 0) {
          // Data is empty, retry if we haven't exceeded max retries
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

        // Mark loading as complete
        serverLoadInProgressRef.current = false;
        serverLoadCompletedRef.current = true;
        
        // Clear timeout since we got data
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
          // Default to data center (全服搜尋)
          setSelectedServerOption(firstDC.name);
        } else if (dcData.length > 0) {
          // If no trad Chinese DC found, use first available DC
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
        // Show success message if this was a retry
        if (isRetry && serverLoadRetryCountRef.current > 0) {
          addToast('伺服器資料加載成功', 'success');
        } else {
          addToast('伺服器資料加載完成', 'success');
        }
      } catch (err) {
        // Don't handle error if request was aborted or superseded
        if (err.name === 'AbortError' || abortSignal.aborted || currentRequestId !== serverLoadRequestIdRef.current) {
          return;
        }
        
        // Mark loading as no longer in progress
        serverLoadInProgressRef.current = false;
        
        // Clear timeout
        if (serverLoadTimeoutRef.current) {
          clearTimeout(serverLoadTimeoutRef.current);
          serverLoadTimeoutRef.current = null;
        }
        
        // If we haven't exceeded max retries, try again
        if (serverLoadRetryCountRef.current < 3) {
          serverLoadRetryCountRef.current++;
          addToast(`伺服器加載失敗，正在重試 (${serverLoadRetryCountRef.current}/3)...`, 'warning');
          setTimeout(() => {
            // Only retry if this is still the current request
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
    
    // Cleanup: clear timeout and abort request when component unmounts or effect re-runs
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

  // Sync selectedItem and searchResults to refs
  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);

  // Initialize from URL on mount and when URL changes
  useEffect(() => {
    if (!isServerDataLoaded || isInitializingFromURLRef.current) {
      return;
    }

    // Create a unique key for the current URL state to avoid processing the same URL twice
    const currentURLKey = `${location.pathname}?${location.search}`;
    
    // Skip if we've already processed this exact URL
    if (lastProcessedURLRef.current === currentURLKey) {
      return;
    }

    isInitializingFromURLRef.current = true;

    // Check if we're on item detail page
    // Extract itemId from params.id (if routes are configured) or from pathname (fallback)
    let itemId = params.id;
    if (!itemId && location.pathname.startsWith('/item/')) {
      // Extract ID from pathname: /item/6689 -> 6689
      const match = location.pathname.match(/^\/item\/(\d+)$/);
      if (match) {
        itemId = match[1];
      }
    }
    if (itemId) {
      const id = parseInt(itemId, 10);
      if (id && !isNaN(id)) {
        // If we have a selected item with this ID, keep it
        // Otherwise, we need to search for it or load it
        const currentSelectedItem = selectedItemRef.current;
        if (!currentSelectedItem || currentSelectedItem.id !== id) {
          // Try to find in search results first (use ref to avoid dependency)
          const foundItem = searchResultsRef.current.find(item => item.id === id);
          if (foundItem) {
            setSelectedItem(foundItem);
            selectedItemRef.current = foundItem;
          } else {
            // Item not in search results, load it by ID
            getItemById(id)
              .then(item => {
                // Check if URL hasn't changed while loading
                if (lastProcessedURLRef.current !== currentURLKey) {
                  return;
                }
                if (item) {
                  setSelectedItem(item);
                  selectedItemRef.current = item;
                } else {
                  // Item not found, navigate to home
                  addToast('找不到該物品', 'error');
                  navigate('/');
                }
              })
              .catch(error => {
                // Check if URL hasn't changed while loading
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
      // Only trigger search if we're not on item page or if search text is different
      if (!itemId && searchText !== searchQuery) {
        setSearchText(searchQuery);
        // Perform search directly (skip navigation to avoid loop)
        const performSearch = async () => {
          // Check if URL hasn't changed while waiting
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
          
          // Clear selected item to show search results
          setSelectedItem(null);
          selectedItemRef.current = null;
          
          // Clear previous market data
          setMarketInfo(null);
          setMarketListings([]);
          setMarketHistory([]);
          setRateLimitMessage(null);

          try {
            const results = await searchItems(searchQuery.trim());
            
            // Check if URL hasn't changed while searching
            if (lastProcessedURLRef.current !== currentURLKey) {
              return;
            }
            
            setSearchResults(results);
            searchResultsRef.current = results;
            setError(null);
            if (results.length === 0) {
              addToast('未找到相關物品', 'warning');
            } else {
              addToast(`找到 ${results.length} 個結果`, 'success');
              // Auto-select first result if only one
              if (results.length === 1) {
                const item = results[0];
                setSelectedItem(item);
                selectedItemRef.current = item;
                navigate(`/item/${item.id}`);
              }
            }
          } catch (err) {
            // Check if URL hasn't changed while searching
            if (lastProcessedURLRef.current !== currentURLKey) {
              return;
            }
            console.error('Search error:', err);
            setError('搜索失敗，請稍後再試');
            setSearchResults([]);
            searchResultsRef.current = [];
            addToast('搜索失敗', 'error');
          } finally {
            // Only update loading state if URL hasn't changed
            if (lastProcessedURLRef.current === currentURLKey) {
              setIsSearching(false);
            }
          }
        };
        
        performSearch();
      }
    } else if (!itemId) {
      // We're on home page (no item ID and no search query)
      const currentSelectedItem = selectedItemRef.current;
      const currentSearchResults = searchResultsRef.current;
      if (currentSelectedItem || currentSearchResults.length > 0 || searchText) {
        // Clear everything if we're navigating to home
        setSelectedItem(null);
        selectedItemRef.current = null;
        setSearchResults([]);
        searchResultsRef.current = [];
        setSearchText('');
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
      }
    }

    // Mark this URL as processed
    lastProcessedURLRef.current = currentURLKey;
    isInitializingFromURLRef.current = false;
  }, [location.pathname, location.search, isServerDataLoaded, params.id, searchParams, searchText, navigate, addToast, isLoadingDB]);

  // Handle return to home page
  const handleReturnHome = useCallback(() => {
    setSelectedItem(null);
    selectedItemRef.current = null;
    setSearchResults([]);
    setSearchText('');
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);
    
    // Clear any pending retries/timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Reset retry state
    retryCountRef.current = 0;
    dataReceivedRef.current = false;
    requestInProgressRef.current = false;
    
    // Navigate to home
    navigate('/');
  }, [navigate]);

  // Handle item selection
  const handleItemSelect = useCallback((item) => {
    // Clear all previous data immediately when switching items
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);
    
    // Clear search text when entering item detail page
    setSearchText('');
    setSearchResults([]);
    
    // Clear any pending retries/timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Reset retry state
    retryCountRef.current = 0;
    dataReceivedRef.current = false;
    requestInProgressRef.current = false;
    
    // Set loading state to show we're loading new data
    setIsLoadingMarket(true);
    
    // Set the new selected item
    setSelectedItem(item);
    selectedItemRef.current = item; // Update ref
    
    // Navigate to item detail page
    navigate(`/item/${item.id}`);
    
    addToast(`已選擇: ${item.name}`, 'info');
  }, [addToast, navigate]);

  // Handle search
  const handleSearch = useCallback(async (searchTerm, skipNavigation = false) => {
    // Extract itemId from pathname if params.id is not available
    let currentItemId = params.id;
    if (!currentItemId && location.pathname.startsWith('/item/')) {
      const match = location.pathname.match(/^\/item\/(\d+)$/);
      if (match) {
        currentItemId = match[1];
      }
    }
    if (!searchTerm || searchTerm.trim() === '') {
      setSearchResults([]);
      // When search is cleared, only clear selected item if there's no selected item
      // This prevents clearing the item view when entering item detail page (which clears search bar)
      // If user is on detail page and clears search, keep the detail page visible
      // If user is on main page and clears search, stay on main page
      // Use ref to get the latest selectedItem value
      if (!selectedItemRef.current) {
        setSelectedItem(null);
        // Clear market data when clearing search
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
        setError(null);
        setRateLimitMessage(null);
        // Navigate to home if not on item page
        if (!skipNavigation && !currentItemId) {
          navigate('/');
        }
      }
      return;
    }

    // Wait for server data to load before allowing search
    // Note: selectedServerOption is only needed for market data, not for item search
    if (isLoadingDB || !isServerDataLoaded) {
      addToast('請等待伺服器資料加載完成', 'warning');
      return;
    }

    // Check if input contains Chinese characters
    if (!containsChinese(searchTerm.trim())) {
      addToast('請輸入中文進行搜索', 'warning');
      setSearchResults([]);
      setSelectedItem(null);
      // Clear market data
      setMarketInfo(null);
      setMarketListings([]);
      setMarketHistory([]);
      setError(null);
      setRateLimitMessage(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    
    // Clear selected item to show search results instead of item detail page
    setSelectedItem(null);
    selectedItemRef.current = null; // Update ref
    
    // Clear previous market data when starting new search
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setRateLimitMessage(null);

    // Navigate to search page (skip if this is called from URL initialization)
    if (!skipNavigation) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }

    try {
      // searchItems will handle the conversion internally
      const results = await searchItems(searchTerm.trim());
      
      setSearchResults(results);
      setError(null);
      if (results.length === 0) {
        addToast('未找到相關物品', 'warning');
      } else {
        addToast(`找到 ${results.length} 個結果`, 'success');
        // Auto-select first result if only one
        if (results.length === 1) {
          handleItemSelect(results[0]);
        }
      }
    } catch (err) {
      setError(err.message || '搜索失敗，請稍後再試');
      addToast('搜索失敗', 'error');
      setSearchResults([]);
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
    // Wait for server data to load before loading market data
    if (isLoadingDB || !selectedItem || !selectedServerOption) {
      // Clear data if we don't have required info
      setMarketInfo(null);
      setMarketListings([]);
      setMarketHistory([]);
      return;
    }

    // Immediately clear old data when switching items/servers
    // This ensures old results don't flash while new data loads
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any pending retry timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    // Increment request ID to track the latest request
    const currentRequestId = ++requestIdRef.current;
    
    // Capture the current item and server at the start of the request
    // This ensures we don't update state with old data if user switches items
    const requestItemId = selectedItem.id;
    const requestItemName = selectedItem.name;
    const requestServerOption = selectedServerOption;
    
    // Reset retry count and flags for new request
    retryCountRef.current = 0;
    dataReceivedRef.current = false;
    requestInProgressRef.current = false;
    
    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const loadMarketData = async (isRetry = false) => {
      // If this is a retry, abort the previous request attempt
      if (isRetry && abortControllerRef.current) {
        abortControllerRef.current.abort();
        // Create a new abort controller for the retry
        const newAbortController = new AbortController();
        abortControllerRef.current = newAbortController;
      }

      setIsLoadingMarket(true);
      setError(null);
      setRateLimitMessage(null);
      
      // Mark that a request is in progress
      requestInProgressRef.current = true;
      dataReceivedRef.current = false;
      
      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // Set timeout to check if data is received within 1.5 seconds
      const requestStartTime = Date.now();
      retryTimeoutRef.current = setTimeout(() => {
        // Only retry if:
        // 1. Request is still in progress (hasn't completed)
        // 2. Data hasn't been received
        // 3. We haven't exceeded max retries
        // 4. This is still the current request
        // 5. Request hasn't been aborted
        // 6. The item and server still match (user hasn't switched)
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
          requestInProgressRef.current = false; // Mark previous attempt as no longer in progress
          addToast(`請求超時，正在重試 (${retryCountRef.current}/3)...`, 'warning');
          // Retry the request
          loadMarketData(true);
        }
      }, 1500);

      try {
        const options = {
          listings: listSize,
          entries: 10,
          signal: abortControllerRef.current.signal, // Use current abort controller
        };

        if (selectedItem.canBeHQ && hqOnly) {
          options.hq = true;
        }

        const data = await getMarketData(requestServerOption, requestItemId, options);

        // Check if this request was cancelled, if a newer request has started, or if user switched items/servers
        if (
          abortControllerRef.current?.signal.aborted || 
          currentRequestId !== requestIdRef.current ||
          selectedItem?.id !== requestItemId ||
          selectedServerOption !== requestServerOption
        ) {
          requestInProgressRef.current = false;
          return; // Don't update state if request was cancelled, superseded, or user switched items
        }

        // Mark that data was received and request is complete
        dataReceivedRef.current = true;
        requestInProgressRef.current = false;
        
        // Clear retry timeout since we got data
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }

        setMarketInfo(data);

        if (data) {
          // Check if this is a data center search (multiple worlds) or single world
          // Use captured values to ensure consistency even if user switches
          const isDataCenterSearch = selectedWorld && requestServerOption === selectedWorld.section;
          
          // Limit listings to listSize (API might return more)
          const allListings = (data.listings || [])
            .map(listing => ({
              itemName: requestItemName, // Use captured item name
              pricePerUnit: listing.pricePerUnit,
              quantity: listing.quantity,
              total: listing.total,
              retainerName: listing.retainerName,
              // Use listing.worldName if available (for data center searches), otherwise use data.worldName or requestServerOption
              worldName: listing.worldName || (isDataCenterSearch ? (data.dcName || requestServerOption) : (data.worldName || requestServerOption)),
              hq: listing.hq || false,
            }))
            .sort((a, b) => a.pricePerUnit - b.pricePerUnit);
          
          // Apply listSize limit
          const listings = allListings.slice(0, listSize);

          const history = (data.recentHistory || [])
            .map(entry => ({
              itemName: requestItemName, // Use captured item name
              pricePerUnit: entry.pricePerUnit,
              quantity: entry.quantity,
              total: entry.total,
              buyerName: entry.buyerName,
              // Use entry.worldName if available (for data center searches), otherwise use data.worldName or requestServerOption
              worldName: entry.worldName || (isDataCenterSearch ? (data.dcName || requestServerOption) : (data.worldName || requestServerOption)),
              timestamp: entry.timestamp,
              hq: entry.hq || false,
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

          // Double-check request is still valid before updating state
          // Verify: request ID matches, not aborted, and item/server still match
          if (
            currentRequestId === requestIdRef.current && 
            !abortControllerRef.current?.signal.aborted &&
            selectedItem?.id === requestItemId &&
            selectedServerOption === requestServerOption
          ) {
            setMarketListings(listings);
            setMarketHistory(history);
            // Show success message if this was a retry
            if (isRetry && retryCountRef.current > 0) {
              addToast('數據加載成功', 'success');
            }
          }
        }
      } catch (err) {
        // Mark request as no longer in progress
        requestInProgressRef.current = false;
        
        // Don't show error if request was cancelled
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || abortControllerRef.current?.signal.aborted) {
          return;
        }
        
        // Only update state if this is still the latest request and item/server still match
        if (
          currentRequestId === requestIdRef.current &&
          selectedItem?.id === requestItemId &&
          selectedServerOption === requestServerOption
        ) {
          // Check if it's a rate limit error
          if (err.message && err.message.includes('請求頻率過高')) {
            setRateLimitMessage('請求頻率過高，請稍後再試');
            addToast('請求頻率過高，請稍後再試', 'warning');
            // Auto-retry after a delay
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
            // Check if it's a 404 error (item not found in market data)
            // 404 means the item doesn't exist in Universalis market data
            // This could be because the item is not tradeable on market board
            // or doesn't have market data available
            if (err.response?.status === 404) {
              setError('此物品在市場數據中不存在，可能無法在市場板交易');
              addToast('此物品在市場數據中不存在', 'warning');
              return; // Don't retry 404 errors
            }
            
            // If we haven't exceeded max retries, try again
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
        // Only update loading state if this is still the latest request and (data was received or max retries reached or request is no longer in progress)
        if (currentRequestId === requestIdRef.current && (dataReceivedRef.current || retryCountRef.current >= 3 || !requestInProgressRef.current)) {
          setIsLoadingMarket(false);
        }
      }
    };

    loadMarketData();

    // Cleanup: abort request when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [isLoadingDB, selectedItem, selectedServerOption, listSize, hqOnly, worlds, refreshKey, addToast, selectedWorld]);

  const serverOptions = selectedWorld
    ? [selectedWorld.section, ...selectedWorld.dcObj.worlds]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Logo - Top Left */}
      <button
        onClick={handleReturnHome}
        className="fixed top-4 left-4 z-50 flex items-center justify-center text-3xl hover:opacity-80 transition-opacity duration-200 cursor-pointer"
        title="返回主頁"
      >
        🐤
      </button>

      {/* Fixed Search Bar and Data Center - Top Left (next to logo) */}
      <div className="fixed top-4 left-20 z-50 flex items-center gap-3">
        {/* Search Bar */}
        <div className="w-96 h-12">
          <div className="h-full">
            <SearchBar 
              onSearch={handleSearch} 
              isLoading={isSearching}
              value={searchText}
              onChange={setSearchText}
              disabled={!isServerDataLoaded}
              disabledTooltip={!isServerDataLoaded ? '請等待伺服器資料載入完成' : undefined}
            />
          </div>
        </div>

        {/* Data Center Display - Next to search bar */}
        {selectedWorld && (
          <div className="flex items-center gap-2 px-4 h-12 bg-gradient-to-r from-slate-700/50 to-slate-800/50 border border-slate-600/50 rounded-lg backdrop-blur-sm whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-ffxiv-gold animate-pulse"></div>
            <span className="text-sm font-semibold text-ffxiv-gold">
              {selectedWorld.section}
            </span>
          </div>
        )}
      </div>

      {/* External Links - Top Right (when item is selected) */}
      {selectedItem && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
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
            className="px-3 py-1.5 text-xs font-medium bg-slate-700/70 hover:bg-slate-600/70 text-gray-300 hover:text-white rounded-md border border-slate-500/50 hover:border-slate-400/50 transition-all duration-200 flex items-center gap-1.5 shadow-sm"
            title="複製物品名稱"
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
            <span>複製</span>
          </button>
          <div className="w-px h-4 bg-slate-600/50 mx-1"></div>
          <a
            href={`https://ff14.huijiwiki.com/wiki/${selectedItem.id > 1000 || selectedItem.id < 20 ? '物品:' : ''}${encodeURIComponent(selectedItem.nameSimplified || selectedItem.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-slate-700/50 rounded border border-slate-600 hover:border-ffxiv-gold transition-colors"
          >
            Wiki
          </a>
          <a
            href={`https://www.garlandtools.cn/db/#item/${selectedItem.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-slate-700/50 rounded border border-slate-600 hover:border-ffxiv-gold transition-colors"
          >
            Garland
          </a>
          <a
            href={`https://universalis.app/market/${selectedItem.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-slate-700/50 rounded border border-slate-600 hover:border-ffxiv-gold transition-colors"
          >
            Market
          </a>
        </div>
      )}

      {/* Toast Notifications - Below Links */}
      <div className="fixed top-16 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Loading Indicator - Top Center */}
      {isLoadingDB && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-ffxiv-gold/30 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ffxiv-gold"></div>
            <span className="text-sm text-gray-300">正在載入伺服器...</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Search Results */}
          {searchResults.length > 0 && !selectedItem && (
            <div className="mb-6">
              <ItemTable
                items={searchResults}
                onSelect={handleItemSelect}
                selectedItem={selectedItem}
              />
            </div>
          )}

          {/* Selected Item & Market Data */}
          {selectedItem && (
            <div className="space-y-6">
              {/* Item Info & Controls - Compact */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-4">
                {/* First Row: Item Image, Name & Server Selector */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <ItemImage
                        itemId={selectedItem.id}
                        alt={selectedItem.name}
                        className="w-20 h-20 object-contain rounded-lg border-2 border-ffxiv-gold/30 bg-slate-900/50 p-2 shadow-lg"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-ffxiv-gold">{selectedItem.name}</h2>
                      <p className="text-sm text-gray-400">ID: {selectedItem.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-6 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-400 whitespace-nowrap">數量:</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="1"
                      value={listSize}
                      onChange={(e) => setListSize(parseInt(e.target.value, 10))}
                      className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-ffxiv-gold"
                    />
                    <span className="text-sm text-ffxiv-gold w-10 font-medium">{listSize}</span>
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
                            : 'bg-slate-700 border-2 border-slate-600'
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
                        text-sm font-semibold transition-colors duration-200
                        ${hqOnly 
                          ? 'text-ffxiv-gold' 
                          : 'text-gray-400 group-hover:text-gray-300'
                        }
                      `}>
                        HQ
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Market Listings & History - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Market Listings */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-ffxiv-gold">在售列表</h3>
                    <button
                      onClick={() => setRefreshKey(prev => prev + 1)}
                      className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 transition-colors"
                    >
                      刷新
                    </button>
                  </div>
                  {isLoadingMarket ? (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-12 text-center">
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
                    <MarketListings listings={marketListings} onRefresh={() => setRefreshKey(prev => prev + 1)} />
                  )}
                </div>

                {/* Market History */}
                <div>
                  <h3 className="text-lg font-semibold text-ffxiv-gold mb-3">歷史交易</h3>
                  {isLoadingMarket ? (
                    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-12 text-center">
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
                    <MarketHistory history={marketHistory} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Empty State - Show welcome content before search */}
          {!selectedItem && searchResults.length === 0 && !isSearching && (
            <div className="space-y-8">
              {/* Welcome Section */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-8">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4 opacity-50">⚔️</div>
                  <h2 className="text-2xl font-bold text-ffxiv-gold mb-2">貝爾的FFXIV市場小屋</h2>
                  <p className="text-gray-400">在左上角搜索物品名稱，比較不同服務器的價格</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <div className="text-2xl mb-2">🔍</div>
                    <h3 className="text-sm font-semibold text-ffxiv-gold mb-1">快速搜索</h3>
                    <p className="text-xs text-gray-400">支持繁體中文和簡體中文輸入</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <div className="text-2xl mb-2">🌐</div>
                    <h3 className="text-sm font-semibold text-ffxiv-gold mb-1">全服搜索</h3>
                    <p className="text-xs text-gray-400">選擇數據中心可查看所有服務器價格</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                    <div className="text-2xl mb-2">📊</div>
                    <h3 className="text-sm font-semibold text-ffxiv-gold mb-1">價格對比</h3>
                    <p className="text-xs text-gray-400">實時查看市場價格和歷史交易</p>
                  </div>
                </div>
              </div>

              {/* Tips Section */}
              <div className="bg-slate-800/30 rounded-lg border border-slate-700/30 p-6">
                <h3 className="text-lg font-semibold text-ffxiv-gold mb-4">💡 使用提示</h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold">•</span>
                    <span>支持多關鍵詞搜索，用空格分隔（例如：「陳舊的 地圖」）</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold">•</span>
                    <span>選擇數據中心名稱可查看該數據中心下所有服務器的價格</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold">•</span>
                    <span>可以調整查詢數量（10-100）和過濾HQ物品</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-ffxiv-gold">•</span>
                    <span>點擊物品表格中的鏈接可查看詳細信息</span>
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
