// Ultimate Price King (究極查價王) - Secret page for advanced market search
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import ItemTable from './ItemTable';
import SearchBar from './SearchBar';
import ServerSelector from './ServerSelector';
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
    if (jobCount === 2) return 40;
    if (jobCount === 3) return 30;
    if (jobCount === 4) return 20;
    return 10;
  }, []);

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
        
        // If empty or invalid, use current value
        if (isNaN(numValue) || numValue < 1 || numValue > 999) {
          if (field === 'min') {
            setIlvlMinInput(ilvlMin.toString());
          } else {
            setIlvlMaxInput(ilvlMax.toString());
          }
          return;
        }

        const maxRange = getMaxRange(selectedJobs.length);
        let newMin = ilvlMin;
        let newMax = ilvlMax;

        if (field === 'min') {
          newMin = numValue;
          if (newMax - newMin > maxRange) {
            newMax = newMin + maxRange;
            setIlvlMaxInput(newMax.toString());
            addToast(`範圍過大！已自動調整為 ${newMin}-${newMax}`, 'warning');
          }
        } else {
          newMax = numValue;
          if (newMax - newMin > maxRange) {
            newMin = newMax - maxRange;
            setIlvlMinInput(newMin.toString());
            addToast(`範圍過大！已自動調整為 ${newMin}-${newMax}`, 'warning');
          }
        }

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
  }, [selectedJobs.length, ilvlMin, ilvlMax, getMaxRange, addToast]);

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
        // Deselect job
        const newJobs = prev.filter(j => j !== jobIdNum);
        const maxRange = getMaxRange(newJobs.length);
        let newMin = ilvlMin;
        let newMax = ilvlMax;
        if (newMax - newMin > maxRange) {
          newMax = newMin + maxRange;
          setIlvlMax(newMax);
          setIlvlMaxInput(newMax.toString());
          addToast(`範圍已調整為 ${newMin}-${newMax}`, 'info');
        }
        return newJobs;
      } else {
        // Select job (max 4)
        if (prev.length >= 4) {
          addToast('最多只能選擇4個職業', 'warning');
          return prev;
        }
        const newJobs = [...prev, jobIdNum];
        const maxRange = getMaxRange(newJobs.length);
        let newMin = ilvlMin;
        let newMax = ilvlMax;
        if (newMax - newMin > maxRange) {
          newMax = newMin + maxRange;
          setIlvlMax(newMax);
          setIlvlMaxInput(newMax.toString());
          addToast(`範圍已調整為 ${newMin}-${newMax}`, 'info');
        }
        return newJobs;
      }
    });
  }, [ilvlMin, ilvlMax, getMaxRange, addToast]);

  // Perform search
  const handleSearch = useCallback(async () => {
    if (isRecipeSearching) return;

    const maxRange = getMaxRange(selectedJobs.length);
    if (ilvlMax - ilvlMin > maxRange) {
      addToast(`範圍過大！最多只能搜索 ${maxRange} 個等級範圍`, 'error');
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
                  // For velocity, pick higher
                  if (nqValue !== undefined || hqValue !== undefined) {
                    return Math.max(nqValue || 0, hqValue || 0);
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
  }, [ilvlMin, ilvlMax, selectedJobs, isRecipeSearching, getMaxRange, addToast, selectedWorld, selectedServerOption]);

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
      {/* Fixed Search Bar - Top Row */}
      <div className="fixed top-2 left-0 right-0 mid:top-4 mid:right-auto z-50 px-1.5 mid:px-0 mid:left-20 py-1 mid:py-0 mid:w-auto">
        <div className="relative flex items-center gap-1.5 mid:gap-3">
          {/* Mobile Logo */}
          <button
            onClick={() => navigate('/')}
            className="mid:hidden flex-shrink-0 flex items-center justify-center w-9 h-9 hover:opacity-80 transition-opacity duration-200 cursor-pointer"
            title="返回主頁"
          >
            <img 
              src="/logo.png" 
              alt="返回主頁" 
              className="w-full h-full object-contain pointer-events-none"
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
              根據職業和物品等級範圍搜索可交易物品的市場數據
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
            disabled={isRecipeSearching || (ilvlMax - ilvlMin + 1 > maxRange)}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              isRecipeSearching || (ilvlMax - ilvlMin + 1 > maxRange)
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed'
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
                navigate(`/item/${item.id}`);
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
