// Component to display item acquisition methods (取得方式)
// Now uses Supabase for efficient data loading - only queries needed data
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getItemSources, DataType } from '../services/extractsService';
import { getItemById } from '../services/itemDatabase';
import { extractIdsFromSources } from '../utils/extractIdsFromSources';
import { getHuijiWikiUrlForItem } from '../utils/wikiUtils';
import { getPlaceName as getPlaceNameUtil, getPlaceNameWithFallback } from '../utils/placeUtils';
// Supabase batch query functions
import {
  getTwNpcsByIds,
  getNpcsByIds,
  getNpcsDatabasePagesByIds,
  getTwShopsByIds,
  getShopsByIds,
  getShopsByNpcIds,
  getTwInstancesByIds,
  getInstancesByIds,
  getZhInstancesByIds,
  getTwQuestsByIds,
  getQuestsByIds,
  getZhQuestsByIds,
  getQuestsDatabasePagesByIds,
  getTwFatesByIds,
  getFatesByIds,
  getZhFatesByIds,
  getFatesDatabasePagesByIds,
  getTwAchievementsByIds,
  getTwAchievementDescriptionsByIds,
  getAchievementsByIds,
  getTwPlacesByIds,
  getPlacesByIds,
  getFateSourcesByItemId,
  getLootSourcesByItemId,
  getTwItemsByIds
} from '../services/supabaseData';
// Small static files - keep as imports (small size)
import twNpcTitlesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-npc-titles.json';
import twJobAbbrData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';

// All data loading now uses Supabase batch queries - no JSON file loading needed

