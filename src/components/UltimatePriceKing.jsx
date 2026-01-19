// Ultimate Price King (究極查價王) - Secret page for advanced market search
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import ItemTable from './ItemTable';
import SearchBar from './SearchBar';
import ServerSelector from './ServerSelector';
import HistoryButton from './HistoryButton';
import { loadRecipeDatabase } from '../services/recipeDatabase';
import { getMarketableItems } from '../services/universalis';
import { getItemById } from '../services/itemDatabase';
import axios from 'axios';
import twJobAbbrData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';

export default function UltimatePriceKing({ 
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
  onItemSelect
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

      // Debounce validation after 1.3 seconds
      ilvlValidationTimeoutRef.current = setTimeout(() => {
        const numValue = parseInt(value, 10);
        
        // If empty or invalid, reset to current value
        if (isNaN(numValue) || numValue < 1 || numValue > 999) {
          if (field === 'min') {
            setIlvlMinInput(ilvlMin.toString());
          } else {
            setIlvlMaxInput(ilvlMax.toString());
          }
          return;
        }

        let newMin = ilvlMin;
        let newMax = ilvlMax;

        if (field === 'min') {
          newMin = numValue;
        } else {
          newMax = numValue;
        }

        // Clamp values to valid range
        if (newMin < 1) {
          newMin = 1;
          setIlvlMinInput('1');
        }
        if (newMax > 999) {
          newMax = 999;
          setIlvlMaxInput('999');
        }
        if (newMin > newMax) {
          const temp = newMin;
          newMin = newMax;
          newMax = temp;
          setIlvlMinInput(newMin.toString());
          setIlvlMaxInput(newMax.toString());
        }

        setIlvlMin(newMin);
        setIlvlMax(newMax);
      }, 1300);
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
      const tradeableItemIds = itemIds.filter(id => marketableSet.has(id));

      if (tradeableItemIds.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        setIsRecipeSearching(false);
        return;
      }

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

      // Fetch market data in batches (100 items per request)
      setIsLoadingVelocities(true);
      
      // Determine if we're querying DC or world
      if (!selectedWorld || !selectedServerOption) {
        addToast('請選擇伺服器', 'warning');
        setIsLoadingVelocities(false);
        setIsRecipeSearching(false);
        return;
      }
      
      const isDCQuery = selectedServerOption === selectedWorld.section;
      // When world is selected, use world ID; when DC is selected, use DC name
      const queryTarget = isDCQuery 
        ? selectedWorld.section  // DC name
        : selectedServerOption;   // World ID (number)
      
      const batchSize = 100;
      const allVelocities = {};
      const allAveragePrices = {};
      const allMinListings = {};
      const allRecentPurchases = {};
      const allTradability = {};

      for (let i = 0; i < tradeableItemIds.length; i += batchSize) {
        const batch = tradeableItemIds.slice(i, i + batchSize);
        const itemIdsString = batch.join(',');
        
        try {
          const response = await axios.get(
            `https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`
          );
          
          const data = response.data;
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
          console.error('Error fetching market data:', error);
          // Mark batch items as non-tradable on error
          batch.forEach(itemId => {
            if (!allTradability.hasOwnProperty(itemId)) {
              allTradability[itemId] = false;
            }
          });
        }
      }

      setItemVelocities(allVelocities);
      setItemAveragePrices(allAveragePrices);
      setItemMinListings(allMinListings);
      setItemRecentPurchases(allRecentPurchases);
      setItemTradability(allTradability);
      setIsLoadingVelocities(false);

      addToast(`搜索完成！找到 ${items.length} 個可交易物品`, 'success');
    } catch (error) {
      console.error('Search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
    } finally {
      setIsRecipeSearching(false);
    }
  }, [ilvlMin, ilvlMax, selectedJobs, isRecipeSearching, isRangeValid, getMaxRange, addToast, selectedWorld, selectedServerOption]);

  // Job icons mapping
  const jobIcons = {
    8: '🔨',   // 木工師 (Carpenter)
    9: '⚒️',   // 鍛造師 (Blacksmith)
    10: '🛡️',  // 甲冑師 (Armorer)
    11: '💎',  // 金工師 (Goldsmith)
    12: '🧵',  // 皮革師 (Leatherworker)
    13: '🧶',  // 裁縫師 (Weaver)
    14: '⚗️',  // 鍊金術師 (Alchemist)
    15: '🍳',  // 烹調師 (Culinarian)
  };

  // Get crafting jobs (IDs 8-15) from tw-job-abbr.json
  const allJobs = Object.entries(twJobAbbrData)
    .map(([id, data]) => ({
      id: parseInt(id, 10),
      name: data.tw,
      icon: jobIcons[parseInt(id, 10)] || '⚙️'
    }))
    .filter(job => job.id >= 8 && job.id <= 15);

  const maxRange = getMaxRange(selectedJobs.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white">
      {/* Logo - Desktop: Fixed Top Left, Mobile: Inside search bar row */}
      <button
        onClick={() => navigate('/')}
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
      <div className="fixed top-2 left-0 right-0 mid:top-4 mid:right-auto z-50 px-1.5 mid:px-0 mid:left-20 py-1 mid:py-0 mid:w-auto">
        <div className="relative flex items-center gap-1.5 mid:gap-3">
          {/* Mobile Logo */}
          <button
            onClick={() => navigate('/')}
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
          <div className="min-w-0 h-9 mid:h-12 flex-1 mid:flex-initial mid:w-[420px] detail:w-[520px] min-w-[100px]">
            <SearchBar 
              onSearch={onSearch} 
              isLoading={isSearching}
              value={searchText}
              onChange={setSearchText}
              disabled={!isServerDataLoaded}
              disabledTooltip={!isServerDataLoaded ? '請等待伺服器資料載入完成' : undefined}
              selectedDcName={selectedWorld?.section}
              onItemSelect={onItemSelect}
            />
          </div>

          {/* History Button */}
          <div className="flex-shrink-0">
            <HistoryButton onItemSelect={onItemSelect} />
          </div>

          {/* Ultimate Price King Button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => navigate('/ultimate-price-king')}
              className="bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border border-ffxiv-gold/70 rounded-lg backdrop-blur-sm whitespace-nowrap flex items-center transition-colors px-2 mid:px-3 detail:px-4 h-9 mid:h-12 gap-1.5 mid:gap-2 shadow-[0_0_10px_rgba(212,175,55,0.3)]"
              title="查價王"
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
              <span className="text-xs detail:text-sm font-semibold text-ffxiv-gold hidden mid:inline">查價王</span>
              <span className="text-xs font-semibold text-ffxiv-gold mid:hidden">查價</span>
            </button>
          </div>
        </div>
      </div>

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
              究極查價王
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
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                        : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                    }`}
                  >
                    <span className="text-base">{job.icon}</span>
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

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isRecipeSearching || !isRangeValid || selectedJobs.length === 0}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              isRecipeSearching || !isRangeValid || selectedJobs.length === 0
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
            }`}
          >
            {isRecipeSearching ? '搜索中...' : '搜索'}
          </button>
        </div>

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
                window.open(`/item/${item.id}`, '_blank', 'noopener,noreferrer');
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
            />
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
