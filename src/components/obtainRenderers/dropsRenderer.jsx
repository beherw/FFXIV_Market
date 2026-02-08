// DROPS renderer (Type 20 - 怪物掉落)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderDrops({
  source,
  index,
  getMobName,
  getPlaceNameCN,
  setMapModal
}) {
  const { data } = source;
  
  if (!data || data.length === 0) {
    return null;
  }

  // Group monsters by zone
  const monstersByZone = {};
  
  data.forEach((drop) => {
    const mobId = typeof drop === 'object' ? drop.id : drop;
    const mobName = getMobName(mobId);
    
    if (!mobName) {
      return;
    }

    const zoneId = typeof drop === 'object' ? drop.zoneid : null;
    const mapId = typeof drop === 'object' ? drop.mapid : null;
    const minLevel = typeof drop === 'object' ? drop.minLevel : null;
    const maxLevel = typeof drop === 'object' ? drop.maxLevel : null;
    const zonePositions = typeof drop === 'object' ? drop.zonePositions : [];
    
    if (!zoneId) {
      if (!monstersByZone['unknown']) {
        monstersByZone['unknown'] = {
          zoneId: 'unknown',
          zoneName: '未知區域',
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

    const zoneName = getPlaceNameCN(zoneId);
    const displayZoneName = zoneName && zoneName !== `區域 ${zoneId}` ? zoneName : `區域 ${zoneId}`;

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
    <div key={`drops-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/c/BNpcName.png" alt="Monster" className="w-8 h-8" />
        <span className={commonClasses.title}>怪物掉落</span>
      </div>
      
      <div className="space-y-4">
        {zoneEntries.map((zone, zoneIndex) => (
          <div key={zoneIndex} className="bg-slate-900/50 rounded p-3 border border-slate-700/50">
            <div className="text-sm font-semibold text-white mb-2 border-b border-slate-700/50 pb-1">
              {zone.zoneName}
            </div>
            <div className="space-y-2">
              {zone.monsters.map((monster, monsterIndex) => {
                const firstPosition = monster.positions && monster.positions.length > 0 
                  ? monster.positions[0] 
                  : null;
                const hasLocation = firstPosition && firstPosition.x !== undefined && firstPosition.y !== undefined && monster.mapId;
                
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
                      {hasLocation && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMapModal({
                              isOpen: true,
                              zoneName: zone.zoneName,
                              x: firstPosition.x,
                              y: firstPosition.y,
                              npcName: monster.mobName,
                              mapId: monster.mapId || null,
                            });
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
