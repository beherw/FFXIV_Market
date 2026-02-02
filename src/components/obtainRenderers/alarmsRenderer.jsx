// ALARMS renderer (Type 18 - 鬧鐘提醒)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderAlarms({
  source,
  index,
  getPlaceNameCN,
  setMapModal
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const nodeTypeIcons = {
    0: 'https://xivapi.com/i/060000/060438.png',
    1: 'https://xivapi.com/i/060000/060437.png',
    2: 'https://xivapi.com/i/060000/060433.png',
    3: 'https://xivapi.com/i/060000/060432.png',
    4: 'https://xivapi.com/i/060000/060445.png',
    5: 'https://xivapi.com/i/060000/060465.png',
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
    <div key={`alarm-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/060000/060502.png" alt="Alarm" className={commonClasses.icon} />
        <span className={commonClasses.title}>鬧鐘提醒</span>
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
            <div key={alarmIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
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
