// Component to display item acquisition methods (取得方式) 
import { useState, useEffect, useRef, useMemo } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getItemSources, DataType } from '../services/extractsService';
import { getItemById } from '../services/itemDatabase';
// Small files that are frequently used - keep as static imports
// FILE SIZE: 76KB, 4.8K lines - Static import
import twNpcTitlesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-npc-titles.json';
// FILE SIZE: 108KB, 5.5K lines - Static import
import twShopsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-shops.json';
// FILE SIZE: 36KB, 1.7K lines - Static import
import twInstancesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-instances.json';
// FILE SIZE: 256KB, 15K lines - Static import
import twQuestsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-quests.json';
// FILE SIZE: 172KB, 10K lines - Static import
import twAchievementsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-achievements.json';
// FILE SIZE: 276KB, 10K lines - Static import
import twAchievementDescriptionsData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-achievement-descriptions.json';
// FILE SIZE: 4KB, 128 lines - Static import
import twJobAbbrData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-job-abbr.json';
// FILE SIZE: 436KB, 14K lines - Static import
import twFatesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-fates.json';
// FILE SIZE: 16KB, 1.6K lines - Static import
import fateSourcesData from '../../teamcraft_git/libs/data/src/lib/json/fate-sources.json';
// FILE SIZE: 116KB, 12K lines - Static import
import lootSourcesData from '../../teamcraft_git/libs/data/src/lib/json/loot-sources.json';
// FILE SIZE: 208KB, 14K lines - Static import
import twPlacesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-places.json';

// Lazy load cache for large JSON files
let npcsDataCache = null;
let shopsDataCache = null;
let shopsByNpcDataCache = null;
let gilShopNamesDataCache = null;
let zhInstancesDataCache = null;
let zhQuestsDataCache = null;
let zhFatesDataCache = null;
let npcsDatabasePagesDataCache = null;
let questsDatabasePagesDataCache = null;
// Large static imports converted to lazy loading to prevent blocking
let twNpcsDataCache = null;
let twItemsDataCache = null;
let achievementsDataCache = null;
let fatesDataCache = null;
let fatesDatabasePagesDataCache = null;
let placesDataCache = null;
let instancesDataCache = null;
let questsDataCache = null;

// Lazy load functions for large JSON files
const loadNpcsData = async () => {
  if (!npcsDataCache) {
    // FILE SIZE: 16MB, 1M+ lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/npcs.json');
    npcsDataCache = module.default;
  }
  return npcsDataCache;
};

const loadShopsData = async () => {
  if (!shopsDataCache) {
    // FILE SIZE: 9.2MB, 595K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/shops.json');
    shopsDataCache = module.default;
  }
  return shopsDataCache;
};

const loadShopsByNpcData = async () => {
  if (!shopsByNpcDataCache) {
    // FILE SIZE: 27MB, 1.5M+ lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/shops-by-npc.json');
    shopsByNpcDataCache = module.default;
  }
  return shopsByNpcDataCache;
};

const loadGilShopNamesData = async () => {
  if (!gilShopNamesDataCache) {
    // FILE SIZE: 156KB, 6.6K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/gil-shop-names.json');
    gilShopNamesDataCache = module.default;
  }
  return gilShopNamesDataCache;
};

const loadZhInstancesData = async () => {
  if (!zhInstancesDataCache) {
    // FILE SIZE: 36KB, 1.9K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/zh/zh-instances.json');
    zhInstancesDataCache = module.default;
  }
  return zhInstancesDataCache;
};

const loadZhQuestsData = async () => {
  if (!zhQuestsDataCache) {
    // FILE SIZE: 268KB, 15K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/zh/zh-quests.json');
    zhQuestsDataCache = module.default;
  }
  return zhQuestsDataCache;
};

const loadZhFatesData = async () => {
  if (!zhFatesDataCache) {
    // FILE SIZE: 460KB, 14K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/zh/zh-fates.json');
    zhFatesDataCache = module.default;
  }
  return zhFatesDataCache;
};

const loadNpcsDatabasePagesData = async () => {
  if (!npcsDatabasePagesDataCache) {
    // FILE SIZE: 14MB - MUST BE LAZY LOADED
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/db/npcs-database-pages.json');
    npcsDatabasePagesDataCache = module.default;
  }
  return npcsDatabasePagesDataCache;
};

const loadQuestsDatabasePagesData = async () => {
  if (!questsDatabasePagesDataCache) {
    // FILE SIZE: 6.7MB - MUST BE LAZY LOADED
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/db/quests-database-pages.json');
    questsDatabasePagesDataCache = module.default;
  }
  return questsDatabasePagesDataCache;
};

// Lazy load functions for large static imports (converted from static imports to prevent blocking)
const loadTwNpcsData = async () => {
  if (!twNpcsDataCache) {
    // FILE SIZE: 1.3MB, 84K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/tw/tw-npcs.json');
    twNpcsDataCache = module.default;
  }
  return twNpcsDataCache;
};

const loadTwItemsData = async () => {
  if (!twItemsDataCache) {
    // FILE SIZE: 2.1MB, 128K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/tw/tw-items.json');
    twItemsDataCache = module.default;
  }
  return twItemsDataCache;
};

