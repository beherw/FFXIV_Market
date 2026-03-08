// GATHERED_BY renderer (Type 7 - 採集獲得)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderGatheredBy({
  source,
  index,
  getPlaceNameCN,
  setMapModal
}) {
  const { data } = source;
  
  if (!data || !data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
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
    5: '刺魚',
  };

  const gatheringLevel = data.level || 0;
  const rawNodeType = data.type !== undefined ? data.type : (data.nodes[0]?.type !== undefined ? data.nodes[0].type : 0);
  const nodeType = Math.abs(rawNodeType);
  const nodeIcon = nodeTypeIcons[nodeType] || nodeTypeIcons[0];
  const nodeTypeName = nodeTypeNames[nodeType] || '採集';

  return (
    <div key={`gathered-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src={nodeIcon} alt={nodeTypeName} className={commonClasses.icon} />
        <span className={commonClasses.title}>採集獲得</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {data.nodes.map((node, nodeIndex) => {
          const zoneId = node.zoneId;
          const zoneName = node.zoneName || (zoneId ? getPlaceNameCN(zoneId) : '');
          const mapId = node.mapId;
          const coords = node.x !== undefined && node.y !== undefined ? { x: node.x, y: node.y } : null;
          const hasLocation = coords && mapId;
          const nodeLevel = node.level || gatheringLevel;
          const isLimited = node.limited === true;
          const isIslandNode = node.isIslandNode === true;

          return (
            <div key={nodeIndex} className={commonClasses.innerItemBlock}>
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
                      radius: node.radius || 0,
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
