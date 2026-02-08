/**
 * Extract all required IDs from sources for efficient data loading
 * This function analyzes sources and extracts only the IDs that are actually needed
 */

import { DataType } from '../constants/dataTypes.js';

/**
 * Extract all IDs needed from sources
 * @param {Array} sources - Array of source objects from extracts
 * @returns {Object} Object containing arrays of IDs by type
 */
export function extractIdsFromSources(sources) {
  const ids = {
    npcIds: new Set(),
    shopIds: new Set(),
    instanceIds: new Set(),
    questIds: new Set(),
    achievementIds: new Set(),
    itemIds: new Set(),
    zoneIds: new Set(),
    fateIds: new Set(),
  };

  if (!sources || !Array.isArray(sources)) {
    return {
      npcIds: [],
      shopIds: [],
      instanceIds: [],
      questIds: [],
      achievementIds: [],
      itemIds: [],
      zoneIds: [],
      fateIds: [],
    };
  }

  sources.forEach(source => {
    const { type, data } = source;

    // TRADE_SOURCES
    // New optimized format: {type, currencyItemId, npcIds, shopId}
    // Legacy format: {type, data: [{trades, npcs}]}
    if (type === DataType.TRADE_SOURCES) {
      // NEW FORMAT: Properties directly on source object
      if (source.npcIds && Array.isArray(source.npcIds)) {
        source.npcIds.forEach(npcId => {
          if (npcId) ids.npcIds.add(npcId);
        });
      }
      if (source.shopId) {
        ids.shopIds.add(source.shopId);
      }
      if (source.currencyItemId) {
        ids.itemIds.add(source.currencyItemId);
      }
      
      // LEGACY FORMAT: data array with shop objects
      if (Array.isArray(data)) {
        data.forEach(tradeSource => {
          // Shop ID
          if (tradeSource.id) {
            ids.shopIds.add(tradeSource.id);
          }
          // NPC IDs
          if (Array.isArray(tradeSource.npcs)) {
            tradeSource.npcs.forEach(npc => {
              const npcId = typeof npc === 'object' ? npc.id : npc;
              if (npcId) {
                ids.npcIds.add(npcId);
                // Zone ID from NPC
                if (typeof npc === 'object' && npc.zoneId) {
                  ids.zoneIds.add(npc.zoneId);
                }
              }
            });
          }
          // Currency/item IDs from trades
          if (Array.isArray(tradeSource.trades)) {
            tradeSource.trades.forEach(trade => {
              if (Array.isArray(trade.currencies)) {
                trade.currencies.forEach(currency => {
                  if (currency.id) {
                    ids.itemIds.add(currency.id);
                  }
                });
              }
              if (Array.isArray(trade.items)) {
                trade.items.forEach(item => {
                  if (item.id) {
                    ids.itemIds.add(item.id);
                  }
                });
              }
            });
          }
          // Quest requirement
          if (tradeSource.requiredQuest) {
            ids.questIds.add(tradeSource.requiredQuest);
          }
        });
      }
    }

    // VENDORS
    if (type === DataType.VENDORS && Array.isArray(data)) {
      data.forEach(vendor => {
        if (vendor.npcId) {
          ids.npcIds.add(vendor.npcId);
        }
        if (vendor.shopId) {
          ids.shopIds.add(vendor.shopId);
        }
        if (vendor.zoneId) {
          ids.zoneIds.add(vendor.zoneId);
        }
        if (vendor.requiredQuest) {
          ids.questIds.add(vendor.requiredQuest);
        }
      });
    }

    // INSTANCES
    if (type === DataType.INSTANCES && Array.isArray(data)) {
      data.forEach(instanceId => {
        const id = typeof instanceId === 'object' ? instanceId.id : instanceId;
        if (id) {
          ids.instanceIds.add(id);
        }
        if (typeof instanceId === 'object' && instanceId.zoneId) {
          ids.zoneIds.add(instanceId.zoneId);
        }
      });
    }

    // QUESTS - data can be array of quest IDs or objects with {id, mapid, zoneid, position}
    if (type === DataType.QUESTS && Array.isArray(data)) {
      data.forEach(questItem => {
        const id = typeof questItem === 'object' && questItem !== null ? questItem.id : questItem;
        if (id) {
          ids.questIds.add(id);
        }
        // Extract zoneId from object (could be zoneId or zoneid)
        if (typeof questItem === 'object' && questItem !== null) {
          const zoneId = questItem.zoneId || questItem.zoneid;
          if (zoneId) {
            ids.zoneIds.add(zoneId);
          }
        }
      });
    }

    // FATES
    if (type === DataType.FATES && Array.isArray(data)) {
      data.forEach(fate => {
        const fateId = typeof fate === 'object' ? fate.id : fate;
        if (fateId) {
          ids.fateIds.add(fateId);
        }
        if (typeof fate === 'object' && fate.zoneId) {
          ids.zoneIds.add(fate.zoneId);
        }
      });
    }

    // ACHIEVEMENTS
    if (type === DataType.ACHIEVEMENTS && Array.isArray(data)) {
      data.forEach(achievementId => {
        const id = typeof achievementId === 'object' ? achievementId.id : achievementId;
        if (id) {
          ids.achievementIds.add(id);
        }
      });
    }

    // CRAFTED_BY - extract item IDs from ingredients and masterbook IDs
    if (type === DataType.CRAFTED_BY && Array.isArray(data)) {
      data.forEach(craft => {
        if (Array.isArray(craft.ingredients)) {
          craft.ingredients.forEach(ingredient => {
            if (ingredient.id) {
              ids.itemIds.add(ingredient.id);
            }
          });
        }
        // Extract masterbook ID if present
        if (craft.masterbook && craft.masterbook.id) {
          const masterbookId = typeof craft.masterbook.id === 'string' 
            ? parseInt(craft.masterbook.id, 10) 
            : craft.masterbook.id;
          if (masterbookId && !isNaN(masterbookId)) {
            ids.itemIds.add(masterbookId);
          }
        }
      });
    }

    // TREASURES - extract item IDs
    if (type === DataType.TREASURES && Array.isArray(data)) {
      data.forEach(treasureId => {
        const id = typeof treasureId === 'object' ? treasureId.id : treasureId;
        if (id) {
          ids.itemIds.add(id);
        }
      });
    }

    // TREASURES (optimized format) - productIds array
    if (type === DataType.TREASURES && Array.isArray(source.productIds)) {
      source.productIds.forEach(treasureId => {
        const id = typeof treasureId === 'object' ? treasureId.id : treasureId;
        if (id) {
          ids.itemIds.add(id);
        }
      });
    }

    // MASTERBOOKS - extract item IDs from CompactMasterbook objects
    if (type === DataType.MASTERBOOKS && Array.isArray(data)) {
      data.forEach(book => {
        // Handle both object format {id: number|string, name?: I18nName} and direct ID format
        if (typeof book === 'object' && book !== null && book.id !== undefined) {
          const bookId = typeof book.id === 'string' ? parseInt(book.id, 10) : book.id;
          if (bookId && !isNaN(bookId)) {
            ids.itemIds.add(bookId);
          }
        } else if (typeof book === 'number' || (typeof book === 'string' && !isNaN(parseInt(book, 10)))) {
          // Direct ID format
          const bookId = typeof book === 'string' ? parseInt(book, 10) : book;
          if (bookId) {
            ids.itemIds.add(bookId);
          }
        }
      });
    }

    // MASTERBOOKS (optimized format) - masterbookItemIds array
    if (type === DataType.MASTERBOOKS && Array.isArray(source.masterbookItemIds)) {
      source.masterbookItemIds.forEach(bookId => {
        const id = typeof bookId === 'string' ? parseInt(bookId, 10) : bookId;
        if (id && !isNaN(id)) {
          ids.itemIds.add(id);
        }
      });
    }

    // ISLAND_CROP - data can be array of item IDs or levequest objects
    if (type === DataType.ISLAND_CROP && Array.isArray(data)) {
      data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          // Check if it's levequest format (has 'item' property)
          if ('item' in item && typeof item.item === 'number') {
            // Levequest format: extract the item ID from 'item' property
            ids.itemIds.add(item.item);
          } else if ('id' in item) {
            // Could be item ID or leve ID - try to extract as item ID
            const id = typeof item.id === 'number' ? item.id : parseInt(item.id, 10);
            if (id && !isNaN(id)) {
              ids.itemIds.add(id);
            }
          }
        } else {
          // Direct item ID
          const id = typeof item === 'number' ? item : parseInt(item, 10);
          if (id && !isNaN(id)) {
            ids.itemIds.add(id);
          }
        }
      });
    }

    // REQUIREMENTS - can be array of item IDs or island crop format {seed: number}
    if (type === DataType.REQUIREMENTS) {
      // Check if it's island crop format: {seed: number}
      if (data && typeof data === 'object' && !Array.isArray(data) && 'seed' in data && typeof data.seed === 'number') {
        // Extract seed ID for island crops
        ids.itemIds.add(data.seed);
      } else if (Array.isArray(data)) {
        // Normal requirements: array of item IDs
        data.forEach(reqId => {
          const id = typeof reqId === 'object' ? reqId.id : reqId;
          if (id) {
            ids.itemIds.add(id);
          }
        });
      }
    }

    // REDUCED_FROM (分解獲得) - data is array of item IDs that can be reduced to get this item
    if (type === DataType.REDUCED_FROM && Array.isArray(data)) {
      data.forEach(itemId => {
        const id = typeof itemId === 'object' ? itemId.id : itemId;
        if (id != null && id !== '') {
          ids.itemIds.add(typeof id === 'number' ? id : parseInt(id, 10));
        }
      });
    }

    // DESYNTHS (精製獲得) - data is array of item IDs that can be desynthed to get this item
    if (type === DataType.DESYNTHS && Array.isArray(data)) {
      data.forEach(itemId => {
        const id = typeof itemId === 'object' ? itemId.id : itemId;
        if (id != null && id !== '') {
          ids.itemIds.add(typeof id === 'number' ? id : parseInt(id, 10));
        }
      });
    }

    // QUESTS (optimized format)
    if (type === DataType.QUESTS && source.questId) {
      ids.questIds.add(source.questId);
    }

    // FATES (optimized format)
    if (type === DataType.FATES && source.fateId) {
      ids.fateIds.add(source.fateId);
      if (source.zoneId) {
        ids.zoneIds.add(source.zoneId);
      }
    }

    // ACHIEVEMENTS (optimized format)
    if (type === DataType.ACHIEVEMENTS && Array.isArray(source.achievementIds)) {
      source.achievementIds.forEach(achievementId => {
        const id = typeof achievementId === 'object' ? achievementId.id : achievementId;
        if (id) {
          ids.achievementIds.add(id);
        }
      });
    }
  });

  // Convert Sets to Arrays and sort for consistent caching
  const result = {
    npcIds: Array.from(ids.npcIds).sort((a, b) => a - b),
    shopIds: Array.from(ids.shopIds).sort((a, b) => a - b),
    instanceIds: Array.from(ids.instanceIds).sort((a, b) => a - b),
    questIds: Array.from(ids.questIds).sort((a, b) => a - b),
    achievementIds: Array.from(ids.achievementIds).sort((a, b) => a - b),
    itemIds: Array.from(ids.itemIds).sort((a, b) => a - b),
    zoneIds: Array.from(ids.zoneIds).sort((a, b) => a - b),
    fateIds: Array.from(ids.fateIds).sort((a, b) => a - b),
  };
  return result;
}
