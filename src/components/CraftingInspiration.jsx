// Crafting Job Price Checker (製造職找價) - Find profitable items to craft
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import SearchBar from './SearchBar';
import HistoryButton from './HistoryButton';
import TopBar from './TopBar';
import TaxRatesModal from './TaxRatesModal';
import SearchResultsTable from './SearchResultsTable.jsx';
import ServerSelector from './ServerSelector';
import RunningLoader from './RunningLoader';
import { loadRecipeDatabase, loadRecipesByJobAndLevel } from '../services/recipeDatabase';
import { getMarketableItems, getMarketableItemsByIds } from '../services/universalis';
import { getItemById, getSimplifiedChineseName } from '../services/itemDatabase';
import { getInternalUrl } from '../utils/internalUrl.js';
import axios from 'axios';
import { getTwJobAbbr, getIlvlsByIds } from '../services/supabaseData';
import { APP_VERSION } from '../constants/version';
import { generateItemUrl } from '../utils/urlSlug';

export default function CraftingJobPriceChecker({ 
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
  onSearch,
  searchText,
  setSearchText,
  isSearching,
  isServerDataLoaded,
  onItemSelect,
  onTaxRatesClick,
  isTaxRatesModalOpen,
  setIsTaxRatesModalOpen,
  taxRates,
  isLoadingTaxRates
}) {
  const navigate = useNavigate();
  const [ilvlMin, setIlvlMin] = useState(1);
  const [ilvlMax, setIlvlMax] = useState(11);
  const [ilvlMinInput, setIlvlMinInput] = useState('1');
  const [ilvlMaxInput, setIlvlMaxInput] = useState('11');
  const [selectedJobs, setSelectedJobs] = useState([]);
  const ilvlValidationTimeoutRef = useRef(null);
  const [searchResults, setSearchResults] = useState([]);
  const [tradeableResults, setTradeableResults] = useState([]);
  const [untradeableResults, setUntradeableResults] = useState([]);
  const [showUntradeable, setShowUntradeable] = useState(false);
  const [isRecipeSearching, setIsRecipeSearching] = useState(false);
  const [itemVelocities, setItemVelocities] = useState({});
  const [itemAveragePrices, setItemAveragePrices] = useState({});
  const [itemMinListings, setItemMinListings] = useState({});
  const [itemRecentPurchases, setItemRecentPurchases] = useState({});
  const [itemTradability, setItemTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [marketableItems, setMarketableItems] = useState(null);
  const [tooManyItemsWarning, setTooManyItemsWarning] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const MAX_ITEMS_LIMIT = 500; // Maximum number of items to process
  
  // Loading indicator state (same as AdvancedSearch page)
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const loadingIndicatorStartTimeRef = useRef(null);
  
  // Ref for scrolling to results table
  const resultsTableRef = useRef(null);
  const previousSearchResultsLengthRef = useRef(0);
  const runningLoaderRef = useRef(null);
  const previousServerOptionRef = useRef(null);
  
  // Cache for ilvls data (per-item basis, not full table)
  const ilvlsCacheRef = useRef({});
  
  // Cache for job abbreviations
  const twJobAbbrDataRef = useRef(null);
  
  // Load job abbreviations on mount
  useEffect(() => {
    getTwJobAbbr().then(data => {
      twJobAbbrDataRef.current = data;
    });
  }, []);

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

  // Load marketable items on mount
  useEffect(() => {
    getMarketableItems().then(items => {
      setMarketableItems(items);
    });
  }, []);

  // Calculate max range based on number of jobs selected
  const getMaxRange = useCallback((jobCount) => {
    if (jobCount === 0) return 10;
    if (jobCount === 1) return 50;
    if (jobCount === 2) return 30;
    if (jobCount === 3) return 20;
    if (jobCount === 4) return 10;
    return 10;
  }, []);

  // Check if current range is valid
  const isRangeValid = useMemo(() => {
    const maxRange = getMaxRange(selectedJobs.length);
    const range = ilvlMax - ilvlMin;
    return range >= 0 && range <= maxRange + 1 && ilvlMin >= 1 && ilvlMax <= 999;
  }, [ilvlMin, ilvlMax, selectedJobs.length, getMaxRange]);

  // Calculate suggested min/max values
  const suggestedRange = useMemo(() => {
    const maxRange = getMaxRange(selectedJobs.length);
    const currentRange = ilvlMax - ilvlMin;
    
    if (currentRange <= maxRange + 1) {
      // Range is valid, suggest keeping current values
      return { suggestedMin: ilvlMin, suggestedMax: ilvlMax };
    }
    
    // Range is too large, suggest adjusted values
    // First try to lower min level
    const adjustedMin = ilvlMax - maxRange - 1;
    if (adjustedMin >= 1) {
      return { suggestedMin: adjustedMin, suggestedMax: ilvlMax };
    } else {
      // If min can't be lowered enough, adjust max level
      return { suggestedMin: 1, suggestedMax: 1 + maxRange + 1 };
    }
  }, [ilvlMin, ilvlMax, selectedJobs.length, getMaxRange]);

  // Handle ilvl input change (allow free typing)
  const handleIlvlInputChange = useCallback((field, value) => {
    // Allow empty string and numbers
    if (value === '' || /^\d*$/.test(value)) {
      if (field === 'min') {
        setIlvlMinInput(value);
      } else {
        setIlvlMaxInput(value);
      }

      // Clear existing timeout
      if (ilvlValidationTimeoutRef.current) {
        clearTimeout(ilvlValidationTimeoutRef.current);
      }

      // Immediate validation for empty or invalid input
      if (value === '') {
        return; // Allow empty input while typing
      }

      const numValue = parseInt(value, 10);
      
      // Immediate validation and adjustment for valid numbers
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 999) {
        let newMin = field === 'min' ? numValue : ilvlMin;
        let newMax = field === 'max' ? numValue : ilvlMax;

        // Ensure maximum is always higher than minimum
        if (field === 'min') {
          // If minimum is adjusted and maximum is still lower or equal, adjust maximum immediately
          if (newMin >= newMax) {
            newMax = Math.min(newMin + 10, 999);
            setIlvlMaxInput(newMax.toString());
          }
        } else {
          // Only adjust minimum if maximum is changed and becomes lower than minimum
          if (newMax < newMin) {
            newMin = Math.max(newMax - 10, 1);
            setIlvlMinInput(newMin.toString());
          }
        }

        // Debounce state update with shorter delay (300ms) for better responsiveness
        ilvlValidationTimeoutRef.current = setTimeout(() => {
          setIlvlMin(newMin);
          setIlvlMax(newMax);
        }, 300);
      } else {
        // For invalid values, reset after a short delay
        ilvlValidationTimeoutRef.current = setTimeout(() => {
          if (field === 'min') {
            setIlvlMinInput(ilvlMin.toString());
          } else {
            setIlvlMaxInput(ilvlMax.toString());
          }
        }, 500);
      }
    }
  }, [ilvlMin, ilvlMax]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (ilvlValidationTimeoutRef.current) {
        clearTimeout(ilvlValidationTimeoutRef.current);
      }
    };
  }, []);

  // Handle job selection
  const handleJobToggle = useCallback((jobId) => {
    const jobIdNum = parseInt(jobId, 10);
    
    setSelectedJobs(prev => {
      if (prev.includes(jobIdNum)) {
        // Deselect job - don't change user input
        return prev.filter(j => j !== jobIdNum);
      } else {
        // Select job (max 4)
        if (prev.length >= 4) {
          // Show toast after state update completes to avoid render warnings
          Promise.resolve().then(() => {
            addToast('最多只能選擇4個職業', 'warning');
          });
          return prev; // Don't add the job
        }
        return [...prev, jobIdNum];
      }
    });
  }, [addToast]);

  // Helper function to fetch market data for items with progressive batching
  const fetchMarketData = useCallback(async (tradeableItemIds, limitItems = false) => {
    if (!selectedWorld || !selectedServerOption) {
      addToast('請選擇伺服器', 'warning');
      return null;
    }

    // Limit items if requested
    const itemsToProcess = limitItems 
      ? tradeableItemIds.slice(0, MAX_ITEMS_LIMIT)
      : tradeableItemIds;

    if (limitItems && tradeableItemIds.length > MAX_ITEMS_LIMIT) {
      addToast(`已限制為前 ${itemsToProcess.length} 個物品，正在獲取市場數據...`, 'warning');
    }

    setIsLoadingVelocities(true);
    
    const isDCQuery = selectedServerOption === selectedWorld.section;
    const queryTarget = isDCQuery 
      ? selectedWorld.section
      : selectedServerOption;
    
    // Progressive batch processing: 20, then 50, then 100 per batch
    const processBatch = async (batchNumber, startIndex) => {
      // Determine batch size: first batch = 20, second batch = 50, rest = 100
      let batchSize;
      if (batchNumber === 0) {
        batchSize = 20; // First batch: 20 items for fast initial display
      } else if (batchNumber === 1) {
        batchSize = 50; // Second batch: 50 items
      } else {
        batchSize = 100; // Remaining batches: 100 items each
      }
      
      const batch = itemsToProcess.slice(startIndex, startIndex + batchSize);
      if (batch.length === 0) {
        return;
      }
      
      const itemIdsString = batch.join(',');
      
      try {
        const response = await axios.get(
          `https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`
        );
        
        const data = response.data;
        
        // Process batch results
        const batchVelocities = {};
        const batchAveragePrices = {};
        const batchMinListings = {};
        const batchRecentPurchases = {};
        const batchTradability = {};
        
        if (data && data.results) {
          data.results.forEach(item => {
            const itemId = item.itemId;
            
            const getValue = (nqData, hqData, field) => {
              const nqWorld = nqData?.world?.[field];
              const hqWorld = hqData?.world?.[field];
              const nqDc = nqData?.dc?.[field];
              const hqDc = hqData?.dc?.[field];
              
              const nqValue = nqWorld !== undefined ? nqWorld : nqDc;
              const hqValue = hqWorld !== undefined ? hqWorld : hqDc;
              
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
            
            const minListing = getValue(
              item.nq?.minListing,
              item.hq?.minListing,
              'price'
            );
            
            const recentPurchasePrice = getValue(
              item.nq?.recentPurchase,
              item.hq?.recentPurchase,
              'price'
            );
            
            let recentPurchase = null;
            if (recentPurchasePrice !== null && recentPurchasePrice !== undefined) {
              if (!isDCQuery) {
                const nqWorldPrice = item.nq?.recentPurchase?.world?.price;
                const hqWorldPrice = item.hq?.recentPurchase?.world?.price;
                const nqDcPrice = item.nq?.recentPurchase?.dc?.price;
                const hqDcPrice = item.hq?.recentPurchase?.dc?.price;
                
                const nqPrice = nqWorldPrice !== undefined ? nqWorldPrice : nqDcPrice;
                const hqPrice = hqWorldPrice !== undefined ? hqWorldPrice : hqDcPrice;
                
                let selectedData = null;
                if (nqPrice !== undefined && hqPrice !== undefined) {
                  selectedData = hqPrice <= nqPrice 
                    ? (item.hq?.recentPurchase?.world || item.hq?.recentPurchase?.dc)
                    : (item.nq?.recentPurchase?.world || item.nq?.recentPurchase?.dc);
                } else if (hqPrice !== undefined) {
                  selectedData = item.hq?.recentPurchase?.world || item.hq?.recentPurchase?.dc;
                } else if (nqPrice !== undefined) {
                  selectedData = item.nq?.recentPurchase?.world || item.nq?.recentPurchase?.dc;
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
      } catch (error) {
        console.error('Error fetching market data:', error);
        // Mark batch items as non-tradable on error
        const batchTradability = {};
        batch.forEach(itemId => {
          batchTradability[itemId] = false;
        });
        // Update state even on error to mark items as non-tradable
        flushSync(() => {
          setItemTradability(prev => ({ ...prev, ...batchTradability }));
        });
      }
    };
    
    // Process batches recursively, scheduling each in separate event loop tick
    // This ensures React processes each batch's state update before the next one
    const processBatchesRecursively = async (batchNumber, startIndex) => {
      if (startIndex >= itemsToProcess.length) {
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
      
      const nextIndex = startIndex + batchSize;
      
      // Schedule next batch in next event loop tick to break React batching
      if (nextIndex < itemsToProcess.length) {
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
    
    // Return final state (though it's already updated progressively)
    return {
      velocities: {},
      averagePrices: {},
      minListings: {},
      recentPurchases: {},
      tradability: {}
    };
  }, [selectedWorld, selectedServerOption, addToast]);

  // Perform search
  const handleSearch = useCallback(async () => {
    if (isRecipeSearching) return;

    if (!isRangeValid) {
      addToast(`範圍過大！最多只能搜索 ${getMaxRange(selectedJobs.length)} 個等級範圍`, 'error');
      return;
    }

    setIsRecipeSearching(true);
    setSearchResults([]);
    setTradeableResults([]);
    setUntradeableResults([]);
    setShowUntradeable(false);
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});
    setCurrentPage(1); // Reset to first page on new search
    
    // Scroll to RunningLoader immediately when search starts
    setTimeout(() => {
      runningLoaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      // Load recipes filtered by job and level using targeted query (optimized)
      const { recipes: filteredRecipes } = await loadRecipesByJobAndLevel(
        selectedJobs.length > 0 ? selectedJobs : [],
        ilvlMin,
        ilvlMax
      );

      // Get unique item IDs from recipes
      const itemIds = [...new Set(filteredRecipes.map(recipe => recipe.result))];
      
      if (itemIds.length === 0) {
        addToast('未找到符合條件的配方', 'warning');
        setIsRecipeSearching(false);
        return;
      }

      addToast(`找到 ${itemIds.length} 個物品，正在過濾可交易物品...`, 'info');

      // Filter out non-tradeable items using targeted marketable API (optimized)
      const marketableSet = await getMarketableItemsByIds(itemIds);
      let tradeableItemIds = itemIds.filter(id => marketableSet.has(id));
      const untradeableItemIds = itemIds.filter(id => !marketableSet.has(id));

      if (tradeableItemIds.length === 0 && untradeableItemIds.length === 0) {
        addToast('沒有找到物品', 'warning');
        setIsRecipeSearching(false);
        return;
      }
      
      if (tradeableItemIds.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        // Still show untradeable items
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

      // Check if too many items
      if (tradeableItemIds.length > MAX_ITEMS_LIMIT) {
        setTooManyItemsWarning({
          total: tradeableItemIds.length,
          limit: MAX_ITEMS_LIMIT
        });
        setIsRecipeSearching(false);
        return;
      }

      setTooManyItemsWarning(null);
      if (tradeableItemIds.length > 0) {
        addToast(`找到 ${tradeableItemIds.length} 個可交易物品${untradeableItemIds.length > 0 ? `、${untradeableItemIds.length} 個不可交易物品` : ''}，正在獲取市場數據...`, 'info');
      }

      // Fetch item details for both tradeable and untradeable items
      const { getTwItemsByIds } = await import('../services/supabaseData');
      const allItemIds = tradeableItemIds.length > 0 ? tradeableItemIds : untradeableItemIds;
      const itemsData = await getTwItemsByIds(allItemIds);
      
      const tradeableItems = tradeableItemIds.map(id => {
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
      
      const untradeableItems = untradeableItemIds.map(id => {
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

      if (tradeableItems.length === 0 && untradeableItems.length === 0) {
        addToast('無法獲取物品信息', 'error');
        setIsRecipeSearching(false);
        return;
      }

      setTradeableResults(tradeableItems);
      setUntradeableResults(untradeableItems);
      setShowUntradeable(false); // Default to showing tradeable items
      
      // Set searchResults based on what should be displayed
      const itemsToDisplay = tradeableItems.length > 0 ? tradeableItems : untradeableItems;
      setSearchResults(itemsToDisplay);

      // Fetch market data (updates state progressively) - only for tradeable items
      if (tradeableItemIds.length > 0) {
        const marketData = await fetchMarketData(tradeableItemIds, false);
        
        if (!marketData) {
          setIsRecipeSearching(false);
          return;
        }
      }

      // State is already updated progressively by fetchMarketData
      addToast(`搜索完成！找到 ${tradeableItems.length} 個可交易物品${untradeableItems.length > 0 ? `、${untradeableItems.length} 個不可交易物品` : ''}`, 'success');
    } catch (error) {
      console.error('Search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
    } finally {
      setIsRecipeSearching(false);
    }
  }, [ilvlMin, ilvlMax, selectedJobs, isRecipeSearching, isRangeValid, getMaxRange, addToast, fetchMarketData]);

  // Update searchResults when showUntradeable changes
  useEffect(() => {
    const itemsToDisplay = showUntradeable ? untradeableResults : tradeableResults;
    // Only update if we have results to avoid clearing during search
    if (tradeableResults.length > 0 || untradeableResults.length > 0) {
      setSearchResults(itemsToDisplay);
    }
  }, [showUntradeable, tradeableResults, untradeableResults]);

  // Job icons mapping with XIVAPI URLs
  const jobIconUrls = {
    8: 'carpenter',      // 木工師 (Carpenter)
    9: 'blacksmith',     // 鍛造師 (Blacksmith)
    10: 'armorer',       // 甲冑師 (Armorer)
    11: 'goldsmith',     // 金工師 (Goldsmith)
    12: 'leatherworker', // 皮革師 (Leatherworker)
    13: 'weaver',        // 裁縫師 (Weaver)
    14: 'alchemist',     // 鍊金術師 (Alchemist)
    15: 'culinarian',    // 烹調師 (Culinarian)
  };

  // Get crafting jobs (IDs 8-15) from tw-job-abbr.json
  const twJobAbbrData = twJobAbbrDataRef.current || {};
  const allJobs = Object.entries(twJobAbbrData)
    .filter(([id]) => {
      const jobId = parseInt(id, 10);
      return jobId >= 8 && jobId <= 15;
    })
    .map(([id, data]) => {
      const jobId = parseInt(id, 10);
      const iconName = jobIconUrls[jobId];
      return {
        id: jobId,
        name: data.tw,
        iconUrl: iconName ? `https://xivapi.com/cj/companion/${iconName}.png` : null
      };
    });

  const maxRange = getMaxRange(selectedJobs.length);

  // Get disabled reason and button text
  const getButtonState = useMemo(() => {
    if (isRecipeSearching) {
      return { disabled: true, text: '搜索中...', tooltip: null };
    }
    if (tooManyItemsWarning !== null) {
      return { 
        disabled: true, 
        text: `搜索（找到 ${tooManyItemsWarning.total} 個物品，超過上限 ${tooManyItemsWarning.limit}）`, 
        tooltip: `找到 ${tooManyItemsWarning.total} 個可交易物品，超過建議上限 ${tooManyItemsWarning.limit} 個。請縮小等級範圍或選擇更少的職業。`
      };
    }
    if (!isRangeValid) {
      const currentRange = ilvlMax - ilvlMin;
      return { 
        disabled: true, 
        text: `搜索（範圍過大：${currentRange} 個等級，最多 ${maxRange}）`, 
        tooltip: `當前範圍為 ${currentRange} 個等級，超過最大允許範圍 ${maxRange} 個等級。建議調整為 ${suggestedRange.suggestedMin}-${suggestedRange.suggestedMax}。`
      };
    }
    if (selectedJobs.length === 0) {
      return { 
        disabled: true, 
        text: '搜索（請先選擇至少一個職業）', 
        tooltip: '請至少選擇一個製造職業才能進行搜索。'
      };
    }
    return { disabled: false, text: '搜索', tooltip: null };
  }, [isRecipeSearching, tooManyItemsWarning, isRangeValid, ilvlMin, ilvlMax, maxRange, suggestedRange, selectedJobs.length]);

  // Auto-refetch prices when server changes (if there are already search results)
  useEffect(() => {
    // Skip if searching (search will handle price fetching)
    if (isRecipeSearching) {
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

    console.log(`[CraftingInspiration] Server changed from ${previousServerKey} to ${currentServerKey}, auto-refetching prices for ${tradeableItemIds.length} items`);
    
    // Fetch prices for existing search results
    fetchMarketData(tradeableItemIds, false);
  }, [selectedServerOption, selectedWorld, searchResults.length, marketableItems, fetchMarketData, isRecipeSearching]);

  // Scroll to results table when search completes and results are available
  useEffect(() => {
    // Only scroll if we transition from 0 results to having results (new search completed)
    if (previousSearchResultsLengthRef.current === 0 && searchResults.length > 0 && resultsTableRef.current) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        resultsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    previousSearchResultsLengthRef.current = searchResults.length;
  }, [searchResults.length]);

  // Manage loading indicator (same logic as AdvancedSearch)
  useEffect(() => {
    // Show loading indicator when searching or loading velocities, for >=50 items
    const shouldShow = (isRecipeSearching || isLoadingVelocities) && searchResults.length >= 50;
    
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
  }, [isRecipeSearching, isLoadingVelocities, searchResults.length]);

  // Pagination calculations
  const totalPages = Math.ceil(searchResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
    // Scroll to top of results when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
        activePage="crafting-inspiration"
        onTaxRatesClick={onTaxRatesClick}
        onCraftingInspirationClick={() => {
          setSearchText('');
          navigate('/crafting-inspiration');
        }}
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
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
              製造職找價
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              用來根據製作職業查找物價肥美的物品，掌控市場雷電。
            </p>
          </div>

        {/* Search Controls */}
        <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6 mb-6">
          {/* Job Selector */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
              職業選擇 (最多4個)
            </label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/30 rounded-lg border border-purple-500/20">
              {allJobs.map(job => {
                const isSelected = selectedJobs.includes(job.id);
                return (
                  <button
                    key={job.id}
                    onClick={() => handleJobToggle(job.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                        : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                    }`}
                  >
                    {job.iconUrl ? (
                      <img 
                        src={job.iconUrl} 
                        alt={job.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          // Fallback to emoji if image fails to load
                          e.target.style.display = 'none';
                          if (!e.target.nextSibling) {
                            const emoji = document.createTextNode('⚙️');
                            e.target.parentNode.insertBefore(emoji, e.target.nextSibling);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-lg">⚙️</span>
                    )}
                    <span>{job.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              已選擇: {selectedJobs.length}/4
              {selectedJobs.length === 0 && (
                <span className="ml-2 text-yellow-400">未選擇職業時，範圍限制為10個等級</span>
              )}
            </div>
          </div>

          {/* ILVL Range */}
          <div className="mb-6">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <label className="text-sm font-semibold text-ffxiv-gold">
                物品等級範圍
              </label>
              {/* Tags for current range and job count */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 bg-slate-700/60 border border-purple-500/40 rounded-md text-xs text-gray-300">
                  當前範圍: <span className="text-ffxiv-gold font-semibold">{ilvlMax - ilvlMin + 1}</span> 個等級
                </span>
                {selectedJobs.length > 0 && (
                  <span className="px-2 py-1 bg-slate-700/60 border border-purple-500/40 rounded-md text-xs text-gray-300">
                    已選擇 <span className="text-ffxiv-gold font-semibold">{selectedJobs.length}</span> 個職業
                  </span>
                )}
                {selectedJobs.length > 0 && (
                  <span className="px-2 py-1 bg-yellow-900/40 border border-yellow-500/50 rounded-md text-xs text-yellow-300">
                    最大範圍: <span className="font-bold">{maxRange}</span> 個等級
                  </span>
                )}
                {selectedJobs.length === 0 && (
                  <span className="px-2 py-1 bg-amber-900/40 border border-amber-500/50 rounded-md text-xs text-amber-300">
                    ⚠️ 請先選擇職業
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">最小等級</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ilvlMinInput}
                  onChange={(e) => handleIlvlInputChange('min', e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-slate-900/50 border-2 border-purple-500/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-ffxiv-gold focus:ring-2 focus:ring-ffxiv-gold/30 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.1)] transition-all"
                />
              </div>
              <div className="pt-6 text-gray-400">-</div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">最大等級</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ilvlMaxInput}
                  onChange={(e) => handleIlvlInputChange('max', e.target.value)}
                  placeholder="999"
                  className="w-full px-3 py-2 bg-slate-900/50 border-2 border-purple-500/40 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-ffxiv-gold focus:ring-2 focus:ring-ffxiv-gold/30 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.1)] transition-all"
                />
              </div>
            </div>
            {/* Range Rule Info Banner - Compact */}
            <div className="mt-3 mb-3 p-2.5 bg-gradient-to-r from-yellow-900/40 via-amber-900/30 to-yellow-900/40 border border-yellow-500/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm">💡</span>
                <span className="text-xs text-yellow-300 font-semibold">職業越多等級范圍限制越多：</span>
                <span className="text-xs text-yellow-200/90">
                  1職<span className="text-yellow-300 font-bold">50</span> | 
                  2職<span className="text-yellow-300 font-bold">30</span> | 
                  3職<span className="text-yellow-300 font-bold">20</span> | 
                  4職<span className="text-yellow-300 font-bold">10</span>
                </span>
              </div>
            </div>
            {!isRangeValid && (
              <div className="mt-3 p-3 bg-red-900/40 border-2 border-red-500/60 rounded-lg animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-red-300 mb-1">
                      範圍過大！
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-red-200">
                        建議調整為: <span className="font-bold text-yellow-300">{suggestedRange.suggestedMin}-{suggestedRange.suggestedMax}</span>
                      </span>
                      <button
                        onClick={() => {
                          setIlvlMinInput(suggestedRange.suggestedMin.toString());
                          setIlvlMaxInput(suggestedRange.suggestedMax.toString());
                          setIlvlMin(suggestedRange.suggestedMin);
                          setIlvlMax(suggestedRange.suggestedMax);
                          addToast(`已自動調整為 ${suggestedRange.suggestedMin}-${suggestedRange.suggestedMax}`, 'success');
                        }}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded-md text-xs font-semibold transition-colors shadow-md hover:shadow-lg"
                      >
                        套用建議
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              />
            </div>
          )}

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
                        setTooManyItemsWarning(null);
                        setIsRecipeSearching(true);
                        setSearchResults([]);
                        setItemVelocities({});
                        setItemAveragePrices({});
                        setItemMinListings({});
                        setItemRecentPurchases({});
                        setItemTradability({});

                        try {
                          // Load recipes filtered by job and level using targeted query (optimized)
                          const { recipes: filteredRecipes } = await loadRecipesByJobAndLevel(
                            selectedJobs.length > 0 ? selectedJobs : [],
                            ilvlMin,
                            ilvlMax
                          );

                          const itemIds = [...new Set(filteredRecipes.map(recipe => recipe.result))];
                          // Filter out non-tradeable items using targeted marketable API (optimized)
                          const marketableSet = await getMarketableItemsByIds(itemIds);
                          let tradeableItemIds = itemIds.filter(id => marketableSet.has(id));
                          
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
                          
                          // Limit to MAX_ITEMS_LIMIT
                          tradeableItemIds = tradeableItemIds.slice(0, MAX_ITEMS_LIMIT);
                          
                          // Fetch item details for display
                          // Use batch query instead of individual queries (optimized)
                          const { getTwItemsByIds } = await import('../services/supabaseData');
                          const itemsData = await getTwItemsByIds(tradeableItemIds);
                          const items = tradeableItemIds.map(id => {
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
                          setSearchResults(items);
                          
                          // Fetch market data with limit flag (updates state progressively)
                          const marketData = await fetchMarketData(tradeableItemIds, true);
                          
                          if (!marketData) {
                            setIsRecipeSearching(false);
                            return;
                          }

                          // State is already updated progressively by fetchMarketData
                          addToast(`搜索完成！找到 ${items.length} 個可交易物品（已限制）`, 'success');
                        } catch (error) {
                          console.error('Search error:', error);
                          addToast('搜索失敗，請稍後再試', 'error');
                          setIsLoadingVelocities(false);
                        } finally {
                          setIsRecipeSearching(false);
                        }
                      }}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                      繼續搜索（限制為前 {MAX_ITEMS_LIMIT} 個）
                    </button>
                    <button
                      onClick={() => {
                        setTooManyItemsWarning(null);
                        addToast('已取消搜索', 'info');
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors"
                    >
                      取消
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    💡 提示：嘗試縮小等級範圍或選擇更少的職業來減少結果數量
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={getButtonState.disabled}
            title={getButtonState.tooltip || undefined}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              getButtonState.disabled
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
            }`}
          >
            {getButtonState.text}
          </button>
        </div>

        {/* Running Loader - Show when searching but no results yet */}
        {isRecipeSearching && searchResults.length === 0 && (
          <div ref={runningLoaderRef} className="mt-8 flex justify-center items-center min-h-[300px]">
            <RunningLoader />
          </div>
        )}

        {/* Results */}
        {searchResults.length > 0 && (
          <div ref={resultsTableRef}>
          <SearchResultsTable
            items={searchResults}
            selectedWorld={selectedWorld}
            selectedServerOption={selectedServerOption}
            onWorldChange={onWorldChange}
            onServerOptionChange={onServerOptionChange}
            datacenters={datacenters}
            worlds={worlds}
            serverOptions={serverOptions}
            isServerSelectorDisabled={isLoadingVelocities || isRecipeSearching}
            marketableItems={marketableItems}
            itemVelocities={itemVelocities}
            itemAveragePrices={itemAveragePrices}
            itemMinListings={itemMinListings}
            itemRecentPurchases={itemRecentPurchases}
            itemTradability={itemTradability}
            isLoadingVelocities={isLoadingVelocities}
            showLoadingIndicator={showLoadingIndicator}
            averagePriceHeader="平均價格"
            getSimplifiedChineseName={getSimplifiedChineseName}
            addToast={addToast}
            title="搜索結果"
            defaultItemsPerPage={50}
            itemsPerPageOptions={[50, 100, 200]}
            untradeableCount={untradeableResults.length}
            tradeableCount={tradeableResults.length}
            onToggleUntradeable={(newValue) => {
              setShowUntradeable(newValue);
            }}
            isShowUntradeable={showUntradeable}
            onSelect={(item) => {
              const itemUrl = generateItemUrl(item.id, item.nameTW || item.name || 'item');
              window.open(`${window.location.origin}${getInternalUrl(itemUrl)}`, '_blank', 'noopener,noreferrer');
            }}
          />
          </div>
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
