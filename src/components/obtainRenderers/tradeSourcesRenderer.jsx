// TRADE_SOURCES renderer (Type 2 - 兌換)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderTradeSources({
  source,
  index,
  loadedDataRef,
  getCurrencyName,
  getShopName,
  getNpcName,
  getPlaceNameCN,
  getShopQuestRequirement,
  getQuestCNName,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate,
  setMapModal
}) {
  const { data } = source;
  
  if (!data || data.length === 0) {
    return null;
  }

  // Process all trade sources and collect valid NPC entries
  const validTradeEntries = [];
  
  data.forEach((tradeSource, tradeIndex) => {
    const tradeEntry = tradeSource.trades?.[0];
    const currencyItem = tradeEntry?.currencies?.[0];
    const currencyItemId = currencyItem?.id;
    const currencyAmount = currencyItem?.amount;
    const requiresHQ = currencyItem?.hq === true;
    const shopId = tradeSource.id;
    
    let currencyName = getCurrencyName(currencyItemId);
    
    if (!currencyName && currencyItemId) {
      return;
    }
    
    const currentLoadedData = loadedDataRef.current;
    const currencyItemData = currencyItemId ? (currentLoadedData.twItems[currencyItemId] || currentLoadedData.twItems[String(currencyItemId)]) : null;
    const hasCurrencyItem = currencyItemData && currencyItemData.tw;
    
    let shopName = null;
    if (tradeSource.shopName) {
      shopName = tradeSource.shopName.tw || tradeSource.shopName.zh || null;
    } else if (tradeSource.id) {
      const shopNameFromData = getShopName(tradeSource.id);
      if (shopNameFromData) {
        shopName = shopNameFromData;
      }
    }
    
    const validNpcs = tradeSource.npcs?.filter(npc => {
      const npcId = typeof npc === 'object' ? npc.id : npc;
      const npcName = getNpcName(npcId);
      return npcName && npcName !== `NPC ${npcId}`;
    }) || [];
    
    if (validNpcs.length === 0 || !currencyName) {
      return;
    }
    
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
  
  if (validTradeEntries.length === 0) {
    return null;
  }
  
  // Group entries
  const groupedEntries = {};
  validTradeEntries.forEach((entry) => {
    const groupKey = `${entry.shopName || 'unknown'}_${entry.currencyItemId}_${entry.currencyAmount}_${entry.requiresHQ ? 'hq' : 'nq'}`;
    if (!groupedEntries[groupKey]) {
      groupedEntries[groupKey] = {
        shopName: entry.shopName,
        currencyItemId: entry.currencyItemId,
        currencyName: entry.currencyName,
        currencyAmount: entry.currencyAmount,
        requiresHQ: entry.requiresHQ,
        hasCurrencyItem: entry.hasCurrencyItem,
        shopId: entry.shopId,
        tradeSource: entry.tradeSource,
        npcs: []
      };
    }
    groupedEntries[groupKey].npcs.push(entry.npc);
  });
  
  const tradeGroups = Object.values(groupedEntries);
  
  return (
    <div key={`trade-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 220 200"
          className="w-6 h-6 text-ffxiv-gold"
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
        <span className={commonClasses.title}>兌換</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {tradeGroups.map((group, groupIndex) => {
          const firstNpc = group.npcs[0];
          const firstNpcId = typeof firstNpc === 'object' ? firstNpc.id : firstNpc;
          const requiredQuestId = getShopQuestRequirement(group.shopId, firstNpcId, group.tradeSource);
          const currentLoadedData = loadedDataRef.current;
          const questData = currentLoadedData.twQuests[requiredQuestId] || currentLoadedData.twQuests[String(requiredQuestId)];
          const questEnData = currentLoadedData.quests[requiredQuestId] || currentLoadedData.quests[String(requiredQuestId)];
          const questName = questData?.tw || questEnData?.name?.en || questEnData?.en || null;
          
          const isSingleNpc = group.npcs.length === 1;
          
          return (
            <div key={`group-${groupIndex}`} className={`${isSingleNpc ? 'w-full' : 'w-[280px] flex-grow-0'} bg-slate-900/50 rounded p-2 flex flex-col border border-slate-700/50`}>
              {/* Currency header */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700/50">
                {group.hasCurrencyItem ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onItemClick) {
                        getItemById(group.currencyItemId).then(item => {
                          if (item) {
                            onItemClick(item, { fromObtainable: true });
                          } else {
                            const itemUrl = generateItemUrl(group.currencyItemId, 'item');
                            navigate(itemUrl);
                          }
                        });
                      } else {
                        const itemUrl = generateItemUrl(group.currencyItemId, 'item');
                        navigate(itemUrl);
                      }
                    }}
                    className="flex items-center gap-1.5 font-medium text-blue-400 hover:text-ffxiv-gold transition-colors"
                  >
                    <ItemImage
                      itemId={group.currencyItemId}
                      alt={group.currencyName}
                      className="w-7 h-7 object-contain"
                    />
                    <span className="hover:underline">{group.currencyName}</span>
                    {group.requiresHQ && (
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
                    {group.currencyName}
                    {group.requiresHQ && (
                      <span 
                        className="inline-flex items-center justify-center px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] font-bold text-yellow-400"
                        title="需要高品質版本"
                      >
                        HQ
                      </span>
                    )}
                  </span>
                )}
                <span className="text-yellow-400 text-sm">x{group.currencyAmount}</span>
              </div>
              
              {/* Shop name */}
              {group.shopName && (
                <div className="text-xs text-gray-400 mb-2">{group.shopName}</div>
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
              
              {/* NPCs list */}
              <div className={`grid ${isSingleNpc ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5`}>
                {group.npcs.map((npc, npcIndex) => {
                  const npcId = typeof npc === 'object' ? npc.id : npc;
                  const npcName = getNpcName(npcId);
                  const npcZoneId = typeof npc === 'object' ? npc.zoneId : null;
                  const npcCoords = typeof npc === 'object' ? npc.coords : null;
                  const npcMapId = typeof npc === 'object' ? npc.mapId : null;
                  const zoneName = npcZoneId ? getPlaceNameCN(npcZoneId) : '';
                  const hasLocation = npcCoords && npcCoords.x !== undefined && npcCoords.y !== undefined;
                  
                  return (
                    <div key={`npc-${npcIndex}`} className="text-xs bg-slate-800/40 rounded px-2 py-1.5 border border-slate-700/30 w-full">
                      <div className="flex items-center gap-0.5">
                        <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-4 h-4 flex-shrink-0 grayscale opacity-70" />
                        <div className="text-gray-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis">{npcName}</div>
                      </div>
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
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors text-[10px] ml-[4px]"
                          title={`${zoneName} (${npcCoords.x.toFixed(1)}, ${npcCoords.y.toFixed(1)})`}
                        >
                          <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className="text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                            {zoneName}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Show count if multiple NPCs */}
              {group.npcs.length > 1 && (
                <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-slate-700/30">
                  {group.npcs.length} 個位置
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
