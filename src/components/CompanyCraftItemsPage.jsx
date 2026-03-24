// 部隊合建物品一覽 — 使用與主搜尋相同的 SearchResultsTable / ItemTable
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';
import TopBar from './TopBar';
import TaxRatesModal from './TaxRatesModal';
import SearchResultsTable from './SearchResultsTable.jsx';
import { getMarketableItemsByIds } from '../services/universalis';
import { getSimplifiedChineseName } from '../services/itemDatabase';
import { getAllCompanyCraftResultItemIds } from '../services/recipeDatabase';
import { getTwItemsByIds } from '../services/gameData';
import { generateItemUrl } from '../utils/urlSlug';
import VersionFooter from './VersionFooter';
import { fetchAggregatedPricesForItemTable } from '../utils/fetchAggregatedPricesForItemTable';

export default function CompanyCraftItemsPage({
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
  const [listError, setListError] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
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
  const [marketableItems, setMarketableItems] = useState(null);

  const tradeableIdsSorted = useMemo(
    () => tradeableResults.map((i) => i.id).sort((a, b) => a - b),
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
        console.error('[CompanyCraftItemsPage] price fetch', e);
        addToast('市場資料載入失敗', 'error');
      } finally {
        setIsLoadingVelocities(false);
      }
    },
    [selectedWorld, selectedServerOption, addToast]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingList(true);
      setListError(null);
      try {
        const ids = await getAllCompanyCraftResultItemIds();
        if (cancelled) return;
        if (!ids.length) {
          setAllResultIds([]);
          setTradeableResults([]);
          setUntradeableResults([]);
          setSearchResults([]);
          setMarketableItems(new Set());
          setListError('目前配方資料中沒有部隊合建物品（請確認已執行 build-recipe 並含 CSV 合併）');
          return;
        }
        const marketableSet = await getMarketableItemsByIds(ids);
        const tw = await getTwItemsByIds(ids);
        const items = ids.map((id) => {
          const row = tw[id];
          const name = row?.tw?.replace(/^["']|["']$/g, '').trim() || `Item ${id}`;
          return {
            id,
            name,
            nameTW: name,
            searchLanguageName: null,
            description: '',
            itemLevel: '',
            shopPrice: '',
            inShop: false,
          };
        });
        const tradeable = items.filter((i) => marketableSet.has(i.id));
        const untradeable = items.filter((i) => !marketableSet.has(i.id));
        setAllResultIds(ids);
        setMarketableItems(marketableSet);
        setTradeableResults(tradeable);
        setUntradeableResults(untradeable);
        setShowUntradeable(false);
        setSearchResults(tradeable.length > 0 ? tradeable : untradeable);
      } catch (e) {
        console.error('[CompanyCraftItemsPage] list load', e);
        if (!cancelled) {
          setListError('無法載入部隊合建清單');
          addToast('無法載入部隊合建清單', 'error');
        }
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  useEffect(() => {
    if (isLoadingList || !allResultIds.length) return;
    if (!selectedWorld || !selectedServerOption) return;
    runPriceFetch(tradeableIdsSorted, allResultIds);
  }, [
    isLoadingList,
    allResultIds,
    tradeableIdsKey,
    selectedWorld,
    selectedServerOption,
    runPriceFetch,
    tradeableIdsSorted,
  ]);

  useEffect(() => {
    const itemsToDisplay = showUntradeable
      ? untradeableResults
      : tradeableResults.length > 0
        ? tradeableResults
        : untradeableResults;
    if (tradeableResults.length > 0 || untradeableResults.length > 0) {
      setSearchResults(itemsToDisplay);
    }
  }, [showUntradeable, tradeableResults, untradeableResults]);

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
        activePage="company-craft"
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
        onTaxRatesClick={onTaxRatesClick}
      />

      <div
        className="fixed right-2 mid:right-4 left-2 mid:left-auto z-50 space-y-2 max-w-sm mid:max-w-none"
        style={{ top: 'var(--topbar-toast-offset, 92px)' }}
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      <div className="pb-8" style={{ paddingTop: 'var(--topbar-content-offset, 96px)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-ffxiv-gold mb-2">部隊合建物品</h1>
            <p className="text-gray-400 text-sm sm:text-base">
              以下為資料庫中標記為部隊工坊產物的物品，可使用與搜尋結果相同的表格檢視市場價格。
            </p>
          </div>

          {listError && (
            <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-amber-200 text-sm">
              {listError}
            </div>
          )}

          {isLoadingList && (
            <div className="flex justify-center items-center min-h-[240px]">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-ffxiv-gold" />
            </div>
          )}

          {!isLoadingList && searchResults.length > 0 && (
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
              title="部隊合建物品"
              titleSuffix={allResultIds.length ? `，資料庫共 ${allResultIds.length} 個` : null}
              untradeableCount={untradeableResults.length}
              tradeableCount={tradeableResults.length}
              onToggleUntradeable={(newValue) => setShowUntradeable(newValue)}
              isShowUntradeable={showUntradeable}
              onSelect={(item) => {
                if (onItemSelect) {
                  const params = new URLSearchParams();
                  if (selectedServerOption) {
                    params.set('server', selectedServerOption);
                  }
                  const queryString = params.toString();
                  const itemUrlPath = generateItemUrl(item.id, item.nameTW || item.name || 'item');
                  const itemUrl = `${itemUrlPath}${queryString ? `?${queryString}` : ''}`;
                  onItemSelect(item);
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      navigate(itemUrl, { replace: true });
                    });
                  });
                }
              }}
              openInNewTab={false}
            />
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
