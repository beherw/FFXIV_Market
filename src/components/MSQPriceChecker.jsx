// MSQ Equipment Price Checker (主線裝備查價)
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Toast from './Toast';
import ItemTable from './ItemTable';
import SearchBar from './SearchBar';
import ServerSelector from './ServerSelector';
import TopBar from './TopBar';
import { getMarketableItems } from '../services/universalis';
import { getItemById } from '../services/itemDatabase';
import axios from 'axios';
// Only import equipSlotCategoriesData - needed for initial render (8KB)
import equipSlotCategoriesData from '../../teamcraft_git/libs/data/src/lib/json/equip-slot-categories.json';
// Lazy load large data files:
// - ilvlsData (748KB) - loaded when user inputs ilvl
// - equipmentData (6.2MB) - loaded when searching

// Equipment slot category translations to Traditional Chinese
const SLOT_TRANSLATIONS = {
  'MainHand': '主手武器',
  'OffHand': '副手',
  'Head': '頭部',
  'Body': '身體',
  'Gloves': '手套',
  'Waist': '腰部',
  'Legs': '腿部',
  'Feet': '腳部',
  'Ears': '耳環',
  'Neck': '項鍊',
  'Wrists': '手環',
  'Rings': '戒指'
};

export default function MSQPriceChecker({
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
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [ilvlInput, setIlvlInput] = useState('');
  const [ilvlInputValidation, setIlvlInputValidation] = useState(null);
  const ilvlValidationTimeoutRef = useRef(null);
  const isInitializingFromURLRef = useRef(false);
  const lastProcessedURLRef = useRef('');
  
  const [selectedEquipCategory, setSelectedEquipCategory] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [itemVelocities, setItemVelocities] = useState({});
  const [itemAveragePrices, setItemAveragePrices] = useState({});
  const [itemMinListings, setItemMinListings] = useState({});
  const [itemRecentPurchases, setItemRecentPurchases] = useState({});
  const [itemTradability, setItemTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [marketableItems, setMarketableItems] = useState(null);
  
  // Cache for dynamically loaded data
  const ilvlsDataRef = useRef(null);
  const equipmentDataRef = useRef(null);

  // Helper function to load equipmentData dynamically
  const loadEquipmentData = useCallback(async () => {
    if (equipmentDataRef.current) {
      return equipmentDataRef.current;
    }
    const equipmentModule = await import('../../teamcraft_git/libs/data/src/lib/json/equipment.json');
    equipmentDataRef.current = equipmentModule.default;
    return equipmentDataRef.current;
  }, []);

  // Helper function to load ilvlsData dynamically
  const loadIlvlsData = useCallback(async () => {
    if (ilvlsDataRef.current) {
      return ilvlsDataRef.current;
    }
    const ilvlsModule = await import('../../teamcraft_git/libs/data/src/lib/json/ilvls.json');
    ilvlsDataRef.current = ilvlsModule.default;
    return ilvlsDataRef.current;
  }, []);

  // Restore state from URL parameters on mount or when returning from item page
  useEffect(() => {
    if (isInitializingFromURLRef.current) {
      return;
    }

    const currentURLKey = `${location.pathname}?${location.search}`;
    
    // Skip if we've already processed this exact URL
    if (lastProcessedURLRef.current === currentURLKey) {
      return;
    }

    const ilvlParam = searchParams.get('ilvl');
    const categoryParam = searchParams.get('category');

    // If we have URL parameters, restore state
    if (ilvlParam) {
      const numValue = parseInt(ilvlParam, 10);
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 999) {
        isInitializingFromURLRef.current = true;
        setIlvlInput(ilvlParam);
        
        // Load ilvlsData dynamically to validate URL parameter
        loadIlvlsData().then(ilvlsData => {
          const itemsWithIlvl = Object.entries(ilvlsData).filter(
            ([_, ilvl]) => ilvl === numValue
          );
          if (itemsWithIlvl.length > 0) {
            setIlvlInputValidation({
              valid: true,
              message: `找到 ${itemsWithIlvl.length} 個物品`
            });
          }
        });
        
        // Restore category if present
        if (categoryParam) {
          setSelectedEquipCategory(categoryParam);
        } else {
          setSelectedEquipCategory(null);
        }
        
        lastProcessedURLRef.current = currentURLKey;
      }
    } else {
      lastProcessedURLRef.current = currentURLKey;
    }
  }, [location.pathname, location.search, searchParams, loadIlvlsData]);

  // Auto-search when state is restored from URL
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);
  const handleSearchLocalRef = useRef(null);
  
  useEffect(() => {
    const ilvlParam = searchParams.get('ilvl');
    if (ilvlParam && isInitializingFromURLRef.current && ilvlInput === ilvlParam && ilvlInputValidation?.valid && isServerDataLoaded) {
      // State has been restored, now trigger search
      isInitializingFromURLRef.current = false;
      setShouldAutoSearch(true);
    }
  }, [ilvlInput, ilvlInputValidation, searchParams, isServerDataLoaded]);

  // Trigger search when auto-search flag is set
  useEffect(() => {
    if (shouldAutoSearch && ilvlInput && ilvlInputValidation?.valid && isServerDataLoaded && handleSearchLocalRef.current) {
      setShouldAutoSearch(false);
      // Use setTimeout to ensure state is fully updated
      setTimeout(() => {
        if (handleSearchLocalRef.current) {
          handleSearchLocalRef.current();
        }
      }, 100);
    }
  }, [shouldAutoSearch, ilvlInput, ilvlInputValidation, isServerDataLoaded]);

  // Get equipment categories from equip-slot-categories
  const equipmentCategories = useMemo(() => {
    const categories = new Map();
    
    // Iterate through equip-slot-categories to get all unique slot types
    Object.entries(equipSlotCategoriesData).forEach(([categoryId, slots]) => {
      Object.entries(slots).forEach(([slotName, value]) => {
        // Skip SoulCrystal
        if (slotName === 'SoulCrystal') return;
        
        if (value === 1 || value === -1) { // 1 or -1 means this slot is part of this category
          // Group FingerL and FingerR as "Rings"
          const displayName = (slotName === 'FingerL' || slotName === 'FingerR') 
            ? 'Rings' 
            : slotName;
          
          if (!categories.has(displayName)) {
            categories.set(displayName, {
              name: displayName,
              translatedName: SLOT_TRANSLATIONS[displayName] || displayName
            });
          }
        }
      });
    });
    
    // Custom order for equipment slots
    const customOrder = ['MainHand', 'OffHand', 'Head', 'Body', 'Gloves', 'Legs', 'Feet', 'Ears', 'Neck', 'Wrists', 'Rings'];
    
    // Sort by custom order
    return Array.from(categories.values()).sort((a, b) => {
      const indexA = customOrder.indexOf(a.name);
      const indexB = customOrder.indexOf(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, []);

  // Helper function to check if an item's equip slot matches the selected category
  const itemMatchesEquipCategory = useCallback((itemId, selectedCategory, equipmentData) => {
    if (!selectedCategory) return true;
    
    const equipInfo = equipmentData[itemId.toString()];
    if (!equipInfo || equipInfo.equipSlotCategory === undefined) return false;
    
    const categoryId = equipInfo.equipSlotCategory;
    const categorySlots = equipSlotCategoriesData[categoryId.toString()];
    
    if (!categorySlots) return false;
    
    // Check if the selected category matches any slot in this category
    if (selectedCategory === 'Rings') {
      // Check for FingerL or FingerR
      return categorySlots['FingerL'] === 1 || categorySlots['FingerL'] === -1 ||
             categorySlots['FingerR'] === 1 || categorySlots['FingerR'] === -1;
    } else if (selectedCategory === 'SoulCrystal') {
      // Skip SoulCrystal
      return false;
    } else {
      // Regular slot matching
      return categorySlots[selectedCategory] === 1 || categorySlots[selectedCategory] === -1;
    }
  }, []);

  // Helper function to check if an item matches any of the provided categories
  const itemMatchesAnyCategory = useCallback((itemId, equipmentData) => {
    const equipInfo = equipmentData[itemId.toString()];
    if (!equipInfo || equipInfo.equipSlotCategory === undefined) return false;
    
    const categoryId = equipInfo.equipSlotCategory;
    const categorySlots = equipSlotCategoriesData[categoryId.toString()];
    
    if (!categorySlots) return false;
    
    // Check if the item matches any of the categories we provide
    return equipmentCategories.some(category => {
      if (category.name === 'Rings') {
        // Check for FingerL or FingerR
        return categorySlots['FingerL'] === 1 || categorySlots['FingerL'] === -1 ||
               categorySlots['FingerR'] === 1 || categorySlots['FingerR'] === -1;
      } else if (category.name === 'SoulCrystal') {
        // Skip SoulCrystal
        return false;
      } else {
        // Regular slot matching
        return categorySlots[category.name] === 1 || categorySlots[category.name] === -1;
      }
    });
  }, [equipmentCategories]);

  // Handle ilvl input change
  const handleIlvlInputChange = useCallback((value) => {
    setIlvlInput(value);

    // Clear existing timeout
    if (ilvlValidationTimeoutRef.current) {
      clearTimeout(ilvlValidationTimeoutRef.current);
    }

    // Debounce validation after 1 second
    ilvlValidationTimeoutRef.current = setTimeout(async () => {
      const numValue = parseInt(value, 10);

      if (value === '') {
        setIlvlInputValidation(null);
        return;
      }

      if (isNaN(numValue) || numValue < 1 || numValue > 999) {
        setIlvlInputValidation({
          valid: false,
          message: '請輸入1-999之間的數字'
        });
        return;
      }

      // Load ilvlsData dynamically when user inputs
      const ilvlsData = await loadIlvlsData();
      
      // Check if this ilvl exists in the data
      const itemsWithIlvl = Object.entries(ilvlsData).filter(
        ([_, ilvl]) => ilvl === numValue
      );

      if (itemsWithIlvl.length === 0) {
        setIlvlInputValidation({
          valid: false,
          message: '此物品等級沒有物品'
        });
      } else {
        setIlvlInputValidation({
          valid: true,
          message: `找到 ${itemsWithIlvl.length} 個物品`
        });
      }
    }, 1000);
  }, [loadIlvlsData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (ilvlValidationTimeoutRef.current) {
        clearTimeout(ilvlValidationTimeoutRef.current);
      }
    };
  }, []);

  // Perform search
  const handleSearchLocal = useCallback(async () => {
    if (isSearching) return;

    const numValue = parseInt(ilvlInput, 10);
    if (isNaN(numValue) || numValue < 1 || numValue > 999) {
      addToast('請輸入有效的物品等級', 'error');
      return;
    }

    // Update URL parameters to persist state using navigate for better history control
    // Only update if params are different to avoid unnecessary history manipulation
    const currentIlvl = searchParams.get('ilvl');
    const currentCategory = searchParams.get('category');
    const paramsChanged = currentIlvl !== ilvlInput || currentCategory !== (selectedEquipCategory || '');
    
    if (paramsChanged) {
      const newSearchParams = new URLSearchParams();
      newSearchParams.set('ilvl', ilvlInput);
      if (selectedEquipCategory) {
        newSearchParams.set('category', selectedEquipCategory);
      } else {
        newSearchParams.delete('category');
      }
      // Use navigate with replace: true to update current entry without creating new one
      // This ensures proper browser history when navigating back from item pages
      navigate(`/msq-price-checker?${newSearchParams.toString()}`, { replace: true });
    }

    setSearchResults([]);
    setItemVelocities({});
    setItemAveragePrices({});
    setItemMinListings({});
    setItemRecentPurchases({});
    setItemTradability({});

    try {
      // Load required data dynamically
      const [ilvlsData, equipmentData] = await Promise.all([
        loadIlvlsData(),
        loadEquipmentData()
      ]);
      
      // Get all item IDs with matching ilvl
      let itemIds = Object.entries(ilvlsData)
        .filter(([_, ilvl]) => ilvl === numValue)
        .map(([itemId, _]) => parseInt(itemId, 10));

      if (itemIds.length === 0) {
        addToast('未找到該物品等級的物品', 'warning');
        setSearchResults([]);
        return;
      }

      // Filter by equipment category
      // If a specific category is selected, filter by that category
      // If "全部分類" is selected (null), filter to only items that match any of our provided categories
      if (selectedEquipCategory) {
        itemIds = itemIds.filter(itemId => 
          itemMatchesEquipCategory(itemId, selectedEquipCategory, equipmentData)
        );
      } else {
        // When "全部分類" is selected, only show items that match at least one of our provided categories
        itemIds = itemIds.filter(itemId => 
          itemMatchesAnyCategory(itemId, equipmentData)
        );
      }

      if (itemIds.length === 0) {
        addToast('該裝備分類中沒有相符的物品', 'warning');
        return;
      }

      // Filter out non-tradeable items using marketable API (load on demand)
      const marketableSet = await getMarketableItems();
      setMarketableItems(marketableSet); // Set for ItemTable component
      const tradeableItemIds = itemIds.filter(id => marketableSet.has(id));

      if (tradeableItemIds.length === 0) {
        addToast('沒有可交易的物品', 'warning');
        return;
      }

      // Fetch item details for display
      const itemPromises = tradeableItemIds.map(id => getItemById(id));
      const items = (await Promise.all(itemPromises)).filter(item => item !== null);

      if (items.length === 0) {
        addToast('無法獲取物品信息', 'error');
        return;
      }

      // Sort by ilvl品級 and 需求等級
      // equipmentData is already loaded above
      const itemsWithInfo = items.map(item => {
        const equipInfo = equipmentData[item.id.toString()];
        return {
          ...item,
          ilvl品級: numValue,
          需求等級: equipInfo?.level || 0,
          equipSlotCategory: equipInfo?.equipSlotCategory,
          jobs: equipInfo?.jobs || []
        };
      }).sort((a, b) => {
        // Sort by level first, then by name
        if (a.需求等級 !== b.需求等級) {
          return a.需求等級 - b.需求等級;
        }
        return a.name.localeCompare(b.name);
      });

      setSearchResults(itemsWithInfo);

      // Fetch market data in batches (100 items per request)
      setIsLoadingVelocities(true);

      if (!selectedWorld || !selectedServerOption) {
        addToast('請選擇伺服器', 'warning');
        setIsLoadingVelocities(false);
        return;
      }

      const isDCQuery = selectedServerOption === selectedWorld.section;
      const queryTarget = isDCQuery
        ? selectedWorld.section
        : selectedServerOption;

      const batchSize = 100;
      const allVelocities = {};
      const allAveragePrices = {};
      const allMinListings = {};
      const allRecentPurchases = {};
      const allTradability = {};

      // Fetch market data in batches (100 items per request)
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

          batch.forEach(itemId => {
            if (!allTradability.hasOwnProperty(itemId)) {
              allTradability[itemId] = false;
            }
          });
        } catch (error) {
          console.error('Error fetching market data:', error);
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
    } catch (error) {
      console.error('Search error:', error);
      addToast('搜索失敗，請稍後再試', 'error');
      setIsLoadingVelocities(false);
    }
  }, [ilvlInput, selectedEquipCategory, selectedWorld, selectedServerOption, addToast, itemMatchesEquipCategory, itemMatchesAnyCategory, searchParams, setSearchParams, loadIlvlsData, loadEquipmentData]);

  // Store handleSearchLocal in ref for auto-search
  useEffect(() => {
    handleSearchLocalRef.current = handleSearchLocal;
  }, [handleSearchLocal]);

  const maxRange = 50;

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
        activePage="msq-price-checker"
        onMSQPriceCheckerClick={() => {
          setSearchText('');
          navigate('/msq-price-checker');
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
              主線裝備查價
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              主線拿到的箱子可以快速查看市場價格。
            </p>
          </div>

          {/* Search Controls */}
          <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6 mb-6">
            {/* ILVL Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
                物品等級 (ilvl品級)
              </label>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ilvlInput}
                    onChange={(e) => handleIlvlInputChange(e.target.value)}
                    placeholder="輸入物品等級..."
                    className="w-full px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-ffxiv-gold"
                    min="1"
                    max="999"
                  />
                  {ilvlInputValidation && (
                    <div className={`mt-2 text-xs ${ilvlInputValidation.valid ? 'text-green-400' : 'text-yellow-400'}`}>
                      {ilvlInputValidation.message}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Equipment Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-ffxiv-gold mb-2">
                裝備分類 (可選)
              </label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/30 rounded-lg border border-purple-500/20">
                <button
                  onClick={() => setSelectedEquipCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedEquipCategory === null
                      ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                      : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                  }`}
                >
                  全部分類
                </button>
                {equipmentCategories.map(category => {
                  const isSelected = selectedEquipCategory === category.name;
                  return (
                    <button
                      key={category.name}
                      onClick={() => setSelectedEquipCategory(category.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                          : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                      }`}
                    >
                      {category.translatedName}
                    </button>
                  );
                })}
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
              onClick={handleSearchLocal}
              disabled={isSearching || !ilvlInput || !ilvlInputValidation?.valid}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                isSearching || !ilvlInput || !ilvlInputValidation?.valid
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-ffxiv-gold to-yellow-500 text-slate-900 hover:shadow-[0_0_20px_rgba(212,175,55,0.5)]'
              }`}
            >
              {isSearching ? '搜索中...' : '搜索'}
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
                  if (onItemSelect) {
                    // Prepare navigation URL with server param
                    const params = new URLSearchParams();
                    if (selectedServerOption) {
                      params.set('server', selectedServerOption);
                    }
                    const queryString = params.toString();
                    const itemUrl = `/item/${item.id}${queryString ? '?' + queryString : ''}`;
                    
                    // Call onItemSelect which will navigate to /item/${item.id} (without server param)
                    onItemSelect(item);
                    
                    // Immediately replace that navigation with our URL that includes server param
                    // This ensures only one history entry is created
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
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
