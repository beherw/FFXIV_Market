import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import SearchBar from './components/SearchBar';
import ServerSelector from './components/ServerSelector';
import ItemTable from './components/ItemTable';
import MarketListings from './components/MarketListings';
import MarketHistory from './components/MarketHistory';
import Toast from './components/Toast';
import { searchItems, getItemById, getSimplifiedChineseName, cancelSimplifiedNameFetch } from './services/itemDatabase';
import { getMarketData } from './services/universalis';
import { containsChinese } from './utils/chineseConverter';
import ItemImage from './components/ItemImage';
import HistoryButton from './components/HistoryButton';
import HistorySection from './components/HistorySection';
import { addItemToHistory, getItemHistory, clearItemHistory } from './utils/itemHistory';

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
  const simplifiedNameAbortControllerRef = useRef(null);
  const [currentImage, setCurrentImage] = useState(() => Math.random() < 0.5 ? '/bear.png' : '/sheep.png');
  const [historyItems, setHistoryItems] = useState([]);
  const lastHistoryIdsRef = useRef([]);
  const toastIdCounterRef = useRef(0);

  // Add toast function
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + (++toastIdCounterRef.current);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  // Remove toast function
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Handle image swap on click
  const handleImageSwap = useCallback(() => {
    setCurrentImage(prev => prev === '/bear.png' ? '/sheep.png' : '/bear.png');
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

  // Reset scroll position on mount and route changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

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

    // Check if we're on history page
    if (location.pathname === '/history') {
      // Load history items
      const loadHistoryItems = async () => {
        const historyIds = getItemHistory();
        
        // Check if URL changed (navigating to history page from another page)
        const urlChanged = lastProcessedURLRef.current !== currentURLKey;
        
        // If URL changed, always load (navigating to history page)
        // If URL didn't change, check if history has changed
        if (!urlChanged) {
          const historyChanged = JSON.stringify(historyIds) !== JSON.stringify(lastHistoryIdsRef.current);
          if (!historyChanged) {
            // URL and history both unchanged, skip reload
            // But still mark URL as processed
            lastProcessedURLRef.current = currentURLKey;
            isInitializingFromURLRef.current = false;
            return;
          }
        }
        
        // Update ref to track current history
        lastHistoryIdsRef.current = historyIds;
        
        if (historyIds.length === 0) {
          setHistoryItems([]);
          setSearchResults([]);
          searchResultsRef.current = [];
          lastProcessedURLRef.current = currentURLKey;
          isInitializingFromURLRef.current = false;
          return;
        }

        try {
          const items = await Promise.all(
            historyIds.map(async (id) => {
              try {
                return await getItemById(id);
              } catch (error) {
                console.error(`Failed to load item ${id}:`, error);
                return null;
              }
            })
          );
          
          const validItems = items.filter(item => item !== null);
          setHistoryItems(validItems);
          setSearchResults(validItems);
          searchResultsRef.current = validItems;
          setSelectedItem(null);
          selectedItemRef.current = null;
          setSearchText('');
        } catch (error) {
          console.error('Failed to load history items:', error);
          setHistoryItems([]);
          setSearchResults([]);
          searchResultsRef.current = [];
        } finally {
          // Always mark URL as processed after loading
          lastProcessedURLRef.current = currentURLKey;
          isInitializingFromURLRef.current = false;
        }
      };

      loadHistoryItems();
      return;
    }

    // Check if we're on search page
    const searchQuery = searchParams.get('q');
    if (searchQuery && searchQuery.trim() !== '') {
      // We're on search page - restore search state
      if (!itemId) {
        // Clear selected item to show search results
        setSelectedItem(null);
        selectedItemRef.current = null;
        
        // Clear market data when showing search results
        setMarketInfo(null);
        setMarketListings([]);
        setMarketHistory([]);
        setRateLimitMessage(null);
        
        // Store previous search text to detect if this is a new search or returning from back button
        const previousSearchText = searchText;
        
        // Update search text to match URL
        if (searchText !== searchQuery) {
          setSearchText(searchQuery);
        }
        
        // Always check if we need to perform search or restore results
        // The key is: if searchResults state is empty OR search text doesn't match, we need to search
        const needsSearch = searchResults.length === 0 || previousSearchText !== searchQuery;
        
        if (needsSearch) {
          // Need to perform search - either no results or search text changed
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
                // Only show toast if this is a new search (not restoring from back button)
                // We detect this by checking if previous search text was different from current query
                if (previousSearchText !== searchQuery) {
                  addToast(`找到 ${results.length} 個結果`, 'success');
                }
                // Auto-select first result if only one
                if (results.length === 1) {
                  const item = results[0];
                  setSelectedItem(item);
                  selectedItemRef.current = item;
                  navigate(`/item/${item.id}`, { replace: false });
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
        // If we have results and search text matches, we're good - no need to do anything
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
    
    // Navigate to home - create a new history entry
    navigate('/', { replace: false });
  }, [navigate]);

  // Handle item selection
  const handleItemSelect = useCallback((item) => {
    // Clear all previous data immediately when switching items
    setMarketInfo(null);
    setMarketListings([]);
    setMarketHistory([]);
    setError(null);
    setRateLimitMessage(null);
    
    // Don't clear search text and results - keep them for browser back button
    // This allows users to go back to search results
    
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
    
    // Add to history
    addItemToHistory(item.id);
    
    // Navigate to item detail page - this will create a new history entry
    navigate(`/item/${item.id}`, { replace: false });
    
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
    // Always create a new history entry to ensure proper back button behavior
    if (!skipNavigation) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`, { replace: false });
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
          entries: listSize,
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

          const allHistory = (data.recentHistory || [])
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
          
          // Apply listSize limit to history as well
          const history = allHistory.slice(0, listSize);

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

  // Pre-fetch Simplified Chinese name when entering item info page
  useEffect(() => {
    if (!selectedItem) {
      // Cancel any pending fetch when leaving item page
      if (simplifiedNameAbortControllerRef.current) {
        cancelSimplifiedNameFetch();
        simplifiedNameAbortControllerRef.current = null;
      }
      return;
    }

    // Create abort controller for this fetch
    const abortController = new AbortController();
    simplifiedNameAbortControllerRef.current = abortController;

    // Pre-fetch Simplified Chinese name in the background
    getSimplifiedChineseName(selectedItem.id, abortController.signal)
      .then(simplifiedName => {
        // Check if request was cancelled
        if (abortController.signal.aborted) {
          return;
        }
        // Name is now cached, ready for Wiki button click
        if (process.env.NODE_ENV === 'development') {
          console.log(`Pre-fetched Simplified Chinese name for item ${selectedItem.id}:`, simplifiedName);
        }
      })
      .catch(error => {
        // Ignore abort errors
        if (error.name !== 'AbortError') {
          console.error('Failed to pre-fetch Simplified Chinese name:', error);
        }
      });

    // Cleanup: cancel fetch if component unmounts or selectedItem changes
    return () => {
      if (simplifiedNameAbortControllerRef.current === abortController) {
        cancelSimplifiedNameFetch();
        simplifiedNameAbortControllerRef.current = null;
      }
    };
  }, [selectedItem]);

  // Monitor history changes when on history page
  useEffect(() => {
    if (location.pathname !== '/history' || !isServerDataLoaded) {
      return;
    }

    const loadHistoryItems = async () => {
      const currentHistoryIds = getItemHistory();
      const currentIdsStr = JSON.stringify(currentHistoryIds);
      const lastIdsStr = JSON.stringify(lastHistoryIdsRef.current);

      // If history hasn't changed, skip
      if (currentIdsStr === lastIdsStr) {
        return;
      }

      lastHistoryIdsRef.current = currentHistoryIds;
      
      if (currentHistoryIds.length === 0) {
        setHistoryItems([]);
        setSearchResults([]);
        searchResultsRef.current = [];
        return;
      }

      try {
        const items = await Promise.all(
          currentHistoryIds.map(async (id) => {
            try {
              return await getItemById(id);
            } catch (error) {
              console.error(`Failed to load item ${id}:`, error);
              return null;
            }
          })
        );
        
        const validItems = items.filter(item => item !== null);
        setHistoryItems(validItems);
        setSearchResults(validItems);
        searchResultsRef.current = validItems;
      } catch (error) {
        console.error('Failed to load history items:', error);
        setHistoryItems([]);
        setSearchResults([]);
        searchResultsRef.current = [];
      }
    };

    // Load immediately
    loadHistoryItems();

    // Listen for storage changes (when history is updated in another tab or component)
    const handleStorageChange = (e) => {
      if (e.key === 'ffxiv_market_item_history') {
        loadHistoryItems();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check periodically (in case storage event doesn't fire for same-tab changes)
    const interval = setInterval(loadHistoryItems, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [location.pathname, isServerDataLoaded]);

  const serverOptions = selectedWorld
    ? [selectedWorld.section, ...selectedWorld.dcObj.worlds]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white">
      {/* Logo - Desktop: Top Left, Mobile: In search bar row (when no item selected) or hidden (when item selected, shown in second row) */}
      <button
        onClick={handleReturnHome}
        className={`fixed z-[60] flex items-center justify-center hover:opacity-80 transition-opacity duration-200 cursor-pointer ${
          selectedItem 
            ? 'mid:top-4 mid:left-4 hidden mid:flex w-10 h-10 mid:w-12 mid:h-12' // Desktop: top left when item selected, Mobile: hidden (shown in second row)
            : 'mid:top-4 mid:left-4 top-2.5 left-2 w-8 h-8 mid:w-12 mid:h-12' // Mobile: same row as search when no item, Desktop: top left
        }`}
        title="返回主頁"
      >
        <img 
          src="/logo.png" 
          alt="返回主頁" 
          className="w-full h-full object-contain pointer-events-none"
        />
      </button>

      {/* Fixed Search Bar - Top Row (Mobile: Full Width, Desktop: Flexible) */}
      <div className={`fixed top-2 left-0 right-0 mid:top-4 mid:right-auto z-50 ${
        selectedItem 
          ? 'px-1.5 mid:px-0 mid:left-20 py-1 mid:py-0' // 物品详情页面：搜索框离logo更远
          : 'pl-12 pr-1.5 mid:pl-20 mid:pr-0 py-1 mid:py-0' // 主页：搜索框从logo右侧开始（logo w-12=48px + left-4=16px = 64px，搜索框从80px开始留出16px间隙）
      } mid:w-auto`}>
        <div className={`relative flex items-stretch mid:items-center gap-1.5 mid:gap-3 ${
          selectedItem ? 'flex-col mid:flex-row' : 'flex-row'
        }`}>
          {/* Search Bar - Flexible width */}
          <div className={`h-9 mid:h-12 min-w-0 ${
            selectedItem 
              ? 'flex-1 mid:flex-initial mid:w-80 detail:w-96' 
              : 'flex-1'
          }`}>
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

          {/* History Button - Between search bar and server selector */}
          <HistoryButton onItemSelect={handleItemSelect} />

          {/* 主服务器按钮 - 显示服务器主类别（如：陸行鳥） */}
          {/* Desktop: 在搜索栏右侧, Mobile: 在搜索栏右侧（主页/搜索页面）或第二排（物品详情页面） */}
          {selectedWorld && (
            <div className={`items-center gap-1.5 mid:gap-2 px-2 mid:px-3 detail:px-4 h-9 mid:h-12 bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border border-purple-500/30 rounded-lg backdrop-blur-sm whitespace-nowrap flex-shrink-0 ${
              selectedItem ? 'hidden mid:flex' : 'flex'
            }`}>
              <div className="w-1.5 h-1.5 mid:w-2 mid:h-2 rounded-full bg-ffxiv-gold animate-pulse"></div>
              <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold truncate">
                {selectedWorld.section}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Second Row - Data Center & External Links (Mobile: Below search, Desktop: Top Right) */}
      {/* 在890px以下，搜索栏换排后：搜索栏h-9(36px) + py-1(上下8px) + top-2(8px) = 52px，但搜索栏容器是flex-col，实际高度可能更高 */}
      {/* 物品详情页面：搜索栏单行，主服务器按钮隐藏，高度约52px；主页：搜索栏+主服务器按钮两行，高度约94px */}
      {/* 增加与搜索栏的间隙：物品详情页面+8px，主页+8px */}
      <div className={`fixed left-2 mid:left-auto mid:right-4 right-2 z-50 flex flex-wrap items-center gap-1.5 mid:gap-2 ${
        selectedItem 
          ? 'top-[68px] mid:top-4' // 物品详情页面：搜索栏单行，留更多空间（60px + 8px间隙）
          : 'top-[102px] mid:top-4' // 主页：搜索栏+主服务器按钮两行（94px + 8px间隙）
      }`}>
        {/* Logo Button - Mobile only in second row when item is selected */}
        {selectedItem && (
          <>
            <button
              onClick={handleReturnHome}
              className="mid:hidden flex items-center justify-center w-8 h-8 hover:opacity-80 transition-opacity duration-200 cursor-pointer"
              title="返回主頁"
            >
              <img 
                src="/logo.png" 
                alt="返回主頁" 
                className="w-full h-full object-contain"
              />
            </button>
            <div className="mid:hidden w-px h-4 bg-slate-600/50"></div>
          </>
        )}
        
        {/* 主服务器按钮 - Mobile only in second row (物品详情页面) */}
        {selectedWorld && selectedItem && (
          <div className="mid:hidden flex items-center gap-1.5 px-2 py-1.5 bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border border-purple-500/30 rounded-lg backdrop-blur-sm whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-ffxiv-gold animate-pulse"></div>
            <span className="text-xs font-semibold text-ffxiv-gold truncate max-w-[120px]">
              {selectedWorld.section}
            </span>
          </div>
        )}
        
        {/* External Links - Show when item is selected */}
        {selectedItem && (
          <>
            {selectedWorld && <div className="mid:hidden w-px h-4 bg-slate-600/50"></div>}
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
              className="px-2 mid:px-3 py-1 mid:py-1.5 text-xs font-medium bg-purple-800/60 hover:bg-purple-700/70 text-gray-200 hover:text-white rounded-md border border-purple-500/40 hover:border-purple-400/60 transition-all duration-200 flex items-center gap-1 mid:gap-1.5 shadow-sm"
              title="複製物品名稱"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-3 w-3 mid:h-3.5 mid:w-3.5" 
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
              <span className="hidden mid:inline">複製</span>
            </button>
            <div className="w-px h-4 bg-slate-600/50 mx-0.5 mid:mx-1"></div>
            <button
              onClick={async () => {
                try {
                  const simplifiedName = await getSimplifiedChineseName(selectedItem.id);
                  if (simplifiedName) {
                    const prefix = selectedItem.id > 1000 || selectedItem.id < 20 ? '物品:' : '';
                    const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(simplifiedName)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  } else {
                    // Fallback to Traditional Chinese name if API fails
                    const prefix = selectedItem.id > 1000 || selectedItem.id < 20 ? '物品:' : '';
                    const url = `https://ff14.huijiwiki.com/wiki/${prefix}${encodeURIComponent(selectedItem.name)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                } catch (error) {
                  console.error('Failed to open Wiki link:', error);
                  addToast('無法打開Wiki連結', 'error');
                }
              }}
              className="px-2 mid:px-3 py-1 mid:py-1.5 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors"
            >
              Wiki
            </button>
            <a
              href={`https://www.garlandtools.org/db/#item/${selectedItem.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 mid:px-3 py-1 mid:py-1.5 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors"
            >
              Garland
            </a>
            <a
              href={`https://universalis.app/market/${selectedItem.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 mid:px-3 py-1 mid:py-1.5 text-xs font-medium text-ffxiv-accent hover:text-ffxiv-gold hover:bg-purple-800/40 rounded border border-purple-500/30 hover:border-ffxiv-gold transition-colors"
            >
              Market
            </a>
          </>
        )}
      </div>


      {/* Toast Notifications - Top Right Corner - Responsive */}
      <div className={`fixed right-2 mid:right-4 left-2 mid:left-auto z-50 space-y-2 max-w-sm mid:max-w-none ${
        selectedItem 
          ? 'top-[68px] mid:top-4' // 物品详情页面：从第二排下方开始（Mobile），或与搜索栏同一行（Desktop）
          : 'top-[102px] mid:top-4' // 主页：从第二排下方开始（Mobile），或与搜索栏同一行（Desktop）
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

      {/* Loading Indicator - Top Center - Responsive */}
      {isLoadingDB && (
        <div className="fixed top-14 mid:top-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 backdrop-blur-sm px-3 mid:px-4 py-2 rounded-lg border border-ffxiv-gold/30 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ffxiv-gold"></div>
            <span className="text-xs mid:text-sm text-gray-300">正在載入伺服器...</span>
          </div>
        </div>
      )}

      {/* Main Content - Responsive Padding */}
      {/* 在890px以下，物品详情页面需要更多顶部间距，避免与右上角按钮重叠 */}
      <div className={`pb-8 ${
        selectedItem 
          ? 'pt-[120px] mid:pt-24' // 物品详情页面：按钮高度约68px + 按钮本身高度 + 间隙
          : 'pt-16 mid:pt-24' // 主页：正常间距
      }`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          {/* History Page Title */}
          {location.pathname === '/history' && searchResults.length > 0 && !selectedItem && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
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
                      clearItemHistory();
                      setSearchResults([]);
                      searchResultsRef.current = [];
                      setHistoryItems([]);
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
              <p className="text-sm sm:text-base text-gray-400">共 {searchResults.length} 個物品</p>
            </div>
          )}

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
            <div className="space-y-4 sm:space-y-6">
              {/* Item Info & Controls - Compact - Responsive */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 p-3 sm:p-4">
                {/* First Row: Item Image, Name & Server Selector - Responsive */}
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
                      <h2 className="text-lg mid:text-xl font-bold text-ffxiv-gold break-words line-clamp-2" style={{ minHeight: '2.5em', maxWidth: '100%' }}>
                        {selectedItem.name}
                      </h2>
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
                
                {/* Second Row: Controls (Quantity & HQ) - Responsive */}
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
                </div>
              </div>

              {/* Market Listings & History - Side by Side - Responsive */}
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

          {/* History Page Empty State */}
          {location.pathname === '/history' && searchResults.length === 0 && !isSearching && (
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
                      clearItemHistory();
                      setSearchResults([]);
                      searchResultsRef.current = [];
                      setHistoryItems([]);
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
              <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-8 sm:p-12 text-center">
                <div className="text-6xl mb-4">📜</div>
                <h2 className="text-2xl sm:text-3xl font-bold text-ffxiv-gold mb-2">暫無歷史記錄</h2>
                <p className="text-sm sm:text-base text-gray-400">查看物品詳情後，會自動保存到歷史記錄</p>
              </div>
            </div>
          )}

          {/* Empty State - Show welcome content before search - Responsive */}
          {!selectedItem && searchResults.length === 0 && !isSearching && location.pathname !== '/history' && (
            <div className="space-y-4 sm:space-y-8">
              {/* Welcome Section */}
              <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-8">
                <div className="text-center mb-4 sm:mb-6">
                  <div className="mb-3 sm:mb-4 flex justify-center items-center">
                    <img 
                      src={currentImage} 
                      alt="Random icon" 
                      onClick={handleImageSwap}
                      draggable={false}
                      className="w-16 h-16 sm:w-24 sm:h-24 object-contain opacity-50 cursor-pointer hover:opacity-70 transition-opacity"
                    />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold mb-2">貝爾的FFXIV市場小屋</h2>
                  <p className="text-sm sm:text-base text-gray-400">在左上角搜索物品名稱，比較不同服務器的價格</p>
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
