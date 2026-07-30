import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from '../hooks/useHistory';
import { hasRecipe, isCompanyCraftResultItem } from '../services/recipeDatabase';
import { searchItems, searchItemsOCR } from '../services/itemDatabase';
import { addSearchToHistory } from '../utils/searchHistory';
import ItemImage from './ItemImage';
import OCRButton from './OCRButton';

const MAX_SEARCH_CANDIDATES = 80;
const MAX_SEARCH_RESULTS = 12;

async function keepSimulatorItems(items, signal) {
  const candidates = items.slice(0, MAX_SEARCH_CANDIDATES);
  const checks = await Promise.all(
    candidates.map(async (item) => {
      if (signal?.aborted) return null;
      const [craftable, isCompanyCraft] = await Promise.all([
        hasRecipe(item.id),
        isCompanyCraftResultItem(item.id),
      ]);
      return craftable && !isCompanyCraft ? item : null;
    }),
  );

  return checks.filter(Boolean).slice(0, MAX_SEARCH_RESULTS);
}

function ItemOption({ item, label, onSelect }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(item)}
      className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left transition hover:bg-purple-800/40"
    >
      <ItemImage
        itemId={item.id}
        alt={item.nameTW || item.name}
        noContainer
        className="h-8 w-8 shrink-0 object-contain"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-100">
          {item.nameTW || item.name}
        </span>
        <span className="block text-[10px] text-slate-500">{label || `ID: ${item.id}`}</span>
      </span>
    </button>
  );
}