import MapModal from './MapModal';
import ItemImage from './ItemImage';
export default function ObtainMethods({ itemId, onItemClick, onExpandCraftingTree, isCraftingTreeExpanded = false }) {
  
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
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
  // Use ref to store latest loadedData so renderSource can access it immediately
  // This avoids the issue where renderSource uses stale loadedData state due to async state updates
  const loadedDataRef = useRef({
    twNpcs: {},
    npcs: {},
    npcsDatabasePages: {},
    twShops: {},
    shops: {},
    shopsByNpc: {},
    twInstances: {},
    instances: {},
    zhInstances: {},
    twQuests: {},
    quests: {},
    zhQuests: {},
    questsDatabasePages: {},
    twFates: {},
    fates: {},
    zhFates: {},
    fatesDatabasePages: {},
    twAchievements: {},
    twAchievementDescriptions: {},
    achievements: {},
    twPlaces: {},
    places: {},
    twItems: {},
    fateSources: [],
    lootSources: []
  });
  
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
      const emptyLoadedData = {
        twNpcs: {},
        npcs: {},
        npcsDatabasePages: {},
        twShops: {},
        shops: {},
        shopsByNpc: {},
        twInstances: {},
        instances: {},
        zhInstances: {},
        twQuests: {},
        quests: {},
        zhQuests: {},
        questsDatabasePages: {},
        twFates: {},
        fates: {},
        zhFates: {},
        fatesDatabasePages: {},
        twAchievements: {},
        twAchievementDescriptions: {},
        achievements: {},
        twPlaces: {},
        places: {},
        twItems: {},
        fateSources: [],
        lootSources: []
      };
      setLoadedData(emptyLoadedData);
      // Also update ref to ensure renderSource can access the reset data immediately
      // OPTIMIZED: Direct assignment is fine for empty object (no deep copy needed)
      loadedDataRef.current = emptyLoadedData;
      // Update ref after resetting state
      layoutEffectPrevItemIdRef.current = itemId;
    }
  }, [itemId]);
  
  // Data loaded from Supabase - organized by type for efficient access
  const [loadedData, setLoadedData] = useState({
    // NPC data
    twNpcs: {},
    npcs: {},
    npcsDatabasePages: {},
    // Shop data
    twShops: {},
    shops: {},
    shopsByNpc: {},
    // Instance data
    twInstances: {},
    instances: {},
    zhInstances: {},
    // Quest data
    twQuests: {},
    quests: {},
    zhQuests: {},
    questsDatabasePages: {},
    // FATE data
    twFates: {},
    fates: {},
    zhFates: {},
    fatesDatabasePages: {},
    // Achievement data
    twAchievements: {},
    twAchievementDescriptions: {},
    achievements: {},
    // Place data
    twPlaces: {},
    places: {},
    // Item data (for currency names, etc.)
    twItems: {},
    // Special sources
    fateSources: [],
    lootSources: []
  });
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [wikiUrl, setWikiUrl] = useState(null); // Store Wiki URL for activity content notice

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

  // Load sources and all required data from Supabase
  useEffect(() => {
    if (!itemId) {
      // Don't clear sources or change loading state when itemId is undefined
      // This prevents showing "no obtainable methods" when itemId is temporarily undefined during redirects
      // The component will show loading state due to the !itemId check in the render logic
      return;
    }

    console.log(`[ObtainMethods] Loading obtainable methods for item ${itemId}`);
    
    // Update ref immediately to prevent showing stale data during redirects
    currentItemIdRef.current = itemId;
    
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
    
    // Step 1: Get sources from Supabase
    getItemSources(currentItemId, abortController.signal)
      .then(async sourcesData => {
        // Check if request was cancelled or itemId changed
        if (abortController.signal.aborted) {
          console.log(`[ObtainMethods] ⏹️ Request cancelled for item ${currentItemId}`);
          return;
        }
        
        // Check again if request was cancelled (after async getFateSourcesByItemId)
        if (abortController.signal.aborted) {
          console.log(`[ObtainMethods] ⏹️ Request cancelled for item ${currentItemId} after getFateSourcesByItemId`);
          return;
        }
        
        // Step 2: Extract all required IDs from sources
        
        // Validate sourcesData before processing
        if (!sourcesData || !Array.isArray(sourcesData)) {
          console.warn(`[ObtainMethods] ⚠️ Invalid sources data for item ${currentItemId}:`, sourcesData);
          if (!abortController.signal.aborted) {
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
        
        const requiredIds = extractIdsFromSources(sourcesData);
        
        // Step 2.5: Get FATE IDs from fate_sources table and add to requiredIds
        const fateSourcesFromTable = await getFateSourcesByItemId(currentItemId, abortController.signal);
        if (Array.isArray(fateSourcesFromTable) && fateSourcesFromTable.length > 0) {
          fateSourcesFromTable.forEach(fateId => {
            if (!requiredIds.fateIds.includes(fateId)) {
              requiredIds.fateIds.push(fateId);
            }
          });
          // Also need to query fatesDatabasePages to get zoneIds for these FATEs
          // We'll add zoneIds after we get the FATE data, but we need to ensure we query fatesDatabasePages
        }
        
        // Check again if request was cancelled
        if (abortController.signal.aborted) {
          return;
        }
        
        // Step 3: Batch query Supabase for all required data (parallel)
        const queries = [];
        
        // NPC queries
        if (requiredIds.npcIds.length > 0) {
          queries.push(
            getTwNpcsByIds(requiredIds.npcIds, abortController.signal).then(data => ({ type: 'twNpcs', data })),
            getNpcsByIds(requiredIds.npcIds, abortController.signal).then(data => ({ type: 'npcs', data })),
            getNpcsDatabasePagesByIds(requiredIds.npcIds, abortController.signal).then(data => ({ type: 'npcsDatabasePages', data }))
          );
        }
        
        // Shop queries
        if (requiredIds.shopIds.length > 0) {
          queries.push(
            getTwShopsByIds(requiredIds.shopIds, abortController.signal).then(data => ({ type: 'twShops', data })),
            getShopsByIds(requiredIds.shopIds, abortController.signal).then(data => ({ type: 'shops', data }))
          );
          // Shops by NPC (if we have NPC IDs)
          if (requiredIds.npcIds.length > 0) {
            queries.push(
              getShopsByNpcIds(requiredIds.npcIds, abortController.signal).then(data => ({ type: 'shopsByNpc', data }))
            );
          }
        }
        
        // Instance queries
        if (requiredIds.instanceIds.length > 0) {
          queries.push(
            getTwInstancesByIds(requiredIds.instanceIds, abortController.signal).then(data => ({ type: 'twInstances', data })),
            getInstancesByIds(requiredIds.instanceIds, abortController.signal).then(data => ({ type: 'instances', data })),
            getZhInstancesByIds(requiredIds.instanceIds, abortController.signal).then(data => ({ type: 'zhInstances', data }))
          );
        }
        
        // Quest queries
        if (requiredIds.questIds.length > 0) {
          queries.push(
            getTwQuestsByIds(requiredIds.questIds, abortController.signal).then(data => ({ type: 'twQuests', data })),
            getQuestsByIds(requiredIds.questIds, abortController.signal).then(data => ({ type: 'quests', data })),
            getZhQuestsByIds(requiredIds.questIds, abortController.signal).then(data => ({ type: 'zhQuests', data })),
            getQuestsDatabasePagesByIds(requiredIds.questIds, abortController.signal).then(data => ({ type: 'questsDatabasePages', data }))
          );
        }
        
        // FATE queries
        if (requiredIds.fateIds.length > 0) {
          queries.push(
            getTwFatesByIds(requiredIds.fateIds, abortController.signal).then(data => ({ type: 'twFates', data })),
            getFatesByIds(requiredIds.fateIds, abortController.signal).then(data => ({ type: 'fates', data })),
            getZhFatesByIds(requiredIds.fateIds, abortController.signal).then(data => ({ type: 'zhFates', data })),
            getFatesDatabasePagesByIds(requiredIds.fateIds, abortController.signal).then(data => ({ type: 'fatesDatabasePages', data }))
          );
        }
        
        // Achievement queries
        if (requiredIds.achievementIds.length > 0) {
          queries.push(
            getTwAchievementsByIds(requiredIds.achievementIds, abortController.signal).then(data => ({ type: 'twAchievements', data })),
            getTwAchievementDescriptionsByIds(requiredIds.achievementIds, abortController.signal).then(data => ({ type: 'twAchievementDescriptions', data })),
            getAchievementsByIds(requiredIds.achievementIds, abortController.signal).then(data => ({ type: 'achievements', data }))
          );
        }
        
        // Place queries
        if (requiredIds.zoneIds.length > 0) {
          queries.push(
            getTwPlacesByIds(requiredIds.zoneIds, abortController.signal).then(data => ({ type: 'twPlaces', data })),
            getPlacesByIds(requiredIds.zoneIds, abortController.signal).then(data => ({ type: 'places', data }))
          );
        }
        
        // Item queries (for currency names, etc.)
        if (requiredIds.itemIds.length > 0) {
          queries.push(
            getTwItemsByIds(requiredIds.itemIds, abortController.signal)
              .then(data => {
                return { type: 'twItems', data };
              })
              .catch(err => {
                console.error(`[ObtainMethods] ❌ Error loading twItems:`, err);
                return { type: 'twItems', data: {} };
              })
          );
        }
        
        // Special sources queries (these return arrays of IDs, not full data objects)
        queries.push(
          Promise.resolve({ type: 'fateSources', data: fateSourcesFromTable }),
          getLootSourcesByItemId(currentItemId, abortController.signal).then(data => ({ type: 'lootSources', data }))
        );
        
        // Execute all queries in parallel
        return Promise.all(queries).then(async results => {
          // Check if request was cancelled or itemId changed
          if (abortController.signal.aborted) {
            console.log(`[ObtainMethods] ⏹️ Request cancelled for item ${currentItemId} after queries`);
            return;
          }
          
          // Double-check that we're still processing the same itemId
          // This prevents race conditions when rapidly switching items
          if (currentItemId !== itemId) {
            return;
          }
          
          // Check if request was cancelled before processing results
          if (abortController.signal.aborted) {
            return;
          }
          
          // Combine results into loadedData object - start fresh for each item
          // Don't use previous loadedData to avoid stale data when switching items
          const newLoadedData = {
            twNpcs: {},
            npcs: {},
            npcsDatabasePages: {},
            twShops: {},
            shops: {},
            shopsByNpc: {},
            twInstances: {},
            instances: {},
            zhInstances: {},
            twQuests: {},
            quests: {},
            zhQuests: {},
            questsDatabasePages: {},
            twFates: {},
            fates: {},
            zhFates: {},
            fatesDatabasePages: {},
            twAchievements: {},
            twAchievementDescriptions: {},
            achievements: {},
            twPlaces: {},
            places: {},
            twItems: {},
            fateSources: [],
            lootSources: []
          };
          
          results.forEach((result) => {
            // Add error handling for malformed results
            if (!result || typeof result !== 'object') {
              console.warn(`[ObtainMethods] ⚠️ Invalid result in query results:`, result);
              return;
            }
            const { type, data } = result;
            if (!type) {
              console.warn(`[ObtainMethods] ⚠️ Result missing type:`, result);
              return;
            }
            // Safely assign data, handling null/undefined
            newLoadedData[type] = data || (Array.isArray(data) ? [] : {});
          });
          
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
          
          // Process sources with additional data from Supabase
          // Note: This processing uses newLoadedData (local variable), not loadedData state
          // But renderSource will use loadedDataRef.current to access latest data immediately
          // Validate sourcesData before processing
          if (!sourcesData || !Array.isArray(sourcesData)) {
            console.warn(`[ObtainMethods] ⚠️ Invalid sourcesData in processing step for item ${currentItemId}:`, sourcesData);
            if (!abortController.signal.aborted && currentItemId === itemId) {
              setSources([]);
              setLoading(false);
              setDataLoaded(true);
            }
            return;
          }
          
          let processedSources = [...sourcesData];
          
          // Collect zoneIds from FATEs - we'll do this after processing sources
          const fateZoneIds = new Set();
          
          // Handle ISLAND_PASTURE sources that are actually FATEs
          // Some FATEs are incorrectly classified as ISLAND_PASTURE (type 14) but have FATE data structure
          const islandPastureFates = [];
          const existingFateIdsFromSources = new Set(); // Track FATE IDs that already have full data in sources
          
          processedSources = processedSources.filter(source => {
            if (source.type === DataType.ISLAND_PASTURE && Array.isArray(source.data)) {
              // Check if this looks like a FATE (has id, level, zoneId, etc.)
              const looksLikeFate = source.data.some(item => {
                if (typeof item === 'object' && item.id && typeof item.id === 'number') {
                  // Has numeric id and other FATE-like properties
                  return item.level !== undefined || item.zoneId !== undefined || item.coords !== undefined;
                }
                return false;
              });
              
              if (looksLikeFate) {
                // Convert to FATE source - preserve all data including zoneId, mapId, coords
                islandPastureFates.push({
                  type: DataType.FATES,
                  data: source.data.map(fate => {
                    // Ensure we preserve all FATE data including zoneId
                    if (typeof fate === 'object' && fate.id) {
                      existingFateIdsFromSources.add(fate.id);
                      // Collect zoneId for place data query
                      if (fate.zoneId) {
                        fateZoneIds.add(fate.zoneId);
                      }
                      return fate; // Return as-is to preserve zoneId, mapId, coords
                    }
                    return fate;
                  })
                });
                return false; // Remove from processedSources, will add as FATE below
              }
            }
            // Also track FATE IDs from existing FATES sources
            if (source.type === DataType.FATES && Array.isArray(source.data)) {
              source.data.forEach(fate => {
                if (typeof fate === 'object' && fate.id) {
                  existingFateIdsFromSources.add(fate.id);
                  if (fate.zoneId) {
                    fateZoneIds.add(fate.zoneId);
                  }
                }
              });
            }
            return source.type !== DataType.ISLAND_PASTURE;
          });
          
          // Add converted FATEs
          if (islandPastureFates.length > 0) {
            const existingFatesSource = processedSources.find(s => s.type === DataType.FATES);
            if (existingFatesSource) {
              // Merge with existing FATES source
              islandPastureFates.forEach(fateSource => {
                existingFatesSource.data = [...(existingFatesSource.data || []), ...(fateSource.data || [])];
              });
            } else {
              // Add as new FATES source
              processedSources.push(...islandPastureFates);
            }
          }
          
          // Filter out invalid FATE sources (gathering nodes misclassified as FATEs)
          processedSources = processedSources.filter(source => {
            if (source.type === DataType.FATES && Array.isArray(source.data)) {
              const hasValidFate = source.data.some(fate => {
                if (typeof fate === 'object') {
                  if ((fate.nodeId !== undefined || fate.itemId !== undefined) && fate.id === undefined) {
                    return false; // This is a gathering node, not a FATE
                  }
                }
                const fateId = typeof fate === 'object' ? fate.id : fate;
                if (!fateId || typeof fateId !== 'number') return false;
                // Check if we have data for this FATE
                const twFate = newLoadedData.twFates[fateId];
                const fateData = newLoadedData.fates[fateId];
                const fateDb = newLoadedData.fatesDatabasePages[fateId] || newLoadedData.fatesDatabasePages[String(fateId)];
                return twFate || fateData || fateDb;
              });
              return hasValidFate;
            }
            return true;
          });
          
          // Check again before processing sources
          if (abortController.signal.aborted || currentItemId !== itemId) {
            return;
          }
          
          // Merge FATE sources from fate_sources table
          const fateSourcesForItem = newLoadedData.fateSources || [];
          
          if (fateSourcesForItem.length > 0) {
            const hasFates = processedSources.some(source => source.type === DataType.FATES);
            const existingFateIds = new Set();
            
            // Collect existing FATE IDs from sources
            if (hasFates) {
              const fatesSource = processedSources.find(s => s.type === DataType.FATES);
              if (fatesSource && Array.isArray(fatesSource.data)) {
                fatesSource.data.forEach(fate => {
                  const fateId = typeof fate === 'object' ? fate.id : fate;
                  if (fateId) existingFateIds.add(fateId);
                  // Collect zoneId from existing FATEs
                  if (typeof fate === 'object' && fate.zoneId) {
                    fateZoneIds.add(fate.zoneId);
                  }
                });
              }
            }
            
            // Find missing FATE IDs that need to be added
            const missingFateIds = fateSourcesForItem.filter(fateId => !existingFateIds.has(fateId) && !existingFateIdsFromSources.has(fateId));
            
            if (missingFateIds.length > 0) {
              const newFateSources = missingFateIds.map(fateId => {
                // Try to get FATE data from fates table first (may have position info)
                const fateData = newLoadedData.fates[fateId] || newLoadedData.fates[String(fateId)];
                const fateDb = newLoadedData.fatesDatabasePages[fateId] || newLoadedData.fatesDatabasePages[String(fateId)];
                
                // Build FATE source object - prefer position from fateData, fallback to fateDb
                let zoneId = null;
                let mapId = null;
                let coords = null;
                let level = 0;
                
                // Try to get position from fateData (fates table)
                if (fateData?.position) {
                  zoneId = fateData.position.zoneid;
                  mapId = fateData.position.map;
                  if (fateData.position.x !== undefined && fateData.position.y !== undefined) {
                    coords = { x: fateData.position.x, y: fateData.position.y };
                  }
                }
                
                // Get level from fateData or fateDb
                if (fateData?.level) {
                  level = fateData.level;
                } else if (fateDb) {
                  level = fateDb.lvl || fateDb.lvlMax || 0;
                }
                
                // If no position data found, log warning
                if (!zoneId && !fateDb) {
                  console.warn(`[ObtainMethods] ⚠️ No database data found for FATE ${fateId}`);
                  return null;
                }
                
                // Collect zoneId for place data query if available
                if (zoneId) {
                  fateZoneIds.add(zoneId);
                }
                
                // Return FATE source object (zoneId may be null if not available)
                return {
                  id: fateId,
                  level: level,
                  zoneId: zoneId,
                  mapId: mapId,
                  coords: coords
                };
              }).filter(Boolean);
              
              if (newFateSources.length > 0) {
                if (hasFates) {
                  const fatesSource = processedSources.find(s => s.type === DataType.FATES);
                  if (fatesSource) {
                    fatesSource.data = [...(fatesSource.data || []), ...newFateSources];
                  }
                } else {
                  processedSources.push({
                    type: DataType.FATES,
                    data: newFateSources
                  });
                }
              }
            }
            
          }
          
          // Unified zoneId collection: Collect zoneIds from all possible sources
          // This ensures we load place data for all zoneIds used by any obtainable method
          const allZoneIds = new Set();
          
          // 1. Collect zoneIds from FATE sources (already collected in fateZoneIds)
          fateZoneIds.forEach(zoneId => allZoneIds.add(zoneId));
          
          // 2. Collect zoneIds from instances (from loaded data and source data)
          const instancesData = newLoadedData.instances || {};
          Object.keys(instancesData).forEach(instanceIdStr => {
            const instance = instancesData[instanceIdStr];
            if (instance?.position?.zoneid) {
              allZoneIds.add(instance.position.zoneid);
            }
          });
          const instancesSource = processedSources.find(s => s.type === DataType.INSTANCES);
          if (instancesSource && Array.isArray(instancesSource.data)) {
            instancesSource.data.forEach(instanceId => {
              if (typeof instanceId === 'object' && instanceId.zoneId) {
                allZoneIds.add(instanceId.zoneId);
              }
            });
          }
          
          // 3. Collect zoneIds from quests (from questsDatabasePages startingPoint and npcs array)
          const questsDatabasePages = newLoadedData.questsDatabasePages || {};
          Object.keys(questsDatabasePages).forEach(questIdStr => {
            const questDb = questsDatabasePages[questIdStr];
            // Collect zoneId from startingPoint
            if (questDb?.startingPoint?.zoneid) {
              allZoneIds.add(questDb.startingPoint.zoneid);
            }
            // Also collect zoneIds from NPCs in quest's npcs array (these NPCs might be used for location fallback)
            if (Array.isArray(questDb?.npcs)) {
              questDb.npcs.forEach(npcId => {
                // These NPCs will have their zoneIds collected from npcsData below
                // But we need to ensure these NPCs are in the loaded npcs data
                // The zoneIds will be collected from npcsData in step 4
              });
            }
          });
          
          // 4. Collect zoneIds from NPCs (from npcs position and npcsDatabasePages)
          const npcsData = newLoadedData.npcs || {};
          Object.keys(npcsData).forEach(npcIdStr => {
            const npc = npcsData[npcIdStr];
            if (npc?.position?.zoneid) {
              allZoneIds.add(npc.position.zoneid);
            }
          });
          const npcsDatabasePages = newLoadedData.npcsDatabasePages || {};
          Object.keys(npcsDatabasePages).forEach(npcIdStr => {
            const npcDb = npcsDatabasePages[npcIdStr];
            if (npcDb?.position?.zoneid) {
              allZoneIds.add(npcDb.position.zoneid);
            }
          });
          
          // 5. Collect zoneIds from gathered nodes (from GATHERED_BY sources)
          const gatheredBySource = processedSources.find(s => s.type === DataType.GATHERED_BY);
          if (gatheredBySource && gatheredBySource.data?.nodes) {
            gatheredBySource.data.nodes.forEach(node => {
              if (node?.zoneId) {
                allZoneIds.add(node.zoneId);
              }
            });
          }
          
          // 6. Collect zoneIds from alarms (from ALARMS sources)
          const alarmsSource = processedSources.find(s => s.type === DataType.ALARMS);
          if (alarmsSource && Array.isArray(alarmsSource.data)) {
            alarmsSource.data.forEach(alarm => {
              if (alarm?.zoneId) {
                allZoneIds.add(alarm.zoneId);
              }
            });
          }
          
          // 7. Collect zoneIds from vendors (from VENDORS sources)
          const vendorsSource = processedSources.find(s => s.type === DataType.VENDORS);
          if (vendorsSource && Array.isArray(vendorsSource.data)) {
            vendorsSource.data.forEach(vendor => {
              if (vendor?.zoneId) {
                allZoneIds.add(vendor.zoneId);
              }
            });
          }
          
          // 8. Collect zoneIds from trade sources (from TRADE_SOURCES)
          const tradeSourcesSource = processedSources.find(s => s.type === DataType.TRADE_SOURCES);
          if (tradeSourcesSource && Array.isArray(tradeSourcesSource.data)) {
            tradeSourcesSource.data.forEach(tradeSource => {
              if (Array.isArray(tradeSource.npcs)) {
                tradeSource.npcs.forEach(npc => {
                  if (typeof npc === 'object' && npc.zoneId) {
                    allZoneIds.add(npc.zoneId);
                  }
                });
              }
            });
          }
          
          // Query place data for all collected zoneIds that are missing
          if (allZoneIds.size > 0) {
            const zoneIdsToQuery = Array.from(allZoneIds).filter(zoneId => {
              const hasTwPlace = newLoadedData.twPlaces[zoneId] || newLoadedData.twPlaces[String(zoneId)];
              const hasPlace = newLoadedData.places[zoneId] || newLoadedData.places[String(zoneId)];
              return !hasTwPlace && !hasPlace;
            });
            
            if (zoneIdsToQuery.length > 0) {
              try {
                const [twPlaces, places] = await Promise.all([
                  getTwPlacesByIds(zoneIdsToQuery, abortController.signal),
                  getPlacesByIds(zoneIdsToQuery, abortController.signal)
                ]);
                
                // Check if request was cancelled or itemId changed before updating state
                if (!abortController.signal.aborted && currentItemId === itemId) {
                  // Update loadedData with place data
                  setLoadedData(prev => {
                    const updated = {
                      ...prev,
                      twPlaces: { ...prev.twPlaces, ...twPlaces },
                      places: { ...prev.places, ...places }
                    };
                    // CRITICAL: Also update ref to keep it in sync with state
                    loadedDataRef.current = updated;
                    return updated;
                  });
                  // Also update newLoadedData for immediate use
                  newLoadedData.twPlaces = { ...newLoadedData.twPlaces, ...twPlaces };
                  newLoadedData.places = { ...newLoadedData.places, ...places };
                  // Also update ref with newLoadedData to ensure consistency
                  loadedDataRef.current.twPlaces = { ...loadedDataRef.current.twPlaces, ...twPlaces };
                  loadedDataRef.current.places = { ...loadedDataRef.current.places, ...places };
                }
              } catch (err) {
                if (!abortController.signal.aborted && currentItemId === itemId) {
                  console.error(`[ObtainMethods] Error loading place data:`, err);
                }
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
          const currentItemIdNum = parseInt(currentItemId, 10);
          
          if (!hasTradeSources && !hasVendors && Object.keys(shopsByNpc).length > 0) {
            // Note: We can't fully reconstruct TRADE_SOURCES from shopsByNpc alone
            // because shopsByNpc doesn't contain the trade information (what items are sold, currencies needed)
            // This is a limitation - we'd need to query the shops table with full trade data
            // For now, just log that we have shop data but can't use it without trade info
            console.warn(`[ObtainMethods] ⚠️ Shop data exists but cannot create sources without trade information. Item ${currentItemId} may need to be added to extracts table.`);
          }
          
          // Extract FATE reward item IDs from fatesDatabasePages and load twItems
          const fateRewardItemIds = new Set();
          const fatesDatabasePages = newLoadedData.fatesDatabasePages || {};
          
          Object.keys(fatesDatabasePages).forEach(fateIdStr => {
            const fateDb = fatesDatabasePages[fateIdStr];
            if (fateDb && Array.isArray(fateDb.items)) {
              fateDb.items.forEach(itemIdRaw => {
                // Normalize item ID to number
                const normalizedItemId = typeof itemIdRaw === 'number' ? itemIdRaw : parseInt(itemIdRaw, 10);
                if (normalizedItemId && !isNaN(normalizedItemId)) {
                  fateRewardItemIds.add(normalizedItemId);
                }
              });
            }
          });
          
          // Also add current item if it's a rare reward (in fate_sources but not in items array)
          // Note: fateSourcesForItem is already declared above (line 346)
          if (fateSourcesForItem.length > 0) {
            // Check if current item is in any FATE's items array (normalize IDs for comparison)
            const isInAnyFateItems = Object.values(fatesDatabasePages).some(fateDb => {
              if (!fateDb || !Array.isArray(fateDb.items)) return false;
              return fateDb.items.some(itemIdRaw => {
                const normalizedItemId = typeof itemIdRaw === 'number' ? itemIdRaw : parseInt(itemIdRaw, 10);
                return normalizedItemId === currentItemIdNum;
              });
            });
            
            // If current item is not in any FATE's items array but is in fate_sources, it's a rare reward
            if (!isInAnyFateItems) {
              fateRewardItemIds.add(currentItemIdNum);
            }
          }
          
          // Query missing twItems for FATE reward items
          const missingRewardItemIds = Array.from(fateRewardItemIds).filter(itemId => {
            const itemIdStr = String(itemId);
            return !newLoadedData.twItems[itemId] && !newLoadedData.twItems[itemIdStr];
          });
          
          if (missingRewardItemIds.length > 0) {
            getTwItemsByIds(missingRewardItemIds, abortController.signal)
              .then(rewardItemsData => {
                // Check if request was cancelled or itemId changed
                if (!abortController.signal.aborted && currentItemId === itemId) {
                  setLoadedData(prev => {
                    const updated = {
                      ...prev,
                      twItems: { ...prev.twItems, ...rewardItemsData }
                    };
                    // CRITICAL: Also update ref to keep it in sync with state
                    loadedDataRef.current = updated;
                    return updated;
                  });
                }
              })
              .catch(err => {
                if (!abortController.signal.aborted && currentItemId === itemId) {
                  console.error(`[ObtainMethods] Error loading FATE reward items:`, err);
                }
              });
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
            setSources(processedSources);
            setDataLoaded(true);
            setLoading(false);
            // Update ref to match current itemId after successful load
            currentItemIdRef.current = currentItemId;
            console.log(`[ObtainMethods] ✅ Loaded ${processedSources.length} obtainable method(s) for item ${currentItemId}`);
          }
        });
      })
      .catch(err => {
        // Don't update state if request was cancelled or itemId changed
        if (abortController.signal.aborted || currentItemId !== itemId) {
          return;
        }
        
        console.error(`[ObtainMethods] ❌ Failed to load sources for item ${currentItemId}:`, err);
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

  // Get method type display name
  const getMethodTypeName = (type) => {
    const methodTypeNames = {
      [DataType.CRAFTED_BY]: '製作',
      [DataType.TRADE_SOURCES]: '兌換',
      [DataType.VENDORS]: 'NPC商店',
      [DataType.TREASURES]: '寶箱/容器',
      [DataType.INSTANCES]: '副本掉落',
      [DataType.DESYNTHS]: '精製獲得',
      [DataType.QUESTS]: '任務獎勵',
      [DataType.FATES]: '危命任務',
      [DataType.GATHERED_BY]: '採集獲得',
      [DataType.REDUCED_FROM]: '分解獲得',
      [DataType.VENTURES]: '遠征獲得',
      [DataType.GARDENING]: '園藝獲得',
      [DataType.MOGSTATION]: '商城購買',
      [DataType.ISLAND_CROP]: '島嶼作物',
      [DataType.VOYAGES]: '遠征',
      [DataType.REQUIREMENTS]: '需求',
      [DataType.MASTERBOOKS]: '製作書',
      [DataType.ALARMS]: '鬧鐘提醒',
      [DataType.ACHIEVEMENTS]: '成就獎勵',
    };
    return methodTypeNames[type] || '未知';
  };

  const getNpcName = (npcId) => {
    // Use ref to access latest loadedData immediately, avoiding stale state issues
    const currentLoadedData = loadedDataRef.current;
    const npc = currentLoadedData.twNpcs[npcId] || currentLoadedData.twNpcs[String(npcId)];
    return npc?.tw || `NPC ${npcId}`;
  };

  const getNpcTitle = (npcId) => {
    // Try tw-npc-titles.json first (static import)
    const titleData = twNpcTitlesData[npcId] || twNpcTitlesData[String(npcId)];
    if (titleData?.tw) {
      return titleData.tw;
    }
    // Fallback to npcs-database-pages from Supabase
    // Use ref to access latest loadedData immediately, avoiding stale state issues
    const currentLoadedData = loadedDataRef.current;
    const npcDb = currentLoadedData.npcsDatabasePages[npcId] || currentLoadedData.npcsDatabasePages[String(npcId)];
    if (npcDb?.title?.zh) {
      return npcDb.title.zh;
    }
    return null;
  };

  // Use centralized place name utility
  const getPlaceName = (zoneId) => {
    const currentLoadedData = loadedDataRef.current;
    return getPlaceNameUtil(zoneId, {
      twPlaces: currentLoadedData.twPlaces,
      places: currentLoadedData.places
    });
  };
  
  // Get place name with Chinese fallback
  const getPlaceNameCN = (zoneId) => {
    const currentLoadedData = loadedDataRef.current;
    return getPlaceNameWithFallback(zoneId, {
      twPlaces: currentLoadedData.twPlaces,
      places: currentLoadedData.places
    }, '區域');
  };

  const getShopName = (shopId) => {
    // Try Traditional Chinese shop names from Supabase
    const currentLoadedData = loadedDataRef.current;
    const twShop = currentLoadedData.twShops[shopId] || currentLoadedData.twShops[String(shopId)];
    if (twShop?.tw) {
      return twShop.tw;
    }
    return null;
  };

  // Get shop name from vendor.shopName by matching English name to shop ID
  const getVendorShopName = (shopName) => {
    if (!shopName) return null;
    
    // First try to get tw or zh directly from shopName
    if (shopName.tw) return shopName.tw;
    if (shopName.zh) return shopName.zh;
    
    // If not available, try to find shop ID by matching English name
    // Note: gil_shop_names table might need to be queried if needed
    // For now, just return null if not in shopName object
    return null;
  };

  const getCurrencyName = (currencyItemId) => {
    // Get currency name from Supabase loaded data
    if (!currencyItemId) return '貨幣';
    
    // Use ref to access latest loadedData immediately, avoiding stale state issues
    const currentLoadedData = loadedDataRef.current;
    const currencyItem = currentLoadedData.twItems[currencyItemId] || currentLoadedData.twItems[String(currencyItemId)];
    if (currencyItem?.tw) {
      return currencyItem.tw;
    }
    
    return null;
  };

  // Get achievement info by achievement ID
  const getAchievementInfo = (achievementId) => {
    if (!achievementId) return null;
    const achievementIdStr = achievementId.toString();
    const currentLoadedData = loadedDataRef.current;
    const achievement = currentLoadedData.twAchievements[achievementIdStr] || currentLoadedData.twAchievements[achievementId];
    const description = currentLoadedData.twAchievementDescriptions[achievementIdStr] || currentLoadedData.twAchievementDescriptions[achievementId];
    const achievementData = currentLoadedData.achievements[achievementIdStr] || currentLoadedData.achievements[achievementId];
    
    if (achievement?.tw) {
      return {
        id: achievementId,
        name: achievement.tw,
        description: description?.tw || null,
        icon: achievementData?.icon ? `https://xivapi.com${achievementData.icon}` : null,
        itemReward: achievementData?.itemReward || null,
        title: achievementData?.title || null,
        // English name for reference
        nameEn: achievementData?.en || null,
        nameJa: achievementData?.ja || null,
      };
    }
    return null;
  };

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

  const getInstanceName = (instanceId) => {
    // Try Traditional Chinese first
    const twInstance = loadedData.twInstances[instanceId] || loadedData.twInstances[String(instanceId)];
    if (twInstance?.tw) {
      return twInstance.tw;
    }
    // Fallback to English instances from Supabase
    const instance = loadedData.instances[instanceId] || loadedData.instances[String(instanceId)];
    if (instance?.en) {
      return instance.en;
    }
    return `副本 ${instanceId}`;
  };

  const getInstanceCNName = (instanceId) => {
    // Get Simplified Chinese name from Supabase
    const zhInstance = loadedData.zhInstances[instanceId] || loadedData.zhInstances[String(instanceId)];
    return zhInstance?.zh || null;
  };

  const getQuestCNName = (questId) => {
    // Get Simplified Chinese quest name from Supabase
    const zhQuest = loadedData.zhQuests[questId] || loadedData.zhQuests[String(questId)];
    return zhQuest?.zh || null;
  };

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
    
    // Look up shop in shops table from Supabase
    const shop = loadedData.shops[shopId] || loadedData.shops[String(shopId)];
    if (shop && shop.requiredQuest) {
      return shop.requiredQuest;
    }
    
    // If not found in shops, try shops_by_npc from Supabase
    if (npcId) {
      const npcShops = loadedData.shopsByNpc[npcId] || loadedData.shopsByNpc[String(npcId)];
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

  // Get masterbook name from item ID
  const getMasterbookName = (masterbookId) => {
    if (!masterbookId) return null;
    const itemId = typeof masterbookId === 'string' ? parseInt(masterbookId, 10) : masterbookId;
    const currentLoadedData = loadedDataRef.current;
    const itemData = currentLoadedData.twItems[itemId] || currentLoadedData.twItems[String(itemId)];
    return itemData?.tw || null;
  };

  const renderSource = (source, index, useFlex1 = true) => {
    const { type, data } = source;
    const flexClass = useFlex1 ? 'flex-1' : '';

    // Crafted By (製作) - data is an array of CraftedBy objects
    if (type === DataType.CRAFTED_BY) {
      if (!data || data.length === 0) {
        return null;
      }

      return (
        <div key={`crafted-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/000000/000501.png" alt="Craft" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">製作</span>
            {onExpandCraftingTree && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onExpandCraftingTree();
                }}
                className={`ml-auto px-2 py-1 text-xs border rounded transition-all duration-200 flex items-center gap-1 ${
                  isCraftingTreeExpanded
                    ? 'bg-amber-900/50 hover:bg-amber-800/70 border-ffxiv-gold/60 hover:border-ffxiv-gold text-ffxiv-gold'
                    : 'bg-purple-900/50 hover:bg-purple-800/70 border-purple-500/40 hover:border-purple-400/60 text-purple-200 hover:text-ffxiv-gold'
                }`}
                title={isCraftingTreeExpanded ? '收起製作價格樹' : '展開製作價格樹'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                {isCraftingTreeExpanded ? '收起樹' : '展開樹'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.map((craft, craftIndex) => {
              const jobId = craft.job;
              const jobName = getJobName(jobId);
              const jobIconUrl = getJobIconUrl(jobId);
              const level = craft.lvl || craft.rlvl || 0;
              const stars = craft.stars_tooltip || '';
              
              // Skip if no valid job data
              if (!jobName || jobName === `職業 ${jobId}`) {
                return null;
              }

              return (
                <button
                  key={`craft-${index}-${craftIndex}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onExpandCraftingTree) {
                      onExpandCraftingTree();
                    }
                  }}
                  className={`w-[280px] flex-grow-0 rounded p-2 min-h-[70px] flex flex-col justify-center transition-all duration-200 cursor-pointer ${
                    isCraftingTreeExpanded
                      ? 'bg-amber-900/30 hover:bg-amber-800/40 border border-ffxiv-gold/40'
                      : 'bg-slate-900/50 hover:bg-slate-800/70'
                  }`}
                  title={isCraftingTreeExpanded ? '點擊收起製作價格樹' : '點擊展開製作價格樹'}
                >
                  <div className="flex items-center gap-2">
                    {jobIconUrl && (
                      <img src={jobIconUrl} alt={jobName} className="w-7 h-7 object-contain" />
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
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (onItemClick) {
                                    getItemById(masterbookId).then(item => {
                                      if (item) {
                                        onItemClick(item, { fromObtainable: true });
                                      } else {
                                        navigate(`/item/${masterbookId}`);
                                      }
                                    });
                                  } else {
                                    navigate(`/item/${masterbookId}`);
                                  }
                                }}
                                className="text-ffxiv-gold hover:text-yellow-400 hover:underline transition-colors"
                              >
                                {displayName}
                              </button>
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

    // Trade Sources (兌換) - data is an array of TradeSource objects
    if (type === DataType.TRADE_SOURCES) {
      if (!data || data.length === 0) {
        return null;
      }

      // Process all trade sources and collect valid NPC entries
      const validTradeEntries = [];
      
      data.forEach((tradeSource, tradeIndex) => {
        // Trade source structure: { id, type, shopName: {en, ja, zh, ...}, npcs: [{id}], trades: [{currencies: [{id, amount, hq?}], items: [{id, amount}]}] }
        const tradeEntry = tradeSource.trades?.[0];
        const currencyItem = tradeEntry?.currencies?.[0];
        const currencyItemId = currencyItem?.id;
        const currencyAmount = currencyItem?.amount;
        const requiresHQ = currencyItem?.hq === true; // Check if HQ is required
        const shopId = tradeSource.id; // Shop ID for quest requirement lookup
        
        // Get currency item name from Traditional Chinese items database (tw-items.json)
        let currencyName = getCurrencyName(currencyItemId);
        
        // If no lookup available, skip this trade source
        if (!currencyName && currencyItemId) {
          return; // Skip if we can't find the currency name
        }
        
        // Get currency item data for linking
        // Use ref to access latest loadedData immediately, avoiding stale state issues
        const currentLoadedData = loadedDataRef.current;
        const currencyItemData = currencyItemId ? (currentLoadedData.twItems[currencyItemId] || currentLoadedData.twItems[String(currencyItemId)]) : null;
        const hasCurrencyItem = currencyItemData && currencyItemData.tw;
        
        // Get shop name - try Traditional Chinese from shopName object or tw-shops.json
        // Only use Chinese versions (tw or zh), don't fallback to English
        let shopName = null;
        if (tradeSource.shopName) {
          // shopName is an I18nName object: { en, ja, de, fr, zh, tw, ko }
          // Only use Chinese versions, don't fallback to English
          shopName = tradeSource.shopName.tw || tradeSource.shopName.zh || null;
        } else if (tradeSource.id) {
          // Try to get shop name from tw-shops.json using shop ID
          const shopNameFromData = getShopName(tradeSource.id);
          if (shopNameFromData) {
            shopName = shopNameFromData;
          }
        }
        
        // Filter out null results (when currency not found)
        const validNpcs = tradeSource.npcs?.filter(npc => {
          const npcId = typeof npc === 'object' ? npc.id : npc;
          const npcName = getNpcName(npcId);
          return npcName && npcName !== `NPC ${npcId}`;
        }) || [];
        
        // Skip if no valid NPCs or no currency name
        if (validNpcs.length === 0 || !currencyName) {
          return;
        }
        
        // Add all valid NPCs from this trade source to the entries list
        validNpcs.forEach((npc) => {
          validTradeEntries.push({
            npc,
            currencyItemId,
            currencyName,
            currencyAmount,
            requiresHQ,
            hasCurrencyItem,
            shopName,
            shopId,
            tradeSource,
          });
        });
      });
      
      // Don't render if no valid entries
      if (validTradeEntries.length === 0) {
        return null;
      }
      
      // Render single container with all trade entries
      return (
        <div key={`trade-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-ffxiv-gold font-medium">兌換</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validTradeEntries.map((entry, entryIndex) => {
              const npc = entry.npc;
              const npcId = typeof npc === 'object' ? npc.id : npc;
              const npcName = getNpcName(npcId);
              const npcZoneId = typeof npc === 'object' ? npc.zoneId : null;
              const npcCoords = typeof npc === 'object' ? npc.coords : null;
              const npcMapId = typeof npc === 'object' ? npc.mapId : null;
              const zoneName = npcZoneId ? getPlaceNameCN(npcZoneId) : '';
              const hasLocation = npcCoords && npcCoords.x !== undefined && npcCoords.y !== undefined;
              
              // Get quest requirement for this shop/NPC combination
              const requiredQuestId = getShopQuestRequirement(entry.shopId, npcId, entry.tradeSource);
              // Use ref to access latest loadedData immediately, avoiding stale state issues
              const currentLoadedData = loadedDataRef.current;
              const questData = currentLoadedData.twQuests[requiredQuestId] || currentLoadedData.twQuests[String(requiredQuestId)];
              const questEnData = currentLoadedData.quests[requiredQuestId] || currentLoadedData.quests[String(requiredQuestId)];
              const questName = questData?.tw || questEnData?.name?.en || questEnData?.en || null;
              
              return (
                <div key={`npc-${entryIndex}`} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    {entry.hasCurrencyItem ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onItemClick) {
                            // Get item data and call onItemClick with flag indicating it's from obtainable
                            getItemById(entry.currencyItemId).then(item => {
                              if (item) {
                                onItemClick(item, { fromObtainable: true });
                              } else {
                                navigate(`/item/${entry.currencyItemId}`);
                              }
                            });
                          } else {
                            navigate(`/item/${entry.currencyItemId}`);
                          }
                        }}
                        className="flex items-center gap-1.5 font-medium text-blue-400 hover:text-ffxiv-gold transition-colors"
                      >
                        <ItemImage
                          itemId={entry.currencyItemId}
                          alt={entry.currencyName}
                          className="w-7 h-7 object-contain"
                        />
                        <span className="hover:underline">{entry.currencyName}</span>
                        {entry.requiresHQ && (
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
                        {entry.currencyName}
                        {entry.requiresHQ && (
                          <span 
                            className="inline-flex items-center justify-center px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] font-bold text-yellow-400"
                            title="需要高品質版本"
                          >
                            HQ
                          </span>
                        )}
                      </span>
                    )}
                    <span className="text-yellow-400 text-sm">x{entry.currencyAmount}</span>
                  </div>
                  <div className="text-sm text-gray-300">{npcName}</div>
                  {entry.shopName && (
                    <div className="text-xs text-gray-400 mt-1">{entry.shopName}</div>
                  )}
                  {requiredQuestId && questName && (
                    <div className="text-xs text-pink-400/90 mt-1 flex items-center gap-1">
                      <span>需要完成任務：</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Navigate to quest page or show quest info
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
                  {zoneName && hasLocation && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapModal({
                          isOpen: true,
                          zoneName,
                          x: npcCoords.x,
                          y: npcCoords.y,
                          npcName,
                          mapId: npcMapId,
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
                          X: {npcCoords.x.toFixed(1)} - Y: {npcCoords.y.toFixed(1)}
                        </span>
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

    // Vendors (NPC商店) - Single box with all vendors listed inside
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

      return (
        <div key={`vendor-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/065000/065002.png" alt="Gil" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">NPC商店</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {npcGroups.map((npcGroup, npcGroupIndex) => {
              const npcVendors = npcGroup.vendors;
              const firstVendor = npcVendors[0];
              const npcName = getNpcName(firstVendor.npcId);
              
              // Try to get position from vendor data first, then fallback to npcs.json
              let zoneId = firstVendor.zoneId;
              let coords = firstVendor.coords;
              let mapId = firstVendor.mapId;
              
              // If vendor doesn't have position data, try to get it from npcs.json (lazy loaded)
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && firstVendor.npcId && npcsDataLoaded) {
                const npcData = npcsDataLoaded[firstVendor.npcId] || npcsDataLoaded[String(firstVendor.npcId)];
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
              // Check if location is valid for map display (must have mapId and not be 0,0)
              const hasValidMapLocation = hasLocationInfo && mapId && (coords.x !== 0 || coords.y !== 0);
              
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
              
              return (
                <div key={npcGroupIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{npcName}</span>
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
                  {hasLocationInfo && (
                    hasValidMapLocation ? (
                      <button
                        onClick={() => setMapModal({
                          isOpen: true,
                          zoneName,
                          x: coords.x,
                          y: coords.y,
                          npcName,
                          mapId: mapId,
                        })}
                        className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                      >
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <span>
                          {zoneName}
                          <span className="ml-2">
                            X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <span>
                          {zoneName}
                          <span className="ml-2">
                            X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                          </span>
                        </span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Treasures (藏寶圖/寶箱) - includes both treasure maps and loot sources (coffers/containers)
    if (type === DataType.TREASURES) {
      return (
        <div key={`treasure-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061808.png" alt="Treasure" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">寶箱/容器</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.map((treasureId, treasureIndex) => {
              // Check if item exists in tw-items.json
              const treasureItemData = loadedData.twItems[treasureId] || loadedData.twItems[String(treasureId)];
              if (!treasureItemData || !treasureItemData.tw) {
                return null; // Skip if no lookup available
              }
              
              const treasureName = treasureItemData.tw;
              
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
                          navigate(`/item/${treasureId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${treasureId}`);
                    }
                  }}
                  className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
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
      return (
        <div key={`instance-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061801.png" alt="Instance" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">副本掉落</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.map((instanceId, instanceIndex) => {
              const instanceName = getInstanceName(instanceId);
              
              // Skip if no lookup available (fallback name means no data)
              if (instanceName === `副本 ${instanceId}`) {
                return null;
              }
              
              // Get Simplified Chinese name for Huiji Wiki link
              const instanceCNName = getInstanceCNName(instanceId);
              
              // Get instance icon and content type from instances.json for better display
              const instance = loadedData.instances[instanceId] || loadedData.instances[String(instanceId)];
              const iconUrl = instance?.icon 
                ? `https://xivapi.com${instance.icon}` 
                : 'https://xivapi.com/i/061000/061801.png';
              
              // Determine content type icon based on contentType
              let contentTypeIcon = iconUrl;
              if (instance?.contentType) {
                // contentType: 2 = Dungeon, 4 = Trial, 5 = Raid, 21 = Deep Dungeon, 28 = Ultimate
                if (instance.contentType === 4) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061804.png'; // Trial
                } else if (instance.contentType === 5) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061802.png'; // Raid
                } else if (instance.contentType === 28) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061832.png'; // Ultimate
                } else if (instance.contentType === 21) {
                  contentTypeIcon = 'https://xivapi.com/i/061000/061824.png'; // Deep Dungeon
                }
              }
              
              return (
                <div key={instanceIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  {instanceCNName && (
                    <a
                      href={`https://ff14.huijiwiki.com/wiki/${encodeURIComponent(instanceCNName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 group"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img src={contentTypeIcon} alt="Instance" className="w-7 h-7" />
                      <span className="text-sm text-blue-400 group-hover:text-ffxiv-gold transition-colors flex items-center gap-1">
                        {instanceName}
                      </span>
                    </a>
                  )}
                  {!instanceCNName && (
                    <div className="flex items-center gap-2">
                      <img src={contentTypeIcon} alt="Instance" className="w-7 h-7" />
                      <span className="text-sm text-gray-300">{instanceName}</span>
                    </div>
                  )}
                </div>
              );
            }).filter(Boolean)}
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
        <div key={`desynth-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/000000/000120.png" alt="Desynth" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">精製獲得</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
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
                          navigate(`/item/${desynthItemId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${desynthItemId}`);
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

    // Quests (任務) - data is an array of quest IDs
    if (type === DataType.QUESTS) {
      const validQuests = data.filter(questId => {
        const questData = loadedData.twQuests[questId] || loadedData.twQuests[String(questId)];
        return questData && questData.tw;
      });
      
      if (validQuests.length === 0) {
        return null; // Skip if no valid quests
      }
      
      return (
        <div key={`quest-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060453.png" alt="Quest" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">任務獎勵</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validQuests.map((questId, questIndex) => {
              const questData = loadedData.twQuests[questId] || loadedData.twQuests[String(questId)];
              const questNameRaw = questData?.tw;
              const questName = cleanQuestName(questNameRaw);
              
              if (!questName) return null;
              
              // Get quest icon from quests.json
              const quest = loadedData.quests[questId] || loadedData.quests[String(questId)];
              const questIcon = quest?.icon 
                ? `https://xivapi.com${quest.icon}` 
                : 'https://xivapi.com/i/060000/060453.png';
              
              // Get Simplified Chinese quest name for Huiji Wiki link
              const questCNNameRaw = getQuestCNName(questId);
              const questCNName = cleanQuestName(questCNNameRaw);
              
              // Get quest details from quests-database-pages.json (lazy loaded)
              const questDb = loadedData.questsDatabasePages[questId] || loadedData.questsDatabasePages[String(questId)];
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
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && startingNpcId && npcsDataLoaded) {
                const npcData = npcsDataLoaded[startingNpcId] || npcsDataLoaded[String(startingNpcId)];
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
              
              // Also try npcs-database-pages.json for NPC location (try both string and number keys) (lazy loaded)
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
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && questDb?.npcs && npcsDataLoaded) {
                for (const npcId of questDb.npcs) {
                  const npcData = npcsDataLoaded[npcId] || npcsDataLoaded[String(npcId)];
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
                <div key={questIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col">
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
                    {startingNpcName && startingNpcName !== `NPC ${startingNpcId}` && (
                      <div className="text-gray-400">{startingNpcName}</div>
                    )}
                    
                    {/* Location */}
                    {hasLocation && zoneName && (
                      hasValidMapLocation ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMapModal({
                              isOpen: true,
                              zoneName,
                              x: coords.x,
                              y: coords.y,
                              npcName: startingNpcName || questName,
                              mapId: mapId,
                            });
                          }}
                          className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span>
                            {zoneName}
                            <span className="ml-2">
                              X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <div className="mt-1 pt-1 border-t border-slate-700/50 text-xs text-gray-400">
                          {zoneName}
                          {coords && coords.x !== undefined && coords.y !== undefined && (
                            <span className="ml-2">
                              X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                            </span>
                          )}
                        </div>
                      )
                    )}
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
        if (!fateId || typeof fateId !== 'number') return false;
        // Accept FATE if we have any data source from Supabase
        const twFate = loadedData.twFates[fateId] || loadedData.twFates[String(fateId)];
        const fateData = loadedData.fates[fateId] || loadedData.fates[String(fateId)];
        const fateDb = loadedData.fatesDatabasePages[fateId] || loadedData.fatesDatabasePages[String(fateId)];
        return twFate || fateData || fateDb;
      });
      
      if (validFates.length === 0) {
        return null; // Skip if no valid fates
      }
      
      return (
        <div key={`fate-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060502.png" alt="FATE" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">危命任務</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validFates.map((fate, fateIndex) => {
              const fateId = typeof fate === 'object' ? fate.id : fate;
              const fateLevel = typeof fate === 'object' ? fate.level : null;
              const fateZoneId = typeof fate === 'object' ? fate.zoneId : null;
              const fateMapId = typeof fate === 'object' ? fate.mapId : null;
              const fateCoords = typeof fate === 'object' ? fate.coords : null;
              
              // Get FATE name - Traditional Chinese for display, Simplified Chinese for wiki link
              const twFate = loadedData.twFates[fateId] || loadedData.twFates[String(fateId)];
              const zhFate = loadedData.zhFates[fateId] || loadedData.zhFates[String(fateId)];
              const fateName = twFate?.name?.tw || twFate?.tw || `FATE ${fateId}`;
              // Use Simplified Chinese for wiki link - zh_fates table structure: { name: { zh: "..." } }
              const fateNameZh = zhFate?.name?.zh || zhFate?.zh || null;
              
              // Debug: Log if zhFate data is missing or incorrect
              if (!fateNameZh && fateId) {
                console.warn(`[ObtainMethods] ⚠️ FATE ${fateId} missing Simplified Chinese name. zhFate data:`, zhFate);
              }
              
              // Get FATE icon
              const fateData = loadedData.fates[fateId] || loadedData.fates[String(fateId)];
              const fateIcon = fateData?.icon 
                ? `https://xivapi.com${fateData.icon}` 
                : 'https://xivapi.com/i/060000/060502.png';
              
              // Get zone name
              const zoneName = fateZoneId ? getPlaceNameCN(fateZoneId) : '';
              const hasLocation = fateCoords && fateCoords.x !== undefined && fateCoords.y !== undefined && fateMapId;
              
              // Debug: Log if zone name is missing (check raw data, not formatted name)
              if (fateZoneId) {
                const rawZoneName = getPlaceName(fateZoneId);
                if (!rawZoneName || rawZoneName === `Zone ${fateZoneId}`) {
                  console.warn(`[ObtainMethods] ⚠️ FATE ${fateId} zoneId ${fateZoneId} missing place name. Available twPlaces:`, Object.keys(loadedData.twPlaces).slice(0, 5));
                }
              }
              
              // Get FATE database page data for reward items
              const fateDb = loadedData.fatesDatabasePages[fateId] || loadedData.fatesDatabasePages[String(fateId)];
              const rewardItemsRaw = fateDb?.items || [];
              
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
              
              // Check if this FATE is a notorious monster (惡名精英) - usually level 32+ and has specific icon
              const isNotoriousMonster = fateLevel && fateLevel >= 32 && fateIcon.includes('060958');
              
              // Create wiki URL using Simplified Chinese name with "临危受命:" prefix (only if available)
              const wikiUrl = fateNameZh ? `https://ff14.huijiwiki.com/wiki/临危受命:${encodeURIComponent(fateNameZh)}` : null;
              
              return (
                <div key={fateIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={fateIcon} alt="FATE" className="w-7 h-7 object-contain" />
                    <div className="flex-1">
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
                      {fateLevel && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {zoneName ? `${zoneName} ` : ''}{fateLevel}級危命任務
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
                                      // Debug: Log if item data is missing
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
                                                  navigate(`/item/${rewardItemId}`);
                                                }
                                              });
                                            } else {
                                              navigate(`/item/${rewardItemId}`);
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
                                      // Debug: Log if item data is missing
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
                                                  navigate(`/item/${rewardItemId}`);
                                                }
                                              });
                                            } else {
                                              navigate(`/item/${rewardItemId}`);
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
                                                  navigate(`/item/${rewardItemId}`);
                                                }
                                              });
                                            } else {
                                              navigate(`/item/${rewardItemId}`);
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

    // Gathered By (採集獲得) - data is an object with { level, nodes: [...], type, stars_tooltip }
    if (type === DataType.GATHERED_BY) {
      if (!data || !data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
        return null;
      }

      // Node type icons mapping (based on NodeTypeIconPipe)
      const nodeTypeIcons = {
        0: 'https://xivapi.com/i/060000/060438.png', // Mining
        1: 'https://xivapi.com/i/060000/060437.png', // Quarrying
        2: 'https://xivapi.com/i/060000/060433.png', // Logging
        3: 'https://xivapi.com/i/060000/060432.png', // Harvesting
        4: 'https://xivapi.com/i/060000/060445.png', // Fishing
        5: 'https://xivapi.com/i/060000/060465.png', // Spearfishing
      };

      // Node type names
      const nodeTypeNames = {
        0: '採礦',
        1: '採石',
        2: '採伐',
        3: '割取',
        4: '釣魚',
        5: '潛水',
      };

      const gatheringLevel = data.level || 0;
      const starsTooltip = data.stars_tooltip || '';
      const rawNodeType = data.type !== undefined ? data.type : (data.nodes[0]?.type !== undefined ? data.nodes[0].type : 0);
      // Handle negative types (timed nodes) by using absolute value
      const nodeType = Math.abs(rawNodeType);
      const nodeIcon = nodeTypeIcons[nodeType] || nodeTypeIcons[0];
      const nodeTypeName = nodeTypeNames[nodeType] || '採集';

      return (
        <div key={`gathered-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src={nodeIcon} alt={nodeTypeName} className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">採集獲得</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.nodes.map((node, nodeIndex) => {
              const zoneId = node.zoneId;
              const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
              const mapId = node.map;
              const coords = node.x !== undefined && node.y !== undefined ? { x: node.x, y: node.y } : null;
              const hasLocation = coords && mapId;
              const nodeLevel = node.level || gatheringLevel;
              const isLimited = node.limited === true;
              const isIslandNode = node.isIslandNode === true;

              return (
                <div key={nodeIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={nodeIcon} alt={nodeTypeName} className="w-7 h-7 object-contain" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">
                        {zoneName}
                      </div>
                      {!isIslandNode && nodeLevel > 0 && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Lv.{nodeLevel} {nodeTypeName}
                          {isLimited && <span className="ml-1 text-yellow-400">限時</span>}
                        </div>
                      )}
                      {isIslandNode && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          島嶼採集點
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {hasLocation && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapModal({
                          isOpen: true,
                          zoneName,
                          x: coords.x,
                          y: coords.y,
                          npcName: `${nodeTypeName}採集點`,
                          mapId: mapId,
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
                          X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                        </span>
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
        <div key={`reduced-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061808.png" alt="Reduction" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">分解獲得</span>
          </div>
          <div className={validReductionItems.length === 1 ? "flex justify-center gap-2 mt-2" : "grid grid-cols-3 gap-2 mt-2"}>
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
                          navigate(`/item/${reductionItemId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${reductionItemId}`);
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

    // Ventures (遠征獲得) - data is an array of item IDs (retainer venture items)
    if (type === DataType.VENTURES) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validVentureItems = data.filter(itemId => {
        const itemData = loadedData.twItems[itemId] || loadedData.twItems[String(itemId)];
        return itemData && itemData.tw;
      });
      
      if (validVentureItems.length === 0) {
        return null;
      }
      
      return (
        <div key={`venture-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/021000/021267.png" alt="Venture" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">遠征獲得</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validVentureItems.map((ventureItemId, ventureIndex) => {
              const ventureItemData = loadedData.twItems[ventureItemId] || loadedData.twItems[String(ventureItemId)];
              const ventureName = ventureItemData?.tw;
              
              if (!ventureName) return null;
              
              return (
                <button
                  key={ventureIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(ventureItemId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          navigate(`/item/${ventureItemId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${ventureItemId}`);
                    }
                  }}
                  className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
                >
                  <ItemImage
                    itemId={ventureItemId}
                    alt={ventureName}
                    className="w-7 h-7 object-contain"
                  />
                  <span className="hover:underline">{ventureName}</span>
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      );
    }

    // Gardening (園藝獲得) - data is an array of objects with {id: seedItemId}
    if (type === DataType.GARDENING) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validSeeds = data.filter(seed => {
        const seedId = typeof seed === 'object' ? seed.id : seed;
        const seedData = loadedData.twItems[seedId] || loadedData.twItems[String(seedId)];
        return seedData && seedData.tw;
      });
      
      if (validSeeds.length === 0) {
        return null;
      }
      
      return (
        <div key={`gardening-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/061000/061808.png" alt="Gardening" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">園藝獲得</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validSeeds.map((seed, seedIndex) => {
              const seedId = typeof seed === 'object' ? seed.id : seed;
              const seedData = loadedData.twItems[seedId] || loadedData.twItems[String(seedId)];
              const seedName = seedData?.tw;
              
              if (!seedName) return null;
              
              return (
                <button
                  key={seedIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(seedId).then(item => {
                        if (item) {
                          onItemClick(item, { fromObtainable: true });
                        } else {
                          navigate(`/item/${seedId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${seedId}`);
                    }
                  }}
                  className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
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

    // Mogstation (商城購買) - data is an array of item IDs
    if (type === DataType.MOGSTATION) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      return (
        <div key={`mogstation-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/065000/065002.png" alt="Mogstation" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">商城購買</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
              <div className="text-sm text-gray-300 text-center">
                可在 Mog Station 商城購買
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Island Crop (島嶼作物) - data is an array of item IDs
    if (type === DataType.ISLAND_CROP) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validCrops = data.filter(cropId => {
        const cropData = loadedData.twItems[cropId] || loadedData.twItems[String(cropId)];
        return cropData && cropData.tw;
      });
      
      if (validCrops.length === 0) {
        return null;
      }
      
      return (
        <div key={`island-crop-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/063000/063950_hr1.png" alt="Island Crop" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">島嶼作物</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validCrops.map((cropId, cropIndex) => {
              const cropData = loadedData.twItems[cropId] || loadedData.twItems[String(cropId)];
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
                          navigate(`/item/${cropId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${cropId}`);
                    }
                  }}
                  className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
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

    // Voyages (遠征) - data structure similar to ventures
    if (type === DataType.VOYAGES) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      return (
        <div key={`voyage-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/021000/021267.png" alt="Voyage" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">遠征</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
              <div className="text-sm text-gray-300 text-center">
                可通過遠征獲得
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Requirements (需求) - data structure varies, usually item IDs or requirements
    if (type === DataType.REQUIREMENTS) {
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
        <div key={`requirement-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060453.png" alt="Requirement" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">需求</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
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
                          navigate(`/item/${reqId}`);
                        }
                      });
                    } else {
                      navigate(`/item/${reqId}`);
                    }
                  }}
                  className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
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
          <div key={`masterbook-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/i/065000/065002.png" alt="Masterbook" className="w-6 h-6" />
              <span className="text-ffxiv-gold font-medium">製作書</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
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
                            navigate(`/item/${bookId}`);
                          }
                        });
                      } else {
                        navigate(`/item/${bookId}`);
                      }
                    }}
                    className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
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
          <div key={`masterbook-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
            <div className="flex items-center gap-2 mb-2">
              <img src="https://xivapi.com/i/065000/065002.png" alt="Masterbook" className="w-6 h-6" />
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

    // Alarms (鬧鐘提醒) - data is an array of Alarm objects with node information
    if (type === DataType.ALARMS) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      // Node type icons mapping
      const nodeTypeIcons = {
        0: 'https://xivapi.com/i/060000/060438.png', // Mining
        1: 'https://xivapi.com/i/060000/060437.png', // Quarrying
        2: 'https://xivapi.com/i/060000/060433.png', // Logging
        3: 'https://xivapi.com/i/060000/060432.png', // Harvesting
        4: 'https://xivapi.com/i/060000/060445.png', // Fishing
        5: 'https://xivapi.com/i/060000/060465.png', // Spearfishing
      };

      const nodeTypeNames = {
        0: '採礦',
        1: '採石',
        2: '採伐',
        3: '割取',
        4: '釣魚',
        5: '潛水',
      };

      return (
        <div key={`alarm-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060502.png" alt="Alarm" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">鬧鐘提醒</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.map((alarm, alarmIndex) => {
              if (!alarm || typeof alarm !== 'object') return null;
              
              const zoneId = alarm.zoneId;
              const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
              const mapId = alarm.mapId;
              const coords = alarm.coords;
              const nodeType = alarm.type !== undefined ? Math.abs(alarm.type) : 0;
              const nodeIcon = nodeTypeIcons[nodeType] || nodeTypeIcons[0];
              const nodeTypeName = nodeTypeNames[nodeType] || '採集';
              const duration = alarm.duration || 0;
              const spawns = alarm.spawns || [];
              const isEphemeral = alarm.ephemeral === true;
              const hasLocation = coords && coords.x !== undefined && coords.y !== undefined && mapId;

              return (
                <div key={alarmIndex} className="bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={nodeIcon} alt={nodeTypeName} className="w-7 h-7 object-contain" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">
                        {zoneName}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {nodeTypeName}
                        {duration > 0 && <span className="ml-1">持續 {duration} 分鐘</span>}
                        {isEphemeral && <span className="ml-1 text-yellow-400">限時</span>}
                        {spawns.length > 0 && <span className="ml-1">出現時間: {spawns.join(', ')}</span>}
                      </div>
                    </div>
                  </div>
                  
                  {hasLocation && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapModal({
                          isOpen: true,
                          zoneName,
                          x: coords.x,
                          y: coords.y,
                          npcName: `${nodeTypeName}採集點`,
                          mapId: mapId,
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
                          X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
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

    // Achievements (成就獎勵) - data is an array of achievement IDs
    if (type === DataType.ACHIEVEMENTS || type === 22) {
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
        <div key={`achievement-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/060000/060453.png" alt="Achievement" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">成就獎勵</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validAchievements.map((achievementId, achievementIndex) => {
              const achievementInfo = getAchievementInfo(achievementId);
              
              if (!achievementInfo) return null;
              
              return (
                <div
                  key={achievementIndex}
                  className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center"
                  onMouseEnter={(e) => handleAchievementMouseEnter(e, achievementId)}
                  onMouseMove={handleAchievementMouseMove}
                  onMouseLeave={handleAchievementMouseLeave}
                >
                  <div className="flex items-center gap-2">
                    {achievementInfo.icon && (
                      <img src={achievementInfo.icon} alt={achievementInfo.name} className="w-7 h-7 object-contain" />
                    )}
                    <div className="flex-1">
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

    // Default fallback - don't render unknown types
    return null;
  };

  // Helper function to count items in a source (matching what's actually displayed)
  // OPTIMIZED: Memoized callback to prevent function recreation on every render
  const getSourceItemCount = useCallback((source) => {
    const { type, data } = source;
    
    if (!data) return 0;
    
    // For array-based sources, count array length
    if (Array.isArray(data)) {
      // For VENDORS, count unique NPCs (since we group by NPC)
      if (type === DataType.VENDORS) {
        const uniqueNpcs = new Set(data.map(v => v.npcId));
        return uniqueNpcs.size;
      }
      // For TRADE_SOURCES, count unique NPCs across all trade sources
      if (type === DataType.TRADE_SOURCES) {
        const uniqueNpcs = new Set();
        data.forEach(tradeSource => {
          tradeSource.npcs?.forEach(npc => {
            const npcId = typeof npc === 'object' ? npc.id : npc;
            if (npcId) uniqueNpcs.add(npcId);
          });
        });
        return uniqueNpcs.size;
      }
      // For other array sources, count array length
      return data.length;
    }
    
    // For object-based sources (like GATHERED_BY), count nodes or other properties
    if (typeof data === 'object') {
      if (type === DataType.GATHERED_BY && data.nodes) {
        return data.nodes.length;
      }
      if (type === DataType.ALARMS && Array.isArray(data)) {
        return data.length;
      }
      // Default to 1 for object sources
      return 1;
    }
    
    return 0;
  }, []); // No dependencies - pure function

  // ============================================================================
  // ⚠️ CRITICAL WARNING: RULES OF HOOKS - HOOKS MUST BE AT TOP LEVEL! ⚠️
  // ============================================================================
  // React hooks (useState, useEffect, etc.) MUST be called at the top level of the component,
  // BEFORE any conditional logic, computed values, or const/let declarations that depend on state.
  // NEVER place hooks after computed values like sortedSources - this violates Rules of Hooks
  // and causes "Rendered more hooks than during the previous render" errors.
  //
  // If you need to use computed values in a hook:
  // 1. Place the hook at the top level with other hooks (before this comment)
  // 2. Compute the value INSIDE the hook using the state/props it depends on
  // 3. Use the state/props in the dependency array, not the computed value
  //
  // ALL HOOKS MUST BE DEFINED BEFORE THIS POINT - NO HOOKS AFTER sortedSources!
  // ============================================================================

  // Sort sources by item count (descending) - more items appear first (on the left)
  // OPTIMIZED: Memoized to prevent recalculation on every render
  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => {
      const countA = getSourceItemCount(a);
      const countB = getSourceItemCount(b);
      return countB - countA; // Descending order
    });
  }, [sources, getSourceItemCount]); // getSourceItemCount is stable (useCallback with no deps)

  // Filter sources by selected method type
  // OPTIMIZED: Memoized to prevent recalculation on every render
  const filteredSources = useMemo(() => {
    return filteredMethodType 
      ? sortedSources.filter(source => source.type === filteredMethodType)
      : sortedSources;
  }, [sortedSources, filteredMethodType]);

  // Get unique method types for filter tags
  // OPTIMIZED: Memoized to prevent recalculation on every render
  const uniqueMethodTypes = useMemo(() => {
    return [...new Set(sortedSources.map(s => s.type))];
  }, [sortedSources]);

  // Filter out null results (sources without valid lookups)
  // OPTIMIZED: Memoized to prevent recalculation on every render
  const validSources = useMemo(() => {
    return filteredSources.map((source, index) => {
      const rendered = renderSource(source, index, false); // Don't use flex-1, let containers wrap naturally
      return rendered;
    }).filter(Boolean);
  }, [filteredSources]);

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
              const methodName = getMethodTypeName(methodType);
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

      <div className="flex flex-wrap gap-3 items-start">
        {validSources}
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
                              navigate(`/item/${achievementTooltipInfo.itemReward}`);
                            }
                          });
                        } else {
                          navigate(`/item/${achievementTooltipInfo.itemReward}`);
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
      />
    </div>
  );
}

