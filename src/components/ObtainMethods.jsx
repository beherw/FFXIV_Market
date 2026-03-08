// Component to display item acquisition methods (取得方式)
// Uses obtainableDataService (msgpack) for all lookup data - load only domains needed per item
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getItemSources, DataType, getTypeIdFromString } from '../services/extractsService';
import { getItemById } from '../services/itemDatabase';
import { extractIdsFromSources } from '../utils/extractIdsFromSources';
import { getHuijiWikiUrlForItem } from '../utils/wikiUtils';
import { getPlaceName as getPlaceNameUtil, getPlaceNameWithFallback } from '../utils/placeUtils';
import { generateItemUrl } from '../utils/urlSlug';
import { loadDataForRequiredIds, loadPlaceDataForZoneIds, getEmptyLoadedData } from '../services/obtainableDataService';
import { getChineseName } from '../constants/dataTypes';
import { FALLBACK_MESSAGE } from '../constants/obtainableConstants';
import * as obtainableHelpers from '../utils/obtainableHelpers';
import { filterAndSortSources } from '../utils/obtainableSourceUtils';
import {
  buildDropObjectsFromDropSources,
  applyDropsToProcessedSources,
  convertIslandPastureToFates,
  filterInvalidFates,
  mergeFateSourcesFromTable,
  collectAllZoneIds
} from '../utils/obtainableSourceProcessing';
import { getFateSourcesByItemId } from '../services/fatesData';
import { getTwItemsByIds } from '../services/itemsDatabaseMsgpack';
// Small static files - keep as imports (small size)
import twNpcTitlesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-npc-titles.json';
import twJobAbbrData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';
import twJobCategoriesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-categories.json';
import twMobsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-mobs.json';
// tw-places / places: loaded from data/places.msgpack via loadPlaceDataForZoneIds
// tw-quests / tw-leves / retainer-tasks - lazy loaded via loadJsonOnce
import dropSourcesData from '../../teamcraft_git/libs/data/src/lib/json/drop-sources.json';
import monstersData from '../../teamcraft_git/libs/data/src/lib/json/monsters.json';
import { loadJsonOnce } from '../utils/lazyJsonLoader';
import { getEorzeaTime, formatEorzeaDuration, formatEorzeaTimeOfDay, getLimitedNodeTiming } from '../utils/eorzeaTimeUtils';

import MapModal from './MapModal';
import ItemImage from './ItemImage';

// Module-level cache for ObtainMethods data - persists across component mounts/unmounts
// Cache structure: { itemId: { sources: [], loadedData: {}, dataLoaded: boolean, timestamp: number } }
const obtainMethodsCache = {};

// Cache expiration time: 1 hour (3600000 ms) - data rarely changes
const CACHE_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Get cached data for an item, or null if not cached or expired
 */
function getCachedObtainMethodsData(itemId) {
  if (!itemId) return null;
  
  const cached = obtainMethodsCache[itemId];
  if (!cached) return null;
  
  // Check if cache is expired
  const now = Date.now();
  if (now - cached.timestamp > CACHE_EXPIRY_MS) {
    delete obtainMethodsCache[itemId];
    return null;
  }
  
  return cached;
}

/**
 * Store data in cache (deep clones to prevent mutations)
 */
function setCachedObtainMethodsData(itemId, sources, loadedData) {
  if (!itemId) return;
  
  // Deep clone loadedData to prevent mutations from affecting cache
  let clonedLoadedData;
  try {
    clonedLoadedData = structuredClone(loadedData);
  } catch (e) {
    // Fallback to JSON parse/stringify for deep copy
    clonedLoadedData = JSON.parse(JSON.stringify(loadedData));
  }
  
  // Clone sources array to prevent mutations
  const clonedSources = sources.map(source => {
    // Clone each source object
    try {
      return structuredClone(source);
    } catch (e) {
      return JSON.parse(JSON.stringify(source));
    }
  });
  
  obtainMethodsCache[itemId] = {
    sources: clonedSources,
    loadedData: clonedLoadedData,
    dataLoaded: true,
    timestamp: Date.now()
  };
}

