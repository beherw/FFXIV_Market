/**
 * Extract all required IDs from sources for efficient data loading
 * This function analyzes sources and extracts only the IDs that are actually needed
 */

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

    // TRADE_SOURCES (type 2)
    if (type === 2 && Array.isArray(data)) {
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

    // VENDORS (type 3)
    if (type === 3 && Array.isArray(data)) {
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

    // INSTANCES (type 6)
    if (type === 6 && Array.isArray(data)) {
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

    // QUESTS (type 10)
    if (type === 10 && Array.isArray(data)) {
      data.forEach(questId => {
        const id = typeof questId === 'object' ? questId.id : questId;
        if (id) {
          ids.questIds.add(id);
        }
        if (typeof questId === 'object' && questId.zoneId) {
          ids.zoneIds.add(questId.zoneId);
        }
      });
    }

    // FATES (type 11)
    if (type === 11 && Array.isArray(data)) {
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

    // ACHIEVEMENTS (type 22)
    if (type === 22 && Array.isArray(data)) {
      data.forEach(achievementId => {
        const id = typeof achievementId === 'object' ? achievementId.id : achievementId;
        if (id) {
          ids.achievementIds.add(id);
        }
      });
    }

    // CRAFTED_BY (type 1) - extract item IDs from ingredients
    if (type === 1 && Array.isArray(data)) {
      data.forEach(craft => {
        if (Array.isArray(craft.ingredients)) {
          craft.ingredients.forEach(ingredient => {
            if (ingredient.id) {
              ids.itemIds.add(ingredient.id);
            }
          });
        }
      });
    }

    // TREASURES (type 9) - extract item IDs
    if (type === 9 && Array.isArray(data)) {
      data.forEach(treasureId => {
        const id = typeof treasureId === 'object' ? treasureId.id : treasureId;
        if (id) {
          ids.itemIds.add(id);
        }
      });
    }
  });

  // Convert Sets to Arrays and sort for consistent caching
  return {
    npcIds: Array.from(ids.npcIds).sort((a, b) => a - b),
    shopIds: Array.from(ids.shopIds).sort((a, b) => a - b),
    instanceIds: Array.from(ids.instanceIds).sort((a, b) => a - b),
    questIds: Array.from(ids.questIds).sort((a, b) => a - b),
    achievementIds: Array.from(ids.achievementIds).sort((a, b) => a - b),
    itemIds: Array.from(ids.itemIds).sort((a, b) => a - b),
    zoneIds: Array.from(ids.zoneIds).sort((a, b) => a - b),
    fateIds: Array.from(ids.fateIds).sort((a, b) => a - b),
  };
}
