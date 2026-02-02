// QUESTS renderer (Type 10 - 任務獎勵)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderQuests({
  source,
  index,
  loadedDataRef,
  twQuestsStaticData,
  twLevesStaticData,
  cleanQuestName,
  getNpcName,
  getPlaceNameCN,
  getPlaceName,
  getQuestCNName,
  twJobAbbrData,
  loadedData,
  setMapModal
}) {
  const { data } = source;
  const currentLoadedData = loadedDataRef.current;
  
  const questIds = data.map(item => {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      return item.id;
    }
    return item;
  }).filter(questId => questId !== null && questId !== undefined);
  
  if (questIds.length === 0) {
    return null;
  }
  
  // Filter out levequests
  const validQuestIds = questIds.filter(questId => {
    const questData = currentLoadedData.twQuests[questId] || currentLoadedData.twQuests[String(questId)] 
      || (twQuestsStaticData && (twQuestsStaticData[questId] || twQuestsStaticData[String(questId)]));
    const questNameRaw = questData?.tw;
    const questName = cleanQuestName(questNameRaw);
    
    if (!questName) {
      const leveData = twLevesStaticData && (twLevesStaticData[questId] || twLevesStaticData[String(questId)]);
      const leveNameRaw = leveData?.tw;
      const leveName = cleanQuestName(leveNameRaw);
      
      if (leveName) {
        return false;
      }
    }
    
    return true;
  });
  
  if (validQuestIds.length === 0) {
    return null;
  }
  
  return (
    <div key={`quest-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src=\"https://xivapi.com/i/060000/060453.png\" alt=\"Quest\" className={commonClasses.icon} />
        <span className={commonClasses.title}>任務獎勵</span>
      </div>
      <div className=\"flex flex-wrap gap-2 mt-2\">
        {validQuestIds.map((questId, questIndex) => {
          const questData = currentLoadedData.twQuests[questId] || currentLoadedData.twQuests[String(questId)] 
            || (twQuestsStaticData && (twQuestsStaticData[questId] || twQuestsStaticData[String(questId)]));
          const questNameRaw = questData?.tw;
          const questName = cleanQuestName(questNameRaw);
          
          if (!questName) {
            const quest = currentLoadedData.quests[questId] || currentLoadedData.quests[String(questId)];
            const questDb = currentLoadedData.questsDatabasePages[questId] || currentLoadedData.questsDatabasePages[String(questId)];
            const fallbackName = quest?.en || questDb?.en || `任務 ${questId}`;
            
            return (
              <div key={questIndex} className=\"w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col\">
                <div className=\"flex items-center gap-2 mb-1\">
                  <img src=\"https://xivapi.com/i/060000/060453.png\" alt=\"Quest\" className=\"w-7 h-7 object-contain flex-shrink-0\" />
                  <div className=\"flex-1 min-w-0\">
                    <span className=\"text-sm font-medium text-gray-300\">{fallbackName}</span>
                  </div>
                </div>
                <div className=\"text-xs text-gray-400 mt-1\">
                  任務 ID: {questId}
                </div>
              </div>
            );
          }
          
          const quest = currentLoadedData.quests[questId] || currentLoadedData.quests[String(questId)];
          const questIcon = quest?.icon 
            ? `https://xivapi.com${quest.icon}` 
            : 'https://xivapi.com/i/060000/060453.png';
          
          const questCNNameRaw = getQuestCNName(questId);
          const questCNName = cleanQuestName(questCNNameRaw);
          
          const questDb = currentLoadedData.questsDatabasePages[questId] || currentLoadedData.questsDatabasePages[String(questId)];
          const questLevel = questDb?.level || null;
          const jobCategory = questDb?.jobCategory || null;
          const startingNpcId = questDb?.start || null;
          const startingNpcName = startingNpcId ? getNpcName(startingNpcId) : null;
          
          let jobCategoryText = '';
          if (jobCategory === 1) {
            jobCategoryText = '所有職業';
          } else if (jobCategory && twJobAbbrData[jobCategory]) {
            jobCategoryText = twJobAbbrData[jobCategory].tw || '';
          }
          
          let zoneId = null;
          let coords = null;
          let mapId = null;
          
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
                break;
              }
            }
          }
          
          const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
          const hasLocation = zoneName && coords && coords.x !== undefined && coords.y !== undefined;
          const hasValidMapLocation = hasLocation && mapId && (coords.x !== 0 || coords.y !== 0);
          
          return (
            <div key={questIndex} className=\"w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col\">
              <div className=\"flex items-center gap-2 mb-1\">
                <img src={questIcon} alt=\"Quest\" className=\"w-7 h-7 object-contain flex-shrink-0\" />
                <div className=\"flex-1 min-w-0\">
                  {questCNName && (
                    <a
                      href={`https://ff14.huijiwiki.com/wiki/任务:${encodeURIComponent(questCNName)}`}
                      target=\"_blank\"
                      rel=\"noopener noreferrer\"
                      className=\"text-sm font-medium text-blue-400 hover:text-ffxiv-gold hover:underline transition-colors cursor-pointer\"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {questName}
                    </a>
                  )}
                  {!questCNName && (
                    <span className=\"text-sm font-medium text-gray-300\">{questName}</span>
                  )}
                </div>
              </div>
              
              <div className=\"space-y-1 mt-1 text-xs text-gray-400\">
                {(questLevel || jobCategoryText) && (
                  <div className=\"flex items-center gap-2\">
                    {jobCategoryText && <span>{jobCategoryText}</span>}
                    {questLevel && <span>{questLevel}級</span>}
                  </div>
                )}
                
                {startingNpcName && startingNpcName !== `NPC ${startingNpcId}` && (
                  <div className=\"text-gray-400\">{startingNpcName}</div>
                )}
                
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
                      className=\"flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left\"
                    >
                      <svg className=\"w-3 h-3 flex-shrink-0\" fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\">
                        <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7\" />
                      </svg>
                      <span>
                        {zoneName}
                        <span className=\"ml-2\">
                          X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className=\"mt-1 pt-1 border-t border-slate-700/50 text-xs text-gray-400\">
                      {zoneName}
                      {coords && coords.x !== undefined && coords.y !== undefined && (
                        <span className=\"ml-2\">
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