export default function ObtainMethods({ itemId, onItemClick, onExpandCraftingTree, isCraftingTreeExpanded = false, onLoadingChange, onSourcesChange }) {
  
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const eorzeaTime = useMemo(() => getEorzeaTime(clockTick), [clockTick]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setClockTick(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);
  
  // Notify parent component when loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(loading);
    }
  }, [loading, onLoadingChange]);

  // Place data (twPlaces, places) is loaded per-item via loadPlaceDataForZoneIds from data/places.msgpack
  const [mapModal, setMapModal] = useState({ isOpen: false, zoneName: '', x: 0, y: 0, npcName: '', mapId: null });
  const [hoveredAchievement, setHoveredAchievement] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [filteredMethodType, setFilteredMethodType] = useState(null); // null = show all
  // Track current itemId to prevent showing stale data during redirects
  // Initialize ref with current itemId to prevent showing stale data on first render
  const currentItemIdRef = useRef(itemId);
  // Track previous itemId to detect changes during render (before useEffect runs)
  const prevItemIdRef = useRef(itemId);
  // Track itemId for useLayoutEffect - this ref is NOT updated during render
  const layoutEffectPrevItemIdRef = useRef(itemId);
  // When set, we cleared sources for this item but haven't received final data yet - don't notify parent with [] to avoid disabling the button
  const loadClearedSourcesForItemIdRef = useRef(null);
  // Use ref to store latest loadedData so renderSource can access it immediately
  // This avoids the issue where renderSource uses stale loadedData state due to async state updates
  const loadedDataRef = useRef(getEmptyLoadedData());
  
  // Sync refs with itemId prop on every render to catch prop changes before useEffect runs
  // This ensures we show loading state immediately when itemId changes, even before useEffect executes
  // DO NOT call setState here - it will cause infinite loops. Just update refs.
  const itemIdChanged = prevItemIdRef.current !== itemId;
  if (itemIdChanged) {
    // ItemId changed - update both refs immediately to prevent showing stale data
    prevItemIdRef.current = itemId;
    currentItemIdRef.current = itemId; // Update immediately, not just in useEffect
  }
  
  // Use useLayoutEffect to synchronously reset state when itemId changes
  // This runs before browser paint, ensuring we never show stale data
  useLayoutEffect(() => {
    // Check if itemId actually changed by comparing with layoutEffectPrevItemIdRef
    // This ref is NOT updated during render, so we can detect changes here
    if (layoutEffectPrevItemIdRef.current !== itemId && itemId) {
      // ItemId changed - reset state synchronously before browser paint
      // This prevents showing stale data during redirects or browser back navigation
      setLoading(true);
      setDataLoaded(false);
      setSources([]);
      // CRITICAL: Also reset loadedData to prevent stale data from being used in renderSource
      // This is especially important for TRADE_SOURCES which relies on loadedData.twItems for currency names
      // Without resetting loadedData, getCurrencyName() may return null because it looks up currency names
      // from loadedData.twItems, which might still contain old data from previous item
      const emptyLoadedData = getEmptyLoadedData({
        twPlaces: loadedDataRef.current.twPlaces || {},
        places: loadedDataRef.current.places || {},
        retainerTasksById: loadedDataRef.current.retainerTasksById || {}
      });
      setLoadedData(emptyLoadedData);
      // Also update ref to ensure renderSource can access the reset data immediately
      // OPTIMIZED: Direct assignment is fine for empty object (no deep copy needed)
      loadedDataRef.current = emptyLoadedData;
      // Update ref after resetting state
      layoutEffectPrevItemIdRef.current = itemId;
    }
  }, [itemId]);
  
  // Data loaded from obtainableDataService - organized by type for efficient access
  const [loadedData, setLoadedData] = useState(() => getEmptyLoadedData());
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [wikiUrl, setWikiUrl] = useState(null); // Store Wiki URL for activity content notice
  const [twQuestsStaticData, setTwQuestsStaticData] = useState(null); // Lazy-loaded tw-quests.json data
  const [twLevesStaticData, setTwLevesStaticData] = useState(null); // Lazy-loaded tw-leves.json data
  const [isLoadingQuestsData, setIsLoadingQuestsData] = useState(false); // Track loading state for React
  const [isLoadingLevesData, setIsLoadingLevesData] = useState(false); // Track loading state for React
  const [isLoadingRetainerTasksData, setIsLoadingRetainerTasksData] = useState(false); // Track loading state for retainer tasks
  const [leveNpcsLoaded, setLeveNpcsLoaded] = useState(false); // Track if NPC data for leves has been loaded
  const [methodHeights, setMethodHeights] = useState([]); // 各 method 卡片高度，用於排序（矮的排最後）
  const methodCardsContainerRef = useRef(null);

  /** Centralized card width: when there are 1–3 method types, cards flex to fill space; otherwise fixed 280px. Used by all method types. */
  const getMethodCardLayoutClass = useCallback((totalMethodCards) => {
    return totalMethodCards <= 3 ? 'min-w-[280px] flex-1 w-full' : 'w-[280px] flex-grow-0';
  }, []);

  /** Inner grid: equal-width columns (no stretch on last row). w-full min-w-0 so card content fills and extends in 1–3 method layout. */
  const INNER_GRID_CLASS_FLEX = 'w-full min-w-0 grid gap-2 mt-2 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]';
  const INNER_GRID_CLASS_FLEX_NO_MT = 'w-full min-w-0 grid gap-2 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]';
  /** Inner item: fill grid cell with same width as others (min-w-0 for overflow). When 4+ method cards, w-full. */
  const getInnerItemLayoutClass = useCallback((totalMethodCards) => {
    return totalMethodCards <= 3 ? 'min-w-0' : 'w-full min-w-0';
  }, []);

  /** Fixed width for items inside a single method card when totalMethodCards > 3 (e.g. treasure buttons, instance cards). */
  const INNER_ITEM_LAYOUT_CLASS = 'min-w-[280px] w-[280px] flex-grow-0';

  // Lazy load tw-quests.json and tw-leves.json when quests are present but names are missing
  useEffect(() => {
    if (!sources || sources.length === 0 || !dataLoaded) {
      return;
    }
    
    // Check if we have any quest sources that need static data
    const questSources = sources.filter(s => s.type === DataType.QUESTS);
    if (questSources.length === 0) {
      return;
    }
    
    // Extract all quest IDs
    const questIds = [];
    questSources.forEach(source => {
      if (Array.isArray(source.data)) {
        source.data.forEach(item => {
          const questId = typeof item === 'object' && item !== null && 'id' in item ? item.id : item;
          if (questId !== null && questId !== undefined) {
            questIds.push(questId);
          }
        });
      }
    });
    
    if (questIds.length === 0) {
      return;
    }
    
    // Check if any quests are missing names in loaded data
    const needsQuestData = questIds.some(questId => {
      const questData = loadedData.twQuests[questId] || loadedData.twQuests[String(questId)];
      return !questData || !questData.tw;
    });
    
    // Load tw-quests.json if needed
    if (needsQuestData && !twQuestsStaticData && !isLoadingQuestsData) {
      setIsLoadingQuestsData(true);
      loadJsonOnce('tw-quests', () => import('../../teamcraft_git/libs/data/src/lib/json/tw/tw-quests.json'), {}).then(data => {
        setTwQuestsStaticData(data);
        setIsLoadingQuestsData(false);
        // Update loadedData with static data
        setLoadedData(prev => {
          const updated = {
            ...prev,
            twQuests: { ...prev.twQuests }
          };
          Object.keys(data).forEach(id => {
            if (!updated.twQuests[id] && !updated.twQuests[String(id)]) {
              updated.twQuests[id] = data[id];
              updated.twQuests[String(id)] = data[id];
            }
          });
          return updated;
        });
        // Also update ref
        Object.keys(data).forEach(id => {
          if (!loadedDataRef.current.twQuests[id] && !loadedDataRef.current.twQuests[String(id)]) {
            loadedDataRef.current.twQuests[id] = data[id];
            loadedDataRef.current.twQuests[String(id)] = data[id];
          }
        });
        
        // Note: Levequest data (tw-leves.json) is now loaded upfront in the main useEffect
        // No need to check for missing levequest names here since they're handled during initial query
      }).catch(err => {
        console.warn('[ObtainMethods] Failed to load tw-quests.json:', err);
        setIsLoadingQuestsData(false);
      });
    }
    // Note: Levequest data (tw-leves.json) is now loaded upfront in the main useEffect
  }, [sources, loadedData.twQuests, twQuestsStaticData, dataLoaded, isLoadingQuestsData]);

  // Lazy load retainer task details for venture sources with missing fields
  useEffect(() => {
    if (!sources || sources.length === 0 || !dataLoaded) {
      return;
    }

    const ventureSources = sources.filter(s => s.type === DataType.VENTURES);
    if (ventureSources.length === 0) {
      return;
    }

    const tasks = ventureSources.flatMap(source => source.tasks || source.data || []);
    const needsRetainerTasks = tasks.some(task => {
      if (task === null || task === undefined) return true;
      if (typeof task !== 'object') return true;
      if (!('id' in task)) return true;
      const hasLevel = task.level !== undefined || task.lvl !== undefined;
      const hasQuantities = Array.isArray(task.quantities) && task.quantities.length > 0;
      return !hasLevel || !hasQuantities;
    });

    if (!needsRetainerTasks || isLoadingRetainerTasksData || (loadedDataRef.current.retainerTasksById && Object.keys(loadedDataRef.current.retainerTasksById).length > 0)) {
      return;
    }

    setIsLoadingRetainerTasksData(true);
    loadJsonOnce('retainer-tasks', () => import('../../teamcraft_git/libs/data/src/lib/json/retainer-tasks.json'), []).then(data => {
      const byId = {};
      data.forEach(task => {
        if (task && task.id !== undefined && task.id !== null) {
          byId[task.id] = task;
          byId[String(task.id)] = task;
        }
      });

      setLoadedData(prev => ({
        ...prev,
        retainerTasksById: byId
      }));

      loadedDataRef.current.retainerTasksById = byId;
      setIsLoadingRetainerTasksData(false);
    }).catch(err => {
      console.warn('[ObtainMethods] Failed to load retainer-tasks.json:', err);
      setIsLoadingRetainerTasksData(false);
    });
  }, [sources, dataLoaded, isLoadingRetainerTasksData]);

  // Load Wiki URL when itemId changes (for activity content notice)
  useEffect(() => {
    if (!itemId) {
      setWikiUrl(null);
      return;
    }

    let cancelled = false;
    getHuijiWikiUrlForItem(itemId)
      .then(url => {
        if (!cancelled) {
          setWikiUrl(url);
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.error(`[ObtainMethods] Failed to generate Wiki URL:`, error);
          // Fallback to ID-based URL
          setWikiUrl(`https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(itemId)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Load sources and all required data
  useEffect(() => {
    if (!itemId) {
      // Don't clear sources or change loading state when itemId is undefined
      // This prevents showing "no obtainable methods" when itemId is temporarily undefined during redirects
      // The component will show loading state due to the !itemId check in the render logic
      return;
    }

    // Check cache first - if data exists and is not expired, use it immediately
    const cached = getCachedObtainMethodsData(itemId);
    if (cached) {
      // Update ref immediately
      currentItemIdRef.current = itemId;
      // Restore cached data - clone to avoid mutating cache
      try {
        loadedDataRef.current = structuredClone(cached.loadedData);
      } catch (e) {
        // Fallback to JSON parse/stringify for deep copy
        loadedDataRef.current = JSON.parse(JSON.stringify(cached.loadedData));
      }
      setLoadedData(cached.loadedData); // React will handle immutability
      setSources(cached.sources);
      setDataLoaded(true);
      setLoading(false);
      // Update refs
      prevItemIdRef.current = itemId;
      layoutEffectPrevItemIdRef.current = itemId;
      // Notify parent immediately so the obtainable-methods button is enabled (avoids it staying disabled when returning to a cached item)
      loadClearedSourcesForItemIdRef.current = null; // we have final data
      if (onLoadingChange) onLoadingChange(false);
      if (onSourcesChange) onSourcesChange(cached.sources, itemId);
      return; // Skip loading
    }

    // Update ref immediately to prevent showing stale data during redirects
    currentItemIdRef.current = itemId;
    // Mark that we're clearing sources for this item - don't notify parent with [] until we have final data
    loadClearedSourcesForItemIdRef.current = itemId;

    // Clear sources and reset state immediately when itemId changes
    // Use functional updates to ensure atomic state changes and prevent race conditions
    // Set loading state FIRST to prevent showing empty state during redirects
    // Always reset state when itemId changes, even if it's the same value (handles browser back navigation)
    setLoading(true);
    setDataLoaded(false);
    setSources([]);
    setFilteredMethodType(null); // Reset filter when item changes
    
    // Create abort controller for cancellation
    const abortController = new AbortController();
    
    // Store current itemId to check if it changed during async operations
    const currentItemId = itemId;
    
    // Step 1: Get sources from obtainable data
    getItemSources(currentItemId, abortController.signal)
      .then(async sourcesData => {
        if (abortController.signal.aborted) {
          return;
        }
        
        // Check again if request was cancelled (after async getFateSourcesByItemId)
        if (abortController.signal.aborted) {
          return;
        }
        
        // Step 2: Extract all required IDs from sources
        
        // Validate sourcesData before processing
        if (!sourcesData || !Array.isArray(sourcesData)) {
          console.warn(`[ObtainMethods] ⚠️ Invalid sources data for item ${currentItemId}:`, sourcesData);
          if (!abortController.signal.aborted) {
            loadClearedSourcesForItemIdRef.current = null;
            setSources([]);
            setLoading(false);
            setDataLoaded(true);
          }
          return;
        }
        
        // Log if sourcesData is empty
        if (sourcesData.length === 0) {
          console.warn(`[ObtainMethods] ⚠️ No sources found for item ${currentItemId}`);
        }
        
        const islandCropSources = sourcesData.filter(s => s.type === DataType.ISLAND_CROP);
        const questSources = sourcesData.filter(s => s.type === DataType.QUESTS);

        const requiredIds = extractIdsFromSources(sourcesData);
        
        // Step 2.5: Identify and load levequest data upfront
        // Check for levequest sources (ISLAND_CROP with levequest format)
        const levequestIds = [];
        const islandCropSourcesWithData = islandCropSources.filter(s => Array.isArray(s.data) && s.data.length > 0);
        islandCropSourcesWithData.forEach(source => {
          const firstItem = source.data[0];
          const isLevequestFormat = firstItem && typeof firstItem === 'object' && 'id' in firstItem && 'lvl' in firstItem && 'item' in firstItem;
          if (isLevequestFormat) {
            source.data.forEach(leve => {
              if (leve && typeof leve === 'object' && 'id' in leve) {
                const leveId = leve.id;
                if (!levequestIds.includes(leveId)) {
                  levequestIds.push(leveId);
                }
              }
            });
          }
        });
        
        // Check QUESTS sources for levequests - need to load tw-leves.json first
        let twLevesDataForState = null;
        const questSourcesWithData = questSources.filter(s => Array.isArray(s.data) && s.data.length > 0);
        if (questSourcesWithData.length > 0 || levequestIds.length > 0) {
          // Load tw-leves.json to identify which quests are actually levequests
          twLevesDataForState = await loadJsonOnce('tw-leves', () => import('../../teamcraft_git/libs/data/src/lib/json/tw/tw-leves.json'), {});
          if (twLevesDataForState && questSourcesWithData.length > 0) {
            questSourcesWithData.forEach(source => {
              if (Array.isArray(source.data)) {
                source.data.forEach(questItem => {
                  const questId = typeof questItem === 'object' && questItem !== null && 'id' in questItem ? questItem.id : questItem;
                  if (questId && (twLevesDataForState[questId] || twLevesDataForState[String(questId)])) {
                    // This is a levequest
                    if (!levequestIds.includes(questId)) {
                      levequestIds.push(questId);
                    }
                  }
                });
              }
            });
          }
        }
        
        // Add levequest IDs to requiredIds for obtainable load
        if (levequestIds.length > 0) {
          // Note: NPC IDs and item IDs will be extracted after leve data is loaded
        }
        
        // Set tw-leves data to state immediately so it's available for rendering
        if (twLevesDataForState) {
          setTwLevesStaticData(twLevesDataForState);
        }
        
        // Step 2.6: Get FATE IDs from fate-sources (msgpack) and add to requiredIds
        const fateSourcesFromTable = await getFateSourcesByItemId(currentItemId, abortController.signal);
        if (Array.isArray(fateSourcesFromTable) && fateSourcesFromTable.length > 0) {
          fateSourcesFromTable.forEach(fateId => {
            if (!requiredIds.fateIds.includes(fateId)) {
              requiredIds.fateIds.push(fateId);
            }
          });
        }
        
        // Step 2.7: Get monster drop zone IDs from drop-sources.json and add to requiredIds
        const dropSourceMonsterIds = dropSourcesData[currentItemId] || dropSourcesData[String(currentItemId)];
        if (Array.isArray(dropSourceMonsterIds) && dropSourceMonsterIds.length > 0) {
          dropSourceMonsterIds.forEach(monsterId => {
            const monster = monstersData[monsterId] || monstersData[String(monsterId)];
            if (monster && Array.isArray(monster.positions) && monster.positions.length > 0) {
              // Collect all zone IDs from monster positions
              monster.positions.forEach(position => {
                if (position.zoneid && !requiredIds.zoneIds.includes(position.zoneid)) {
                  requiredIds.zoneIds.push(position.zoneid);
                }
              });
            }
          });
        }
        
        // Check again if request was cancelled
        if (abortController.signal.aborted) {
          return;
        }
        
        // Step 3: Load all required data from obtainableDataService (msgpack domains + fatesData + items)
        let newLoadedData;
        try {
          newLoadedData = await loadDataForRequiredIds(requiredIds, {
            leveIds: levequestIds,
            itemId: currentItemId,
            signal: abortController.signal
          });
        } catch (err) {
          if (err?.name === 'AbortError' || abortController.signal.aborted) return;
          console.error(`[ObtainMethods] ❌ Error loading obtainable data:`, err);
          if (currentItemId === itemId) {
            loadClearedSourcesForItemIdRef.current = null;
            setSources([]);
            setLoading(false);
            setDataLoaded(true);
          }
          return;
        }
        
        if (abortController.signal.aborted || currentItemId !== itemId) return;
        
        // Preserve place data from ref (phase 2 will merge more)
        newLoadedData.twPlaces = loadedDataRef.current.twPlaces || {};
        newLoadedData.places = loadedDataRef.current.places || {};
        
        // CRITICAL: Set loadedData FIRST before processing sources
          // This ensures that when renderSource executes, loadedData state is already updated
          // React 18+ batches state updates, but we need loadedData to be available when sources render
          // IMPORTANT: Update ref FIRST, then set state, so renderSource can access latest data immediately
          // OPTIMIZED: Use structuredClone for faster deep copy (or JSON.parse/stringify as fallback)
          try {
            // Use native structuredClone if available (faster than manual copy)
            loadedDataRef.current = structuredClone(newLoadedData);
          } catch (e) {
            // Fallback to JSON parse/stringify for deep copy (still faster than manual copy)
            loadedDataRef.current = JSON.parse(JSON.stringify(newLoadedData));
          }
          setLoadedData(newLoadedData);
          
          // Process sources with additional data from obtainableDataService
          // Note: This processing uses newLoadedData (local variable), not loadedData state
          // But renderSource will use loadedDataRef.current to access latest data immediately
          // Validate sourcesData before processing
          if (!sourcesData || !Array.isArray(sourcesData)) {
            console.warn(`[ObtainMethods] ⚠️ Invalid sourcesData in processing step for item ${currentItemId}:`, sourcesData);
            if (!abortController.signal.aborted && currentItemId === itemId) {
              loadClearedSourcesForItemIdRef.current = null;
              setSources([]);
              setLoading(false);
              setDataLoaded(true);
            }
            return;
          }
          
          let processedSources = [...sourcesData];
          const currentItemIdNum = parseInt(currentItemId, 10);

          const dropObjects = buildDropObjectsFromDropSources(
            currentItemId,
            dropSourcesData,
            monstersData,
            msg => console.warn('[ObtainMethods]', msg)
          );
          applyDropsToProcessedSources(processedSources, dropObjects);

          const { fateZoneIds, existingFateIdsFromSources } = convertIslandPastureToFates(processedSources);
          filterInvalidFates(processedSources);

          if (abortController.signal.aborted || currentItemId !== itemId) return;

          const fateSourcesForItem = newLoadedData.fateSources || [];
          mergeFateSourcesFromTable(
            processedSources,
            fateSourcesForItem,
            newLoadedData,
            fateZoneIds,
            existingFateIdsFromSources,
            msg => console.warn('[ObtainMethods]', msg)
          );

          const allZoneIds = collectAllZoneIds(processedSources, newLoadedData, requiredIds, fateZoneIds);

          // Extract FATE reward item IDs from fatesById (do this before querying)
          const fateRewardItemIds = new Set();
          const fatesById = newLoadedData.fatesById || {};
          
          Object.keys(fatesById).forEach(fateIdStr => {
            const fate = fatesById[fateIdStr];
            if (fate && Array.isArray(fate.items)) {
              fate.items.forEach(itemIdRaw => {
                const normalizedItemId = typeof itemIdRaw === 'number' ? itemIdRaw : parseInt(itemIdRaw, 10);
                if (normalizedItemId && !isNaN(normalizedItemId)) {
                  fateRewardItemIds.add(normalizedItemId);
                }
              });
            }
          });
          
          // Also add current item if it's a rare reward (in fate_sources but not in items array)
          if (fateSourcesForItem.length > 0) {
            const isInAnyFateItems = Object.values(fatesById).some(fate => {
              if (!fate || !Array.isArray(fate.items)) return false;
              return fate.items.some(itemIdRaw => {
                const normalizedItemId = typeof itemIdRaw === 'number' ? itemIdRaw : parseInt(itemIdRaw, 10);
                return normalizedItemId === currentItemIdNum;
              });
            });
            if (!isInAnyFateItems) {
              fateRewardItemIds.add(currentItemIdNum);
            }
          }
          
          // Batch query: Query place data and FATE reward items together
          // Note: twPlaces and places are now pre-loaded, so zoneIdsToQuery should be empty
          const zoneIdsToQuery = Array.from(allZoneIds).filter(zoneId => {
            const hasTwPlace = newLoadedData.twPlaces[zoneId] || newLoadedData.twPlaces[String(zoneId)];
            const hasPlace = newLoadedData.places[zoneId] || newLoadedData.places[String(zoneId)];
            return !hasTwPlace && !hasPlace;
          });
          
          const missingRewardItemIds = Array.from(fateRewardItemIds).filter(itemId => {
            const itemIdStr = String(itemId);
            return !newLoadedData.twItems[itemId] && !newLoadedData.twItems[itemIdStr];
          });
          
          // Phase 2: Load places for zone IDs and FATE reward items
          if (zoneIdsToQuery.length > 0 && !abortController.signal.aborted && currentItemId === itemId) {
            try {
              const { twPlaces: twPlacesData, places: placesData } = await loadPlaceDataForZoneIds(zoneIdsToQuery, abortController.signal);
              setLoadedData(prev => {
                const updated = {
                  ...prev,
                  twPlaces: { ...prev.twPlaces, ...twPlacesData },
                  places: { ...prev.places, ...placesData }
                };
                loadedDataRef.current = updated;
                return updated;
              });
              newLoadedData.twPlaces = { ...newLoadedData.twPlaces, ...twPlacesData };
              newLoadedData.places = { ...newLoadedData.places, ...placesData };
              loadedDataRef.current.twPlaces = newLoadedData.twPlaces;
              loadedDataRef.current.places = newLoadedData.places;
            } catch (err) {
              if (!abortController.signal.aborted && currentItemId === itemId) {
                console.error(`[ObtainMethods] Error loading place data:`, err);
              }
            }
          }
          
          if (missingRewardItemIds.length > 0 && !abortController.signal.aborted && currentItemId === itemId) {
            try {
              const twItemsData = await getTwItemsByIds(missingRewardItemIds);
              setLoadedData(prev => {
                const updated = {
                  ...prev,
                  twItems: { ...prev.twItems, ...twItemsData }
                };
                loadedDataRef.current = updated;
                const cached = obtainMethodsCache[currentItemId];
                if (cached) {
                  cached.loadedData = updated;
                  cached.timestamp = Date.now();
                }
                return updated;
              });
              newLoadedData.twItems = { ...newLoadedData.twItems, ...twItemsData };
              loadedDataRef.current.twItems = newLoadedData.twItems;
            } catch (err) {
              if (!abortController.signal.aborted && currentItemId === itemId) {
                console.error(`[ObtainMethods] Error loading FATE reward items:`, err);
              }
            }
          }
          
          // Check quests that reward this item (from quests table)
          const hasQuests = processedSources.some(source => source.type === DataType.QUESTS);
          const questIdsFromQuests = [];
          const questsData = newLoadedData.quests || {};
          
          Object.keys(questsData).forEach(questIdStr => {
            const quest = questsData[questIdStr];
            if (!quest || !quest.rewards) return;
            
            const hasItemReward = Array.isArray(quest.rewards) && quest.rewards.some(reward => reward.id === parseInt(currentItemId, 10));
            if (hasItemReward) {
              questIdsFromQuests.push(parseInt(questIdStr, 10));
            }
          });
          
          if (questIdsFromQuests.length > 0) {
            if (hasQuests) {
              const questsSource = processedSources.find(s => s.type === DataType.QUESTS);
              if (questsSource && Array.isArray(questsSource.data)) {
                const existingQuestIds = new Set(questsSource.data.map(q => typeof q === 'object' ? q.id : q));
                const newQuestIds = questIdsFromQuests.filter(qId => !existingQuestIds.has(qId));
                if (newQuestIds.length > 0) {
                  questsSource.data = [...questsSource.data, ...newQuestIds];
                }
              }
            } else {
              const masterbooksSource = processedSources.find(s => s.type === DataType.MASTERBOOKS);
              if (masterbooksSource && Array.isArray(masterbooksSource.data)) {
                const looksLikeQuestIds = masterbooksSource.data.every(id => {
                  const numId = typeof id === 'object' ? id.id : id;
                  return typeof numId === 'number' && numId > 1000 && numId < 1000000;
                });
                
                if (looksLikeQuestIds) {
                  masterbooksSource.type = DataType.QUESTS;
                  const existingQuestIds = new Set(masterbooksSource.data.map(q => typeof q === 'object' ? q.id : q));
                  const newQuestIds = questIdsFromQuests.filter(qId => !existingQuestIds.has(qId));
                  if (newQuestIds.length > 0) {
                    masterbooksSource.data = [...masterbooksSource.data, ...newQuestIds];
                  }
                } else {
                  processedSources.push({
                    type: DataType.QUESTS,
                    data: questIdsFromQuests
                  });
                }
              } else {
                processedSources.push({
                  type: DataType.QUESTS,
                  data: questIdsFromQuests
                });
              }
            }
          }
          
          // Check loot sources from loot_sources table
          const lootSourceIds = newLoadedData.lootSources || [];
          if (lootSourceIds.length > 0) {
            const hasTreasures = processedSources.some(source => source.type === DataType.TREASURES);
            const twItemsData = newLoadedData.twItems || {};
            
            const validLootSources = lootSourceIds.filter(lootSourceId => {
              const lootItem = newLoadedData.twItems[lootSourceId] || newLoadedData.twItems[String(lootSourceId)];
              return lootItem && lootItem.tw;
            });
            
            if (validLootSources.length > 0) {
              if (hasTreasures) {
                const treasuresSource = processedSources.find(s => s.type === DataType.TREASURES);
                if (treasuresSource && Array.isArray(treasuresSource.data)) {
                  const existingTreasureIds = new Set(treasuresSource.data.map(id => typeof id === 'object' ? id.id : id));
                  const newTreasureIds = validLootSources.filter(id => !existingTreasureIds.has(id));
                  if (newTreasureIds.length > 0) {
                    treasuresSource.data = [...treasuresSource.data, ...newTreasureIds];
                  }
                }
              } else {
                processedSources.push({
                  type: DataType.TREASURES,
                  data: validLootSources
                });
              }
            }
          }
          
          // Check if we have shop data loaded but no TRADE_SOURCES or VENDORS source
          // This can happen if the extracts table doesn't have the shop data but shops_by_npc does
          const hasTradeSources = processedSources.some(source => source.type === DataType.TRADE_SOURCES);
          const hasVendors = processedSources.some(source => source.type === DataType.VENDORS);
          const shopsByNpc = newLoadedData.shopsByNpc || {};
          const twShops = newLoadedData.twShops || {};
          
          if (!hasTradeSources && !hasVendors && Object.keys(shopsByNpc).length > 0) {
            // Note: We can't fully reconstruct TRADE_SOURCES from shopsByNpc alone
            // because shopsByNpc doesn't contain the trade information (what items are sold, currencies needed)
            // This is a limitation - we'd need to query the shops table with full trade data
            // For now, just log that we have shop data but can't use it without trade info
            console.warn(`[ObtainMethods] ⚠️ Shop data exists but cannot create sources without trade information. Item ${currentItemId} may need to be added to extracts table.`);
          }
          
          // Final check: log if processedSources is empty
          if (processedSources.length === 0) {
            console.warn(`[ObtainMethods] ⚠️ No valid sources found for item ${currentItemId} after processing`);
          }
          
          // Final check: ensure request wasn't cancelled
          if (abortController.signal.aborted) {
            return;
          }
          
          // Check if itemId changed - but be more lenient: if itemId is undefined/null, 
          // it might be because component is unmounting, so still update state
          // Only skip if itemId is different AND not null/undefined (meaning user switched to different item)
          if (currentItemId !== itemId && itemId !== null && itemId !== undefined) {
            return;
          }
          
          // Only update state if itemId hasn't changed (prevent stale data)
          if (currentItemId === itemId) {
            // CRITICAL: React batches state updates, but renderSource uses loadedData from closure
            // We need to ensure loadedData is updated before sources are set
            // Since setLoadedData was already called above (line 461), React will batch these updates
            // But to ensure renderSource has access to the latest data, we use React's automatic batching
            // which ensures state updates are applied in the order they were called
            
            // Get the final loadedData state (may have been updated with reward items)
            // Use loadedDataRef.current which has the latest data including any reward item updates
            const finalLoadedData = loadedDataRef.current || newLoadedData;

            loadClearedSourcesForItemIdRef.current = null; // final state - allow notify
            setSources(processedSources);
            setDataLoaded(true);
            setLoading(false);
            // Update ref to match current itemId after successful load
            currentItemIdRef.current = currentItemId;
            
            // Cache the loaded data for future use (use finalLoadedData which includes all updates)
            setCachedObtainMethodsData(currentItemId, processedSources, finalLoadedData);
          }
      })
      .catch(err => {
        // Don't update state if request was cancelled or itemId changed
        if (abortController.signal.aborted || currentItemId !== itemId) {
          return;
        }
        
        console.error(`[ObtainMethods] ❌ Failed to load sources for item ${currentItemId}:`, err);
        loadClearedSourcesForItemIdRef.current = null; // final state - allow notify with []
        setSources([]);
        setDataLoaded(true);
        setLoading(false);
        
        // Show user-friendly error message for timeout/large file issues
        if (err.message && (err.message.includes('超時') || err.message.includes('timeout') || err.message.includes('過大'))) {
          console.warn('extracts.json 載入超時，這可能是因為檔案過大或網路連線較慢。取得方式資訊可能無法顯示。');
        }
      });
    
    // Cleanup: abort request if component unmounts or itemId changes
    return () => {
      abortController.abort();
    };
  }, [itemId]);

  // ============================================================================
  // HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // ============================================================================
  // All hooks (useCallback, useMemo) must be defined here before any early returns
  // to prevent "Rendered more hooks than during the previous render" errors
  
  const sortedSources = useMemo(() => {
    return filterAndSortSources(sources, {
      loadedData: loadedDataRef.current,
      twQuestsStaticData,
      twLevesStaticData
    });
  }, [sources, twQuestsStaticData, twLevesStaticData, loadedData.twQuests, loadedData.quests]);

  // Notify parent component when sources change (for button disable state)
  // This determines if the obtainable methods button should be enabled/disabled
  useEffect(() => {
    if (onSourcesChange) {
      // Only notify when we have final state: not loading, and not in "cleared but waiting for load" state
      // (avoids notifying with [] when setSources([]) was applied before setLoading(true), which would disable the button)
      const clearedButNoDataYet = sortedSources.length === 0 && loadClearedSourcesForItemIdRef.current === itemId;
      if (!loading && !clearedButNoDataYet) {
        onSourcesChange(sortedSources, itemId);
      }
    }
  }, [itemId, sortedSources, onSourcesChange, loading]);

  const getMethodTypeLabel = (source) => {
    if (source?.typeName) return source.typeName;
    return getChineseName(source?.type) || '未知';
  };

  // Filter sources by selected method type
  // OPTIMIZED: Memoized to prevent recalculation on every render
  const filteredSources = useMemo(() => {
    return filteredMethodType 
      ? sortedSources.filter(source => getMethodTypeLabel(source) === filteredMethodType)
      : sortedSources;
  }, [sortedSources, filteredMethodType]);

  // Get unique method types for filter tags
  // OPTIMIZED: Memoized to prevent recalculation on every render
  const uniqueMethodTypes = useMemo(() => {
    return [...new Set(sortedSources.map(source => getMethodTypeLabel(source)))];
  }, [sortedSources]);

  const validSources = useMemo(() => filteredSources, [filteredSources]);

  // 依各 method 卡片高度排序：高的在前、矮的排最後（只填補尚未測到的，避免重排後又重測造成閃爍）
  const methodOrderByHeight = useMemo(() => {
    const n = validSources.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const withHeight = indices.filter(i => methodHeights[i] != null && methodHeights[i] > 0);
    const withoutHeight = indices.filter(i => methodHeights[i] == null || methodHeights[i] === 0);
    withHeight.sort((a, b) => (methodHeights[b] ?? 0) - (methodHeights[a] ?? 0));
    return [...withHeight, ...withoutHeight];
  }, [validSources.length, methodHeights]);

  useEffect(() => {
    if (methodHeights.length !== validSources.length) {
      setMethodHeights([]);
    }
  }, [validSources.length, methodHeights.length]);

  useLayoutEffect(() => {
    const el = methodCardsContainerRef.current;
    if (!el || !validSources.length) return;
    const children = el.children;
    const n = validSources.length;
    if (children.length !== n) return;
    const nextHeights = [];
    for (let i = 0; i < n; i++) {
      const origIdx = parseInt(children[i].getAttribute('data-original-index'), 10);
      if (Number.isNaN(origIdx)) continue;
      const h = children[i].getBoundingClientRect().height;
      nextHeights[origIdx] = h;
    }
    setMethodHeights(prev => {
      if (prev.length !== n) return nextHeights;
      const next = [...prev];
      let changed = false;
      const HEIGHT_EPS = 2; // ignore sub-2px changes to avoid thrash
      for (let i = 0; i < n; i++) {
        const newH = nextHeights[i];
        if (newH == null) continue;
        const prevH = next[i];
        const prevNull = prevH == null;
        const diff = prevNull ? newH : Math.abs((prevH ?? 0) - newH);
        if (prevNull || diff > HEIGHT_EPS) {
          next[i] = newH;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });

  // Show loading state if data is still loading or sources are being fetched
  // Also show loading if itemId is undefined/null to prevent showing empty state during redirects
  // Also show loading if itemId changed but sources haven't been updated yet (prevent stale data)
  // itemIdChanged is already computed above when syncing refs
  if (!dataLoaded || loading || !itemId || itemIdChanged) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
        <p className="mt-4 text-gray-400">載入取得方式...</p>
      </div>
    );
  }

  if (sources.length === 0) {
    // If itemId changed but state hasn't been reset yet, show loading instead of empty state
    // This prevents showing empty state during redirects when useLayoutEffect hasn't run yet
    if (itemIdChanged || layoutEffectPrevItemIdRef.current !== itemId) {
      return (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
          <p className="mt-4 text-gray-400">載入取得方式...</p>
        </div>
      );
    }
    // Check if item is a treasure map (名稱包含"地圖")
    // Use ref to access latest loadedData immediately, avoiding stale state issues
    const currentLoadedData = loadedDataRef.current;
    const itemData = currentLoadedData.twItems[itemId] || currentLoadedData.twItems[String(itemId)];
    const itemName = itemData?.tw || '';
    const isTreasureMap = itemName && itemName.includes('地圖');
    
    return (
      <div className="text-center py-4 text-gray-400 text-sm">
        {isTreasureMap ? (
          <div className="flex flex-col items-center gap-3">
            <div>暫無取得方式資料</div>
            <a
              href="https://cycleapple.github.io/xiv-tc-treasure-finder/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-ffxiv-gold/20 hover:bg-ffxiv-gold/30 border border-ffxiv-gold/50 hover:border-ffxiv-gold text-ffxiv-gold rounded-lg transition-all duration-200 text-sm font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              前往藏寶圖查詢器
            </a>
          </div>
        ) : (
          <div>暫無取得方式資料</div>
        )}
      </div>
    );
  }

  

  const getNpcName = (npcId) => obtainableHelpers.getNpcName(npcId, loadedDataRef.current);
  const getNpcTitle = (npcId) => obtainableHelpers.getNpcTitle(npcId, loadedDataRef.current, twNpcTitlesData);

  // Thin wrapper: pass current loadedData (from ref) into centralized placeUtils
  const getPlaceName = (zoneId) => {
    const currentLoadedData = loadedDataRef.current;
    return getPlaceNameUtil(zoneId, {
      twPlaces: currentLoadedData.twPlaces,
      places: currentLoadedData.places
    });
  };
  const getPlaceNameCN = getPlaceName;

  /**
   * 中心化地图位置信息管理 - 统一标准处理所有地图相关数据
   * Centralized map location information management - unified standard handling
   * 
   * @param {Object} locationData - 位置数据对象
   * @param {number} locationData.zoneId - 区域 ID
   * @param {number} locationData.mapId - 地图 ID (可选)
   * @param {Object} locationData.coords - 坐标 {x, y} (可选)
   * @param {number} locationData.radius - 范围半径 (可选)
   * @param {string} locationData.contextName - 上下文名称 (可选)
   * @returns {Object} 返回位置信息对象
   *   - zoneName: 地图名称（中文优先，英文其次，失败则为空）
   *   - hasLocation: 是否有有效的地图位置（需要 mapId + coords）
   *   - mapId: 地图 ID
   *   - coords: 坐标对象或 null
   *   - coordsText: 格式化的坐标文本 "X: 12.3 - Y: 45.6"
   *   - displayText: 用于显示的完整文本
   *   - contextName: 上下文名称
   */
  const getLocationInfo = (locationData) => {
    const {
      zoneId,
      mapId,
      coords,
      radius,
      zoneName: zoneNameOverride,
      contextName = ''
    } = locationData;

    // 1. 获取地图名称（中文优先）
    const zoneName = zoneNameOverride || (zoneId ? getPlaceNameCN(zoneId) : '');

    // 2. 检查是否有有效的坐标
    const hasValidCoords = coords && coords.x !== undefined && coords.y !== undefined;
    
    // 3. 坐标文本格式
    const coordsText = hasValidCoords ? `X: ${coords.x.toFixed(1)} - Y: ${coords.y.toFixed(1)}` : '';
    
    // 4. 判断是否有有效的地图位置（需要同时有 mapId 和坐标）
    const hasLocation = hasValidCoords && mapId;
    
    // 5. 构建显示文本 - 标准格式：地图名称 (坐标)
    let displayText = '';
    if (zoneName && coordsText) {
      // 标准情况：有地图名称和坐标
      displayText = `${zoneName} (${coordsText})`;
    } else if (zoneName) {
      // 只有地图名称
      displayText = zoneName;
    } else if (coordsText) {
      // 只有坐标（地图名称加载失败的降级方案）
      displayText = coordsText;
    } else {
      // 都没有
      displayText = '位置未知';
    }
    
    return {
      zoneName,           // 地图名称（可能为空）
      hasLocation,        // 是否可以打开地图
      mapId,
      coords: hasValidCoords ? coords : null,
      radius: radius || 0,
      coordsText,         // 格式化坐标
      displayText,        // 用于 UI 显示的完整文本
      contextName: contextName || zoneName || '位置'
    };
  };

  /**
   * 打开地图模态框的辅助函数
   * Helper function to open map modal
   * 
   * @param {Object} locationInfo - 位置信息（从 getLocationInfo 获取）
   * @param {string} entityName - 实体名称（NPC、采集点等）
   */
  const openMapModal = (locationInfo, entityName = '') => {
    if (!locationInfo.hasLocation) return;
    
    setMapModal({
      isOpen: true,
      zoneName: locationInfo.zoneName,
      x: locationInfo.coords.x,
      y: locationInfo.coords.y,
      npcName: entityName || locationInfo.contextName,
      mapId: locationInfo.mapId,
      radius: locationInfo.radius || 0,
    });
  };

  const getShopName = (shopId) => obtainableHelpers.getShopName(shopId, loadedDataRef.current);
  const getVendorShopName = (shopName) => obtainableHelpers.getVendorShopName(shopName);
  const getCurrencyName = (currencyItemId) => obtainableHelpers.getCurrencyName(currencyItemId, loadedDataRef.current);
  const getItemNameWithFallback = (itemId) => obtainableHelpers.getItemNameWithFallback(itemId, loadedDataRef.current);
  const getAchievementInfo = (achievementId) => obtainableHelpers.getAchievementInfo(achievementId, loadedDataRef.current);

  // Handle mouse enter for achievement tooltip
  const handleAchievementMouseEnter = (e, achievementId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // For fixed positioning, use viewport coordinates (no scroll offset needed)
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
    setHoveredAchievement(achievementId);
  };

  // Handle mouse move to update tooltip position
  const handleAchievementMouseMove = (e) => {
    if (hoveredAchievement) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
  };

  // Handle mouse leave for achievement tooltip
  const handleAchievementMouseLeave = () => {
    setHoveredAchievement(null);
  };

  // Get achievement IDs from sources (check both type 19 ALARMS and type 22 ACHIEVEMENTS)
  // Note: Type 19 (ALARMS) is sometimes used for achievements in extracts.json
  const achievementIds = [];
  sources.forEach(source => {
    if (source.type === DataType.ACHIEVEMENTS || source.type === 19) {
      // Type 19 might be achievements in some cases, type 22 is ACHIEVEMENTS
      if (Array.isArray(source.data)) {
        achievementIds.push(...source.data);
      }
    }
  });

  // Get mob/monster name by mob ID
  const getMobName = (mobId) => {
    if (!mobId) return null;
    const mobIdStr = String(mobId);
    const mob = twMobsData[mobIdStr] || twMobsData[mobId];
    if (mob?.tw) {
      return mob.tw;
    }
    return null;
  };

  const getInstanceName = (instanceId) => obtainableHelpers.getInstanceName(instanceId, loadedDataRef.current);
  const getInstanceCNName = (instanceId) => obtainableHelpers.getInstanceCNName(instanceId, loadedDataRef.current);
  const getQuestCNName = (questId) => obtainableHelpers.getQuestCNName(questId, loadedDataRef.current);

  // Clean quest name by removing invisible/special characters (like U+E0FE)
  const cleanQuestName = (name) => {
    if (!name) return name;
    // Remove characters in private use area (U+E000-U+F8FF) and other invisible characters
    return name.replace(/[\uE000-\uF8FF\u200B-\u200D\uFEFF]/g, '').trim();
  };

  // Get quest requirement for a shop by shop ID and NPC ID
  // Look up from multiple sources: trade source data, shops table, and shops_by_npc table
  const getShopQuestRequirement = (shopId, npcId, tradeSource) => {
    if (!shopId) return null;
    
    // First, check if tradeSource has requiredQuest (from extracts)
    if (tradeSource && tradeSource.requiredQuest) {
      return tradeSource.requiredQuest;
    }
    
    // Use ref to access latest loadedData immediately, avoiding stale state issues
    const currentLoadedData = loadedDataRef.current;
    // Look up shop in shops table from loaded data
    const shop = currentLoadedData.shops[shopId] || currentLoadedData.shops[String(shopId)];
    if (shop && shop.requiredQuest) {
      return shop.requiredQuest;
    }
    
    // If not found in shops, try shops_by_npc from loaded data
    if (npcId) {
      const npcShops = currentLoadedData.shopsByNpc[npcId] || currentLoadedData.shopsByNpc[String(npcId)];
      if (npcShops) {
        const npcShop = typeof npcShops === 'object' && !Array.isArray(npcShops)
          ? npcShops[shopId] || npcShops[String(shopId)]
          : Array.isArray(npcShops)
            ? npcShops.find(s => (s.id || s) === shopId)
            : null;
        
        if (npcShop && (npcShop.requiredQuest || (typeof npcShop === 'object' && npcShop.requiredQuest))) {
          return npcShop.requiredQuest || (typeof npcShop === 'object' ? npcShop.requiredQuest : null);
        }
      }
    }
    
    return null;
  };

  const formatPrice = (price) => {
    return price.toLocaleString('zh-TW');
  };

  // Map job ID to job abbreviation
  const getJobAbbreviation = (jobId) => {
    const jobAbbrMap = {
      // Production jobs
      8: 'CRP', 9: 'BSM', 10: 'ARM', 11: 'GSM', 12: 'LTW', 13: 'WVR', 14: 'ALC', 15: 'CUL',
    };
    return jobAbbrMap[jobId];
  };

  // Get job name from tw-job-abbr.json
  const getJobName = (jobId) => {
    const jobData = twJobAbbrData[jobId];
    return jobData?.tw || `職業 ${jobId}`;
  };

  // Get job icon URL from garlandtools
  const getJobIconUrl = (jobId) => {
    const abbr = getJobAbbreviation(jobId);
    if (!abbr) return null;
    return `https://garlandtools.org/files/icons/job/${abbr}.png`;
  };

  // Get masterbook name from item ID (TW → ZH → EN → fallback message)
  const getMasterbookName = (masterbookId) => {
    if (!masterbookId) return null;
    const itemId = typeof masterbookId === 'string' ? parseInt(masterbookId, 10) : masterbookId;
    const name = getItemNameWithFallback(itemId);
    return name === FALLBACK_MESSAGE ? null : name;
  };

  const renderSource = (source, index, useFlex1 = true, totalMethodCards = 4) => {
    let { type } = source;
    const { data } = source;
    // Remove flexClass since we're using grid layout now
    const flexClass = '';
    // Use ref to access latest loadedData immediately, avoiding stale state issues
    // This is critical because renderSource is now called during render (not in useMemo)
    const currentLoadedData = loadedDataRef.current;

    // Map string type to DataType enum if necessary
    // New data structure uses strings like "gathering", "voyage", "venture"
    if (typeof type === 'string') {
      type = getTypeIdFromString(type);
    }

    // Crafted By (製作) - new structure: source has recipeId, job, level directly
    if (type === DataType.CRAFTED_BY) {
      // Check if we have the new structure (recipeId directly in source) or old structure (data array)
      const hasRecipeData = source.recipeId || source.job;
      const craftData = hasRecipeData ? [source] : (data || []);
      
      if (!craftData || craftData.length === 0) {
        return null;
      }
      
      const masterbooksSource = sources.find(s => s.type === DataType.MASTERBOOKS);
      const masterbookRaw = masterbooksSource?.masterbookItemIds || masterbooksSource?.data || [];
      const masterbookEntries = Array.isArray(masterbookRaw)
        ? masterbookRaw.map(book => {
            if (typeof book === 'object' && book !== null) {
              const bookId = typeof book.id === 'string' ? parseInt(book.id, 10) : book.id;
              const bookName = book.name?.tw || book.name?.zh || book.name?.en;
              return { id: bookId, name: bookName };
            }
            const bookId = typeof book === 'string' ? parseInt(book, 10) : book;
            return { id: bookId, name: null };
          }).filter(entry => entry.id && !isNaN(entry.id))
        : [];

      const validMasterbooks = masterbookEntries.filter(entry => {
        const bookData = loadedData.twItems[entry.id] || loadedData.twItems[String(entry.id)];
        const hasItemData = bookData && bookData.tw;
        const hasNameFromSource = entry.name;
        return hasItemData || hasNameFromSource;
      });



      return (
        <div key={`crafted-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/000000/000501.png" alt="Craft" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">製作</span>
            {onExpandCraftingTree && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dataLoaded) {
                    onExpandCraftingTree();
                  }
                }}
                disabled={!dataLoaded}
                className={`ml-auto px-2 py-1 text-xs border rounded transition-all duration-200 flex items-center gap-1 ${
                  !dataLoaded
                    ? 'bg-gray-900/50 border-gray-600/40 text-gray-500 cursor-not-allowed opacity-60'
                    : isCraftingTreeExpanded
                    ? 'bg-amber-900/50 hover:bg-amber-800/70 border-ffxiv-gold/60 hover:border-ffxiv-gold text-ffxiv-gold'
                    : 'bg-purple-900/50 hover:bg-purple-800/70 border-purple-500/40 hover:border-purple-400/60 text-purple-200 hover:text-ffxiv-gold'
                }`}
                title={!dataLoaded ? '正在加載數據...' : isCraftingTreeExpanded ? '收起製作價格樹' : '展開製作價格樹'}
              >
                {!dataLoaded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                )}
                {isCraftingTreeExpanded ? '收起樹' : '展開樹'}
              </button>
            )}
          </div>
          {validMasterbooks.length > 0 && (
            <div className="mb-3 bg-slate-900/40 border border-slate-700/40 rounded p-2">
              <div className="text-xs text-gray-400 mb-1">需要秘籍：</div>
              <div className="flex flex-wrap gap-2">
                {validMasterbooks.map((entry, bookIndex) => {
                  const bookId = entry.id;
                  const bookData = loadedData.twItems[bookId] || loadedData.twItems[String(bookId)];
                  const bookName = bookData?.tw || entry.name || `物品 ${bookId}`;

                  return (
                    <button
                      key={`gathered-masterbook-${bookIndex}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onItemClick) {
                          getItemById(bookId).then(item => {
                            if (item) {
                              onItemClick(item, { fromObtainable: true });
                            } else {
                              const itemUrl = generateItemUrl(bookId, 'item');
                              navigate(itemUrl);
                            }
                          });
                        } else {
                          const itemUrl = generateItemUrl(bookId, 'item');
                          navigate(itemUrl);
                        }
                      }}
                      className="flex items-center gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded px-2 py-1.5 hover:bg-slate-800/70"
                    >
                      <ItemImage
                        itemId={bookId}
                        alt={bookName}
                        className="w-5 h-5 object-contain"
                      />
                      <span className="hover:underline">{bookName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {craftData.map((craft, craftIndex) => {
              const jobId = craft.job;
              const jobName = getJobName(jobId);
              const jobIconUrl = getJobIconUrl(jobId);
              const level = craft.level || craft.lvl || craft.rlvl || 0;
              const stars = craft.stars_tooltip || '';
              
              // Skip if no valid job data
              if (!jobName || jobName === `職業 ${jobId}`) {
                return null;
              }

              return (
                <button
                  key={`craft-${index}-${craftIndex}`}
                  disabled={!dataLoaded}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dataLoaded && onExpandCraftingTree) {
                      onExpandCraftingTree();
                    }
                  }}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} rounded p-2 min-h-[70px] flex flex-col justify-center transition-all duration-200 ${
                    !dataLoaded
                      ? 'bg-gray-900/40 border border-gray-700/40 text-gray-500 cursor-not-allowed opacity-50'
                      : isCraftingTreeExpanded
                      ? 'bg-amber-900/30 hover:bg-amber-800/40 border border-ffxiv-gold/40 cursor-pointer'
                      : 'bg-slate-900/50 hover:bg-slate-800/70 cursor-pointer'
                  }`}
                  title={!dataLoaded ? '正在加載數據...' : isCraftingTreeExpanded ? '點擊收起製作價格樹' : '點擊展開製作價格樹'}
                >
                  <div className="flex items-center gap-2">
                    {!dataLoaded ? (
                      <div className="w-7 h-7 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
                        </svg>
                      </div>
                    ) : (
                      jobIconUrl && (
                        <img src={jobIconUrl} alt={jobName} className="w-7 h-7 object-contain" />
                      )
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{jobName}</span>
                        {level > 0 && (
                          <span className="text-xs text-gray-400">Lv.{level}</span>
                        )}
                        {stars && (
                          <span className="text-xs text-yellow-400">{stars}</span>
                        )}
                      </div>
                      {craft.masterbook && (() => {
                        const masterbookId = craft.masterbook.id 
                          ? (typeof craft.masterbook.id === 'string' ? parseInt(craft.masterbook.id, 10) : craft.masterbook.id)
                          : null;
                        const masterbookName = masterbookId 
                          ? getMasterbookName(masterbookId) 
                          : (craft.masterbook.name?.tw || craft.masterbook.name?.en);
                        const displayName = masterbookName || '專用配方書';
                        
                        return (
                          <div className="text-xs text-gray-400 mt-1">
                            {masterbookId ? (
                              <span
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (onItemClick) {
                                    getItemById(masterbookId).then(item => {
                                      if (item) {
                                        onItemClick(item, { fromObtainable: true });
                                      } else {
                                        const itemUrl = generateItemUrl(masterbookId, 'item');
                                        navigate(itemUrl);
                                      }
                                    });
                                  } else {
                                    const itemUrl = generateItemUrl(masterbookId, 'item');
                                    navigate(itemUrl);
                                  }
                                }}
                                className="text-ffxiv-gold hover:text-yellow-400 hover:underline transition-colors cursor-pointer"
                              >
                                {displayName}
                              </span>
                            ) : (
                              <span>{displayName}</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Trade Sources (兌換) - NEW FORMAT: {type, currencyItemId, currencyAmount, requiresHQ, npcIds, shopId, shopName}
    if (type === DataType.TRADE_SOURCES) {
      // New optimized format: source properties directly on source object (not in data array)
      // Extract from source object itself
      const currencyItemId = source.currencyItemId;
      const currencyAmount = source.currencyAmount || 1;
      const requiresHQ = source.requiresHQ === true;
      const shopId = source.shopId;
      const shopName = source.shopName;
      const npcIds = source.npcIds || [];
      
      // Early return if no currency info or no NPCs
      if (!currencyItemId || npcIds.length === 0) {
        return null;
      }

      // Get currency item name: TW → ZH → EN → fallback message
      const currencyName = getCurrencyName(currencyItemId);
      
      // Get currency item data for linking (show link when we have any language name)
      const currentLoadedData = loadedDataRef.current;
      const twCur = currentLoadedData.twItems[currencyItemId] || currentLoadedData.twItems[String(currencyItemId)];
      const zhCur = currentLoadedData.zhItems?.[currencyItemId] || currentLoadedData.zhItems?.[String(currencyItemId)];
      const enCur = currentLoadedData.items?.[currencyItemId] || currentLoadedData.items?.[String(currencyItemId)];
      const hasCurrencyItem = !!(twCur?.tw || zhCur?.zh || enCur?.en);
      
      // Get shop name - try Traditional Chinese from shopName object
      // shopName is an I18nName object: { en, ja, de, fr, zh, tw, ko }
      let shopNameDisplay = null;
      if (shopName) {
        shopNameDisplay = shopName.tw || shopName.zh || null;
      } else if (shopId) {
        // Fallback: try to get shop name from loaded data using shop ID
        const shopData = getShopName(shopId);
        if (shopData) {
          shopNameDisplay = shopData;
        }
      }
      
      // Get quest requirement (use first NPC for lookup)
      const firstNpcId = npcIds[0];
      const requiredQuestId = getShopQuestRequirement(shopId, firstNpcId, source);
      const questData = currentLoadedData.twQuests[requiredQuestId] || currentLoadedData.twQuests[String(requiredQuestId)];
      const questEnData = currentLoadedData.quests[requiredQuestId] || currentLoadedData.quests[String(requiredQuestId)];
      const questName = questData?.tw || questEnData?.name?.en || questEnData?.en || null;
      
      // Check if this is a single NPC shop
      const isSingleNpc = npcIds.length === 1;
      
      return (
        <div key={`trade-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 220 200"
              className="w-8 h-8 text-ffxiv-gold"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <g>
                <polyline points="150,55 75,55 75,35 20,77 75,120 75,100" />
                <line x1="75" y1="100" x2="145" y2="100" />
                <polyline points="145,100 145,80 200,122 145,165 145,145 70,145" />
              </g>
            </svg>
            <span className="text-ffxiv-gold font-medium">兌換</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className={`${isSingleNpc ? 'w-full' : getMethodCardLayoutClass(totalMethodCards)} bg-slate-900/50 rounded flex flex-col ${totalMethodCards <= 3 ? 'p-3 min-w-0' : 'p-2'}`}>
              {/* Currency header: icon always by itemId (loads regardless of tw/zh/en); name uses fallback */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700/50">
                {hasCurrencyItem ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onItemClick) {
                        getItemById(currencyItemId).then(item => {
                          if (item) {
                            onItemClick(item, { fromObtainable: true });
                          } else {
                            const itemUrl = generateItemUrl(currencyItemId, 'item');
                            navigate(itemUrl);
                          }
                        });
                      } else {
                        const itemUrl = generateItemUrl(currencyItemId, 'item');
                        navigate(itemUrl);
                      }
                    }}
                    className="flex items-center gap-1.5 font-medium text-blue-400 hover:text-ffxiv-gold transition-colors"
                  >
                    <ItemImage
                      itemId={currencyItemId}
                      alt={currencyName}
                      className="w-7 h-7 object-contain"
                    />
                    <span className="hover:underline">{currencyName}</span>
                    {requiresHQ && (
                      <span 
                        className="inline-flex items-center justify-center px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] font-bold text-yellow-400"
                        title="需要高品質版本"
                      >
                        HQ
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <ItemImage
                      itemId={currencyItemId}
                      alt={currencyName}
                      className="w-7 h-7 object-contain"
                    />
                    {currencyName}
                    {requiresHQ && (
                      <span 
                        className="inline-flex items-center justify-center px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] font-bold text-yellow-400"
                        title="需要高品質版本"
                      >
                        HQ
                      </span>
                    )}
                  </span>
                )}
                <span className="text-yellow-400 text-sm">x{currencyAmount}</span>
              </div>
              
              {/* Shop name */}
              {shopNameDisplay && (
                <div className="text-xs text-gray-400 mb-2">{shopNameDisplay}</div>
              )}
              
              {/* Quest requirement */}
              {requiredQuestId && questName && (
                <div className="text-xs text-pink-400/90 mb-2 flex items-center gap-1">
                  <span>需要完成任務：</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const questCNName = getQuestCNName(requiredQuestId);
                      if (questCNName) {
                        window.open(`https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(questCNName)}`, '_blank');
                      }
                    }}
                    className="text-yellow-400/90 hover:text-yellow-300 hover:underline transition-colors"
                  >
                    {questName}
                  </button>
                </div>
              )}
              
              {/* NPCs list: when 1–3 methods use fewer columns so each NPC is readable and space is used well */}
              <div className={`grid gap-2 ${isSingleNpc ? 'grid-cols-1' : totalMethodCards <= 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
                {npcIds.map((npcId, npcIndex) => {
                  const npcName = getNpcName(npcId);
                  
                  // Get NPC position from loaded npcs data
                  const npcData = currentLoadedData.npcs[npcId] || currentLoadedData.npcs[String(npcId)];
                  const npcPosition = npcData?.position;
                  const npcZoneId = npcPosition?.zoneid;
                  const npcMapId = npcPosition?.map;
                  const npcCoords = npcPosition ? { x: npcPosition.x, y: npcPosition.y } : null;
                  
                  // 使用中心化的地图位置管理
                  const locationInfo = getLocationInfo({
                    zoneId: npcZoneId,
                    mapId: npcMapId,
                    coords: npcCoords,
                    contextName: npcName
                  });
                  
                  return (
                    <div key={`npc-${npcIndex}`} className={`bg-slate-800/40 rounded border border-slate-700/30 w-full min-w-0 overflow-hidden ${totalMethodCards <= 3 ? 'px-3 py-2.5 text-sm' : 'text-xs px-2 py-1.5'}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className={`flex-shrink-0 grayscale opacity-70 ${totalMethodCards <= 3 ? 'w-5 h-5' : 'w-4 h-4'}`} />
                        <div className="text-gray-300 font-medium min-w-0 truncate">{npcName}</div>
                      </div>
                      {locationInfo.hasLocation && locationInfo.zoneName && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openMapModal(locationInfo, npcName);
                          }}
                          className={`flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors min-w-0 flex-1 ${totalMethodCards <= 3 ? 'text-xs mt-1 ml-7' : 'text-[10px] ml-[18px] mt-0.5'}`}
                          title={`${locationInfo.zoneName}${locationInfo.displayText && locationInfo.displayText !== locationInfo.zoneName ? ' · ' + locationInfo.displayText : ''}\n點擊查看地圖`}
                        >
                          <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className={`text-gray-400 overflow-hidden min-w-0 ${!isSingleNpc ? 'line-clamp-2 break-words' : 'truncate'}`}>
                            {locationInfo.zoneName}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Show count if multiple NPCs */}
              {npcIds.length > 1 && (
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-slate-700/30">
                  {npcIds.length} 個位置
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Vendors (NPC商人) - Single box with all vendors listed inside
    if (type === DataType.VENDORS) {
      // Group vendors by NPC ID
      const vendorsByNpc = {};
      data.forEach((vendor) => {
        const npcId = vendor.npcId;
        if (!vendorsByNpc[npcId]) {
          vendorsByNpc[npcId] = [];
        }
        vendorsByNpc[npcId].push(vendor);
      });

      const npcGroups = Object.keys(vendorsByNpc).map((npcId) => {
        return { npcId, vendors: vendorsByNpc[npcId] };
      });

      // Separate NPCs into those with location info and those without
      const npcGroupsWithLocation = [];
      const npcGroupsWithoutLocation = [];

      npcGroups.forEach((npcGroup) => {
        const npcVendors = npcGroup.vendors;
        const firstVendor = npcVendors[0];
        const npcName = getNpcName(firstVendor.npcId);
        
        // Try to get position from vendor data first, then fallback to npcs.json
        let zoneId = firstVendor.zoneId;
        let coords = firstVendor.coords;
        let mapId = firstVendor.mapId;
        
        // If vendor doesn't have position data, try to get it from npcs.json (lazy loaded)
        if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && firstVendor.npcId && currentLoadedData.npcs) {
          const npcData = currentLoadedData.npcs[firstVendor.npcId] || currentLoadedData.npcs[String(firstVendor.npcId)];
          if (npcData?.position) {
            zoneId = zoneId || npcData.position.zoneid;
            mapId = mapId || npcData.position.map;
            if (!coords || coords.x === undefined || coords.y === undefined) {
              coords = {
                x: npcData.position.x,
                y: npcData.position.y
              };
            }
          }
        }
        
        // Check if this is a housing NPC (journeyman salvager or other housing NPCs)
        // NPCs like 1025913 (journeyman salvager) are housing NPCs without fixed locations
        const isHousingNPC = !zoneId && !coords && (
          npcName?.includes('古董商') || 
          npcName?.includes('journeyman salvager') ||
          firstVendor.npcId >= 1025000 && firstVendor.npcId < 1026000 // Housing NPC ID range
        );
        
        // For housing NPCs, set default zoneId and coords
        if (isHousingNPC) {
          zoneId = 1160; // 個人房屋 (Personal Housing)
          coords = { x: 0, y: 0 };
          mapId = null; // No map for housing NPCs
        }
        
        // For other NPCs without coords but with zoneId, set default 0,0
        if (zoneId && (!coords || coords.x === undefined || coords.y === undefined)) {
          coords = { x: 0, y: 0 };
        }
        
        const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
        // Check if we have location info (even if 0,0 for housing NPCs)
        const hasLocationInfo = zoneName && coords && coords.x !== undefined && coords.y !== undefined;

        // Categorize NPC group
        if (hasLocationInfo) {
          npcGroupsWithLocation.push({ ...npcGroup, zoneId, coords, mapId, zoneName, npcName });
        } else {
          npcGroupsWithoutLocation.push({ ...npcGroup, npcName, zoneName, coords, zoneId, mapId });
        }
      });

      return (
        <div key={`vendor-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/065000/065002_hr1.png" alt="Gil" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">NPC商人</span>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {/* NPCs with location info */}
            {npcGroupsWithLocation.length > 0 && (
              <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX_NO_MT : 'grid gap-2 grid-cols-1'}>
                {npcGroupsWithLocation.map((npcGroup, npcGroupIndex) => {
                  const npcVendors = npcGroup.vendors;
                  const firstVendor = npcVendors[0];
                  const { zoneName, coords, mapId, npcName } = npcGroup;
                  
                  // 使用中心化的地图位置管理
                  const locationInfo = getLocationInfo({
                    zoneId: firstVendor.zoneId,
                    mapId: mapId,
                    coords: coords,
                    contextName: npcName
                  });
                  
                  // Get all shop names for this NPC
                  const shopNames = npcVendors.map(v => getVendorShopName(v.shopName)).filter(Boolean);
                  const uniqueShopNames = [...new Set(shopNames)];
                  
                  // Check if any vendor requires achievement
                  const requiresAchievement = achievementIds.length > 0 || 
                    npcVendors.some(vendor => {
                      const shopName = getVendorShopName(vendor.shopName);
                      return vendor.shopName && (
                        vendor.shopName.en?.toLowerCase().includes('achievement') ||
                        vendor.shopName.en?.toLowerCase().includes('reward') ||
                        shopName?.includes('成就')
                      );
                    });
                  
                  // Get prices - show range if multiple vendors have different prices
                  const prices = npcVendors.map(v => v.price).filter(Boolean);
                  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                  const hasPriceRange = minPrice !== null && maxPrice !== null && minPrice !== maxPrice;
                  
                  // Check if location is valid for map display (must have mapId and not be 0,0)
                  const hasValidMapLocation = locationInfo.hasLocation && (coords.x !== 0 || coords.y !== 0);
                  
                  return (
                    <div key={npcGroupIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-0.5 min-w-0">
                          <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-5 h-5 flex-shrink-0 grayscale opacity-70" />
                          <span className="text-sm font-medium text-white truncate">{npcName}</span>
                          {(() => {
                            const npcTitle = getNpcTitle(firstVendor.npcId);
                            return npcTitle ? (
                              <span className="text-xs text-gray-400">&lt;{npcTitle}&gt;</span>
                            ) : null;
                          })()}
                        </div>
                        {minPrice && (
                          <span className="text-yellow-400 text-sm">
                            {hasPriceRange ? `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}` : formatPrice(minPrice)} Gil
                          </span>
                        )}
                      </div>
                      {uniqueShopNames.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          {uniqueShopNames.join(', ')}
                        </div>
                      )}
                      {requiresAchievement && achievementIds.length > 0 && (() => {
                        const achievementInfo = getAchievementInfo(achievementIds[0]);
                        return achievementInfo ? (
                          <div 
                            className="text-xs mt-1 flex items-start gap-1 relative"
                            onMouseEnter={(e) => handleAchievementMouseEnter(e, achievementIds[0])}
                            onMouseMove={handleAchievementMouseMove}
                            onMouseLeave={handleAchievementMouseLeave}
                          >
                            <span className="text-pink-400/90">需要完成成就：</span>
                            <span className="font-medium text-yellow-400/90 cursor-help underline decoration-dotted decoration-yellow-400/50 hover:decoration-yellow-400 transition-colors">
                              {achievementInfo.name}
                            </span>
                          </div>
                        ) : null;
                      })()}
                      {hasValidMapLocation && (
                        <button
                          onClick={() => openMapModal(locationInfo, npcName)}
                          className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span>
                            {locationInfo.displayText}
                          </span>
                        </button>
                      )}
                      {!hasValidMapLocation && locationInfo.displayText && (
                        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-gray-400">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span>{locationInfo.displayText}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* NPCs without location info - consolidated display */}
            {npcGroupsWithoutLocation.length > 0 && (
              <div className="bg-slate-900/30 rounded p-2 border border-slate-700/50">
                <div className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                  <span>特殊 NPC 商人</span>
                  <span className="text-gray-600">({npcGroupsWithoutLocation.length} 位)</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {npcGroupsWithoutLocation.map((npcGroup, npcGroupIndex) => {
                    const { npcName, vendors: npcVendors, zoneName, coords } = npcGroup;
                    const firstVendor = npcVendors[0];
                    
                    // Use npcName or fallback to shop name if available
                    const displayName = npcName || (firstVendor.shopName?.tw ? firstVendor.shopName.tw : `NPC ${firstVendor.npcId}`);
                    const npcTitle = getNpcTitle(firstVendor.npcId);
                    
                    // Get zone name and coords if available
                    const zoneDisplay = zoneName || (firstVendor.zoneId ? getPlaceNameCN(firstVendor.zoneId) : null);
                    const coordsDisplay = coords || (firstVendor.coords ? firstVendor.coords : null);
                    
                    return (
                      <div
                        key={npcGroupIndex}
                        className="flex flex-col gap-1 text-xs px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700/30 w-full"
                      >
                        <div className="flex items-center gap-1">
                          <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-3 h-3 flex-shrink-0 grayscale opacity-60" />
                          <span className="text-gray-300 font-medium">{displayName}</span>
                          {npcTitle && (
                            <span className="text-xs text-gray-500">&lt;{npcTitle}&gt;</span>
                          )}
                        </div>
                        {zoneDisplay && (
                          <div className="text-gray-400 flex items-center gap-1 pl-4">
                            <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <span>{zoneDisplay}</span>
                            {coordsDisplay && (coordsDisplay.x !== 0 || coordsDisplay.y !== 0) && (
                              <span className="text-gray-500">X: {coordsDisplay.x.toFixed(1)} Y: {coordsDisplay.y.toFixed(1)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Treasures (藏寶圖/寶箱) - includes both treasure maps and loot sources (coffers/containers)
    if (type === DataType.TREASURES) {
      // Defensive check: ensure data exists and is an array
      if (!data || !Array.isArray(data)) {
        console.warn(`[ObtainMethods] ⚠️ TREASURES source has invalid data:`, source);
        return null;
      }

      const validTreasures = data
        .map(entry => (typeof entry === 'object' && entry !== null ? entry.id : entry))
        .filter(treasureId => {
          const treasureData = loadedData.twItems[treasureId] || loadedData.twItems[String(treasureId)];
          return treasureData && treasureData.tw;
        });

      if (validTreasures.length === 0) {
        return null;
      }

      return (
        <div key={`treasure-${index}`} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start">
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/026000/026509_hr1.png" alt="Treasure" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">{source.typeName || '寶箱/容器'}</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validTreasures.map((treasureId, treasureIndex) => {
              const treasureData = loadedData.twItems[treasureId] || loadedData.twItems[String(treasureId)];
              const treasureName = treasureData?.tw;
              if (!treasureName) return null;

              return (
                <button
                  key={treasureIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(treasureId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(treasureId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(treasureId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]`}
                >
                  <ItemImage
                    itemId={treasureId}
                    alt={treasureName}
                    className="w-7 h-7 object-contain"
                  />
                  <span className="hover:underline">{treasureName}</span>
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Instances (副本) - data is an array of instance IDs
    if (type === DataType.INSTANCES) {
            // Support both legacy data (IDs) and optimized data (instanceNames)
            const instanceEntries = Array.isArray(data) && data.length > 0
              ? data
              : (Array.isArray(source.instanceNames)
                ? source.instanceNames.map(name => ({ name }))
                : []);

            // Defensive check: ensure we have something to render
            if (!instanceEntries || instanceEntries.length === 0) {
              console.warn(`[ObtainMethods] ⚠️ INSTANCES source has no renderable entries:`, source);
              return null;
            }
      
      return (
        <div key={`instance-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061801.png" alt="Instance" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">{source.typeName || '副本掉落'}</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {instanceEntries.map((instanceEntry, instanceIndex) => {
              const instanceId = typeof instanceEntry === 'object' && instanceEntry !== null ? instanceEntry.id : instanceEntry;
              const fallbackName = typeof instanceEntry === 'object' && instanceEntry !== null ? instanceEntry.name : null;
              const instanceName = fallbackName || getInstanceName(instanceId);
              
              // Skip if no lookup available (fallback name means no data)
              if (!instanceId && !instanceName) {
                return null;
              }

              // If we don't have a valid ID, render a minimal card with name only
              if (!instanceId) {
                return (
                  <div key={instanceIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded-lg p-3 min-h-[80px] flex flex-col justify-center border border-slate-700/30`}>
                    <div className="flex items-center gap-2">
                      <img src="https://xivapi.com/i/061000/061801.png" alt="Instance" className="w-7 h-7 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-300 leading-tight">{instanceName || '未知副本'}</span>
                    </div>
                  </div>
                );
              }
              
              // Get Simplified Chinese name for Huiji Wiki link
              const instanceCNName = getInstanceCNName(instanceId);
              
              // Get instance icon and content type from instances.json for better display
              // Use ref to access latest loadedData immediately, avoiding stale state issues
              const currentLoadedData = loadedDataRef.current;
              const instance = currentLoadedData.instances[instanceId] || currentLoadedData.instances[String(instanceId)];
              const iconUrl = instance?.icon 
                ? `https://xivapi.com${instance.icon}` 
                : 'https://xivapi.com/i/061000/061801_hr1.png';
              
              // Determine content type icon based on contentType
              let contentTypeIcon = iconUrl;
              if (instance?.contentType) {
                // contentType: 2 = Dungeon, 4 = Trial, 5 = Raid, 21 = Deep Dungeon, 28 = Ultimate
                if (instance.contentType === 4) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061804_hr1.png'; // Trial
                } else if (instance.contentType === 5) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061802_hr1.png'; // Raid
                } else if (instance.contentType === 28) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061832_hr1.png'; // Ultimate
                } else if (instance.contentType === 21) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061824_hr1.png'; // Deep Dungeon
                }
              }
              
              // Get level information from instance data
              const levelReq = instance?.levelReq;
              const ilvlReq = instance?.ilvlReq;
              const sync = instance?.sync;
              
              return (
                <div key={instanceIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded-lg p-3 min-h-[80px] flex flex-col justify-between border border-slate-700/30 hover:border-slate-600/50 transition-colors`}>
                  {instanceCNName && (
                    <a
                      href={`https://ff14.huijiwiki.com/wiki/${encodeURIComponent(instanceCNName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col gap-2 group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <img src={contentTypeIcon} alt="Instance" className="w-7 h-7 flex-shrink-0" />
                        <span className="text-sm font-medium text-blue-400 group-hover:text-ffxiv-gold transition-colors leading-tight">
                          {instanceName}
                        </span>
                      </div>
                      {(levelReq || ilvlReq) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-6 text-xs text-gray-400">
                          {levelReq && (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-gray-500">等级:</span>
                              <span className="text-gray-300 font-medium">Lv.{levelReq}</span>
                              {sync && sync !== levelReq && (
                                <span className="text-gray-500 text-[10px] leading-none -ml-0.5">(同步: {sync})</span>
                              )}
                            </div>
                          )}
                          {ilvlReq && ilvlReq > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500">iLvl要求:</span>
                              <span className="text-gray-300 font-medium">{ilvlReq}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </a>
                  )}
                  {!instanceCNName && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <img src={contentTypeIcon} alt="Instance" className="w-7 h-7 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-300 leading-tight">{instanceName}</span>
                      </div>
                      {(levelReq || ilvlReq) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-6 text-xs text-gray-400">
                          {levelReq && (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-gray-500">等级:</span>
                              <span className="text-gray-300 font-medium">Lv.{levelReq}</span>
                              {sync && sync !== levelReq && (
                                <span className="text-gray-500 text-[10px] leading-none -ml-0.5">(同步: {sync})</span>
                              )}
                            </div>
                          )}
                          {ilvlReq && ilvlReq > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500">iLvl要求:</span>
                              <span className="text-gray-300 font-medium">{ilvlReq}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // DROPS (怪物掉落) - data is an array of Drop objects with {id, mapid?, zoneid?, lvl?, position?}
    if (type === DataType.DROPS) {
      if (!data || data.length === 0) {
        return null;
      }

      // Group monsters by zone and process data
      const monstersByZone = {};
      
      data.forEach((drop) => {
        const mobId = typeof drop === 'object' ? drop.id : drop;
        const fallbackMobName = typeof drop === 'object' ? (drop.name || drop.mobName) : null;
        const mobName = getMobName(mobId) || fallbackMobName;
        
        // Skip if no lookup available
        if (!mobName) {
          return;
        }

        // Get zone and level info from drop object (already processed from monsters.json)
        const zoneId = typeof drop === 'object' ? drop.zoneid : null;
        const mapId = typeof drop === 'object' ? drop.mapid : null;
        const zoneNameFallback = typeof drop === 'object' ? drop.zoneName : null;
        const minLevel = typeof drop === 'object' ? drop.minLevel : null;
        const maxLevel = typeof drop === 'object' ? drop.maxLevel : null;
        const zonePositions = typeof drop === 'object' ? drop.zonePositions : [];
        
        // Handle monsters without zone data - still show them
        if (!zoneId) {
          // Still show the monster, but without zone info
          if (!monstersByZone['unknown']) {
            monstersByZone['unknown'] = {
              zoneId: 'unknown',
              zoneName: zoneNameFallback || '未知區域',
              monsters: []
            };
          }
          monstersByZone['unknown'].monsters.push({
            mobId,
            mobName,
            levelRange: minLevel ? `等級${minLevel}` : null,
            mapId: null,
            positions: []
          });
          return;
        }

        // Get zone name using the existing function
        const zoneName = getPlaceNameCN(zoneId);
        // Use zoneId as fallback if zone name not found
        const displayZoneName = zoneName && zoneName !== `區域 ${zoneId}` ? zoneName : `區域 ${zoneId}`;

        // Calculate level range
        const levelRange = minLevel && maxLevel 
          ? (minLevel === maxLevel ? `等級${minLevel}` : `等級${minLevel}～${maxLevel}`)
          : (minLevel ? `等級${minLevel}` : null);

        if (!monstersByZone[zoneId]) {
          monstersByZone[zoneId] = {
            zoneId,
            zoneName: displayZoneName,
            monsters: []
          };
        }

        monstersByZone[zoneId].monsters.push({
          mobId,
          mobName,
          levelRange,
          mapId,
          positions: zonePositions
        });
      });

      const zoneEntries = Object.values(monstersByZone);
      if (zoneEntries.length === 0) {
        return null;
      }

      return (
        <div key={`drops-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-3">
            <img src="https://xivapi.com/c/BNpcName.png" alt="Monster" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">怪物掉落</span>
          </div>
          
          {/* Table-like display */}
          <div className="space-y-4">
            {zoneEntries.map((zone, zoneIndex) => (
              <div key={zoneIndex} className="bg-slate-900/50 rounded p-3">
                <div className="text-sm font-semibold text-white mb-2 border-b border-slate-700/50 pb-1">
                  {zone.zoneName}
                </div>
                <div className="space-y-2">
                  {zone.monsters.map((monster, monsterIndex) => {
                    // Get first position for map display
                    const firstPosition = monster.positions && monster.positions.length > 0 
                      ? monster.positions[0] 
                      : null;
                    
                    // 使用中心化的地图位置管理
                    const locationInfo = getLocationInfo({
                      zoneId: zone.zoneId,
                      mapId: monster.mapId,
                      coords: firstPosition,
                      contextName: monster.mobName
                    });
                    
                    return (
                      <div key={monsterIndex} className="flex items-start gap-2 text-sm">
                        <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white">{monster.mobName}</span>
                        </div>
                          {monster.levelRange && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {monster.levelRange}
                            </div>
                          )}
                          {locationInfo.hasLocation && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openMapModal(locationInfo, monster.mobName);
                              }}
                              className="text-xs text-blue-400 hover:text-ffxiv-gold transition-colors text-left mt-1"
                            >
                              位置: ({Math.round(firstPosition.x * 10) / 10}, {Math.round(firstPosition.y * 10) / 10})
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Desynths (精製獲得)
    if (type === DataType.DESYNTHS) {
      // data is an array of item IDs that can be desynthed to get this item
      const validDesynthItems = data.filter(itemId => {
        const itemData = loadedData.twItems[itemId] || loadedData.twItems[String(itemId)];
        return itemData && itemData.tw;
      });
      
      if (validDesynthItems.length === 0) {
        return null; // Skip if no valid items
      }
      
      return (
        <div key={`desynth-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/000000/000120.png" alt="Desynth" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">精製獲得</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validDesynthItems.map((desynthItemId, desynthIndex) => {
              const desynthItemData = loadedData.twItems[desynthItemId] || loadedData.twItems[String(desynthItemId)];
              const desynthName = desynthItemData?.tw;
              
              if (!desynthName) return null;
              
              return (
                <button
                  key={desynthIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(desynthItemId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(desynthItemId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(desynthItemId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
                >
                  <ItemImage
                    itemId={desynthItemId}
                    alt={desynthName}
                    className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
                  />
                  <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={desynthName}>
                    {desynthName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Quests (任務) - data is an array of quest IDs or quest objects with {id, mapid, zoneid, position}
    if (type === DataType.QUESTS) {
      // Use ref to access latest loadedData immediately, avoiding stale state issues
      const currentLoadedData = loadedDataRef.current;
      
      // Extract quest IDs from data (handle both ID numbers and objects with 'id' property)
      const questIds = data.map(item => {
        if (typeof item === 'object' && item !== null && 'id' in item) {
          return item.id; // Extract ID from object
        }
        return item; // Already an ID
      }).filter(questId => questId !== null && questId !== undefined);
      
      if (questIds.length === 0) {
        return null; // Skip if no valid quests
      }
      
      // Filter out levequests first - they should be displayed in "理符任務" container
      const validQuestIds = questIds.filter(questId => {
        // Check if this is a regular quest (has name in tw_quests or quests)
        const questData = currentLoadedData.twQuests[questId] || currentLoadedData.twQuests[String(questId)] 
          || (twQuestsStaticData && (twQuestsStaticData[questId] || twQuestsStaticData[String(questId)]));
        let questNameRaw = questData?.tw;
        
        // Fallback to EN if TW not available
        if (!questNameRaw) {
          const questEn = currentLoadedData.quests[questId] || currentLoadedData.quests[String(questId)];
          questNameRaw = questEn?.en;
        }
        
        const questName = cleanQuestName(questNameRaw);
        
        // If no quest name found, check if it's a levequest
        if (!questName) {
          const leveData = twLevesStaticData && (twLevesStaticData[questId] || twLevesStaticData[String(questId)]);
          const leveNameRaw = leveData?.tw;
          const leveName = cleanQuestName(leveNameRaw);
          
          // If it's a levequest, filter it out (will be displayed in "理符任務" container)
          if (leveName) {
            return false; // Filter out levequests
          }
        }
        
        return true; // Keep regular quests
      });
      
      // If all quests were filtered out (all were levequests), don't render the container
      if (validQuestIds.length === 0) {
        return null; // Skip container if all quests were levequests
      }
      
      return (
        <div key={`quest-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060453_hr1.png" alt="Quest" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">任務獎勵</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validQuestIds.map((questId, questIndex) => {
              // Try loaded data first, then static JSON fallback
              const questData = currentLoadedData.twQuests[questId] || currentLoadedData.twQuests[String(questId)] 
                || (twQuestsStaticData && (twQuestsStaticData[questId] || twQuestsStaticData[String(questId)]));
              const questNameRaw = questData?.tw;
              const questName = cleanQuestName(questNameRaw);
              
              // If still no quest name found, try to get from quests.json or questsDatabasePages
              if (!questName) {
                
                // Try to get quest name from quests.json or questsDatabasePages
                const quest = currentLoadedData.quests[questId] || currentLoadedData.quests[String(questId)];
                const questDb = currentLoadedData.questsDatabasePages[questId] || currentLoadedData.questsDatabasePages[String(questId)];
                const fallbackName = quest?.en || questDb?.en || `任務 ${questId}`;
                
                // Still render even without Traditional Chinese name
                return (
                  <div key={questIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col`}>
                    <div className="flex items-center gap-2 mb-1">
                      <img src="https://xivapi.com/i/060000/060453_hr1.png" alt="Quest" className="w-7 h-7 object-contain flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-300">{fallbackName}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      任務 ID: {questId}
                    </div>
                  </div>
                );
              }
              
              // Get quest icon from quests.json
              const quest = currentLoadedData.quests[questId] || currentLoadedData.quests[String(questId)];
              const questIcon = quest?.icon 
                ? `https://xivapi.com${quest.icon}` 
                : 'https://xivapi.com/i/060000/060453_hr1.png';
              
              // Get Simplified Chinese quest name for Huiji Wiki link
              const questCNNameRaw = getQuestCNName(questId);
              const questCNName = cleanQuestName(questCNNameRaw);
              
              // Get quest details from quests-database-pages.json (lazy loaded)
              const questDb = currentLoadedData.questsDatabasePages[questId] || currentLoadedData.questsDatabasePages[String(questId)];
              const questLevel = questDb?.level || null;
              const jobCategory = questDb?.jobCategory || null;
              const startingNpcId = questDb?.start || null;
              const startingNpcName = startingNpcId ? getNpcName(startingNpcId) : null;
              
              // Format job category: 1 = all jobs (所有職業)
              let jobCategoryText = '';
              if (jobCategory === 1) {
                jobCategoryText = '所有職業';
              } else if (jobCategory && twJobAbbrData[jobCategory]) {
                jobCategoryText = twJobAbbrData[jobCategory].tw || '';
              }
              
              // Get NPC location - try quest startingPoint first, then fallback to NPC data
              let zoneId = null;
              let coords = null;
              let mapId = null;
              
              // First try quest's startingPoint
              const startingPoint = questDb?.startingPoint || null;
              if (startingPoint) {
                zoneId = startingPoint.zoneid || null;
                mapId = startingPoint.map || null;
                if (startingPoint.x !== undefined && startingPoint.y !== undefined) {
                  coords = {
                    x: startingPoint.x,
                    y: startingPoint.y
                  };
                }
              }
              
              // If no location from quest, try to get it from NPC data (like vendors do) (lazy loaded)
              // Try both number and string keys
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && startingNpcId && currentLoadedData.npcs) {
                const npcData = currentLoadedData.npcs[startingNpcId] || currentLoadedData.npcs[String(startingNpcId)];
                if (npcData?.position) {
                  zoneId = zoneId || npcData.position.zoneid;
                  mapId = mapId || npcData.position.map;
                  if (!coords || coords.x === undefined || coords.y === undefined) {
                    coords = {
                      x: npcData.position.x,
                      y: npcData.position.y
                    };
                  }
                }
              }
              
              // Also try npcsDatabasePages from loaded data for NPC location (try both string and number keys)
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && startingNpcId) {
                const npcDb = loadedData.npcsDatabasePages[startingNpcId] || loadedData.npcsDatabasePages[String(startingNpcId)];
                if (npcDb?.position) {
                  zoneId = zoneId || npcDb.position.zoneid;
                  mapId = mapId || npcDb.position.map;
                  if (!coords || coords.x === undefined || coords.y === undefined) {
                    coords = {
                      x: npcDb.position.x,
                      y: npcDb.position.y
                    };
                  }
                }
              }
              
              // If still no location, try checking quest's npcs array for any NPC with location (lazy loaded)
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && questDb?.npcs && currentLoadedData.npcs) {
                for (const npcId of questDb.npcs) {
                  const npcData = currentLoadedData.npcs[npcId] || currentLoadedData.npcs[String(npcId)];
                  if (npcData?.position) {
                    zoneId = zoneId || npcData.position.zoneid;
                    mapId = mapId || npcData.position.map;
                    if (!coords || coords.x === undefined || coords.y === undefined) {
                      coords = {
                        x: npcData.position.x,
                        y: npcData.position.y
                      };
                    }
                    break; // Use first NPC with location
                  }
                }
              }
              
              const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
              const hasLocation = zoneName && coords && coords.x !== undefined && coords.y !== undefined;
              const hasValidMapLocation = hasLocation && mapId && (coords.x !== 0 || coords.y !== 0);
              
              return (
                <div key={questIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    <img src={questIcon} alt="Quest" className="w-7 h-7 object-contain flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {questCNName && (
                        <a
                          href={`https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(questCNName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-400 hover:text-ffxiv-gold hover:underline transition-colors cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {questName}
                        </a>
                      )}
                      {!questCNName && (
                        <span className="text-sm font-medium text-gray-300">{questName}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Quest details */}
                  <div className="space-y-1 mt-1 text-xs text-gray-400">
                    {/* Level and Job Category */}
                    {(questLevel || jobCategoryText) && (
                      <div className="flex items-center gap-2">
                        {jobCategoryText && <span>{jobCategoryText}</span>}
                        {questLevel && <span>{questLevel}級</span>}
                      </div>
                    )}
                    
                    {/* Starting NPC */}
                    {startingNpcName && startingNpcName !== FALLBACK_MESSAGE && startingNpcName !== `NPC ${startingNpcId}` && (
                      <div className="text-gray-400">{startingNpcName}</div>
                    )}
                    
                    {/* Location */}
                    {hasLocation && zoneName && (() => {
                      // 使用中心化的地图位置管理
                      const locationInfo = getLocationInfo({
                        zoneId: zoneId,
                        mapId: mapId,
                        coords: coords,
                        contextName: startingNpcName
                      });
                      
                      return hasValidMapLocation && locationInfo.hasLocation ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openMapModal(locationInfo, startingNpcName);
                          }}
                          className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span>
                            {locationInfo.displayText}
                          </span>
                        </button>
                      ) : (
                        <div className="mt-1 pt-1 border-t border-slate-700/50 text-xs text-gray-400">
                          {locationInfo.displayText}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // FATES (危命任務) - data is an array of FateData objects with { id, level, zoneId, mapId, coords }
    if (type === DataType.FATES) {
      const validFates = data.filter(fate => {
        // Skip if this looks like a gathering node (has nodeId, itemId but no id)
        if (typeof fate === 'object') {
          // If it has nodeId or itemId but no id, it's likely a gathering node misclassified as FATE
          if ((fate.nodeId !== undefined || fate.itemId !== undefined) && fate.id === undefined) {
            return false;
          }
        }
        const fateId = typeof fate === 'object' ? fate.id : fate;
        // Accept any FATE with valid numeric id from obtainable-methods (show even without name data)
        if (!fateId || typeof fateId !== 'number') return false;
        return true;
      });
      
      if (validFates.length === 0) {
        return null; // Skip if no valid fates
      }
      
      return (
        <div key={`fate-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060502_hr1.png" alt="FATE" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">危命任務</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validFates.map((fate, fateIndex) => {
              const fateId = typeof fate === 'object' ? fate.id : fate;
              const fateLevel = typeof fate === 'object' ? fate.level : null;
              const fateZoneId = typeof fate === 'object' ? fate.zoneId : null;
              const fateMapId = typeof fate === 'object' ? fate.mapId : null;
              const fateCoords = typeof fate === 'object' ? fate.coords : null;
              
              // Centralized FATE data from msgpack (fatesData)
              const currentLoadedData = loadedDataRef.current;
              const fateInfo = currentLoadedData.fatesById[fateId] || currentLoadedData.fatesById[String(fateId)];
              const fateName = fateInfo?.tw || fateInfo?.en || fateInfo?.zh || `危命任務 ${fateId}`;
              const fateNameZh = fateInfo?.zh || null;
              const fateIcon = fateInfo?.icon
                ? `https://xivapi.com${fateInfo.icon}`
                : 'https://xivapi.com/i/060000/060502_hr1.png';
              const levelFromData = fateInfo?.level ?? null;
              const zoneIdFromData = fateInfo?.zoneId ?? null;
              const zoneIdForName = fateZoneId ?? zoneIdFromData;
              const zoneName = (typeof fate === 'object' ? fate.zoneName : '') || (zoneIdForName ? getPlaceNameCN(zoneIdForName) : '');
              const hasLocation = (fateCoords && fateCoords.x !== undefined && fateCoords.y !== undefined && fateMapId) ||
                (fateInfo?.x != null && fateInfo?.y != null && fateInfo?.mapId);
              const rewardItemsRaw = fateInfo?.items || [];
              const displayLevel = fateLevel ?? levelFromData;
              
              // Normalize reward item IDs to numbers for consistent comparison
              let rewardItems = rewardItemsRaw.map(id => typeof id === 'number' ? id : parseInt(id, 10)).filter(id => !isNaN(id));
              
              // Check if current item is in this FATE's rewards
              const currentItemIdNum = parseInt(itemId, 10);
              const fateSourcesForItemCheck = loadedData.fateSources || [];
              const isFateInSourcesForItem = fateSourcesForItemCheck && fateSourcesForItemCheck.includes(fateId);
              
              // If FATE's items array is empty but this FATE is in sources for current item,
              // add current item to reward items (fallback when database doesn't have items array populated)
              if (rewardItems.length === 0 && isFateInSourcesForItem) {
                rewardItems = [currentItemIdNum];
              }
              
              const isCurrentItemInRewards = rewardItems.includes(currentItemIdNum);
              
              // Silver rating: show all items from FATE's items array
              // Silver rating gives 1x of each reward item
              const silverRewardItems = rewardItems;
              
              // Gold rating: same items as silver but with ×5 quantity (displayed in UI)
              // Gold rating gives 5x of each reward item (same items as silver)
              const goldRewardItems = rewardItems;
              
              // Rare rating: show current item if it's not in the items array but FATE is in sources for this item
              // This handles cases where an item is a rare drop from FATE but not in the standard reward list
              // Only show as rare if there are other reward items (meaning current item is separate from standard rewards)
              const rareRewardItems = (!isCurrentItemInRewards && isFateInSourcesForItem && rewardItemsRaw.length > 0) ? [currentItemIdNum] : [];
              
              // Check if this FATE is a notorious monster (惡名精英) - usually level 32+ and specific icon
              const isNotoriousMonster = displayLevel && displayLevel >= 32 && fateIcon.includes('060958');
              
              // Create wiki URL using Simplified Chinese name with "临危受命:" prefix (only if available)
              const wikiUrl = fateNameZh ? `https://ff14.huijiwiki.com/wiki/临危受命:${encodeURIComponent(fateNameZh)}` : null;
              
              return (
                <div key={fateIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center`}>
                  <div className="flex items-center gap-2 mb-1">
                    <img src={fateIcon} alt="FATE" className="w-7 h-7 object-contain" />
                    <div className="flex-1 min-w-0">
                      {wikiUrl ? (
                        <a
                          href={wikiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="text-sm font-medium text-blue-400 hover:text-ffxiv-gold hover:underline transition-colors cursor-pointer"
                        >
                          {fateName}
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-300">{fateName}</span>
                      )}
                      {displayLevel && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {displayLevel}級危命任務
                          {isNotoriousMonster && <span className="ml-1 text-yellow-400">惡名精英</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Reward Items with Ratings */}
                  {(silverRewardItems.length > 0 || goldRewardItems.length > 0 || rareRewardItems.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 w-full">
                      <div className="text-xs text-gray-400 mb-2 font-medium">獎勵物品</div>
                      <div className="w-full border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/30">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-700/50">
                              <th className="text-left text-gray-400 font-normal py-2 px-3 w-20">評價</th>
                              <th className="text-left text-gray-400 font-normal py-2 px-3">獎勵物品</th>
                            </tr>
                          </thead>
                            <tbody>
                            {/* Gold Rating - best rating, show first */}
                            {goldRewardItems.length > 0 && (
                              <tr className="border-b border-slate-700/30 bg-slate-900/30">
                                <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">金牌</td>
                                <td className="py-2.5 px-3 w-auto">
                                  <div className="flex flex-wrap gap-2">
                                    {goldRewardItems.map((rewardItemId) => {
                                      const rewardItem = loadedData.twItems[rewardItemId] || loadedData.twItems[String(rewardItemId)];
                                      if (!rewardItem || !rewardItem.tw) {
                                        console.warn(`[ObtainMethods] ⚠️ FATE ${fateId} reward item ${rewardItemId} missing twItems data for gold rating.`);
                                        return null;
                                      }
                                      
                                      // Show quantity ×5 for gold rating
                                      const quantityText = ' ×5';
                                      
                                      return (
                                        <button
                                          key={`gold-${rewardItemId}`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (onItemClick) {
                                              getItemById(rewardItemId).then(item => {
                                                if (item) {
                                                  onItemClick(item, { fromObtainable: true });
                                                } else {
                                                  const itemUrl = generateItemUrl(rewardItemId, 'item');
                                                  navigate(itemUrl);
                                                }
                                              });
                                            } else {
                                              const itemUrl = generateItemUrl(rewardItemId, 'item');
                                              navigate(itemUrl);
                                            }
                                          }}
                                          className="flex items-center gap-1.5 text-blue-400 hover:text-ffxiv-gold transition-colors"
                                        >
                                          <ItemImage
                                            itemId={rewardItemId}
                                            alt={rewardItem.tw}
                                            className="w-5 h-5 object-contain"
                                          />
                                          <span className="hover:underline">{rewardItem.tw}{quantityText}</span>
                                        </button>
                                      );
                                    }).filter(Boolean)}
                                  </div>
                                </td>
                              </tr>
                            )}
                            
                            {/* Silver Rating - show after gold */}
                            {silverRewardItems.length > 0 && (
                              <tr className="bg-slate-900/30">
                                <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">銀牌</td>
                                <td className="py-2.5 px-3 w-auto">
                                  <div className="flex flex-wrap gap-2">
                                    {silverRewardItems.map((rewardItemId) => {
                                      const rewardItem = loadedData.twItems[rewardItemId] || loadedData.twItems[String(rewardItemId)];
                                      if (!rewardItem || !rewardItem.tw) {
                                        console.warn(`[ObtainMethods] ⚠️ FATE ${fateId} reward item ${rewardItemId} missing twItems data. Available twItems keys:`, Object.keys(loadedData.twItems || {}).slice(0, 5));
                                        return null;
                                      }
                                      
                                      return (
                                        <button
                                          key={`silver-${rewardItemId}`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (onItemClick) {
                                              getItemById(rewardItemId).then(item => {
                                                if (item) {
                                                  onItemClick(item, { fromObtainable: true });
                                                } else {
                                                  const itemUrl = generateItemUrl(rewardItemId, 'item');
                                                  navigate(itemUrl);
                                                }
                                              });
                                            } else {
                                              const itemUrl = generateItemUrl(rewardItemId, 'item');
                                              navigate(itemUrl);
                                            }
                                          }}
                                          className="flex items-center gap-1.5 text-blue-400 hover:text-ffxiv-gold transition-colors"
                                        >
                                          <ItemImage
                                            itemId={rewardItemId}
                                            alt={rewardItem.tw}
                                            className="w-5 h-5 object-contain"
                                          />
                                          <span className="hover:underline">{rewardItem.tw}</span>
                                        </button>
                                      );
                                    }).filter(Boolean)}
                                  </div>
                                </td>
                              </tr>
                            )}
                            
                            {/* Rare Rating - show last */}
                            {rareRewardItems.length > 0 && (
                              <tr className="bg-slate-900/30">
                                <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">稀有</td>
                                <td className="py-2.5 px-3 w-auto">
                                  <div className="flex flex-wrap gap-2">
                                    {rareRewardItems.map((rewardItemId) => {
                                      const rewardItem = loadedData.twItems[rewardItemId] || loadedData.twItems[String(rewardItemId)];
                                      if (!rewardItem || !rewardItem.tw) return null;
                                      
                                      return (
                                        <button
                                          key={`rare-${rewardItemId}`}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (onItemClick) {
                                              getItemById(rewardItemId).then(item => {
                                                if (item) {
                                                  onItemClick(item, { fromObtainable: true });
                                                } else {
                                                  const itemUrl = generateItemUrl(rewardItemId, 'item');
                                                  navigate(itemUrl);
                                                }
                                              });
                                            } else {
                                              const itemUrl = generateItemUrl(rewardItemId, 'item');
                                              navigate(itemUrl);
                                            }
                                          }}
                                          className="flex items-center gap-1.5 text-blue-400 hover:text-ffxiv-gold transition-colors"
                                        >
                                          <ItemImage
                                            itemId={rewardItemId}
                                            alt={rewardItem.tw}
                                            className="w-5 h-5 object-contain"
                                          />
                                          <span className="hover:underline">{rewardItem.tw}</span>
                                        </button>
                                      );
                                    }).filter(Boolean)}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                )}
                  
                  {hasLocation && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapModal({
                          isOpen: true,
                          zoneName,
                          x: fateCoords.x,
                          y: fateCoords.y,
                          npcName: fateName,
                          mapId: fateMapId,
                        });
                      }}
                      className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                    >
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span>
                        {zoneName}
                        <span className="ml-2">
                          X: {fateCoords.x.toFixed(1)} - Y: {fateCoords.y.toFixed(1)}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // ISLAND_PASTURE (島嶼牧場) - These are Eureka-related sources and should not be displayed
    // They are filtered out earlier in the useEffect, so this should never be reached
    // But keeping this as a safety check
    if (type === DataType.ISLAND_PASTURE) {
      return null;
    }

    // Gathered By (採集獲得) - new structure: { nodes: [...], gatheringType, level }
    if (type === DataType.GATHERED_BY) {
      const nodes = source.nodes || data?.nodes;
      if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
        return null;
      }

      const masterbooksSource = sources.find(s => s.type === DataType.MASTERBOOKS);
      const masterbookRaw = masterbooksSource?.masterbookItemIds || masterbooksSource?.data || [];
      const masterbookEntries = Array.isArray(masterbookRaw)
        ? masterbookRaw.map(book => {
            if (typeof book === 'object' && book !== null) {
              const bookId = typeof book.id === 'string' ? parseInt(book.id, 10) : book.id;
              const bookName = book.name?.tw || book.name?.zh || book.name?.en;
              return { id: bookId, name: bookName };
            }
            const bookId = typeof book === 'string' ? parseInt(book, 10) : book;
            return { id: bookId, name: null };
          }).filter(entry => entry.id && !isNaN(entry.id))
        : [];

      const validMasterbooks = masterbookEntries.filter(entry => {
        const bookData = loadedData.twItems[entry.id] || loadedData.twItems[String(entry.id)];
        const hasItemData = bookData && bookData.tw;
        const hasNameFromSource = entry.name;
        return hasItemData || hasNameFromSource;
      });

      // Node type icons mapping (based on NodeTypeIconPipe)
      const nodeTypeIcons = {
        0: 'https://xivapi.com/i/060000/060438_hr1.png', // Mining
        1: 'https://xivapi.com/i/060000/060437_hr1.png', // Quarrying
        2: 'https://xivapi.com/i/060000/060433_hr1.png', // Logging
        3: 'https://xivapi.com/i/060000/060432_hr1.png', // Harvesting
        4: 'https://xivapi.com/i/060000/060445_hr1.png', // Fishing
        5: 'https://xivapi.com/i/060000/060465_hr1.png', // Spearfishing
      };

      // Node type names
      const nodeTypeNames = {
        0: '採礦',
        1: '採石',
        2: '採伐',
        3: '割取',
        4: '捕魚師',
        5: '捕魚師',
      };

      const gatheringLevel = source.level || data?.level || 0;
      const starsTooltip = source.stars_tooltip || data?.stars_tooltip || '';
      const rawNodeType = source.gatheringType !== undefined ? source.gatheringType : (data?.type !== undefined ? data.type : (nodes[0]?.type !== undefined ? nodes[0].type : 0));
      // Handle negative types (timed nodes) by using absolute value
      const nodeType = Math.abs(rawNodeType);
      const nodeIcon = nodeTypeIcons[nodeType] || nodeTypeIcons[0];
      const nodeTypeName = nodeTypeNames[nodeType] || '採集';
      const nodePointLabel = nodeType === 4 ? '釣場' : (nodeType === 5 ? '刺魚點' : `${nodeTypeName}採集點`);

      return (
        <div key={`gathered-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src={nodeIcon} alt={nodeTypeName} className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">採集獲得</span>
          </div>
          {validMasterbooks.length > 0 && (
            <div className="mb-3 bg-slate-900/40 border border-slate-700/40 rounded p-2">
              <div className="text-xs text-gray-400 mb-1">需要秘籍：</div>
              <div className="flex flex-wrap gap-2">
                {validMasterbooks.map((entry, bookIndex) => {
                  const bookId = entry.id;
                  const bookData = loadedData.twItems[bookId] || loadedData.twItems[String(bookId)];
                  const bookName = bookData?.tw || entry.name || `物品 ${bookId}`;

                  return (
                    <button
                      key={`gathered-masterbook-${bookIndex}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onItemClick) {
                          getItemById(bookId).then(item => {
                            if (item) {
                              onItemClick(item, { fromObtainable: true });
                            } else {
                              const itemUrl = generateItemUrl(bookId, 'item');
                              navigate(itemUrl);
                            }
                          });
                        } else {
                          const itemUrl = generateItemUrl(bookId, 'item');
                          navigate(itemUrl);
                        }
                      }}
                      className="flex items-center gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded px-2 py-1.5 hover:bg-slate-800/70"
                    >
                      <ItemImage
                        itemId={bookId}
                        alt={bookName}
                        className="w-5 h-5 object-contain"
                      />
                      <span className="hover:underline">{bookName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {nodes.map((node, nodeIndex) => {
              const zoneId = node.zoneId;
              const mapId = node.mapId;
              const coords = node.x !== undefined && node.y !== undefined ? { x: node.x, y: node.y } : null;
              const locationInfo = getLocationInfo({
                zoneId: zoneId,
                mapId: mapId,
                coords: coords,
                radius: node.radius,
                zoneName: node.zoneName,
                contextName: nodePointLabel
              });
              const primaryLocationText = locationInfo.zoneName || locationInfo.displayText;
              const hasCoordsRow = !!locationInfo.zoneName && !!locationInfo.coordsText;
              const nodeLevel = node.level || gatheringLevel;
              const isLimited = node.limited === true;
              const isIslandNode = node.isIslandNode === true;
              const isFishingType = nodeType === 4 || nodeType === 5;
              const fishCakeUrl = isFishingType && node.nodeId
                ? `https://fish.ffmomola.com/ng/#/wiki/fishing/spot/${node.nodeId}/fish/${itemId}`
                : null;
              const timing = isLimited
                ? getLimitedNodeTiming(node.spawns, node.duration, eorzeaTime.totalMinutes)
                : null;

              return (
                <div key={nodeIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center`}>
                  <div className="flex items-center gap-2 mb-1">
                    <img src={nodeIcon} alt={nodeTypeName} className="w-9 h-9 object-contain" />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      {!isIslandNode && nodeLevel > 0 && (
                        <div className="text-sm text-gray-200">
                          Lv.{nodeLevel} {nodeTypeName}
                          {isLimited && <span className="ml-1 text-yellow-400">限時</span>}
                        </div>
                      )}
                      {fishCakeUrl && (
                        <a
                          href={fishCakeUrl}
                          target="_blank"
                          rel="nofollow noreferrer noopener"
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 mt-1 text-xs text-blue-300 hover:text-blue-200 hover:underline"
                        >
                          <img
                            alt="魚糕"
                            src="/pastry-fish.png"
                            width="16"
                            height="16"
                            className="w-4 h-4 object-contain"
                          />
                          <span>魚糕</span>
                        </a>
                      )}
                      {isIslandNode && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          島嶼採集點
                        </div>
                      )}
                    </div>
                  </div>

                  {isLimited && timing && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={timing.state === 'spawned' ? 'text-emerald-300' : 'text-amber-300'}>
                          {timing.state === 'spawned' ? '可採集' : '距離下次出現'}
                        </span>
                        <span className="text-gray-300">{formatEorzeaDuration(timing.remainingMinutes)} ET</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded bg-slate-800/80 overflow-hidden">
                        <div
                          className={`h-full ${timing.state === 'spawned' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          style={{ width: `${Math.round(timing.progress * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-gray-400">
                        {timing.state === 'spawned'
                          ? `剩餘 ${formatEorzeaDuration(timing.remainingMinutes)} ET`
                          : `下一次 ${formatEorzeaTimeOfDay(timing.nextSpawnStart)} ET`}
                      </div>
                    </div>
                  )}
                  
                  {locationInfo.hasLocation && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openMapModal(locationInfo, nodePointLabel);
                      }}
                      className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                    >
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="flex flex-col justify-center items-start leading-tight">
                        <span>
                          {primaryLocationText}
                        </span>
                        {hasCoordsRow && (
                          <span className="text-[11px] text-blue-300/90 mt-0.5">
                            {locationInfo.coordsText}
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Reduced From (分解獲得) - data is an array of item IDs that can be reduced to get this item
    if (type === DataType.REDUCED_FROM) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validReductionItems = data.filter(itemId => {
        const itemData = loadedData.twItems[itemId] || loadedData.twItems[String(itemId)];
        return itemData && itemData.tw;
      });
      
      if (validReductionItems.length === 0) {
        return null;
      }
      
      return (
        <div key={`reduced-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061808_hr1.png" alt="Reduction" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">分解獲得</span>
          </div>
          <div className={validReductionItems.length === 1 ? "flex justify-center gap-2 mt-2" : (totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1')}>
            {validReductionItems.map((reductionItemId, reductionIndex) => {
              const reductionItemData = loadedData.twItems[reductionItemId] || loadedData.twItems[String(reductionItemId)];
              const reductionName = reductionItemData?.tw;
              
              if (!reductionName) return null;
              
              return (
                <button
                  key={reductionIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(reductionItemId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(reductionItemId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(reductionItemId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
                >
                  <ItemImage
                    itemId={reductionItemId}
                    alt={reductionName}
                    className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
                  />
                  <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={reductionName}>
                    {reductionName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Ventures (雇員探險) - new structure: { tasks: [{id, level, reqGathering, quantities, ...}] }
    if (type === DataType.VENTURES) {
      const tasks = source.tasks || data;
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return null;
      }

      return (
        <div key={`venture-${index}`} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start">
          {/* Card header */}
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700/50">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900/60 border border-slate-600/50">
              <img src="https://xivapi.com/i/065000/065049.png" alt="Venture" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <span className="text-ffxiv-gold font-semibold text-base tracking-wide">雇員探險</span>
              <p className="text-xs text-slate-400 mt-0.5">派遣雇員進行探險以獲得道具</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {tasks.map((task, taskIdx) => {
              const taskId = typeof task === 'object' && task !== null ? task.id : task;
              const taskFromLookup = taskId !== undefined && taskId !== null
                ? (loadedDataRef.current.retainerTasksById?.[taskId] || loadedDataRef.current.retainerTasksById?.[String(taskId)])
                : null;
              const mergedTask = taskFromLookup
                ? { ...taskFromLookup, ...(typeof task === 'object' && task !== null ? task : {}) }
                : (typeof task === 'object' && task !== null ? task : { id: taskId });
              const quantities = Array.isArray(mergedTask?.quantities) ? mergedTask.quantities : [];
              const level = mergedTask?.level ?? mergedTask?.lvl;
              const reqGathering = mergedTask?.reqGathering ?? 0;
              const reqIlvl = mergedTask?.reqIlvl ?? 0;
              const categoryId = mergedTask?.category ?? null;
              const categoryName = categoryId !== null && categoryId !== undefined
                ? (twJobCategoriesData[categoryId]?.tw || twJobCategoriesData[String(categoryId)]?.tw)
                : null;

              return (
                <div
                  key={taskIdx}
                  className={`${getMethodCardLayoutClass(tasks.length)} rounded-xl p-4 flex flex-col gap-3 bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/60 transition-all duration-200`}
                >
                  {/* Level & category row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ffxiv-gold/15 border border-ffxiv-gold/40 text-ffxiv-gold font-semibold text-sm">
                      Lv.{level ?? '?'}
                    </span>
                    {categoryName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-700/50 border border-slate-600/50 text-xs text-slate-300 font-medium">
                        {categoryName}
                      </span>
                    )}
                    {reqGathering > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 font-medium">
                        採集力 {reqGathering}+
                      </span>
                    )}
                    {reqIlvl > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/30 text-xs text-violet-400 font-medium">
                        裝等 {reqIlvl}+
                      </span>
                    )}
                  </div>

                  {/* Quantity tiers - one row per tier, with icon and labels */}
                  {quantities.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">獲得數量</div>
                      {quantities.map((entry, qIdx) => {
                        const statLabel = entry?.stat === 'perception' ? '感知' : '裝等';
                        const statValue = entry?.value !== undefined && entry?.value !== null ? entry.value : null;
                        const qty = entry?.quantity ?? '?';
                        const conditionText = statValue !== null
                          ? `${statLabel} ${statValue}+`
                          : `需求 ${reqGathering}+`;
                        const isPerception = entry?.stat === 'perception';
                        const isIlvl = entry?.stat !== 'perception' && statValue != null;
                        return (
                          <div
                            key={qIdx}
                            className="flex items-stretch overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/40"
                          >
                            <div className="flex items-center justify-center w-10 shrink-0 border-r border-slate-600/50 bg-slate-700/30">
                              {isPerception ? (
                                <svg className="w-5 h-5 text-amber-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : isIlvl ? (
                                <svg className="w-5 h-5 text-violet-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 items-center py-2.5 px-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-wider text-slate-500">條件</div>
                                <div className="text-sm font-medium text-slate-200">{conditionText}</div>
                              </div>
                            </div>
                            <div className="w-px bg-slate-600/60 shrink-0" aria-hidden />
                            <div className="flex shrink-0 flex-col items-center justify-center border-l border-emerald-500/30 bg-emerald-500/10 py-2.5 px-4 min-w-[4.5rem]">
                              <div className="text-[11px] uppercase tracking-wider text-emerald-400/70">數量</div>
                              <div className="flex items-baseline gap-0.5">
                                <span className="font-bold text-emerald-400 text-lg tabular-nums">{qty}</span>
                                <span className="text-xs text-emerald-400/80">個</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Gardening (園藝獲得) - data can be object { seedItemId, crossBreeds } or array of seeds
    if (type === DataType.GARDENING) {
      let seedIds = [];
      if (data && typeof data === 'object' && !Array.isArray(data) && (data.seedItemId != null || source.seedItemId != null)) {
        const mainSeed = data.seedItemId ?? source.seedItemId;
        if (mainSeed != null) seedIds.push(mainSeed);
        const crossBreeds = data.crossBreeds ?? source.crossBreeds;
        if (Array.isArray(crossBreeds) && crossBreeds.length > 0) {
          crossBreeds.forEach(cb => {
            const id = typeof cb === 'object' && cb !== null && 'id' in cb ? cb.id : cb;
            if (id != null) seedIds.push(typeof id === 'number' ? id : parseInt(id, 10));
          });
        }
      } else if (Array.isArray(data) && data.length > 0) {
        data.forEach(seed => {
          const seedId = typeof seed === 'object' ? seed.id : seed;
          if (seedId != null) seedIds.push(typeof seedId === 'number' ? seedId : parseInt(seedId, 10));
        });
      }
      if (seedIds.length === 0) {
        return null;
      }

      const validSeeds = seedIds.filter(seedId => {
        const seedData = loadedData.twItems[seedId] || loadedData.twItems[String(seedId)];
        return seedData && seedData.tw;
      });

      if (validSeeds.length === 0) {
        return null;
      }

      return (
        <div key={`gardening-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061808_hr1.png" alt="Gardening" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">園藝獲得</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validSeeds.map((seedId, seedIndex) => {
              const seedData = loadedData.twItems[seedId] || loadedData.twItems[String(seedId)];
              const seedName = seedData?.tw;
              
              if (!seedName) return null;
              
              return (
                <button
                  key={seedId}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(seedId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(seedId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(seedId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]`}
                >
                  <ItemImage
                    itemId={seedId}
                    alt={seedName}
                    className="w-7 h-7 object-contain"
                  />
                  <span className="hover:underline">{seedName}</span>
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Mogstation (商城購買) - data can be object { id, price } (from build) or legacy array
    if (type === DataType.MOGSTATION) {
      const hasData = data && (
        (typeof data === 'object' && !Array.isArray(data) && (data.id != null || source.productId != null))
        || (Array.isArray(data) && data.length > 0)
      );
      if (!hasData) {
        return null;
      }

      return (
        <div key={`mogstation-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/065000/065002_hr1.png" alt="Mogstation" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">商城購買</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            <div className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center`}>
              <div className="text-sm text-gray-300 text-center">
                可在 Mog Station 商城購買
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Island Crop (島嶼作物) / Levequest (理符任務) - data can be object { seed }, or array of levequest objects
    if (type === DataType.ISLAND_CROP) {
      // Use ref to access latest loadedData immediately, avoiding stale state issues
      const currentLoadedData = loadedDataRef.current;

      // Build format: data is object { seed: number } or source.seedItemId
      const seedIdFromObject = (data && typeof data === 'object' && !Array.isArray(data) && (data.seed != null || data.seedItemId != null))
        ? (data.seed ?? data.seedItemId ?? source.seedItemId)
        : null;
      if (seedIdFromObject != null) {
        const seedId = typeof seedIdFromObject === 'number' ? seedIdFromObject : parseInt(seedIdFromObject, 10);
        const seedData = currentLoadedData.twItems[seedId] || currentLoadedData.twItems[String(seedId)];
        const seedName = seedData?.tw;
        return (
          <div key={`island-crop-requirement-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/i/063000/063950_hr1.png" alt="Island Crop" className="w-8 h-8" />
              <span className="text-ffxiv-gold font-medium">島嶼作物</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">
              在島嶼聖域種植種子獲得
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="w-full">
                <div className="text-xs text-gray-400 mb-1">所需種子：</div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(seedId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(seedId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(seedId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className="w-full flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
                >
                  <ItemImage
                    itemId={seedId}
                    alt={seedName || `種子 ${seedId}`}
                    className="w-7 h-7 object-contain flex-shrink-0"
                  />
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="hover:underline font-medium truncate w-full">
                      {seedName || `種子 (ID: ${seedId})`}
                    </span>
                    {!seedName && (
                      <span className="text-xs text-gray-500 mt-0.5">資料載入中...</span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      // Check if data is levequest format (has 'id', 'lvl', 'item' properties)
      const firstItem = data[0];
      const isLevequestFormat = firstItem && typeof firstItem === 'object' && 'id' in firstItem && 'lvl' in firstItem && 'item' in firstItem;
      
      if (isLevequestFormat) {
        // This is actually levequest data, display as levequests (理符任務)
        // Also collect levequests from QUESTS sources to display together
        // Collect all levequests from QUESTS sources
        const questLevequests = [];
        sources.forEach(s => {
          if (s.type === DataType.QUESTS && Array.isArray(s.data)) {
            s.data.forEach(questItem => {
              const questId = typeof questItem === 'object' && questItem !== null && 'id' in questItem ? questItem.id : questItem;
              if (questId) {
                // Check if this is a levequest (not a regular quest)
                const leveData = twLevesStaticData && (twLevesStaticData[questId] || twLevesStaticData[String(questId)]);
                if (leveData && leveData.tw) {
                  // Convert to levequest format for display
                  // Use the current itemId from component props (the item we're showing sources for)
                  questLevequests.push({
                    id: questId,
                    lvl: null, // Will get from leves_database_pages
                    level: null,
                    item: itemId, // Use current itemId from component props
                    cost: null,
                    exp: null,
                    gil: null,
                    fromQuests: true // Mark as from QUESTS source
                  });
                }
              }
            });
          }
        });
        
        // Combine ISLAND_CROP levequests with QUESTS levequests
        const allLevequests = [...data, ...questLevequests];
        
        return (
          <div key={`levequest-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/c/Leve.png" alt="Levequest" className="w-10 h-10" />
              <span className="text-ffxiv-gold font-medium">理符任務</span>
            </div>
            <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
              {allLevequests.map((leve, leveIndex) => {
                if (!leve || typeof leve !== 'object') return null;
                
                const leveId = leve.id;
                const leveLevel = leve.lvl || leve.level;
                const itemId = leve.item;
                
                // Get detailed leve data from loaded data
                const leveDbData = currentLoadedData.levesDatabasePages && (currentLoadedData.levesDatabasePages[leveId] || currentLoadedData.levesDatabasePages[String(leveId)]);
                
                // Get leve name from tw-leves.json or database pages
                const leveNameData = twLevesStaticData && (twLevesStaticData[leveId] || twLevesStaticData[String(leveId)]);
                const leveName = leveNameData?.tw || leveDbData?.zh || leveDbData?.en || `理符任務 ${leveId}`;
                
                // Get item name
                const itemData = currentLoadedData.twItems[itemId] || currentLoadedData.twItems[String(itemId)];
                const itemName = itemData?.tw || `物品 ${itemId}`;
                
                // Get NPC info
                const npcs = leveDbData?.npcs || [];
                const npcIds = npcs.map(npc => npc.id).filter(Boolean);
                const npcNames = npcIds.map(npcId => {
                  const npcData = currentLoadedData.twNpcs[npcId] || currentLoadedData.twNpcs[String(npcId)];
                  const npcDb = currentLoadedData.npcsDatabasePages[npcId] || currentLoadedData.npcsDatabasePages[String(npcId)];
                  const name = npcData?.tw || npcDb?.zh || npcDb?.en || null;
                  // If name is still null, the data might not be loaded yet - return a placeholder that will update when data loads
                  if (!name) {
                    console.warn(`[ObtainMethods] ⚠️ NPC ${npcId} name not found. twNpcs has:`, Object.keys(currentLoadedData.twNpcs).slice(0, 5), `npcsDatabasePages has:`, Object.keys(currentLoadedData.npcsDatabasePages).slice(0, 5));
                    return `NPC ${npcId}`;
                  }
                  return name;
                });
                
                // Get NPC positions (keep null values to maintain index alignment with npcNames)
                // Try npcsDatabasePages first, then fallback to npcs.json, then JSON file
                // Also check loadedData state in addition to currentLoadedData ref to ensure we get latest data
                const npcPositions = npcIds.map(npcId => {
                  // First try npcsDatabasePages (from both ref and state)
                  const npcDbRef = currentLoadedData.npcsDatabasePages[npcId] || currentLoadedData.npcsDatabasePages[String(npcId)];
                  const npcDbState = loadedData.npcsDatabasePages[npcId] || loadedData.npcsDatabasePages[String(npcId)];
                  const npcDb = npcDbRef || npcDbState;
                  if (npcDb?.position) {
                    return npcDb.position;
                  }
                  // Fallback to npcs.json (from getNpcsByIds) - check both ref and state
                  const npcDataRef = currentLoadedData.npcs[npcId] || currentLoadedData.npcs[String(npcId)];
                  const npcDataState = loadedData.npcs[npcId] || loadedData.npcs[String(npcId)];
                  const npcData = npcDataRef || npcDataState;
                  if (npcData?.position) {
                    return npcData.position;
                  }
                  return null;
                });
                
                // Get required items (items array from leve data)
                const requiredItems = leveDbData?.items || [];
                
                // Get rewards with probabilities
                const rewards = leveDbData?.rewards || [];
                
                // Get cost (allowance cost)
                const cost = leveDbData?.cost || leve.cost || null;
                
                // Get Simplified Chinese name for wiki link (lazy load on click)
                const leveNameZh = leveDbData?.zh || null;
                
                // Create wiki URL using Simplified Chinese name with "任务:" prefix
                const wikiUrl = leveNameZh ? `https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(leveNameZh)}` : null;
                
                const hasDetailSections = requiredItems.length > 0 || rewards.length > 0 || npcNames.length > 0;

                return (
                  <div key={leveIndex} className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-3 ${hasDetailSections ? 'min-h-[100px] gap-2' : 'gap-1' } flex flex-col`}>
                    {/* Leve name with wiki link - same style as FATE */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        {wikiUrl ? (
                          <a
                            href={wikiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="text-sm font-medium text-blue-400 hover:text-ffxiv-gold hover:underline transition-colors cursor-pointer"
                          >
                            {leveName}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-gray-300">{leveName}</span>
                        )}
                        {(leveLevel || cost !== null) && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {leveLevel && <span>等級 {leveLevel}</span>}
                            {leveLevel && cost !== null && <span> • </span>}
                            {cost !== null && <span>理符點數: {cost}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Required items from items array */}
                    {requiredItems.length > 0 && (
                      <div className="text-xs text-gray-400">
                        <div className="mb-1">需要物品:</div>
                        <div className="flex flex-wrap gap-2">
                          {requiredItems.map((reqItem, reqIndex) => {
                            const reqItemData = currentLoadedData.twItems[reqItem.id] || currentLoadedData.twItems[String(reqItem.id)];
                            const reqItemName = reqItemData?.tw || `物品 ${reqItem.id}`;
                            return (
                              <button
                                key={reqIndex}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (onItemClick) {
                                    getItemById(reqItem.id).then(item => {
                                      if (item) {
                                        onItemClick(item, { fromObtainable: true });
                                      } else {
                                        const itemUrl = generateItemUrl(reqItem.id, 'item');
                                        navigate(itemUrl);
                                      }
                                    });
                                  } else {
                                    const itemUrl = generateItemUrl(reqItem.id, 'item');
                                    navigate(itemUrl);
                                  }
                                }}
                                className="flex items-center gap-1 text-blue-400 hover:text-ffxiv-gold hover:underline transition-colors"
                              >
                                <ItemImage
                                  itemId={reqItem.id}
                                  alt={reqItemName}
                                  className="w-4 h-4 object-contain flex-shrink-0"
                                />
                                <span>{reqItemName} x{reqItem.amount || 1}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Rewards with probabilities */}
                    {rewards.length > 0 && (
                      <div className="text-xs text-gray-400">
                        <div className="mb-1">獎勵:</div>
                        <div className="space-y-1">
                          {rewards.map((reward, rewardIndex) => {
                            const rewardItemData = currentLoadedData.twItems[reward.id] || currentLoadedData.twItems[String(reward.id)];
                            const rewardItemName = rewardItemData?.tw || `物品 ${reward.id}`;
                            return (
                              <div key={rewardIndex} className="flex items-center gap-2">
                                <ItemImage
                                  itemId={reward.id}
                                  alt={rewardItemName}
                                  className="w-5 h-5 object-contain flex-shrink-0"
                                />
                                <span className="text-gray-300">
                                  {rewardItemName} x{reward.amount || 1}
                                </span>
                                {reward.chances !== undefined && (
                                  <span className="text-yellow-400">
                                    ({reward.chances}%)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* NPC locations - same style as TRADE_SOURCES */}
                    {npcNames.length > 0 && (
                      <div className="text-xs space-y-1.5">
                        {npcNames.map((npcName, npcIndex) => {
                          const npcPosition = npcPositions[npcIndex];
                          const npcId = npcIds[npcIndex];
                          
                          const zoneId = npcPosition?.zoneid;
                          const mapId = npcPosition?.map;
                          const coords = npcPosition && npcPosition.x !== undefined && npcPosition.y !== undefined 
                            ? { x: npcPosition.x, y: npcPosition.y } : null;
                          
                          // 使用中心化的地图位置管理
                          const locationInfo = getLocationInfo({
                            zoneId: zoneId,
                            mapId: mapId,
                            coords: coords,
                            contextName: npcName
                          });
                          
                          return (
                            <div key={`npc-${npcIndex}`} className="text-xs">
                              <div className="flex items-center gap-0.5">
                                <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-4 h-4 flex-shrink-0 grayscale opacity-70" />
                                <div className="text-gray-300 font-medium">{npcName}</div>
                              </div>
                              {locationInfo.hasLocation && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openMapModal(locationInfo, npcName);
                                  }}
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors mt-0.5"
                                  title={locationInfo.displayText}
                                >
                                  <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  <span className="text-gray-400">
                                    {locationInfo.displayText}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        );
      }
      
      // Original island crop format - array of item IDs
      const validCrops = data.filter(cropId => {
        const cropData = currentLoadedData.twItems[cropId] || currentLoadedData.twItems[String(cropId)];
        return cropData && cropData.tw;
      });
      
      if (validCrops.length === 0) {
        return null;
      }
      
      return (
        <div key={`island-crop-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/063000/063950_hr1.png" alt="Island Crop" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">島嶼作物</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validCrops.map((cropId, cropIndex) => {
              const cropData = currentLoadedData.twItems[cropId] || currentLoadedData.twItems[String(cropId)];
              const cropName = cropData?.tw;
              
              if (!cropName) return null;
              
              return (
                <button
                  key={cropIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(cropId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(cropId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(cropId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]`}
                >
                  <ItemImage
                    itemId={cropId}
                    alt={cropName}
                    className="w-7 h-7 object-contain"
                  />
                  <span className="hover:underline">{cropName}</span>
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Voyages (遠航探索) - new structure: { voyages: [{type, id, name}], totalVoyages }
    if (type === DataType.VOYAGES) {
      const voyages = source.voyages || data;
      if (!voyages || !Array.isArray(voyages) || voyages.length === 0) {
        return null;
      }

      return (
        <div key={`voyage-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/027000/027841_hr1.png" alt="Voyage" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">遠航探索</span>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {voyages.map((voyage, idx) => {
              const voyageName = voyage.name?.en || `Voyage ${voyage.id}`;
              const voyageType = voyage.type === 1 ? '潛水艇' : '飛空艇';
              
              return (
                <div key={idx} className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
                  <div className="text-sm text-blue-400">
                    <span className="text-gray-500">[{voyageType}]</span> {voyageName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Island Crop (島嶼作物) - Special case when data has {seed: number} format
    // Type 23 is ISLAND_CROP, not REQUIREMENTS
    if (type === DataType.ISLAND_CROP) {
      // Check if data is an island crop format: {seed: number}
      if (data && typeof data === 'object' && !Array.isArray(data) && 'seed' in data && typeof data.seed === 'number') {
        // This is actually an island crop, display it as such
        const seedId = data.seed;
        const seedData = currentLoadedData.twItems[seedId] || currentLoadedData.twItems[String(seedId)];
        const seedName = seedData?.tw;
        return (
          <div key={`island-crop-requirement-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/i/063000/063950_hr1.png" alt="Island Crop" className="w-8 h-8" />
              <span className="text-ffxiv-gold font-medium">島嶼作物</span>
            </div>
            <div className="text-xs text-gray-400 mb-2">
              在島嶼聖域種植種子獲得
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="w-full">
                <div className="text-xs text-gray-400 mb-1">所需種子：</div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(seedId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(seedId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(seedId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className="w-full flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
                >
                  <ItemImage
                    itemId={seedId}
                    alt={seedName || `種子 ${seedId}`}
                    className="w-7 h-7 object-contain flex-shrink-0"
                  />
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="hover:underline font-medium truncate w-full">
                      {seedName || `種子 (ID: ${seedId})`}
                    </span>
                    {!seedName && (
                      <span className="text-xs text-gray-500 mt-0.5">資料載入中...</span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      }
      
      // Normal requirements handling (array of item IDs)
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validRequirements = data.filter(reqId => {
        if (typeof reqId === 'number') {
          const reqData = loadedData.twItems[reqId] || loadedData.twItems[String(reqId)];
          return reqData && reqData.tw;
        }
        return false;
      });
      
      if (validRequirements.length === 0) {
        return null;
      }
      
      return (
        <div key={`requirement-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060453_hr1.png" alt="Requirement" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">需求</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validRequirements.map((reqId, reqIndex) => {
              const reqData = loadedData.twItems[reqId] || loadedData.twItems[String(reqId)];
              const reqName = reqData?.tw;
              
              if (!reqName) return null;
              
              return (
                <button
                  key={reqIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(reqId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          const itemUrl = generateItemUrl(reqId, 'item');
                          navigate(itemUrl);
                        }
                      });
                    } else {
                      const itemUrl = generateItemUrl(reqId, 'item');
                      navigate(itemUrl);
                    }
                  }}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]`}
                >
                  <ItemImage
                    itemId={reqId}
                    alt={reqName}
                    className="w-7 h-7 object-contain"
                  />
                  <span className="hover:underline">{reqName}</span>
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Masterbooks (製作書) - data is an array of CompactMasterbook objects: [{id: number|string, name?: I18nName}]
    if (type === DataType.MASTERBOOKS) {
      const hasGatheredBy = sources.some(s => s.type === DataType.GATHERED_BY);
      const hasCraftedBy = sources.some(s => s.type === DataType.CRAFTED_BY);
      if (hasGatheredBy || hasCraftedBy){
        return null;
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      // Extract masterbook IDs from objects or use direct IDs
      const masterbookEntries = data.map(book => {
        // Handle both object format {id: number, name?: I18nName} and direct ID format
        if (typeof book === 'object' && book !== null) {
          const bookId = typeof book.id === 'string' ? parseInt(book.id, 10) : book.id;
          const bookName = book.name?.tw || book.name?.zh || book.name?.en;
          return { id: bookId, name: bookName };
        } else {
          // Direct ID format (number or string)
          const bookId = typeof book === 'string' ? parseInt(book, 10) : book;
          return { id: bookId, name: null };
        }
      }).filter(entry => entry.id && !isNaN(entry.id));

      // Filter valid masterbooks - only show entries that have data in database or name from source
      // Don't show entries that are just IDs without any data
      const validMasterbooks = masterbookEntries.filter(entry => {
        const bookData = loadedData.twItems[entry.id] || loadedData.twItems[String(entry.id)];
        const hasItemData = bookData && bookData.tw;
        const hasNameFromSource = entry.name;
        // Only show if we have item data OR if we have a name from source
        // Don't show if it's just an ID without any data
        return hasItemData || hasNameFromSource;
      });
      
      // Check if all masterbooks are missing from database
      const allMissing = masterbookEntries.length > 0 && validMasterbooks.length === 0;
      
      // If we have valid masterbooks, show them
      if (validMasterbooks.length > 0) {
        // Generate huiji wiki URL for the item
        const huijiUrl = `https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(itemId)}`;
        
        return (
          <div key={`masterbook-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/i/065000/065002_hr1.png" alt="Masterbook" className="w-8 h-8" />
              <span className="text-ffxiv-gold font-medium">製作書</span>
            </div>
            <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
              {validMasterbooks.map((entry, bookIndex) => {
                const bookId = entry.id;
                const bookData = loadedData.twItems[bookId] || loadedData.twItems[String(bookId)];
                // Use item name from loaded data, fallback to name from source
                const bookName = bookData?.tw || entry.name;
                
                return (
                  <button
                    key={bookIndex}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onItemClick) {
                        getItemById(bookId).then(item => {
                          if (item) {
                            onItemClick(item, { fromObtainable: true });
                          } else {
                            const itemUrl = generateItemUrl(bookId, 'item');
                            navigate(itemUrl);
                          }
                        });
                      } else {
                        const itemUrl = generateItemUrl(bookId, 'item');
                        navigate(itemUrl);
                      }
                    }}
                    className={`${getInnerItemLayoutClass(totalMethodCards)} flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]`}
                  >
                    <ItemImage
                      itemId={bookId}
                      alt={bookName}
                      className="w-7 h-7 object-contain"
                    />
                    <span className="hover:underline">{bookName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      
      // If all masterbooks are missing, show activity content notice
      if (allMissing) {
        return (
          <div key={`masterbook-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/i/065000/065002_hr1.png" alt="Masterbook" className="w-8 h-8" />
              <span className="text-ffxiv-gold font-medium">製作書</span>
            </div>
            <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-yellow-400 text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm text-yellow-300 mb-2">
                    此物品的製作書資訊可能來自限時活動內容，資料庫中暫無詳細資料。
                  </p>
                  {wikiUrl ? (
                    <a
                      href={wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500/50 rounded text-sm text-yellow-200 hover:text-yellow-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      查看灰機 Wiki
                    </a>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-600/30 border border-yellow-500/50 rounded text-sm text-yellow-200 opacity-50">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent"></div>
                      載入中...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }
      
      // If no masterbooks at all, return null
      return null;
    }

    // Alarms (鬧鐘提醒) - removed from UI due to unreliable data
    if (type === DataType.ALARMS) {
      return null;
    }

    // Achievements (成就獎勵) - data is an array of achievement IDs
    if (type === DataType.ACHIEVEMENTS) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validAchievements = data.filter(achievementId => {
        const achievementInfo = getAchievementInfo(achievementId);
        return achievementInfo && achievementInfo.name;
      });
      
      if (validAchievements.length === 0) {
        return null;
      }
      
      return (
        <div key={`achievement-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060453_hr1.png" alt="Achievement" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">成就獎勵</span>
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validAchievements.map((achievementId, achievementIndex) => {
              const achievementInfo = getAchievementInfo(achievementId);
              
              if (!achievementInfo) return null;
              
              return (
                <div
                  key={achievementIndex}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center`}
                  onMouseEnter={(e) => handleAchievementMouseEnter(e, achievementId)}
                  onMouseMove={handleAchievementMouseMove}
                  onMouseLeave={handleAchievementMouseLeave}
                >
                  <div className="flex items-center gap-2">
                    {achievementInfo.icon && (
                      <img src={achievementInfo.icon} alt={achievementInfo.name} className="w-7 h-7 object-contain" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-yellow-400 cursor-help underline decoration-dotted decoration-yellow-400/50 hover:decoration-yellow-400 transition-colors">
                        {achievementInfo.name}
                      </div>
                      {achievementInfo.description && (
                        <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                          {achievementInfo.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Requirements (需求材料) - data is an array of drop objects with {id, amount}
    // This represents mob drops with specific quantities
    if (type === DataType.REQUIREMENTS) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      // Get current loaded data from ref for up-to-date access
      const currentLoadedData = loadedDataRef.current;

      const validDrops = data.filter(drop => {
        const mobId = drop.id;
        const mobName = currentLoadedData.twMobs[mobId] || currentLoadedData.twMobs[String(mobId)];
        return mobName;
      });

      if (validDrops.length === 0) {
        return null;
      }

      return (
        <div key={`requirements-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full min-w-0 self-start`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060881.png" alt="Requirements" className="w-8 h-8" />
            <span className="text-ffxiv-gold font-medium">需求材料</span>
          </div>
          <div className="text-xs text-gray-400 mb-2">
            從怪物掉落獲得（特定數量）
          </div>
          <div className={totalMethodCards <= 3 ? INNER_GRID_CLASS_FLEX : 'grid gap-2 mt-2 grid-cols-1'}>
            {validDrops.map((drop, dropIndex) => {
              const mobId = drop.id;
              const amount = drop.amount || 1;
              const mobName = currentLoadedData.twMobs[mobId] || currentLoadedData.twMobs[String(mobId)];

              if (!mobName) return null;

              return (
                <div
                  key={dropIndex}
                  className={`${getInnerItemLayoutClass(totalMethodCards)} bg-slate-900/50 rounded p-2 min-h-[70px] flex items-center justify-between`}
                >
                  <div className="flex-1">
                    <div className="text-sm text-blue-400">
                      {mobName}
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 bg-slate-800 px-2 py-1 rounded">
                    x{amount}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Default fallback - don't render unknown types
    return null;
  };


  // Get achievement info for tooltip
  const achievementTooltipInfo = hoveredAchievement ? getAchievementInfo(hoveredAchievement) : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold flex items-center gap-2">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          取得方式
        </h3>
        {sortedSources.length > 0 && (
          <span className="text-xs text-gray-400 bg-amber-900/40 px-2 py-1 rounded border border-ffxiv-gold/30">
            {sortedSources.length} 種
          </span>
        )}
        
        {/* Filter Tags - Inline with header */}
        {uniqueMethodTypes.length > 1 && (
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <button
              onClick={() => setFilteredMethodType(null)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                filteredMethodType === null
                  ? 'border-ffxiv-gold bg-ffxiv-gold/20 text-ffxiv-gold'
                  : 'border-gray-600 bg-slate-800/50 text-gray-400 hover:border-gray-500 hover:bg-slate-700/50'
              }`}
            >
              全部
            </button>
            {uniqueMethodTypes.map((methodType) => {
              const methodName = methodType;
              if(methodName=="秘籍習得"){
                return null
              }
              const isActive = filteredMethodType === methodType;
              return (
                <button
                  key={methodType}
                  onClick={() => setFilteredMethodType(isActive ? null : methodType)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all border ${
                    isActive
                      ? 'border-ffxiv-gold bg-ffxiv-gold/20 text-ffxiv-gold'
                      : 'border-gray-600 bg-slate-800/50 text-gray-400 hover:border-gray-500 hover:bg-slate-700/50'
                  }`}
                >
                  {methodName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 1–2 種方式時減少欄數以善用橫向空間；3+ 種時維持多欄。子項依高度排序，矮的排最後。 */}
      <div
        ref={methodCardsContainerRef}
        className={`grid gap-3 items-start ${
          validSources.length <= 1 ? 'grid-cols-1' :
          validSources.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
          validSources.length === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}
      >
        {methodOrderByHeight.map((origIdx) => (
          <div key={origIdx} data-original-index={origIdx} className="w-full min-w-0">
            {renderSource(validSources[origIdx], origIdx, false, validSources.length)}
          </div>
        ))}
        {/* Force re-render when NPC data is loaded */}
        {leveNpcsLoaded && <span className="hidden" />}
      </div>

      {/* Achievement Tooltip */}
      {hoveredAchievement && achievementTooltipInfo && (
        <div
          className="fixed z-[9999] bg-slate-900 border-2 border-yellow-400/60 rounded-lg shadow-2xl p-4 max-w-sm pointer-events-auto"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, calc(-100% - 10px))'
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            // Keep tooltip visible when hovering over it
          }}
          onMouseLeave={() => {
            setHoveredAchievement(null);
          }}
        >
          <div className="flex items-start gap-3">
            {achievementTooltipInfo.icon && (
              <img 
                src={achievementTooltipInfo.icon} 
                alt={achievementTooltipInfo.name}
                className="w-12 h-12 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-yellow-400 mb-1">
                {achievementTooltipInfo.name}
              </div>
              {achievementTooltipInfo.description && (
                <div className="text-xs text-gray-300 mb-2 leading-relaxed">
                  {achievementTooltipInfo.description}
                </div>
              )}
              <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-700">
                {achievementTooltipInfo.id && (
                  <div className="text-xs text-gray-400">
                    <span className="text-gray-500">成就ID:</span> {achievementTooltipInfo.id}
                  </div>
                )}
                {achievementTooltipInfo.itemReward && (
                  <div className="text-xs text-gray-400">
                    <span className="text-gray-500">獎勵物品:</span> 
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onItemClick) {
                          getItemById(achievementTooltipInfo.itemReward).then(item => {
                            if (item) {
                              onItemClick(item, { fromObtainable: true });
                            } else {
                              const itemUrl = generateItemUrl(achievementTooltipInfo.itemReward, 'item');
                              navigate(itemUrl);
                            }
                          });
                        } else {
                          const itemUrl = generateItemUrl(achievementTooltipInfo.itemReward, 'item');
                          navigate(itemUrl);
                        }
                        setHoveredAchievement(null);
                      }}
                      className="ml-1 text-ffxiv-gold hover:text-yellow-400 hover:underline pointer-events-auto"
                    >
                      {(loadedData.twItems[achievementTooltipInfo.itemReward] || loadedData.twItems[String(achievementTooltipInfo.itemReward)])?.tw || `Item ${achievementTooltipInfo.itemReward}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <MapModal
        isOpen={mapModal.isOpen}
        onClose={() => setMapModal({ ...mapModal, isOpen: false })}
        zoneName={mapModal.zoneName}
        x={mapModal.x}
        y={mapModal.y}
        npcName={mapModal.npcName}
        mapId={mapModal.mapId}
        radius={mapModal.radius}
      />
    </div>
  );
}

