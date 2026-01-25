// Advanced Search Component (進階搜尋)
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import ItemTable from './ItemTable';
import TopBar from './TopBar';
import ServerSelector from './ServerSelector';
import { getMarketableItems } from '../services/universalis';
import { searchItems, getSimplifiedChineseName, getItemById } from '../services/itemDatabase';
import { loadRecipeDatabase } from '../services/recipeDatabase';
import twJobAbbrData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';
import twItemUICategoriesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-item-ui-categories.json';

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
  isSearching
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('batch'); // 'batch' or 'filter'
  const [batchInput, setBatchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
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
  
  // Filter search state
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isFilterSearching, setIsFilterSearching] = useState(false);
  const [failedIcons, setFailedIcons] = useState(new Set());
  
  // Handle icon load error
  const handleIconError = useCallback((jobId) => {
    setFailedIcons(prev => new Set(prev).add(jobId));
  }, []);
  
  // Refs for request management
  const velocityFetchAbortControllerRef = useRef(null);
  const velocityFetchRequestIdRef = useRef(0);
  const velocityFetchInProgressRef = useRef(false);

  // Handle batch search
  const handleBatchSearch = useCallback(async () => {
    if (isBatchSearching || isSearching) return;

    // Parse batch input - support both comma-separated and newline-separated item names
    const inputLines = batchInput.trim().split(/[,\n]/).map(line => line.trim()).filter(line => line);
    
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

    setSearchResults([]);
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});

    try {
      setIsBatchSearching(true);
      
      // Search for each unique item name
      const allSearchResults = [];
      const searchPromises = uniqueItemNames.map(async (itemName) => {
        try {
          const searchResult = await searchItems(itemName);
          return searchResult.results || [];
        } catch (error) {
          console.error(`Error searching for "${itemName}":`, error);
          return [];
        }
      });
      
      const searchResultsArray = await Promise.all(searchPromises);
      
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

      // Filter out non-tradeable items using marketable API
      const marketableSet = await getMarketableItems();
      setMarketableItems(marketableSet);
      const tradeableItems = allItems.filter(item => marketableSet.has(item.id));

      if (tradeableItems.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        setIsBatchSearching(false);
        return;
      }

      // Sort by ID
      const itemsSorted = tradeableItems.sort((a, b) => a.id - b.id);

      setSearchResults(itemsSorted);

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

      const currentRequestId = ++velocityFetchRequestIdRef.current;
      velocityFetchAbortControllerRef.current = new AbortController();
      const abortSignal = velocityFetchAbortControllerRef.current.signal;
      velocityFetchInProgressRef.current = true;

      setIsLoadingVelocities(true);

      const isDCQuery = selectedServerOption === selectedWorld.section;
      const queryTarget = isDCQuery
        ? selectedWorld.section
        : selectedServerOption;

      const tradeableItemIds = itemsSorted.map(item => item.id);
      const allVelocities = {};
      const allAveragePrices = {};
      const allMinListings = {};
      const allRecentPurchases = {};
      const allTradability = {};

      // Progressive batch sizes: 20, then 50, then 100 per batch
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
          if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
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
        if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
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
      setIsLoadingVelocities(false);
      setIsBatchSearching(false);
      
      addToast(`找到 ${tradeableItems.length} 個可交易物品`, 'success');
    } catch (error) {
      console.error('Search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
      setIsBatchSearching(false);
    }
  }, [batchInput, selectedWorld, selectedServerOption, addToast, isBatchSearching, isSearching]);

  // Job icons mapping with XIVAPI URLs - separated into 生產 and 戰鬥職業
  // Only show higher tier jobs (exclude base classes 1-7, 26, 29)
  const { productionJobs, battleJobsByRole } = useMemo(() => {
    // Mapping of lower tier classes to their higher tier jobs
    // We'll exclude these lower tier IDs: 1-7 (base classes), 26 (ACN), 29 (ROG)
    const lowerTierClasses = new Set([1, 2, 3, 4, 5, 6, 7, 26, 29]);
    
    // Complete mapping of job IDs to XIVAPI companion icon names
    const jobNameMap = {
      // 戰鬥職業 (Battle Jobs) - Only higher tier jobs (19-42, excluding lower tier)
      19: 'paladin',       // 騎士 (upgrade from GLA/1)
      20: 'monk',          // 武僧 (upgrade from PGL/2)
      21: 'warrior',       // 戰士 (upgrade from MRD/3)
      22: 'dragoon',       // 龍騎士 (upgrade from LNC/4)
      23: 'bard',          // 吟遊詩人 (upgrade from ARC/5)
      24: 'whitemage',     // 白魔道士 (upgrade from CNJ/6)
      25: 'blackmage',     // 黑魔道士 (upgrade from THM/7)
      27: 'summoner',      // 召喚士 (upgrade from ACN/26)
      28: 'scholar',       // 學者 (upgrade from ACN/26)
      30: 'ninja',         // 忍者 (upgrade from ROG/29)
      31: 'machinist',     // 機工士
      32: 'darkknight',    // 暗黑騎士
      33: 'astrologian',   // 占星術師
      34: 'samurai',       // 武士
      35: 'redmage',       // 赤魔道士
      36: 'bluemage',      // 青魔道士
      37: 'gunbreaker',    // 絕槍戰士
      38: 'dancer',        // 舞者
      39: 'reaper',        // 奪魂者
      40: 'sage',          // 賢者
      41: 'viper',         // 毒蛇劍士
      42: 'pictomancer',   // 繪靈法師
      
      // 生產職業 (Production Jobs) - Crafting (8-15) and Gathering (16-18)
      8: 'carpenter',      // 木工師
      9: 'blacksmith',     // 鍛造師
      10: 'armorer',       // 甲冑師
      11: 'goldsmith',     // 金工師
      12: 'leatherworker', // 皮革師
      13: 'weaver',        // 裁縫師
      14: 'alchemist',     // 鍊金術師
      15: 'culinarian',    // 烹調師
      16: 'miner',         // 採掘師
      17: 'botanist',      // 園藝師
      18: 'fisher',        // 漁師
    };
    
    // Role definitions: 1=Tank, 2=Physical DPS, 3=Ranged Physical DPS, 4=Healer, 5=Magical DPS
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
    
    const production = [];
    const battleByRole = {
      tank: [],
      healer: [],
      melee: [],
      ranged: [],
      caster: [],
    };
    
    Object.entries(twJobAbbrData).forEach(([id, data]) => {
      const jobId = parseInt(id, 10);
      
      // Skip lower tier classes
      if (lowerTierClasses.has(jobId)) return;
      
      const iconName = jobNameMap[jobId];
      if (!iconName) return; // Skip if no icon mapping
      
      const jobData = {
        id: jobId,
        name: data.tw,
        iconUrl: `https://xivapi.com/cj/companion/${iconName}.png`,
      };
      
      // 生產職業: 8-18 (crafting + gathering)
      if (jobId >= 8 && jobId <= 18) {
        production.push(jobData);
      } 
      // 戰鬥職業: Only higher tier jobs (19-42, excluding lower tier)
      else if (jobId >= 19 && jobId <= 42) {
        const role = jobRoles[jobId];
        if (role && battleByRole[role]) {
          battleByRole[role].push(jobData);
        }
      }
    });
    
    // Sort by ID within each category
    production.sort((a, b) => a.id - b.id);
    Object.keys(battleByRole).forEach(role => {
      battleByRole[role].sort((a, b) => a.id - b.id);
    });
    
    return { productionJobs: production, battleJobsByRole: battleByRole };
  }, []);

  // Item categories from tw-item-ui-categories.json
  const itemCategories = useMemo(() => {
    return Object.entries(twItemUICategoriesData)
      .map(([id, data]) => ({
        id: parseInt(id, 10),
        name: data.tw,
      }))
      .sort((a, b) => a.id - b.id);
  }, []);

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
  }, []);

  // Handle filter search
  const handleFilterSearch = useCallback(async () => {
    if (isFilterSearching || isSearching) return;

    if (selectedJobs.length === 0 && selectedCategories.length === 0) {
      addToast('請至少選擇一個職業或分類', 'warning');
      return;
    }

    if (!selectedWorld || !selectedServerOption) {
      addToast('請選擇伺服器', 'warning');
      return;
    }

    try {
      setIsFilterSearching(true);
      setSearchResults([]);
      setItemVelocities({});
      setItemAveragePrices({});
      setItemMinListings({});
      setItemRecentPurchases({});
      setItemTradability({});
      setTooManyItemsWarning(null);

      let itemIds = new Set();
      
      // Separate production and battle jobs
      const productionJobIds = selectedJobs.filter(jobId => jobId >= 8 && jobId <= 18);
      const battleJobIds = selectedJobs.filter(jobId => (jobId >= 1 && jobId <= 7) || (jobId >= 19 && jobId <= 42));

      // Filter by production jobs (using recipes)
      if (productionJobIds.length > 0) {
        const { recipes } = await loadRecipeDatabase();
        productionJobIds.forEach(jobId => {
          recipes.forEach(recipe => {
            if (recipe.job === jobId && recipe.result) {
              itemIds.add(recipe.result);
            }
          });
        });
      }

      // Filter by battle jobs
      // Note: Battle job filtering requires ClassJobCategory data which isn't available in our current item database
      // For now, we'll show a message if only battle jobs are selected
      if (battleJobIds.length > 0 && productionJobIds.length === 0) {
        addToast('戰鬥職業篩選需要物品職業需求資料，目前僅支援生產職業篩選', 'info');
        setIsFilterSearching(false);
        return;
      }
      
      if (battleJobIds.length > 0 && productionJobIds.length > 0) {
        addToast('已篩選生產職業物品，戰鬥職業篩選需要額外資料', 'info');
      }

      // Filter by categories
      // Note: Since we don't have category data in tw-items.json,
      // we'll need to fetch items and filter by category if available
      // For now, we'll search all items if categories are selected
      // TODO: Implement proper category filtering when category data is available
      if (selectedCategories.length > 0 && itemIds.size === 0) {
        // If no jobs selected, we need to get items from database
        // For now, we'll show a message that category filtering needs item category data
        addToast('分類篩選需要物品分類資料，目前僅支援職業篩選', 'info');
        setIsFilterSearching(false);
        return;
      }

      if (itemIds.size === 0) {
        addToast('未找到符合條件的物品', 'warning');
        setIsFilterSearching(false);
        return;
      }

      // Filter out non-tradeable items
      const marketableSet = await getMarketableItems();
      setMarketableItems(marketableSet);
      const tradeableItemIds = Array.from(itemIds).filter(id => marketableSet.has(id));

      if (tradeableItemIds.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        setIsFilterSearching(false);
        return;
      }

      // Check if too many items
      if (tradeableItemIds.length > MAX_ITEMS_LIMIT) {
        setTooManyItemsWarning({
          total: tradeableItemIds.length,
          limit: MAX_ITEMS_LIMIT
        });
        setIsFilterSearching(false);
        return;
      }

      setTooManyItemsWarning(null);

      // Fetch item details
      const itemPromises = tradeableItemIds.map(id => getItemById(id));
      const items = (await Promise.all(itemPromises)).filter(item => item !== null);

      if (items.length === 0) {
        addToast('無法獲取物品信息', 'error');
        setIsFilterSearching(false);
        return;
      }

      // Sort by ID
      const itemsSorted = items.sort((a, b) => a.id - b.id);
      setSearchResults(itemsSorted);

      // Fetch market data (same as batch search)
      if (velocityFetchAbortControllerRef.current) {
        velocityFetchAbortControllerRef.current.abort();
      }

      const currentRequestId = ++velocityFetchRequestIdRef.current;
      velocityFetchAbortControllerRef.current = new AbortController();
      const abortSignal = velocityFetchAbortControllerRef.current.signal;
      velocityFetchInProgressRef.current = true;

      setIsLoadingVelocities(true);

      const isDCQuery = selectedServerOption === selectedWorld.section;
      const queryTarget = isDCQuery
        ? selectedWorld.section
        : selectedServerOption;

      const allVelocities = {};
      const allAveragePrices = {};
      const allMinListings = {};
      const allRecentPurchases = {};
      const allTradability = {};

      // Process batches sequentially
      const processBatch = async (batchNumber, startIndex) => {
        if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
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
        
        const batch = tradeableItemIds.slice(startIndex, startIndex + batchSize);
        if (batch.length === 0) {
          return;
        }
        
        const itemIdsString = batch.join(',');
        
        try {
          const response = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`, {
            signal: abortSignal
          });
          
          if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
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

          setItemVelocities(prev => ({ ...prev, ...allVelocities }));
          setItemAveragePrices(prev => ({ ...prev, ...allAveragePrices }));
          setItemMinListings(prev => ({ ...prev, ...allMinListings }));
          setItemRecentPurchases(prev => ({ ...prev, ...allRecentPurchases }));
          setItemTradability(prev => ({ ...prev, ...allTradability }));
        } catch (error) {
          if (error.name === 'AbortError') {
            return;
          }
          console.error('Error fetching market data:', error);
          batch.forEach(itemId => {
            if (!allTradability.hasOwnProperty(itemId)) {
              allTradability[itemId] = false;
            }
          });
        }
      };

      let currentIndex = 0;
      let batchNumber = 0;
      while (currentIndex < tradeableItemIds.length) {
        await processBatch(batchNumber, currentIndex);
        
        if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
          setIsLoadingVelocities(false);
          setIsFilterSearching(false);
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
        
        currentIndex += batchSize;
        batchNumber++;
      }

      setItemVelocities(allVelocities);
      setItemAveragePrices(allAveragePrices);
      setItemMinListings(allMinListings);
      setItemRecentPurchases(allRecentPurchases);
      setItemTradability(allTradability);
      setIsLoadingVelocities(false);
      setIsFilterSearching(false);
      
      addToast(`找到 ${tradeableItemIds.length} 個可交易物品`, 'success');
    } catch (error) {
      console.error('Filter search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
      setIsFilterSearching(false);
    }
  }, [selectedJobs, selectedCategories, selectedWorld, selectedServerOption, addToast, isFilterSearching, isSearching]);

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
        onAdvancedSearchClick={() => {
          setSearchText('');
          navigate('/advanced-search');
        }}
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
        }}
        onUltimatePriceKingClick={() => {
          setSearchText('');
          navigate('/ultimate-price-king');
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
                setActiveTab('batch');
                // Clear filter selections when switching to batch tab
                setSelectedJobs([]);
                setSelectedCategories([]);
                setTooManyItemsWarning(null);
              }}
              className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                activeTab === 'batch'
                  ? 'text-ffxiv-gold border-ffxiv-gold'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              批量搜尋
            </button>
            <button
              onClick={() => {
                setActiveTab('filter');
                // Clear batch input when switching to filter tab
                setBatchInput('');
                setTooManyItemsWarning(null);
              }}
              className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                activeTab === 'filter'
                  ? 'text-ffxiv-gold border-ffxiv-gold'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              篩選搜尋
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'batch' && (
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
                onClick={handleBatchSearch}
                disabled={isBatchSearching || isSearching || !batchInput.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  isBatchSearching || isSearching || !batchInput.trim()
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
              {/* Job Icons Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-ffxiv-gold mb-3">
                  選擇職業（可多選）
                </label>
                
                {/* 生產職業 */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-purple-400 mb-2">生產職業</div>
                  <div className="flex flex-wrap gap-2">
                    {productionJobs.map(job => {
                      const isSelected = selectedJobs.includes(job.id);
                      return (
                        <button
                          key={job.id}
                          onClick={() => handleJobToggle(job.id)}
                          title={job.name}
                          className={`p-2 rounded-lg border transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                              : 'bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50'
                          }`}
                        >
                          {failedIcons.has(job.id) ? (
                            <span className="text-xs font-medium whitespace-nowrap">{job.name}</span>
                          ) : (
                            <img 
                              src={job.iconUrl} 
                              alt={job.name}
                              className="w-8 h-8 object-contain"
                              onError={() => handleIconError(job.id)}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 戰鬥職業 - Organized by role */}
                <div className="mb-2">
                  <div className="text-xs font-semibold text-purple-400 mb-3">戰鬥職業</div>
                  
                  {/* Tanks and Healers - Same row */}
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tanks */}
                    {battleJobsByRole.tank.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-blue-400 mb-2">坦克 (Tank)</div>
                        <div className="flex flex-wrap gap-2">
                          {battleJobsByRole.tank.map(job => {
                            const isSelected = selectedJobs.includes(job.id);
                            return (
                              <button
                                key={job.id}
                                onClick={() => handleJobToggle(job.id)}
                                title={job.name}
                                className={`p-2 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                    : 'bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50'
                                }`}
                              >
                                {failedIcons.has(job.id) ? (
                                  <span className="text-xs font-medium whitespace-nowrap">{job.name}</span>
                                ) : (
                                  <img 
                                    src={job.iconUrl} 
                                    alt={job.name}
                                    className="w-8 h-8 object-contain"
                                    onError={() => handleIconError(job.id)}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Healers */}
                    {battleJobsByRole.healer.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-green-400 mb-2">治療 (Healer)</div>
                        <div className="flex flex-wrap gap-2">
                          {battleJobsByRole.healer.map(job => {
                            const isSelected = selectedJobs.includes(job.id);
                            return (
                              <button
                                key={job.id}
                                onClick={() => handleJobToggle(job.id)}
                                title={job.name}
                                className={`p-2 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                    : 'bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50'
                                }`}
                              >
                                {failedIcons.has(job.id) ? (
                                  <span className="text-xs font-medium whitespace-nowrap">{job.name}</span>
                                ) : (
                                  <img 
                                    src={job.iconUrl} 
                                    alt={job.name}
                                    className="w-8 h-8 object-contain"
                                    onError={() => handleIconError(job.id)}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Melee DPS */}
                  {battleJobsByRole.melee.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-red-400 mb-2">近戰物理 DPS (Melee DPS)</div>
                      <div className="flex flex-wrap gap-2">
                        {battleJobsByRole.melee.map(job => {
                          const isSelected = selectedJobs.includes(job.id);
                          return (
                            <button
                              key={job.id}
                              onClick={() => handleJobToggle(job.id)}
                              title={job.name}
                              className={`p-2 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                  : 'bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50'
                              }`}
                            >
                              <img 
                                src={job.iconUrl} 
                                alt={job.name}
                                className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    const button = e.target.parentNode;
                                    // Check if text fallback already exists
                                    if (!button.querySelector('.job-name-fallback')) {
                                      const textSpan = document.createElement('span');
                                      textSpan.className = 'job-name-fallback text-xs font-medium whitespace-nowrap';
                                      textSpan.textContent = job.name;
                                      button.appendChild(textSpan);
                                    }
                                  }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ranged Physical DPS and Magical DPS - Same row */}
                  {(battleJobsByRole.ranged.length > 0 || battleJobsByRole.caster.length > 0) && (
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Ranged Physical DPS */}
                      {battleJobsByRole.ranged.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-orange-400 mb-2">遠程物理 DPS (Ranged Physical DPS)</div>
                          <div className="flex flex-wrap gap-2">
                            {battleJobsByRole.ranged.map(job => {
                              const isSelected = selectedJobs.includes(job.id);
                              return (
                                <button
                                  key={job.id}
                                  onClick={() => handleJobToggle(job.id)}
                                  title={job.name}
                                  className={`p-2 rounded-lg border transition-all ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                      : 'bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50'
                                  }`}
                                >
                                  <img 
                                    src={job.iconUrl} 
                                    alt={job.name}
                                    className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    const button = e.target.parentNode;
                                    // Check if text fallback already exists
                                    if (!button.querySelector('.job-name-fallback')) {
                                      const textSpan = document.createElement('span');
                                      textSpan.className = 'job-name-fallback text-xs font-medium whitespace-nowrap';
                                      textSpan.textContent = job.name;
                                      button.appendChild(textSpan);
                                    }
                                  }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Magical DPS */}
                      {battleJobsByRole.caster.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-purple-300 mb-2">遠程魔法 DPS (Magical DPS)</div>
                          <div className="flex flex-wrap gap-2">
                            {battleJobsByRole.caster.map(job => {
                              const isSelected = selectedJobs.includes(job.id);
                              return (
                                <button
                                  key={job.id}
                                  onClick={() => handleJobToggle(job.id)}
                                  title={job.name}
                                  className={`p-2 rounded-lg border transition-all ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-ffxiv-gold/20 to-yellow-500/20 border-ffxiv-gold'
                                      : 'bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50'
                                  }`}
                                >
                                  <img 
                                    src={job.iconUrl} 
                                    alt={job.name}
                                    className="w-8 h-8 object-contain"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    const button = e.target.parentNode;
                                    // Check if text fallback already exists
                                    if (!button.querySelector('.job-name-fallback')) {
                                      const textSpan = document.createElement('span');
                                      textSpan.className = 'job-name-fallback text-xs font-medium whitespace-nowrap';
                                      textSpan.textContent = job.name;
                                      button.appendChild(textSpan);
                                    }
                                  }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedJobs.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    已選擇 {selectedJobs.length} 個職業
                  </div>
                )}
              </div>

              {/* Item Categories Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-ffxiv-gold mb-3">
                  選擇物品分類（可多選）
                </label>
                <div className="max-h-64 overflow-y-auto border border-purple-500/30 rounded-lg p-3 bg-slate-900/30">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {itemCategories.map(category => {
                      const isSelected = selectedCategories.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          onClick={() => handleCategoryToggle(category.id)}
                          className={`px-3 py-2 rounded text-sm transition-all text-left ${
                            isSelected
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
                {selectedCategories.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    已選擇 {selectedCategories.length} 個分類
                  </div>
                )}
                <div className="mt-2 text-xs text-yellow-400">
                  注意：分類篩選需要物品分類資料，目前僅支援職業篩選
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
                    disabled={isLoadingVelocities || isFilterSearching}
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
                            setIsFilterSearching(true);
                            setSearchResults([]);
                            setItemVelocities({});
                            setItemAveragePrices({});
                            setItemMinListings({});
                            setItemRecentPurchases({});
                            setItemTradability({});

                            try {
                              let itemIds = new Set();
                              
                              const productionJobIds = selectedJobs.filter(jobId => jobId >= 8 && jobId <= 18);
                              const battleJobIds = selectedJobs.filter(jobId => (jobId >= 1 && jobId <= 7) || (jobId >= 19 && jobId <= 42));

                              if (productionJobIds.length > 0) {
                                const { recipes } = await loadRecipeDatabase();
                                productionJobIds.forEach(jobId => {
                                  recipes.forEach(recipe => {
                                    if (recipe.job === jobId && recipe.result) {
                                      itemIds.add(recipe.result);
                                    }
                                  });
                                });
                              }

                              if (battleJobIds.length > 0 && productionJobIds.length === 0) {
                                addToast('戰鬥職業篩選需要物品職業需求資料，目前僅支援生產職業篩選', 'info');
                                setIsFilterSearching(false);
                                return;
                              }
                              
                              if (battleJobIds.length > 0 && productionJobIds.length > 0) {
                                addToast('已篩選生產職業物品，戰鬥職業篩選需要額外資料', 'info');
                              }

                              if (selectedCategories.length > 0 && itemIds.size === 0) {
                                addToast('分類篩選需要物品分類資料，目前僅支援職業篩選', 'info');
                                setIsFilterSearching(false);
                                return;
                              }

                              if (itemIds.size === 0) {
                                addToast('未找到符合條件的物品', 'warning');
                                setIsFilterSearching(false);
                                return;
                              }

                              const marketableSet = await getMarketableItems();
                              setMarketableItems(marketableSet);
                              let tradeableItemIds = Array.from(itemIds).filter(id => marketableSet.has(id));

                              if (tradeableItemIds.length === 0) {
                                addToast('沒有可交易的物品', 'warning');
                                setIsFilterSearching(false);
                                return;
                              }

                              // Limit to MAX_ITEMS_LIMIT
                              tradeableItemIds = tradeableItemIds.slice(0, MAX_ITEMS_LIMIT);
                              addToast(`已限制為前 ${tradeableItemIds.length} 個物品，正在獲取市場數據...`, 'warning');

                              const itemPromises = tradeableItemIds.map(id => getItemById(id));
                              const items = (await Promise.all(itemPromises)).filter(item => item !== null);

                              if (items.length === 0) {
                                addToast('無法獲取物品信息', 'error');
                                setIsFilterSearching(false);
                                return;
                              }

                              const itemsSorted = items.sort((a, b) => a.id - b.id);
                              setSearchResults(itemsSorted);

                              if (velocityFetchAbortControllerRef.current) {
                                velocityFetchAbortControllerRef.current.abort();
                              }

                              const currentRequestId = ++velocityFetchRequestIdRef.current;
                              velocityFetchAbortControllerRef.current = new AbortController();
                              const abortSignal = velocityFetchAbortControllerRef.current.signal;
                              velocityFetchInProgressRef.current = true;

                              setIsLoadingVelocities(true);

                              const isDCQuery = selectedServerOption === selectedWorld.section;
                              const queryTarget = isDCQuery
                                ? selectedWorld.section
                                : selectedServerOption;

                              const allVelocities = {};
                              const allAveragePrices = {};
                              const allMinListings = {};
                              const allRecentPurchases = {};
                              const allTradability = {};

                              const processBatch = async (batchNumber, startIndex) => {
                                if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
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
                                
                                const batch = tradeableItemIds.slice(startIndex, startIndex + batchSize);
                                if (batch.length === 0) {
                                  return;
                                }
                                
                                const itemIdsString = batch.join(',');
                                
                                try {
                                  const response = await fetch(`https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`, {
                                    signal: abortSignal
                                  });
                                  
                                  if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
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

                                  setItemVelocities(prev => ({ ...prev, ...allVelocities }));
                                  setItemAveragePrices(prev => ({ ...prev, ...allAveragePrices }));
                                  setItemMinListings(prev => ({ ...prev, ...allMinListings }));
                                  setItemRecentPurchases(prev => ({ ...prev, ...allRecentPurchases }));
                                  setItemTradability(prev => ({ ...prev, ...allTradability }));
                                } catch (error) {
                                  if (error.name === 'AbortError') {
                                    return;
                                  }
                                  console.error('Error fetching market data:', error);
                                  batch.forEach(itemId => {
                                    if (!allTradability.hasOwnProperty(itemId)) {
                                      allTradability[itemId] = false;
                                    }
                                  });
                                }
                              };

                              let currentIndex = 0;
                              let batchNumber = 0;
                              while (currentIndex < tradeableItemIds.length) {
                                await processBatch(batchNumber, currentIndex);
                                
                                if (abortSignal.aborted || currentRequestId !== velocityFetchRequestIdRef.current) {
                                  setIsLoadingVelocities(false);
                                  setIsFilterSearching(false);
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
                                
                                currentIndex += batchSize;
                                batchNumber++;
                              }

                              setItemVelocities(allVelocities);
                              setItemAveragePrices(allAveragePrices);
                              setItemMinListings(allMinListings);
                              setItemRecentPurchases(allRecentPurchases);
                              setItemTradability(allTradability);
                              setIsLoadingVelocities(false);
                              setIsFilterSearching(false);
                              
                              addToast(`找到 ${tradeableItemIds.length} 個可交易物品`, 'success');
                            } catch (error) {
                              console.error('Filter search error:', error);
                              addToast('搜索失敗，請稍後再試', 'error');
                              setIsLoadingVelocities(false);
                              setIsFilterSearching(false);
                            }
                          }}
                          className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 hover:bg-yellow-500/30 transition-all text-sm font-medium"
                        >
                          繼續搜索（限制為前 {MAX_ITEMS_LIMIT} 個）
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

              {/* Search Button */}
              <button
                onClick={handleFilterSearch}
                disabled={isFilterSearching || isSearching || (selectedJobs.length === 0 && selectedCategories.length === 0) || tooManyItemsWarning !== null}
                className={`w-full py-3 rounded-lg font-semibold transition-all ${
                  isFilterSearching || isSearching || (selectedJobs.length === 0 && selectedCategories.length === 0) || tooManyItemsWarning !== null
                    ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
                }`}
              >
                {isFilterSearching || isSearching ? '搜索中...' : '搜索'}
              </button>
            </div>
          )}

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold">
                  搜索結果 ({searchResults.length} 個物品)
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
              </div>
              <ItemTable
                items={searchResults}
                onSelect={(item) => {
                  if (onItemSelect) {
                    const params = new URLSearchParams();
                    if (selectedServerOption) {
                      params.set('server', selectedServerOption);
                    }
                    const queryString = params.toString();
                    const itemUrl = `/item/${item.id}${queryString ? '?' + queryString : ''}`;
                    
                    onItemSelect(item);
                    
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        navigate(itemUrl, { replace: true });
                      });
                    });
                  }
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
