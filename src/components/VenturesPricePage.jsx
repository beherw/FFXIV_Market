// 僱員查價 — 依探險類型分頁，每頁依市場價格排序
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import TopBar from './TopBar';
import TaxRatesModal from './TaxRatesModal';
import SearchResultsTable from './SearchResultsTable.jsx';
import { getMarketableItemsByIds } from '../services/universalis';
import { getSimplifiedChineseName } from '../services/itemDatabase';
import { getTwItemsByIds } from '../services/gameData';
import { generateItemUrl } from '../utils/urlSlug';
import VersionFooter from './VersionFooter';
import { fetchAggregatedPricesForItemTable } from '../utils/fetchAggregatedPricesForItemTable';
import {
  loadVenturesData,
  getItemsForCategory,
  COLLECTION_TABS,
} from '../services/venturesDataService';

const LEVEL_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DEFAULT_LEVEL = 100;

const MAIN_TABS = [
  { key: 'collection', label: '筹集委托' },
  { key: 'exploration', label: '探索任務' },
];

export default function VenturesPricePage({
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
  isSearching,
  onTaxRatesClick,
  isTaxRatesModalOpen,
  setIsTaxRatesModalOpen,
  taxRates,
  isLoadingTaxRates,
  taxSelectedWorld,
  taxServerOption,
  onTaxServerOptionChange,
}) {
  const navigate = useNavigate();

  // Venture base data
  const [allTasks, setAllTasks] = useState([]);
  const [explorationItemIds, setExplorationItemIds] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [dataError, setDataError] = useState(null);

  // Pending filter state — what the user has selected but not yet searched
  const [pendingMainTab, setPendingMainTab] = useState('collection');
  const [pendingCollectionTab, setPendingCollectionTab] = useState('hunting');
  const [pendingLevel, setPendingLevel] = useState(DEFAULT_LEVEL);

  // Committed filter state — only updates when user clicks 搜尋
  // null means never searched yet
  const [committedFilters, setCommittedFilters] = useState(null);

  // Market data
  const [searchResults, setSearchResults] = useState([]);
  const [tradeableResults, setTradeableResults] = useState([]);
  const [untradeableResults, setUntradeableResults] = useState([]);
  const [showUntradeable, setShowUntradeable] = useState(false);
  const [allResultIds, setAllResultIds] = useState([]);
  const [itemVelocities, setItemVelocities] = useState({});
  const [itemAveragePrices, setItemAveragePrices] = useState({});
  const [itemMinListings, setItemMinListings] = useState({});
  const [itemRecentPurchases, setItemRecentPurchases] = useState({});
  const [itemTradability, setItemTradability] = useState({});
  const [isLoadingVelocities, setIsLoadingVelocities] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [marketableItems, setMarketableItems] = useState(null);

  const isLoading = isLoadingList || isLoadingVelocities;

  // Load venture data once (base data only, no market data)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadVenturesData();
        if (!cancelled) {
          setAllTasks(data.tasks);
          setExplorationItemIds(data.explorationItemIds);
          setIsDataLoaded(true);
        }
      } catch (e) {
        console.error('[VenturesPricePage] load', e);
        if (!cancelled) {
          setDataError('無法載入僱員探險資料');
          addToast('無法載入僱員探險資料', 'error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [addToast]);

  const tradeableIdsSorted = useMemo(
    () => tradeableResults.map(i => i.id).sort((a, b) => a - b),
    [tradeableResults]
  );
  const tradeableIdsKey = tradeableIdsSorted.join(',');

  const runPriceFetch = useCallback(
    async (idsToQuery, finalIds) => {
      if (!idsToQuery.length || !selectedWorld || !selectedServerOption) {
        setItemVelocities({});
        setItemAveragePrices({});
        setItemMinListings({});
        setItemRecentPurchases({});
        setItemTradability({});
        setIsLoadingVelocities(false);
        return;
      }
      setIsLoadingVelocities(true);
      try {
        const next = await fetchAggregatedPricesForItemTable({
          selectedWorld,
          selectedServerOption,
          itemIdsToQuery: idsToQuery,
          finalItemIds: finalIds,
          addToast,
        });
        setItemVelocities(next.itemVelocities);
        setItemAveragePrices(next.itemAveragePrices);
        setItemMinListings(next.itemMinListings);
        setItemRecentPurchases(next.itemRecentPurchases);
        setItemTradability(next.itemTradability);
      } catch (e) {
        console.error('[VenturesPricePage] price fetch', e);
        addToast('市場資料載入失敗', 'error');
      } finally {
        setIsLoadingVelocities(false);
      }
    },
    [selectedWorld, selectedServerOption, addToast]
  );

  // Build item list only when committedFilters changes (triggered by 搜尋 button)
  useEffect(() => {
    if (!committedFilters || !isDataLoaded) return;
    const { mainTab, collectionTab, level } = committedFilters;
    let cancelled = false;
    (async () => {
      setIsLoadingList(true);
      try {
        let ids;
        if (mainTab === 'exploration') {
          ids = explorationItemIds;
        } else {
          const tabDef = COLLECTION_TABS.find(t => t.key === collectionTab);
          if (!tabDef) { setIsLoadingList(false); return; }
          const itemMap = getItemsForCategory(allTasks, tabDef.category, level);
          ids = Array.from(itemMap.keys());
        }

        if (!ids.length) {
          setAllResultIds([]);
          setTradeableResults([]);
          setUntradeableResults([]);
          setSearchResults([]);
          setMarketableItems(new Set());
          setIsLoadingList(false);
          return;
        }

        const [marketableSet, tw] = await Promise.all([
          getMarketableItemsByIds(ids),
          getTwItemsByIds(ids),
        ]);
        if (cancelled) return;

        const items = ids.map(id => {
          const row = tw[id];
          const name = row?.tw?.replace(/^["']|["']$/g, '').trim() || `Item ${id}`;
          return { id, name, nameTW: name, searchLanguageName: null, description: '', itemLevel: '', shopPrice: '', inShop: false };
        });

        const tradeable = items.filter(i => marketableSet.has(i.id));
        const untradeable = items.filter(i => !marketableSet.has(i.id));
        setAllResultIds(ids);
        setMarketableItems(marketableSet);
        setTradeableResults(tradeable);
        setUntradeableResults(untradeable);
        setShowUntradeable(false);
        setSearchResults(tradeable.length > 0 ? tradeable : untradeable);
      } catch (e) {
        console.error('[VenturesPricePage] list build', e);
        if (!cancelled) addToast('無法建立物品清單', 'error');
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, [committedFilters, isDataLoaded, allTasks, explorationItemIds, addToast]);

  // Fetch prices when item list finishes building
  useEffect(() => {
    if (isLoadingList || !allResultIds.length) return;
    if (!selectedWorld || !selectedServerOption) return;
    runPriceFetch(tradeableIdsSorted, allResultIds);
  }, [isLoadingList, allResultIds, tradeableIdsKey, selectedWorld, selectedServerOption, runPriceFetch, tradeableIdsSorted]);

  // Toggle untradeable
  useEffect(() => {
    const items = showUntradeable ? untradeableResults : (tradeableResults.length > 0 ? tradeableResults : untradeableResults);
    if (tradeableResults.length > 0 || untradeableResults.length > 0) setSearchResults(items);
  }, [showUntradeable, tradeableResults, untradeableResults]);

  const handleSearch = () => {
    if (isLoading) return;
    setCommittedFilters({ mainTab: pendingMainTab, collectionTab: pendingCollectionTab, level: pendingLevel });
  };

  const activeCollectionTab = COLLECTION_TABS.find(t => t.key === (committedFilters?.collectionTab ?? pendingCollectionTab));

  const tableTitleSuffix = useMemo(() => {
    if (!allResultIds.length) return null;
    if (committedFilters?.mainTab === 'exploration') return `，共 ${allResultIds.length} 件`;
    return `，等級 ≤ ${committedFilters?.level ?? DEFAULT_LEVEL} 共 ${allResultIds.length} 件`;
  }, [allResultIds.length, committedFilters]);

  const handleItemSelect = (item) => {
    if (!onItemSelect) return;
    const params = new URLSearchParams();
    if (selectedServerOption) params.set('server', selectedServerOption);
    const qs = params.toString();
    const itemUrlPath = generateItemUrl(item.id, item.nameTW || item.name || 'item');
    const itemUrl = `${itemUrlPath}${qs ? `?${qs}` : ''}`;
    onItemSelect(item);
    requestAnimationFrame(() => requestAnimationFrame(() => navigate(itemUrl, { replace: true })));
  };

  const filterDisabled = isLoading;

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
        activePage="ventures"
        onCraftingInspirationClick={() => { setSearchText(''); navigate('/crafting-inspiration'); }}
        onMSQPriceCheckerClick={() => { setSearchText(''); navigate('/msq-price-checker'); }}
        onAdvancedSearchClick={() => { setSearchText(''); navigate('/advanced-search'); }}
        onTaxRatesClick={onTaxRatesClick}
      />

      <div
        className="fixed right-2 mid:right-4 left-2 mid:left-auto z-50 space-y-2 max-w-sm mid:max-w-none"
        style={{ top: 'var(--topbar-toast-offset, 92px)' }}
      >
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      <div className="pb-8" style={{ paddingTop: 'var(--topbar-content-offset, 96px)' }}>
        <div className="max-w-7xl mx-auto px-4">

          {/* Page header */}
          <div className="mb-5">
            <h1 className="text-3xl sm:text-4xl font-bold text-ffxiv-gold mb-1">僱員查價</h1>
            <p className="text-gray-400 text-sm">依探險類型篩選僱員可取得的物品，以市場最低掛牌價排序。</p>
          </div>

          {dataError && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-amber-200 text-sm">
              {dataError}
            </div>
          )}

          {/* Main tabs */}
          <div className="flex gap-1 mb-4 border-b border-slate-700/60">
            {MAIN_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => !filterDisabled && setPendingMainTab(tab.key)}
                disabled={filterDisabled}
                className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
                  pendingMainTab === tab.key
                    ? 'border-ffxiv-gold text-ffxiv-gold bg-slate-800/40'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                } ${filterDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Collection sub-tabs */}
          {pendingMainTab === 'collection' && (
            <div className="flex flex-wrap gap-2 mb-4">
              {COLLECTION_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => !filterDisabled && setPendingCollectionTab(tab.key)}
                  disabled={filterDisabled}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    pendingCollectionTab === tab.key
                      ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                      : 'bg-slate-800/50 text-gray-300 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                  } ${filterDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Level filter + search button — collection only */}
          {pendingMainTab === 'collection' && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className={`text-xs shrink-0 ${filterDisabled ? 'text-gray-600' : 'text-gray-400'}`}>僱員等級上限</span>
              {LEVEL_OPTIONS.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => !filterDisabled && setPendingLevel(lvl)}
                  disabled={filterDisabled}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    pendingLevel === lvl
                      ? 'bg-ffxiv-gold text-slate-900 border-2 border-ffxiv-gold'
                      : 'bg-slate-800/50 text-gray-400 border border-purple-500/30 hover:bg-purple-800/40 hover:border-purple-400/50'
                  } ${filterDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Lv.{lvl}
                </button>
              ))}
              <button
                onClick={handleSearch}
                disabled={filterDisabled || !isDataLoaded}
                className={`ml-2 px-6 py-1 rounded-lg font-medium text-sm transition-all ${
                  filterDisabled || !isDataLoaded
                    ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                    : 'bg-ffxiv-gold text-slate-900 hover:brightness-110 active:scale-95'
                }`}
              >
                {isLoading ? '載入中…' : '搜尋'}
              </button>
            </div>
          )}

          {/* Exploration info banner + search button */}
          {pendingMainTab === 'exploration' && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 rounded-lg border border-blue-500/20 bg-blue-900/10 px-4 py-2.5 text-blue-300 text-xs">
                探索任務（平地、山岳、森林、水岸、自由探索）的任務等級資料尚未收錄，以下顯示所有探索可取得的物品，不支援等級篩選。
              </div>
              <button
                onClick={handleSearch}
                disabled={filterDisabled || !isDataLoaded}
                className={`shrink-0 px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                  filterDisabled || !isDataLoaded
                    ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                    : 'bg-ffxiv-gold text-slate-900 hover:brightness-110 active:scale-95'
                }`}
              >
                {isLoading ? '載入中…' : '搜尋'}
              </button>
            </div>
          )}

          {/* Loading spinner */}
          {isLoading && (
            <div className="flex justify-center items-center min-h-[240px]">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold" />
            </div>
          )}

          {/* Initial prompt — never searched yet */}
          {!isLoading && committedFilters === null && !dataError && (
            <div className="flex flex-col justify-center items-center min-h-[200px] gap-3 text-gray-500 text-sm">
              <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              選擇篩選條件後點選「搜尋」以載入物品與市場價格
            </div>
          )}

          {/* Results table */}
          {!isLoading && committedFilters !== null && searchResults.length > 0 && (
            <SearchResultsTable
              items={searchResults}
              selectedWorld={selectedWorld}
              selectedServerOption={selectedServerOption}
              onWorldChange={onWorldChange}
              onServerOptionChange={onServerOptionChange}
              datacenters={datacenters}
              worlds={worlds}
              serverOptions={serverOptions}
              isServerSelectorDisabled={isLoadingVelocities}
              marketableItems={marketableItems}
              itemVelocities={itemVelocities}
              itemAveragePrices={itemAveragePrices}
              itemMinListings={itemMinListings}
              itemRecentPurchases={itemRecentPurchases}
              itemTradability={itemTradability}
              isLoadingVelocities={isLoadingVelocities}
              showLoadingIndicator={isLoadingVelocities}
              averagePriceHeader={selectedServerOption === selectedWorld?.section ? '全服平均價格' : '平均價格'}
              getSimplifiedChineseName={getSimplifiedChineseName}
              addToast={addToast}
              title={committedFilters.mainTab === 'exploration' ? '探索任務物品' : (activeCollectionTab?.label ?? '筹集委托物品')}
              titleSuffix={tableTitleSuffix}
              untradeableCount={untradeableResults.length}
              tradeableCount={tradeableResults.length}
              onToggleUntradeable={newValue => setShowUntradeable(newValue)}
              isShowUntradeable={showUntradeable}
              onSelect={handleItemSelect}
              openInNewTab={false}
            />
          )}

          {/* Empty state after search */}
          {!isLoading && committedFilters !== null && searchResults.length === 0 && !dataError && (
            <div className="flex justify-center items-center min-h-[160px] text-gray-500 text-sm">
              此類型目前沒有物品資料
            </div>
          )}
        </div>

        <VersionFooter />
      </div>

      <TaxRatesModal
        isOpen={isTaxRatesModalOpen}
        onClose={() => setIsTaxRatesModalOpen(false)}
        taxRates={taxRates}
        worlds={worlds}
        isLoading={isLoadingTaxRates}
        selectedWorld={taxSelectedWorld || selectedWorld}
        selectedServerOption={taxServerOption ?? selectedServerOption}
        onServerOptionChange={onTaxServerOptionChange || onServerOptionChange}
      />
    </div>
  );
}
