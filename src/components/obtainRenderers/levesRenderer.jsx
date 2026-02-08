// LEVES renderer (Type 14 - 理符任務) 
// Note: Leves data is stored in ISLAND_CROP (DataType 14) with levequest format
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderLeves({
  source,
  index,
  itemId,
  sources,
  loadedData,
  loadedDataRef,
  twLevesStaticData,
  getPlaceNameCN,
  setMapModal,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const currentLoadedData = loadedDataRef.current;
  
  // Check if data is levequest format (has 'id', 'lvl', 'item' properties)
  const firstItem = data[0];
  const isLevequestFormat = firstItem && typeof firstItem === 'object' && 'id' in firstItem;
  
  if (!isLevequestFormat) {
    return null; // Not levequest data
  }
  
  // Collect levequests from QUESTS sources as well
  const questLevequests = [];
  sources.forEach(s => {
    if (s.type === 10 && Array.isArray(s.data)) {
      s.data.forEach(questItem => {
        const questId = typeof questItem === 'object' && questItem !== null && 'id' in questItem ? questItem.id : questItem;
        if (questId) {
          const leveData = twLevesStaticData && (twLevesStaticData[questId] || twLevesStaticData[String(questId)]);
          if (leveData && leveData.tw) {
            questLevequests.push({
              id: questId,
              lvl: null,
              level: null,
              item: itemId,
              cost: null,
              exp: null,
              gil: null,
              fromQuests: true
            });
          }
        }
      });
    }
  });
  
  const allLevequests = [...data, ...questLevequests];
  
  return (
    <div key={`levequest-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/c/Leve.png" alt="Levequest" className="w-10 h-10" />
        <span className={commonClasses.title}>理符任務</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {allLevequests.map((leve, leveIndex) => {
          if (!leve || typeof leve !== 'object') return null;
          
          const leveId = leve.id;
          const leveLevel = leve.lvl || leve.level;
          const leveItemId = leve.item;
          
          const leveDbData = currentLoadedData.levesDatabasePages && (currentLoadedData.levesDatabasePages[leveId] || currentLoadedData.levesDatabasePages[String(leveId)]);
          const leveNameData = twLevesStaticData && (twLevesStaticData[leveId] || twLevesStaticData[String(leveId)]);
          const leveName = leveNameData?.tw || leveDbData?.zh || leveDbData?.en || `理符任務 ${leveId}`;
          
          const itemData = currentLoadedData.twItems[leveItemId] || currentLoadedData.twItems[String(leveItemId)];
          
          const npcs = leveDbData?.npcs || [];
          const npcIds = npcs.map(npc => npc.id).filter(Boolean);
          const npcNames = npcIds.map(npcId => {
            const npcData = currentLoadedData.twNpcs[npcId] || currentLoadedData.twNpcs[String(npcId)];
            const npcDb = currentLoadedData.npcsDatabasePages[npcId] || currentLoadedData.npcsDatabasePages[String(npcId)];
            return npcData?.tw || npcDb?.zh || npcDb?.en || `NPC ${npcId}`;
          });
          
          const npcPositions = npcIds.map(npcId => {
            const npcDbRef = currentLoadedData.npcsDatabasePages[npcId] || currentLoadedData.npcsDatabasePages[String(npcId)];
            const npcDbState = loadedData.npcsDatabasePages[npcId] || loadedData.npcsDatabasePages[String(npcId)];
            const npcDb = npcDbRef || npcDbState;
            if (npcDb?.position) return npcDb.position;
            
            const npcDataRef = currentLoadedData.npcs[npcId] || currentLoadedData.npcs[String(npcId)];
            const npcDataState = loadedData.npcs[npcId] || loadedData.npcs[String(npcId)];
            const npcData = npcDataRef || npcDataState;
            if (npcData?.position) return npcData.position;
            
            return null;
          });
          
          const requiredItems = leveDbData?.items || [];
          const rewards = leveDbData?.rewards || [];
          const cost = leveDbData?.cost || leve.cost || null;
          const leveNameZh = leveDbData?.zh || null;
          const wikiUrl = leveNameZh ? `https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(leveNameZh)}` : null;
          const hasDetailSections = requiredItems.length > 0 || rewards.length > 0 || npcNames.length > 0;

          return (
            <div key={leveIndex} className={`w-[320px] flex-grow-0 bg-slate-900/50 rounded p-3 border border-slate-700/50 ${hasDetailSections ? 'min-h-[100px] gap-2' : 'gap-1' } flex flex-col`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  {wikiUrl ? (
                    <a
                      href={wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
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
              
              {npcNames.length > 0 && (
                <div className="text-xs space-y-1.5">
                  {npcNames.map((npcName, npcIndex) => {
                    const npcPosition = npcPositions[npcIndex];
                    const hasLocation = npcPosition && 
                      npcPosition.x !== undefined && 
                      npcPosition.y !== undefined && 
                      (npcPosition.map || npcPosition.zoneid);
                    
                    const zoneId = npcPosition?.zoneid;
                    const mapId = npcPosition?.map;
                    const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
                    
                    return (
                      <div key={`npc-${npcIndex}`} className="text-xs">
                        <div className="flex items-center gap-0.5">
                          <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-4 h-4 flex-shrink-0 grayscale opacity-70" />
                          <div className="text-gray-300 font-medium">{npcName}</div>
                        </div>
                        {zoneName && hasLocation && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMapModal({
                                isOpen: true,
                                zoneName,
                                x: npcPosition.x,
                                y: npcPosition.y,
                                npcName: npcName,
                                mapId: mapId || null,
                              });
                            }}
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors ml-[2px]"
                          >
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <span className="text-gray-400">
                              {zoneName} ({npcPosition.x.toFixed(1)}, {npcPosition.y.toFixed(1)})
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