export default function CraftingSimulatorItemNavigator({
  currentItem,
  navigationItems,
  navigationIndex,
  onPrevious,
  onNext,
  onItemSelect,
}) {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownMode, setDropdownMode] = useState(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [compatibleRecentIds, setCompatibleRecentIds] = useState(() => new Set());
  const rootRef = useRef(null);
  const searchAbortRef = useRef(null);
  const { historyItems } = useHistory();

  const sessionHistory = useMemo(() => {
    const seen = new Set();
    return [...navigationItems]
      .reverse()
      .filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .slice(0, 8);
  }, [navigationItems]);

  const recentHistory = useMemo(() => {
    const sessionIds = new Set(sessionHistory.map((item) => item.id));
    return historyItems
      .filter((item) => compatibleRecentIds.has(item.id) && !sessionIds.has(item.id))
      .slice(0, 6);
  }, [compatibleRecentIds, historyItems, sessionHistory]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      historyItems.slice(0, 10).map(async (historyItem) => {
        const [craftable, isCompanyCraft] = await Promise.all([
          hasRecipe(historyItem.id),
          isCompanyCraftResultItem(historyItem.id),
        ]);
        return craftable && !isCompanyCraft ? historyItem.id : null;
      }),
    ).then((ids) => {
      if (!cancelled) {
        setCompatibleRecentIds(new Set(ids.filter(Boolean)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [historyItems]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setDropdownMode(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => () => searchAbortRef.current?.abort(), []);

  const selectItem = (item) => {
    setDropdownMode(null);
    setSearchText('');
    setSearchResults([]);
    setSearchMessage('');
    onItemSelect(item);
  };

  const runSearch = async (rawText, isOCR = false, ocrMeta = undefined) => {
    const query = rawText.trim();
    if (!query) {
      setDropdownMode('history');
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setIsSearching(true);
    setSearchMessage('');
    setDropdownMode('results');

    try {
      let response = isOCR
        ? await searchItemsOCR(query, controller.signal, ocrMeta)
        : await searchItems(query, false, controller.signal);

      if (!isOCR && response.results.length === 0) {
        response = await searchItems(query, true, controller.signal);
      }

      const compatibleItems = await keepSimulatorItems(response.results, controller.signal);
      if (controller.signal.aborted) return;

      setSearchResults(compatibleItems);
      setSearchMessage(
        compatibleItems.length === 0
          ? '找不到支援模擬製作的物品'
          : `找到 ${compatibleItems.length} 個可模擬物品`,
      );

      if (!isOCR) {
        addSearchToHistory(query);
        window.dispatchEvent(new Event('searchHistoryChanged'));
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && !controller.signal.aborted) {
        console.error('[CraftingSimulator] Item search failed:', error);
        setSearchResults([]);
        setSearchMessage('搜尋失敗，請稍後再試');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const handleOCRTextRecognized = (text, meta) => {
    setSearchText(text);
    runSearch(text, true, meta);
  };

  const canGoPrevious = navigationIndex > 0;
  const canGoNext = navigationIndex < navigationItems.length - 1;

  return (
    <div ref={rootRef} className="relative mt-3 flex flex-col gap-2 lg:flex-row lg:items-stretch">
      <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-purple-400/30 bg-slate-800/85 px-3 text-xs font-semibold text-slate-200 transition hover:border-ffxiv-gold/50 hover:text-ffxiv-gold disabled:cursor-not-allowed disabled:opacity-35"
          title="上一個模擬物品"
        >
          <span aria-hidden="true">←</span>
          上一個
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-purple-400/30 bg-slate-800/85 px-3 text-xs font-semibold text-slate-200 transition hover:border-ffxiv-gold/50 hover:text-ffxiv-gold disabled:cursor-not-allowed disabled:opacity-35"
          title="下一個模擬物品"
        >
          下一個
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          onFocus={() => setDropdownMode(searchText.trim() ? 'results' : 'history')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              runSearch(searchText);
            }
          }}
          placeholder={`搜尋可製作物品（目前：${currentItem?.nameTW || currentItem?.name || ''}）`}
          className="h-10 w-full rounded-lg border border-purple-400/30 bg-slate-950/75 pl-9 pr-20 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-ffxiv-gold/60 focus:ring-1 focus:ring-ffxiv-gold/30"
        />
        <button
          type="button"
          onClick={() => runSearch(searchText)}
          disabled={isSearching || !searchText.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 transition hover:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSearching ? '搜尋中' : '搜尋'}
        </button>
      </div>

      <div className="flex gap-2 lg:shrink-0">
        <OCRButton onTextRecognized={handleOCRTextRecognized} disabled={isSearching} />
        <button
          type="button"
          onClick={() => setDropdownMode((previous) => previous === 'history' ? null : 'history')}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 text-xs font-semibold text-purple-200 transition hover:border-ffxiv-gold/50 hover:text-ffxiv-gold"
          aria-expanded={dropdownMode === 'history'}
        >
          <span aria-hidden="true">↻</span>
          歷史
        </button>
      </div>

      {dropdownMode && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(48vh,360px)] overflow-y-auto rounded-xl border border-purple-400/35 bg-slate-950/95 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur">
          {dropdownMode === 'results' ? (
            <>
              <div className="sticky top-0 border-b border-slate-700/70 bg-slate-950 px-3 py-2 text-xs font-semibold text-cyan-200">
                {isSearching ? '正在搜尋可模擬物品…' : searchMessage || '輸入名稱後按 Enter 搜尋'}
              </div>
              {!isSearching && searchResults.map((result) => (
                <ItemOption key={result.id} item={result} onSelect={selectItem} />
              ))}
            </>
          ) : (
            <>
              <div className="border-b border-slate-700/70 px-3 py-2 text-xs font-semibold text-ffxiv-gold">
                本次模擬歷史
              </div>
              {sessionHistory.map((historyItem, index) => (
                <ItemOption
                  key={`session-${historyItem.id}`}
                  item={historyItem}
                  label={index === 0 ? '最近使用' : '本次模擬'}
                  onSelect={selectItem}
                />
              ))}
              {recentHistory.length > 0 && (
                <div className="border-y border-slate-700/70 px-3 py-2 text-xs font-semibold text-slate-400">
                  最近瀏覽
                </div>
              )}
              {recentHistory.map((historyItem) => (
                <ItemOption
                  key={`recent-${historyItem.id}`}
                  item={historyItem}
                  label="物品瀏覽歷史"
                  onSelect={selectItem}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
