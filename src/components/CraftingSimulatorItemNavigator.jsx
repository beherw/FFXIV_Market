import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from '../hooks/useHistory';
import { hasRecipe, isCompanyCraftResultItem } from '../services/recipeDatabase';
import { getItemById, searchItems, searchItemsOCR } from '../services/itemDatabase';
import { loadLunarCraftingData } from '../services/lunarCraftingDatabase';
import { getCosmicMissionRank } from '../utils/cosmicMission';
import { addSearchToHistory } from '../utils/searchHistory';
import ItemImage from './ItemImage';
import OCRButton from './OCRButton';

const MAX_SEARCH_CANDIDATES = 80;
const MAX_SEARCH_RESULTS = 12;
const CRAFTING_JOBS = [
  [8, '刻木匠'],
  [9, '鍛鐵匠'],
  [10, '鑄甲匠'],
  [11, '金工師'],
  [12, '製革匠'],
  [13, '裁縫匠'],
  [14, '煉金術士'],
  [15, '烹調師'],
];
const RANK_LABELS = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'EX', 6: 'EX+' };

function getRankOrder(currentRank) {
  const standardRanks = ['A', 'B', 'C', 'D'];
  if (standardRanks.includes(currentRank)) {
    const index = standardRanks.indexOf(currentRank);
    return [...standardRanks.slice(index), ...standardRanks.slice(0, index), 'EX', 'EX+'];
  }
  if (currentRank === 'EX') return ['EX', 'EX+', 'A', 'B', 'C', 'D'];
  if (currentRank === 'EX+') return ['EX+', 'EX', 'A', 'B', 'C', 'D'];
  return ['A', 'B', 'C', 'D', 'EX', 'EX+'];
}

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
  currentRecipe,
  availableRecipes = [],
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
  const [lunarData, setLunarData] = useState(null);
  const [lunarItems, setLunarItems] = useState([]);
  const [selectedLunarJobs, setSelectedLunarJobs] = useState([]);
  const [selectedLunarRanks, setSelectedLunarRanks] = useState([]);
  const [isLoadingLunarItems, setIsLoadingLunarItems] = useState(false);
  const rootRef = useRef(null);
  const searchAbortRef = useRef(null);
  const lunarFiltersInitializedRef = useRef(false);
  const { historyItems } = useHistory();
  const contextRecipe = currentRecipe || availableRecipes[0] || null;
  const currentJob = Number(contextRecipe?.job) || null;
  const currentRank = getCosmicMissionRank(contextRecipe);
  const currentLunarEntry = useMemo(
    () => lunarData?.items?.find((entry) => Number(entry.id) === Number(currentItem?.id)) || null,
    [currentItem?.id, lunarData],
  );
  const rankOrder = useMemo(() => getRankOrder(currentRank), [currentRank]);

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

  useEffect(() => {
    let cancelled = false;
    loadLunarCraftingData()
      .then((data) => {
        if (!cancelled) setLunarData(data);
      })
      .catch((error) => console.error('[CraftingSimulator] Lunar crafting index failed:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (dropdownMode !== 'lunar' || !lunarData) return undefined;
    let cancelled = false;
    setIsLoadingLunarItems(true);

    const selectedJobs = new Set(selectedLunarJobs);
    const candidates = lunarData.items.filter((entry) => (
      entry.jobs.some((job) => selectedJobs.has(Number(job)))
    ));

    Promise.all(candidates.map(async (entry) => ({
      ...entry,
      item: await getItemById(Number(entry.id)) || {
        id: Number(entry.id),
        name: entry.name,
        nameTW: entry.name,
      },
    }))).then((items) => {
      if (!cancelled) {
        setLunarItems(items);
        setIsLoadingLunarItems(false);
      }
    }).catch((error) => {
      if (!cancelled) {
        console.error('[CraftingSimulator] Lunar item names failed:', error);
        setLunarItems([]);
        setIsLoadingLunarItems(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dropdownMode, lunarData, selectedLunarJobs]);

  const selectItem = (item) => {
    setDropdownMode(null);
    setSearchText('');
    setSearchResults([]);
    setSearchMessage('');
    onItemSelect(item);
  };

  const toggleLunarDropdown = () => {
    if (dropdownMode === 'lunar') {
      setDropdownMode(null);
      return;
    }
    if (!lunarFiltersInitializedRef.current) {
      const defaultJob = currentJob && currentLunarEntry?.jobs.includes(currentJob)
        ? currentJob
        : Number(currentLunarEntry?.jobs?.[0]);
      setSelectedLunarJobs(defaultJob ? [defaultJob] : []);
      setSelectedLunarRanks(rankOrder);
      lunarFiltersInitializedRef.current = true;
    }
    setDropdownMode('lunar');
  };

  const toggleLunarJob = (jobId) => {
    setSelectedLunarJobs((previous) => (
      previous.includes(jobId)
        ? previous.filter((candidate) => candidate !== jobId)
        : [...previous, jobId]
    ));
  };

  const toggleLunarRank = (rank) => {
    setSelectedLunarRanks((previous) => (
      previous.includes(rank)
        ? previous.filter((candidate) => candidate !== rank)
        : [...previous, rank]
    ));
  };

  const groupedLunarItems = useMemo(() => {
    const selectedJobs = new Set(selectedLunarJobs);
    const groups = new Map(rankOrder.map((rank) => [rank, []]));

    lunarItems.forEach((entry) => {
      const matchingJobs = entry.jobs.map(Number).filter((job) => selectedJobs.has(job));
      const matchingRanks = matchingJobs
        .flatMap((job) => entry.ranksByJob?.[job] || [])
        .filter((value) => selectedLunarRanks.includes(RANK_LABELS[value]));
      const primaryRank = rankOrder.find((rank) => matchingRanks.some((value) => RANK_LABELS[value] === rank));
      if (primaryRank) groups.get(primaryRank).push({ ...entry, matchingJobs, primaryRank });
    });

    groups.forEach((items) => items.sort((left, right) => (
      (left.item.nameTW || left.item.name).localeCompare(right.item.nameTW || right.item.name, 'zh-Hant')
    )));
    return groups;
  }, [lunarItems, rankOrder, selectedLunarJobs, selectedLunarRanks]);

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
        {currentLunarEntry && (
          <button
            type="button"
            onClick={toggleLunarDropdown}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-300/35 bg-indigo-500/10 px-3 text-xs font-semibold text-indigo-100 transition hover:border-ffxiv-gold/60 hover:text-ffxiv-gold"
            aria-expanded={dropdownMode === 'lunar'}
            title="依職業瀏覽月球探索製作物品"
          >
            <span aria-hidden="true" className="text-base">☾</span>
            月球探索物品
          </button>
        )}
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
          ) : dropdownMode === 'lunar' ? (
            <>
              <div className="border-b border-indigo-300/25 bg-slate-950 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-indigo-100">
                    選擇月球探索製作職業
                  </span>
                  <span className="text-[10px] text-slate-500">可複選職業</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CRAFTING_JOBS.map(([jobId, jobName]) => {
                    const selected = selectedLunarJobs.includes(jobId);
                    return (
                      <button
                        key={jobId}
                        type="button"
                        onClick={() => toggleLunarJob(jobId)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${selected
                          ? 'border-ffxiv-gold/70 bg-amber-500/15 text-ffxiv-gold'
                          : 'border-slate-600 bg-slate-900 text-slate-400 hover:border-indigo-300/50 hover:text-indigo-100'}`}
                        aria-pressed={selected}
                      >
                        {jobName}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-indigo-300/15 pt-2">
                  <div className="mb-1.5 text-[10px] font-semibold text-slate-500">等級篩選（可複選）</div>
                  <div className="flex flex-wrap gap-1.5">
                    {rankOrder.map((rank) => {
                      const selected = selectedLunarRanks.includes(rank);
                      return (
                        <button
                          key={rank}
                          type="button"
                          onClick={() => toggleLunarRank(rank)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${selected
                            ? 'border-cyan-300/70 bg-cyan-500/15 text-cyan-100'
                            : 'border-slate-600 bg-slate-900 text-slate-400 hover:border-cyan-300/50 hover:text-cyan-100'}`}
                          aria-pressed={selected}
                        >
                          {rank}級
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {selectedLunarJobs.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-400">請至少選擇一個製作職業</div>
              ) : selectedLunarRanks.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-400">請至少選擇一個等級</div>
              ) : isLoadingLunarItems ? (
                <div className="px-3 py-8 text-center text-sm text-slate-400">正在整理月球探索物品…</div>
              ) : (
                rankOrder.map((rank) => {
                  const entries = groupedLunarItems.get(rank) || [];
                  if (!entries.length) return null;
                  return (
                    <div key={rank}>
                      <div className="border-y border-slate-700/70 bg-slate-900/95 px-3 py-1.5 text-xs font-bold text-indigo-200">
                        {rank}級・{entries.length} 項
                      </div>
                      {entries.map((entry) => {
                        const preferredRank = rank;
                        const preferredJob = entry.matchingJobs.find((job) => (
                          (entry.ranksByJob?.[job] || []).some((value) => RANK_LABELS[value] === preferredRank)
                        )) || entry.matchingJobs[0];
                        const jobNames = entry.matchingJobs
                          .map((job) => CRAFTING_JOBS.find(([id]) => id === job)?.[1])
                          .filter(Boolean)
                          .join('、');
                        return (
                          <ItemOption
                            key={`${rank}-${entry.id}`}
                            item={entry.item}
                            label={`${rank}級｜${jobNames}`}
                            onSelect={(item) => {
                              setDropdownMode(null);
                              onItemSelect(item, { preferredJob, preferredRank });
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })
              )}
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
