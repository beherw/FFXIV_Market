// Crafting Job Price Checker (製造職找價) - Find profitable items to craft
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import ItemTable from './ItemTable';
import SearchBar from './SearchBar';
import ServerSelector from './ServerSelector';
import HistoryButton from './HistoryButton';
import TopBar from './TopBar';
import TaxRatesModal from './TaxRatesModal';
import { loadRecipeDatabase } from '../services/recipeDatabase';
import { getMarketableItems } from '../services/universalis';
import { getItemById, getSimplifiedChineseName } from '../services/itemDatabase';
import { getInternalUrl } from '../utils/internalUrl.js';
import axios from 'axios';
import twJobAbbrData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';

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
  
  // Cache for ilvls data
  const ilvlsDataRef = useRef(null);
  
  // Helper function to load ilvls data dynamically
  const loadIlvlsData = useCallback(async () => {
    if (ilvlsDataRef.current) {
      return ilvlsDataRef.current;
    }
    const ilvlsModule = await import('../../teamcraft_git/libs/data/src/lib/json/ilvls.json');
    ilvlsDataRef.current = ilvlsModule.default;
    return ilvlsDataRef.current;
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
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});
    setCurrentPage(1); // Reset to first page on new search

    try {
      // Load recipe database
      const { recipes } = await loadRecipeDatabase();
      
      // Filter recipes by job and level
      let filteredRecipes = recipes;
      
      if (selectedJobs.length > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => 
          selectedJobs.includes(recipe.job)
        );
      }
      
      filteredRecipes = filteredRecipes.filter(recipe => 
        recipe.lvl >= ilvlMin && recipe.lvl <= ilvlMax
      );

      // Get unique item IDs from recipes
      const itemIds = [...new Set(filteredRecipes.map(recipe => recipe.result))];
      
      if (itemIds.length === 0) {
        addToast('未找到符合條件的配方', 'warning');
        setIsRecipeSearching(false);
        return;
      }

      addToast(`找到 ${itemIds.length} 個物品，正在過濾可交易物品...`, 'info');

      // Filter out non-tradeable items using marketable API
      const marketableSet = await getMarketableItems();
      let tradeableItemIds = itemIds.filter(id => marketableSet.has(id));

      if (tradeableItemIds.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        setIsRecipeSearching(false);
        return;
      }

      // Sort item IDs by ilvl (descending, highest first) before API query
      const ilvlsData = await loadIlvlsData();
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
      addToast(`找到 ${tradeableItemIds.length} 個可交易物品，正在獲取市場數據...`, 'info');

      // Fetch item details for display
      const itemPromises = tradeableItemIds.map(id => getItemById(id));
      const items = (await Promise.all(itemPromises)).filter(item => item !== null);

      if (items.length === 0) {
        addToast('無法獲取物品信息', 'error');
        setIsRecipeSearching(false);
        return;
      }

      setSearchResults(items);

      // Fetch market data (updates state progressively)
      const marketData = await fetchMarketData(tradeableItemIds, false);
      
      if (!marketData) {
        setIsRecipeSearching(false);
        return;
      }

      // State is already updated progressively by fetchMarketData
      addToast(`搜索完成！找到 ${items.length} 個可交易物品`, 'success');
    } catch (error) {
      console.error('Search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
    } finally {
      setIsRecipeSearching(false);
    }
  }, [ilvlMin, ilvlMax, selectedJobs, isRecipeSearching, isRangeValid, getMaxRange, addToast, fetchMarketData]);

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
        activePage="ultimate-price-king"
        onTaxRatesClick={onTaxRatesClick}
        onUltimatePriceKingClick={() => {
          setSearchText('');
          navigate('/ultimate-price-king');
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
          {/* ILVL Range */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
              物品等級範圍 (1-999)
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">最小等級</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={ilvlMinInput}
                  onChange={(e) => handleIlvlInputChange('min', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold"
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
                  className="w-full px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold"
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              當前範圍: {ilvlMax - ilvlMin + 1} 個等級
              {selectedJobs.length > 0 && (
                <span className="ml-2 text-ffxiv-gold">
                  (已選擇 {selectedJobs.length} 個職業，最大範圍: {maxRange})
                </span>
              )}
            </div>
            {!isRangeValid && (
              <div className="mt-2 text-xs text-yellow-400">
                範圍過大！建議調整為: {suggestedRange.suggestedMin}-{suggestedRange.suggestedMax}
              </div>
            )}
          </div>

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
                          const { recipes } = await loadRecipeDatabase();
                          let filteredRecipes = recipes;
                          
                          if (selectedJobs.length > 0) {
                            filteredRecipes = filteredRecipes.filter(recipe => 
                              selectedJobs.includes(recipe.job)
                            );
                          }
                          
                          filteredRecipes = filteredRecipes.filter(recipe => 
                            recipe.lvl >= ilvlMin && recipe.lvl <= ilvlMax
                          );

                          const itemIds = [...new Set(filteredRecipes.map(recipe => recipe.result))];
                          const marketableSet = await getMarketableItems();
                          let tradeableItemIds = itemIds.filter(id => marketableSet.has(id));
                          
                          // Sort item IDs by ilvl (descending, highest first) before API query
                          const ilvlsData = await loadIlvlsData();
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
                          const itemPromises = tradeableItemIds.map(id => getItemById(id));
                          const items = (await Promise.all(itemPromises)).filter(item => item !== null);
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

        {/* Results */}
        {(searchResults.length > 0 || isRecipeSearching || isLoadingVelocities) && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold">
                搜索結果 ({searchResults.length > 0 ? searchResults.length : 0} 個物品)
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
              {/* Loading Indicator - show when searching or loading velocities */}
              {showLoadingIndicator && (
                <div className="flex items-center gap-2 px-2 py-1 bg-slate-800/50 border border-purple-500/30 rounded-lg">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-ffxiv-gold"></div>
                  <span className="text-xs text-gray-300">載入中...</span>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {searchResults.length > itemsPerPage && (
              <div className="mb-4 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-300">每頁顯示:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      const newItemsPerPage = parseInt(e.target.value, 10);
                      setItemsPerPage(newItemsPerPage);
                      setCurrentPage(1); // Reset to first page
                    }}
                    className="px-3 py-1.5 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-ffxiv-gold"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-sm text-gray-400">
                    顯示 {startIndex + 1}-{Math.min(endIndex, searchResults.length)} / {searchResults.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    首頁
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    上一頁
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-300">
                    第 {currentPage} / {totalPages} 頁
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    下一頁
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    末頁
                  </button>
                </div>
              </div>
            )}

            {/* Only render ItemTable when we have results */}
            {searchResults.length > 0 && (
              <ItemTable
                items={searchResults}
                onSelect={(item) => {
                  window.open(`${window.location.origin}${getInternalUrl(`/item/${item.id}`)}`, '_blank', 'noopener,noreferrer');
                }}
                selectedItem={null}
                marketableItems={marketableItems}
                itemVelocities={itemVelocities}
                itemAveragePrices={itemAveragePrices}
                itemMinListings={itemMinListings}
                itemRecentPurchases={itemRecentPurchases}
                itemTradability={itemTradability}
                isLoadingVelocities={isLoadingVelocities}
                averagePriceHeader="平均價格"
                getSimplifiedChineseName={getSimplifiedChineseName}
                addToast={addToast}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
              />
            )}

            {/* Pagination Controls - Bottom */}
            {searchResults.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-300">每頁顯示:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      const newItemsPerPage = parseInt(e.target.value, 10);
                      setItemsPerPage(newItemsPerPage);
                      setCurrentPage(1); // Reset to first page
                    }}
                    className="px-3 py-1.5 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-ffxiv-gold"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-sm text-gray-400">
                    顯示 {startIndex + 1}-{Math.min(endIndex, searchResults.length)} / {searchResults.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    首頁
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === 1
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    上一頁
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-300">
                    第 {currentPage} / {totalPages} 頁
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    下一頁
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      currentPage === totalPages
                        ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                        : 'bg-slate-800/50 text-white hover:bg-purple-800/40 border border-purple-500/30'
                    }`}
                  >
                    末頁
                  </button>
                </div>
              </div>
            )}
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
      />
    </div>
  );
}