const loadAchievementsData = async () => {
  if (!achievementsDataCache) {
    // FILE SIZE: 924KB, 31K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/achievements.json');
    achievementsDataCache = module.default;
  }
  return achievementsDataCache;
};

const loadFatesData = async () => {
  if (!fatesDataCache) {
    // FILE SIZE: 2.1MB, 44K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/fates.json');
    fatesDataCache = module.default;
  }
  return fatesDataCache;
};

const loadFatesDatabasePagesData = async () => {
  if (!fatesDatabasePagesDataCache) {
    // FILE SIZE: 1.8MB
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/db/fates-database-pages.json');
    fatesDatabasePagesDataCache = module.default;
  }
  return fatesDatabasePagesDataCache;
};

const loadPlacesData = async () => {
  if (!placesDataCache) {
    // FILE SIZE: 736KB, 33K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/places.json');
    placesDataCache = module.default;
  }
  return placesDataCache;
};

const loadInstancesData = async () => {
  if (!instancesDataCache) {
    // FILE SIZE: 1.3MB, 19K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/instances.json');
    instancesDataCache = module.default;
  }
  return instancesDataCache;
};

const loadQuestsData = async () => {
  if (!questsDataCache) {
    // FILE SIZE: 1.9MB, 96K lines
    const module = await import('../../teamcraft_git/libs/data/src/lib/json/quests.json');
    questsDataCache = module.default;
  }
  return questsDataCache;
};

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
  // Cache for lazy-loaded data (loaded on demand)
  const [npcsDataLoaded, setNpcsDataLoaded] = useState(null);
  const [shopsDataLoaded, setShopsDataLoaded] = useState(null);
  const [shopsByNpcDataLoaded, setShopsByNpcDataLoaded] = useState(null);
  const [gilShopNamesDataLoaded, setGilShopNamesDataLoaded] = useState(null);
  const [zhInstancesDataLoaded, setZhInstancesDataLoaded] = useState(null);
  const [zhQuestsDataLoaded, setZhQuestsDataLoaded] = useState(null);
  const [zhFatesDataLoaded, setZhFatesDataLoaded] = useState(null);
  const [npcsDatabasePagesDataLoaded, setNpcsDatabasePagesDataLoaded] = useState(null);
  const [questsDatabasePagesDataLoaded, setQuestsDatabasePagesDataLoaded] = useState(null);
  // Refs for lazy-loaded data (converted from static imports) - loaded on mount
  const dataRefs = useRef({
    twNpcsData: null,
    twItemsData: null,
    achievementsData: null,
    fatesData: null,
    fatesDatabasePagesData: null,
    placesData: null,
    instancesData: null,
    questsData: null
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  // Create a data accessor object that provides access to lazy-loaded data
  // This allows the component to use the same variable names throughout
  const dataFiles = useMemo(() => {
    if (!dataLoaded) {
      return {
        twNpcsData: {},
        twItemsData: {},
        achievementsData: {},
        fatesData: {},
        fatesDatabasePagesData: {},
        placesData: {},
        instancesData: {},
        questsData: {}
      };
    }
    return {
      twNpcsData: dataRefs.current.twNpcsData || {},
      twItemsData: dataRefs.current.twItemsData || {},
      achievementsData: dataRefs.current.achievementsData || {},
      fatesData: dataRefs.current.fatesData || {},
      fatesDatabasePagesData: dataRefs.current.fatesDatabasePagesData || {},
      placesData: dataRefs.current.placesData || {},
      instancesData: dataRefs.current.instancesData || {},
      questsData: dataRefs.current.questsData || {}
    };
  }, [dataLoaded]);
  
  // Destructure for convenient access throughout component
  const { twNpcsData, twItemsData, achievementsData, fatesData, fatesDatabasePagesData, placesData, instancesData, questsData } = dataFiles;

  // Load all large data files in parallel on mount
  useEffect(() => {
    Promise.all([
      loadTwNpcsData(),
      loadTwItemsData(),
      loadAchievementsData(),
      loadFatesData(),
      loadFatesDatabasePagesData(),
      loadPlacesData(),
      loadInstancesData(),
      loadQuestsData()
    ]).then(([twNpcs, twItems, achievements, fates, fatesDb, places, instances, quests]) => {
      dataRefs.current.twNpcsData = twNpcs;
      dataRefs.current.twItemsData = twItems;
      dataRefs.current.achievementsData = achievements;
      dataRefs.current.fatesData = fates;
      dataRefs.current.fatesDatabasePagesData = fatesDb;
      dataRefs.current.placesData = places;
      dataRefs.current.instancesData = instances;
      dataRefs.current.questsData = quests;
      setDataLoaded(true);
    }).catch(error => {
      console.error('Failed to load ObtainMethods data:', error);
      setDataLoaded(true); // Still set to true to prevent infinite loading
    });
  }, []);

  useEffect(() => {
    if (!itemId || !dataLoaded) return; // Wait for data to load before processing

    setLoading(true);
    setFilteredMethodType(null); // Reset filter when item changes
    
    // Create abort controller for cancellation
    const abortController = new AbortController();
    
    getItemSources(itemId, abortController.signal)
      .then(data => {
        // Check if request was cancelled
        if (abortController.signal.aborted) {
          return;
        }
        // Check if we need to add FATE sources from fate-sources.json
        const hasFates = data.some(source => source.type === DataType.FATES);
        
        // Filter out ISLAND_PASTURE sources - these are Eureka-related and should not be displayed as FATEs
        data = data.filter(source => source.type !== DataType.ISLAND_PASTURE);
        
        // Filter out invalid FATE sources (gathering nodes misclassified as FATEs)
        data = data.filter(source => {
          if (source.type === DataType.FATES && Array.isArray(source.data)) {
            // Check if this FATE source has any valid FATEs
            const hasValidFate = source.data.some(fate => {
              // Skip if this looks like a gathering node (has nodeId, itemId but no id)
              if (typeof fate === 'object') {
                if ((fate.nodeId !== undefined || fate.itemId !== undefined) && fate.id === undefined) {
                  return false; // This is a gathering node, not a FATE
                }
              }
              const fateId = typeof fate === 'object' ? fate.id : fate;
              if (!fateId || typeof fateId !== 'number') return false;
              // Check if we have any data source for this FATE
              const twFate = twFatesData[fateId];
              const fateData = fatesData[fateId];
              const fateDb = fatesDatabasePagesData[fateId] || fatesDatabasePagesData[String(fateId)];
              return twFate || fateData || fateDb;
            });
            return hasValidFate; // Keep source only if it has at least one valid FATE
          }
          return true; // Keep all non-FATE sources
        });
        
        // Always check fate-sources.json and merge any additional FATEs
        // Check both string and number keys since JSON keys are strings
        const fateSourcesForItem = fateSourcesData[itemId] || fateSourcesData[String(itemId)];
        if (fateSourcesForItem) {
          const fateIds = fateSourcesForItem;
          const existingFateIds = new Set();
          
          // Collect existing FATE IDs from FATES sources only
          if (hasFates) {
            const fatesSource = data.find(s => s.type === DataType.FATES);
            if (fatesSource && Array.isArray(fatesSource.data)) {
              fatesSource.data.forEach(fate => {
                const fateId = typeof fate === 'object' ? fate.id : fate;
                if (fateId) existingFateIds.add(fateId);
              });
            }
          }
          
          // Add missing FATEs from fate-sources.json
          const missingFateIds = fateIds.filter(fateId => !existingFateIds.has(fateId));
          
          if (missingFateIds.length > 0) {
            const newFateSources = missingFateIds.map(fateId => {
              const fateDb = fatesDatabasePagesData[fateId] || fatesDatabasePagesData[String(fateId)];
              if (!fateDb) return null;
              
              return {
                id: fateId,
                level: fateDb.lvl || fateDb.lvlMax || 0,
                zoneId: fateDb.zoneid,
                mapId: fateDb.map,
                coords: (fateDb.x !== undefined && fateDb.y !== undefined) ? {
                  x: fateDb.x,
                  y: fateDb.y
                } : null
              };
            }).filter(Boolean);
            
            if (newFateSources.length > 0) {
              // Create or merge into FATES source
              if (hasFates) {
                const fatesSource = data.find(s => s.type === DataType.FATES);
                if (fatesSource) {
                  fatesSource.data = [...(fatesSource.data || []), ...newFateSources];
                }
              } else {
                data.push({
                  type: DataType.FATES,
                  data: newFateSources
                });
              }
            }
          }
        }
        
        // Recalculate hasFates after potentially adding FATEs from fate-sources.json
        const hasFatesAfterMerge = data.some(source => source.type === DataType.FATES);
        
        // Also check reverse lookup: find FATEs that reward this item
        // 1. Check if any FATE's items array includes this item
        // 2. Check if any FATE in fate-sources.json for other items also rewards this item (rare drops)
        Object.keys(fatesDatabasePagesData).forEach(fateIdStr => {
          const fateDb = fatesDatabasePagesData[fateIdStr];
          if (!fateDb) return;
          
          const fateId = parseInt(fateIdStr, 10);
          const fateItems = Array.isArray(fateDb.items) ? fateDb.items : [];
          const itemIsInFateItems = fateItems.includes(itemId);
          
          // Check if this FATE is already included
          let alreadyIncluded = false;
          if (hasFatesAfterMerge) {
            const fatesSource = data.find(s => s.type === DataType.FATES);
            if (fatesSource && Array.isArray(fatesSource.data)) {
              alreadyIncluded = fatesSource.data.some(fate => {
                const existingFateId = typeof fate === 'object' ? fate.id : fate;
                return existingFateId === fateId;
              });
            }
          }
          
          // Check if this FATE should be included:
          // - Item is in FATE's items array, OR
          // - FATE is in fate-sources.json for this item (already handled above), OR
          // - FATE is in fate-sources.json for other items AND we're viewing one of those items
          //   (this handles cases where an item is a reward but not in the items array)
          const fateSourcesForItem = fateSourcesData[itemId] || fateSourcesData[String(itemId)];
          const isFateInSourcesForItem = fateSourcesForItem && fateSourcesForItem.includes(fateId);
          const shouldInclude = itemIsInFateItems || isFateInSourcesForItem;
          
          if (shouldInclude && !alreadyIncluded) {
            const newFateSource = {
              id: fateId,
              level: fateDb.lvl || fateDb.lvlMax || 0,
              zoneId: fateDb.zoneid,
              mapId: fateDb.map,
              coords: (fateDb.x !== undefined && fateDb.y !== undefined) ? {
                x: fateDb.x,
                y: fateDb.y
              } : null
            };
            
            if (hasFatesAfterMerge) {
              const fatesSource = data.find(s => s.type === DataType.FATES);
              if (fatesSource) {
                fatesSource.data = [...(fatesSource.data || []), newFateSource];
              } else {
                // Should not happen, but create if missing
                data.push({
                  type: DataType.FATES,
                  data: [newFateSource]
                });
              }
            } else {
              data.push({
                type: DataType.FATES,
                data: [newFateSource]
              });
            }
          }
        });
        
        // Check quests.json directly for quests that reward this item (fallback for missing/extracted data)
        const hasQuests = data.some(source => source.type === DataType.QUESTS);
        const questIdsFromQuestsJson = [];
        
        // Find all quests that reward this item
        Object.keys(questsData).forEach(questIdStr => {
          const quest = questsData[questIdStr];
          if (!quest || !quest.rewards) return;
          
          // Check if any reward matches this item
          const hasItemReward = quest.rewards.some(reward => reward.id === itemId);
          if (hasItemReward) {
            questIdsFromQuestsJson.push(parseInt(questIdStr, 10));
          }
        });
        
        // Add quest sources if found and not already present
        if (questIdsFromQuestsJson.length > 0) {
          if (hasQuests) {
            // Merge with existing quest sources
            const questsSource = data.find(s => s.type === DataType.QUESTS);
            if (questsSource && Array.isArray(questsSource.data)) {
              const existingQuestIds = new Set(questsSource.data.map(q => typeof q === 'object' ? q.id : q));
              const newQuestIds = questIdsFromQuestsJson.filter(qId => !existingQuestIds.has(qId));
              if (newQuestIds.length > 0) {
                questsSource.data = [...questsSource.data, ...newQuestIds];
              }
            }
          } else {
            // Also check if type 18 (MASTERBOOKS) contains quest IDs (data error fix)
            const masterbooksSource = data.find(s => s.type === DataType.MASTERBOOKS);
            if (masterbooksSource && Array.isArray(masterbooksSource.data)) {
              // Check if the data looks like quest IDs (reasonable quest ID range)
              const looksLikeQuestIds = masterbooksSource.data.every(id => {
                const numId = typeof id === 'object' ? id.id : id;
                return typeof numId === 'number' && numId > 1000 && numId < 1000000;
              });
              
              if (looksLikeQuestIds) {
                // Convert MASTERBOOKS source to QUESTS source
                masterbooksSource.type = DataType.QUESTS;
                const existingQuestIds = new Set(masterbooksSource.data.map(q => typeof q === 'object' ? q.id : q));
                const newQuestIds = questIdsFromQuestsJson.filter(qId => !existingQuestIds.has(qId));
                if (newQuestIds.length > 0) {
                  masterbooksSource.data = [...masterbooksSource.data, ...newQuestIds];
                }
              } else {
                // Add as new QUESTS source
                data.push({
                  type: DataType.QUESTS,
                  data: questIdsFromQuestsJson
                });
              }
            } else {
              // Add as new QUESTS source
              data.push({
                type: DataType.QUESTS,
                data: questIdsFromQuestsJson
              });
            }
          }
        }
        
        // Check loot-sources.json for items obtainable from coffers/containers
        if (lootSourcesData[itemId] && Array.isArray(lootSourcesData[itemId]) && lootSourcesData[itemId].length > 0) {
          const lootSourceIds = lootSourcesData[itemId];
          const hasTreasures = data.some(source => source.type === DataType.TREASURES);
          
          // Filter out invalid loot source IDs and check if items exist
          const validLootSources = lootSourceIds.filter(lootSourceId => {
            const lootItem = twItemsData[lootSourceId];
            return lootItem && lootItem.tw;
          });
          
          if (validLootSources.length > 0) {
            if (hasTreasures) {
              // Merge with existing TREASURES source
              const treasuresSource = data.find(s => s.type === DataType.TREASURES);
              if (treasuresSource && Array.isArray(treasuresSource.data)) {
                const existingTreasureIds = new Set(treasuresSource.data.map(id => typeof id === 'object' ? id.id : id));
                const newTreasureIds = validLootSources.filter(id => !existingTreasureIds.has(id));
                if (newTreasureIds.length > 0) {
                  treasuresSource.data = [...treasuresSource.data, ...newTreasureIds];
                }
              }
            } else {
              // Add as new TREASURES source (reusing TREASURES type for loot sources/coffers)
              data.push({
                type: DataType.TREASURES,
                data: validLootSources
              });
            }
          }
        }
        
        setSources(data || []);
        setLoading(false);
      })
      .catch(err => {
        // Don't update state if request was cancelled
        if (abortController.signal.aborted) {
          return;
        }
        
        
        console.error('Failed to load sources:', err);
        setSources([]);
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

  // Load gil-shop-names data when needed
  useEffect(() => {
    if (!gilShopNamesDataLoaded) {
      loadGilShopNamesData().then(data => setGilShopNamesDataLoaded(data));
    }
  }, [gilShopNamesDataLoaded]);
  
  // Load zh data when needed
  useEffect(() => {
    if (!zhInstancesDataLoaded && sources.some(s => s.type === DataType.INSTANCES)) {
      loadZhInstancesData().then(data => setZhInstancesDataLoaded(data));
    }
  }, [sources, zhInstancesDataLoaded]);
  
  useEffect(() => {
    if (!zhQuestsDataLoaded && sources.some(s => s.type === DataType.QUESTS)) {
      loadZhQuestsData().then(data => setZhQuestsDataLoaded(data));
    }
  }, [sources, zhQuestsDataLoaded]);
  
  // Load zhFatesData when needed (for FATEs)
  useEffect(() => {
    if (!zhFatesDataLoaded && sources.some(s => s.type === DataType.FATES)) {
      loadZhFatesData().then(data => setZhFatesDataLoaded(data));
    }
  }, [sources, zhFatesDataLoaded]);
  
  // Load npcs data when needed (for vendors/quests)
  useEffect(() => {
    if (!npcsDataLoaded && sources.some(s => s.type === DataType.VENDORS || s.type === DataType.QUESTS)) {
      loadNpcsData().then(data => setNpcsDataLoaded(data));
    }
  }, [sources, npcsDataLoaded]);
  
  // Load shops data when component mounts (only if needed)
  useEffect(() => {
    if (!shopsDataLoaded && sources.some(s => s.type === DataType.VENDORS || s.type === DataType.TRADE_SOURCES)) {
      loadShopsData().then(data => setShopsDataLoaded(data));
    }
  }, [sources, shopsDataLoaded]);
  
  useEffect(() => {
    if (!shopsByNpcDataLoaded && sources.some(s => s.type === DataType.VENDORS || s.type === DataType.TRADE_SOURCES)) {
      loadShopsByNpcData().then(data => setShopsByNpcDataLoaded(data));
    }
  }, [sources, shopsByNpcDataLoaded]);
  
  // Load npcs-database-pages data when needed (for NPC titles and locations)
  useEffect(() => {
    if (!npcsDatabasePagesDataLoaded && sources.some(s => s.type === DataType.VENDORS || s.type === DataType.QUESTS)) {
      loadNpcsDatabasePagesData().then(data => setNpcsDatabasePagesDataLoaded(data));
    }
  }, [sources, npcsDatabasePagesDataLoaded]);
  
  // Load quests-database-pages data when needed (for quest details)
  useEffect(() => {
    if (!questsDatabasePagesDataLoaded && sources.some(s => s.type === DataType.QUESTS)) {
      loadQuestsDatabasePagesData().then(data => setQuestsDatabasePagesDataLoaded(data));
    }
  }, [sources, questsDatabasePagesDataLoaded]);

  // Show loading state if data is still loading or sources are being fetched
  if (!dataLoaded || loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
        <p className="mt-4 text-gray-400">載入取得方式...</p>
      </div>
    );
  }

  if (sources.length === 0) {
    // Check if item is a treasure map (名稱包含"地圖")
    const itemData = twItemsData[itemId];
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
    const npc = twNpcsData[npcId];
    return npc?.tw || `NPC ${npcId}`;
  };

  const getNpcTitle = (npcId) => {
    // Try tw-npc-titles.json first
    const titleData = twNpcTitlesData[npcId] || twNpcTitlesData[String(npcId)];
    if (titleData?.tw) {
      return titleData.tw;
    }
    // Fallback to npcs-database-pages.json (lazy loaded)
    if (npcsDatabasePagesDataLoaded) {
      const npcDb = npcsDatabasePagesDataLoaded[npcId] || npcsDatabasePagesDataLoaded[String(npcId)];
      if (npcDb?.title?.zh) {
        return npcDb.title.zh;
      }
    }
    return null;
  };

  const getPlaceName = (zoneId) => {
    // Try Traditional Chinese first
    const twPlace = twPlacesData[zoneId];
    if (twPlace?.tw) {
      return twPlace.tw;
    }
    // Fallback to English places.json
    const place = placesData[zoneId];
    return place?.en || `Zone ${zoneId}`;
  };

  const getShopName = (shopId) => {
    // Try Traditional Chinese shop names
    const twShop = twShopsData[shopId];
    if (twShop?.tw) {
      return twShop.tw;
    }
    // Fallback to shop name from trade source if available
    return null;
  };

  // Get shop name from vendor.shopName by matching English name to shop ID
  const getVendorShopName = (shopName) => {
    if (!shopName) return null;
    
    // First try to get tw or zh directly from shopName
    if (shopName.tw) return shopName.tw;
    if (shopName.zh) return shopName.zh;
    
    // If not available, try to find shop ID by matching English name (lazy loaded)
    if (shopName.en && gilShopNamesDataLoaded) {
      for (const [shopId, shopData] of Object.entries(gilShopNamesDataLoaded)) {
        if (shopData?.en === shopName.en) {
          // Found matching shop ID, get Traditional Chinese name from tw-shops.json
          const twShop = twShopsData[shopId];
          if (twShop?.tw) {
            return twShop.tw;
          }
        }
      }
    }
    
    return null;
  };

  const getCurrencyName = (currencyItemId) => {
    // Get currency name directly from tw-items.json (synchronous lookup)
    if (!currencyItemId) return '貨幣';
    
    const currencyItem = twItemsData[currencyItemId];
    if (currencyItem?.tw) {
      return currencyItem.tw;
    }
    
    // Fallback: try async lookup from item database
    // Note: This will return a promise, so we handle it in the component
    return null;
  };

  // Get achievement info by achievement ID
  const getAchievementInfo = (achievementId) => {
    if (!achievementId) return null;
    const achievementIdStr = achievementId.toString();
    const achievement = twAchievementsData[achievementIdStr];
    const description = twAchievementDescriptionsData[achievementIdStr];
    const achievementData = achievementsData[achievementIdStr];
    
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
    const twInstance = twInstancesData[instanceId];
    if (twInstance?.tw) {
      return twInstance.tw;
    }
    // Fallback to English instances.json
    const instance = instancesData[instanceId];
    if (instance?.en) {
      return instance.en;
    }
    return `副本 ${instanceId}`;
  };

  const getInstanceCNName = (instanceId) => {
    // Get Simplified Chinese name from zh-instances.json for Huiji Wiki (lazy loaded)
    if (!zhInstancesDataLoaded) return null;
    const zhInstance = zhInstancesDataLoaded[instanceId];
    return zhInstance?.zh || null;
  };

  const getQuestCNName = (questId) => {
    // Get Simplified Chinese quest name from zh-quests.json for Huiji Wiki (lazy loaded)
    if (!zhQuestsDataLoaded) return null;
    const zhQuest = zhQuestsDataLoaded[questId];
    return zhQuest?.zh || null;
  };

  // Clean quest name by removing invisible/special characters (like U+E0FE)
  const cleanQuestName = (name) => {
    if (!name) return name;
    // Remove characters in private use area (U+E000-U+F8FF) and other invisible characters
    return name.replace(/[\uE000-\uF8FF\u200B-\u200D\uFEFF]/g, '').trim();
  };

  // Get quest requirement for a shop by shop ID and NPC ID
  // Look up from multiple sources: trade source data, shops.json, and shops-by-npc.json
  const getShopQuestRequirement = (shopId, npcId, tradeSource) => {
    if (!shopId) return null;
    
    // First, check if tradeSource has requiredQuest (from extracts.json after extraction runs)
    if (tradeSource && tradeSource.requiredQuest) {
      return tradeSource.requiredQuest;
    }
    
    // Look up shop in shops.json (lazy loaded)
    if (shopsDataLoaded) {
      const shop = Array.isArray(shopsDataLoaded) 
        ? shopsDataLoaded.find(s => s.id === shopId)
        : shopsDataLoaded[shopId];
      
      // Check if shop has requiredQuest property (will be populated after extraction runs)
      if (shop && shop.requiredQuest) {
        return shop.requiredQuest;
      }
    }
    
    // If not found in shops.json, try shops-by-npc.json (lazy loaded)
    if (npcId && shopsByNpcDataLoaded && shopsByNpcDataLoaded[npcId]) {
      const npcShops = shopsByNpcDataLoaded[npcId];
      const npcShop = Array.isArray(npcShops)
        ? npcShops.find(s => s.id === shopId)
        : npcShops[shopId];
      
      if (npcShop && npcShop.requiredQuest) {
        return npcShop.requiredQuest;
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
    const itemData = twItemsData[itemId];
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
                            專用配方書:{' '}
                            {masterbookId ? (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (onItemClick) {
                                    getItemById(masterbookId).then(item => {
                                      if (item) {
                                        onItemClick(item);
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
        const currencyItemData = currencyItemId ? twItemsData[currencyItemId] : null;
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
              const zoneName = npcZoneId ? getPlaceName(npcZoneId) : '';
              const hasLocation = npcCoords && npcCoords.x !== undefined && npcCoords.y !== undefined;
              
              // Get quest requirement for this shop/NPC combination
              const requiredQuestId = getShopQuestRequirement(entry.shopId, npcId, entry.tradeSource);
              const questName = requiredQuestId ? (twQuestsData[requiredQuestId]?.tw || twQuestsData[requiredQuestId]?.en) : null;
              
              return (
                <div key={`npc-${entryIndex}`} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    {entry.hasCurrencyItem ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onItemClick) {
                            // Get item data and call onItemClick
                            getItemById(entry.currencyItemId).then(item => {
                              if (item) {
                                onItemClick(item);
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
              
              const zoneName = zoneId ? getPlaceName(zoneId) : '';
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
              const treasureItemData = twItemsData[treasureId];
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
                          onItemClick(item);
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
              const instance = instancesData[instanceId];
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
                  {instanceCNName ? (
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
                  ) : (
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
        const itemData = twItemsData[itemId];
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
              const desynthItemData = twItemsData[desynthItemId];
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
                          onItemClick(item);
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
        const questData = twQuestsData[questId];
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
              const questData = twQuestsData[questId];
              const questNameRaw = questData?.tw;
              const questName = cleanQuestName(questNameRaw);
              
              if (!questName) return null;
              
              // Get quest icon from quests.json
              const quest = questsData[questId];
              const questIcon = quest?.icon 
                ? `https://xivapi.com${quest.icon}` 
                : 'https://xivapi.com/i/060000/060453.png';
              
              // Get Simplified Chinese quest name for Huiji Wiki link
              const questCNNameRaw = getQuestCNName(questId);
              const questCNName = cleanQuestName(questCNNameRaw);
              
              // Get quest details from quests-database-pages.json (lazy loaded)
              const questDb = questsDatabasePagesDataLoaded ? questsDatabasePagesDataLoaded[questId] : null;
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
              if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && startingNpcId && npcsDatabasePagesDataLoaded) {
                const npcDb = npcsDatabasePagesDataLoaded[startingNpcId] || npcsDatabasePagesDataLoaded[String(startingNpcId)];
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
              
              const zoneName = zoneId ? getPlaceName(zoneId) : '';
              const hasLocation = zoneName && coords && coords.x !== undefined && coords.y !== undefined;
              const hasValidMapLocation = hasLocation && mapId && (coords.x !== 0 || coords.y !== 0);
              
              return (
                <div key={questIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={questIcon} alt="Quest" className="w-7 h-7 object-contain flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {questCNName ? (
                        <a
                          href={`https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(questCNName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-400 hover:text-ffxiv-gold hover:underline transition-colors cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {questName}
                        </a>
                      ) : (
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
        // Accept FATE if we have any data source: twFatesData, fatesData, or fatesDatabasePagesData
        const twFate = twFatesData[fateId];
        const fateData = fatesData[fateId];
        const fateDb = fatesDatabasePagesData[fateId] || fatesDatabasePagesData[String(fateId)];
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
              const twFate = twFatesData[fateId];
              const zhFate = zhFatesDataLoaded?.[fateId];
              const fateName = twFate?.name?.tw || `FATE ${fateId}`;
              const fateNameZh = zhFate?.name?.zh || fateName; // Use ZH for wiki link
              
              // Get FATE icon
              const fateData = fatesData[fateId];
              const fateIcon = fateData?.icon 
                ? `https://xivapi.com${fateData.icon}` 
                : 'https://xivapi.com/i/060000/060502.png';
              
              // Get zone name
              const zoneName = fateZoneId ? getPlaceName(fateZoneId) : '';
              const hasLocation = fateCoords && fateCoords.x !== undefined && fateCoords.y !== undefined && fateMapId;
              
              // Get FATE database page data for reward items
              const fateDb = fatesDatabasePagesData[fateId] || fatesDatabasePagesData[String(fateId)];
              const rewardItems = fateDb?.items || [];
              
              // Check if current item is in this FATE's rewards
              // If the current item is not in the FATE's items array but the FATE is in fate-sources.json for this item,
              // it means the item is a rare reward - show it in rare rating
              const isCurrentItemInRewards = rewardItems.includes(itemId);
              const fateSourcesForItemCheck = fateSourcesData[itemId] || fateSourcesData[String(itemId)];
              const isFateInSourcesForItem = fateSourcesForItemCheck && fateSourcesForItemCheck.includes(fateId);
              
              // Gold/Silver rating: show all items from FATE's items array
              const goldRewardItems = rewardItems;
              
              // Rare rating: show current item if it's not in the items array but FATE is in sources for this item
              const rareRewardItems = (!isCurrentItemInRewards && isFateInSourcesForItem) ? [itemId] : [];
              
              // Check if this FATE is a notorious monster (惡名精英) - usually level 32+ and has specific icon
              const isNotoriousMonster = fateLevel && fateLevel >= 32 && fateIcon.includes('060958');
              
              // Create wiki URL using Chinese name
              const wikiUrl = `https://ff14.huijiwiki.com/wiki/${encodeURIComponent(fateNameZh)}`;
              
              return (
                <div key={fateIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={fateIcon} alt="FATE" className="w-7 h-7 object-contain" />
                    <div className="flex-1">
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
                      {fateLevel && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {zoneName ? `${zoneName} ` : ''}{fateLevel}級危命任務
                          {isNotoriousMonster && <span className="ml-1 text-yellow-400">惡名精英</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Reward Items with Ratings */}
                  {(goldRewardItems.length > 0 || rareRewardItems.length > 0) && (
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
                              {/* Silver Rating - only show if there are items for silver */}
                              {goldRewardItems.length > 0 && (
                                <tr className="border-b border-slate-700/30 bg-slate-900/30">
                                  <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">銀牌</td>
                                  <td className="py-2.5 px-3 w-auto">
                                    <div className="flex flex-wrap gap-2">
                                    {goldRewardItems.map((rewardItemId) => {
                                    const rewardItem = twItemsData[rewardItemId];
                                    if (!rewardItem || !rewardItem.tw) return null;
                                    
                                    return (
                                      <button
                                        key={`silver-${rewardItemId}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (onItemClick) {
                                            getItemById(rewardItemId).then(item => {
                                              if (item) {
                                                onItemClick(item);
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
                            
                            {/* Gold Rating */}
                            {goldRewardItems.length > 0 && (
                              <tr className="bg-slate-900/30">
                                <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">金牌</td>
                                <td className="py-2.5 px-3 w-auto">
                                  <div className="flex flex-wrap gap-2">
                                    {goldRewardItems.map((rewardItemId) => {
                                      const rewardItem = twItemsData[rewardItemId];
                                      if (!rewardItem || !rewardItem.tw) return null;
                                      
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
                                                  onItemClick(item);
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
                            
                            {/* Rare Rating - only for FATE 1362 when viewing item 6155 */}
                            {rareRewardItems.length > 0 && (
                              <tr className="bg-slate-900/30">
                                <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">稀有</td>
                                <td className="py-2.5 px-3 w-auto">
                                  <div className="flex flex-wrap gap-2">
                                    {rareRewardItems.map((rewardItemId) => {
                                      const rewardItem = twItemsData[rewardItemId];
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
                                                  onItemClick(item);
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
            <div className="w-full text-sm text-gray-300 mb-2">
              <span className="text-ffxiv-gold">{nodeTypeName}</span>
              {gatheringLevel > 0 && (
                <span className="ml-2">Lv.{gatheringLevel}</span>
              )}
              {starsTooltip && (
                <span className="ml-2 text-yellow-400">{starsTooltip}</span>
              )}
            </div>
            {data.nodes.map((node, nodeIndex) => {
              const zoneId = node.zoneId;
              const zoneName = zoneId ? getPlaceName(zoneId) : '';
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
                        {zoneName || `區域 ${zoneId}`}
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
        const itemData = twItemsData[itemId];
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
              const reductionItemData = twItemsData[reductionItemId];
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
                          onItemClick(item);
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
        const itemData = twItemsData[itemId];
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
              const ventureItemData = twItemsData[ventureItemId];
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
                          onItemClick(item);
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
        const seedData = twItemsData[seedId];
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
              const seedData = twItemsData[seedId];
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
                          onItemClick(item);
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
        const cropData = twItemsData[cropId];
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
              const cropData = twItemsData[cropId];
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
                          onItemClick(item);
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
          const reqData = twItemsData[reqId];
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
              const reqData = twItemsData[reqId];
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
                          onItemClick(item);
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

    // Masterbooks (製作書) - data is an array of item IDs (masterbook item IDs)
    if (type === DataType.MASTERBOOKS) {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const validMasterbooks = data.filter(bookId => {
        const bookData = twItemsData[bookId];
        return bookData && bookData.tw;
      });
      
      if (validMasterbooks.length === 0) {
        return null;
      }
      
      return (
        <div key={`masterbook-${index}`} className={`bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 ${flexClass} min-w-[280px]`}>
          <div className="flex items-center gap-2 mb-2">
            <img src="https://xivapi.com/i/065000/065002.png" alt="Masterbook" className="w-6 h-6" />
            <span className="text-ffxiv-gold font-medium">製作書</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {validMasterbooks.map((bookId, bookIndex) => {
              const bookData = twItemsData[bookId];
              const bookName = bookData?.tw;
              
              if (!bookName) return null;
              
              return (
                <button
                  key={bookIndex}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onItemClick) {
                      getItemById(bookId).then(item => {
                        if (item) {
                          onItemClick(item);
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
            }).filter(Boolean)}
          </div>
        </div>
      );
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
              const zoneName = zoneId ? getPlaceName(zoneId) : '';
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
                        {zoneName || `區域 ${zoneId}`}
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
  const getSourceItemCount = (source) => {
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
  };

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
  const sortedSources = [...sources].sort((a, b) => {
    const countA = getSourceItemCount(a);
    const countB = getSourceItemCount(b);
    return countB - countA; // Descending order
  });

  // Filter sources by selected method type
  const filteredSources = filteredMethodType 
    ? sortedSources.filter(source => source.type === filteredMethodType)
    : sortedSources;

  // Get unique method types for filter tags
  const uniqueMethodTypes = [...new Set(sortedSources.map(s => s.type))];

  // Filter out null results (sources without valid lookups)
  const validSources = filteredSources.map((source, index) => {
    const rendered = renderSource(source, index, false); // Don't use flex-1, let containers wrap naturally
    return rendered;
  }).filter(Boolean);

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
        {uniqueMethodTypes.length > 0 && (
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
                              onItemClick(item);
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
                      {twItemsData[achievementTooltipInfo.itemReward]?.tw || `Item ${achievementTooltipInfo.itemReward}`}
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
