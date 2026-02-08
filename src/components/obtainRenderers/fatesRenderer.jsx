// FATES renderer (Type 11 - 危命任務)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderFates({
  source,
  index,
  itemId,
  loadedData,
  sources,
  getPlaceNameCN,
  getFateNameCN,
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

  const currentItemIdNum = typeof itemId === 'string' ? parseInt(itemId, 10) : itemId;
  const isFateInSourcesForItem = sources.some(s => s.type === 11);

  return (
    <div key={`fates-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/060000/060958.png" alt="FATE" className={commonClasses.icon} />
        <span className={commonClasses.title}>危命任務</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {data.map((fateId, fateIndex) => {
          const fateData = loadedData.fatesById && (loadedData.fatesById[fateId] || loadedData.fatesById[String(fateId)]);
          const fateName = fateData?.tw || fateData?.en || fateData?.zh || (getFateNameCN ? getFateNameCN(fateId) : null) || `危命任務 ${fateId}`;
          const fateLevel = fateData?.level ?? null;
          const fateIcon = fateData?.icon ? `https://xivapi.com${fateData.icon}` : 'https://xivapi.com/i/060000/060958.png';
          const zoneId = fateData?.zoneId ?? null;
          const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
          const fateMapId = fateData?.mapId ?? null;
          const fateCoords = (fateData?.x != null && fateData?.y != null) ? { x: fateData.x, y: fateData.y } : null;
          const hasLocation = fateCoords && fateMapId;
          const fateNameZh = fateData?.zh ?? null;

          const rewardItemsRaw = fateData?.items ?? [];
          const rewardItems = rewardItemsRaw.filter(rewardItemId => {
            const rewardItemData = loadedData.twItems[rewardItemId] || loadedData.twItems[String(rewardItemId)];
            return rewardItemData && rewardItemData.tw;
          });

          const isCurrentItemInRewards = rewardItems.includes(currentItemIdNum) || rewardItems.includes(String(currentItemIdNum));
          const silverRewardItems = rewardItems;
          const goldRewardItems = rewardItems;
          const rareRewardItems = (!isCurrentItemInRewards && isFateInSourcesForItem && rewardItemsRaw.length > 0) ? [currentItemIdNum] : [];
          const isNotoriousMonster = fateLevel && fateLevel >= 32 && fateIcon.includes('060958');
          const wikiUrl = fateNameZh ? `https://ff14.huijiwiki.com/wiki/临危受命:${encodeURIComponent(fateNameZh)}` : null;

          return (
            <div key={fateIndex} className={commonClasses.innerItemBlock}>
              <div className="flex items-center gap-2 mb-1">
                <img src={fateIcon} alt="FATE" className="w-7 h-7 object-contain" />
                <div className="flex-1">
                  {wikiUrl ? (
                    <a
                      href={wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
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
                        {goldRewardItems.length > 0 && (
                          <tr className="border-b border-slate-700/30 bg-slate-900/30">
                            <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">金牌</td>
                            <td className="py-2.5 px-3 w-auto">
                              <div className="flex flex-wrap gap-2">
                                {goldRewardItems.map((rewardItemId) => {
                                  const rewardItem = loadedData.twItems[rewardItemId] || loadedData.twItems[String(rewardItemId)];
                                  if (!rewardItem || !rewardItem.tw) return null;
                                  
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
                                      <span className="hover:underline">{rewardItem.tw} ×5</span>
                                    </button>
                                  );
                                }).filter(Boolean)}
                              </div>
                            </td>
                          </tr>
                        )}
                        
                        {silverRewardItems.length > 0 && (
                          <tr className="bg-slate-900/30">
                            <td className="py-2.5 px-3 text-gray-300 align-top font-medium whitespace-nowrap">銀牌</td>
                            <td className="py-2.5 px-3 w-auto">
                              <div className="flex flex-wrap gap-2">
                                {silverRewardItems.map((rewardItemId) => {
                                  const rewardItem = loadedData.twItems[rewardItemId] || loadedData.twItems[String(rewardItemId)];
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
