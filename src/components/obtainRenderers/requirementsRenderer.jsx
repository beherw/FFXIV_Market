// REQUIREMENTS renderer (Type 17/23 - 需求)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderRequirements({
  source,
  index,
  loadedData,
  loadedDataRef,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate
}) {
  const { data } = source;
  const currentLoadedData = loadedDataRef.current;
  
  if (!data) {
    return null;
  }

  // Check if data is an island crop format: {seed: number}
  if (typeof data === 'object' && !Array.isArray(data) && 'seed' in data && typeof data.seed === 'number') {
    const seedId = data.seed;
    const seedData = currentLoadedData.twItems[seedId] || currentLoadedData.twItems[String(seedId)];
    const seedName = seedData?.tw;
    
    return (
      <div key={`island-crop-requirement-${index}`} className={commonClasses.card}>
        <div className={commonClasses.header}>
          <img src="https://xivapi.com/i/063000/063950_hr1.png" alt="Island Crop" className={commonClasses.icon} />
          <span className={commonClasses.title}>島嶼作物</span>
        </div>
        <div className="text-xs text-gray-400 mb-2">
          在島嶼聖域種植種子獲得
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="w-full">
            <div className="text-xs text-gray-400 mb-1">所需種子：</div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onItemClick) {
                  getItemById(seedId).then(item => {
                    if (item) {
                      onItemClick(item, { fromObtainable: true });
                    } else {
                      const itemUrl = generateItemUrl(seedId, 'item');
                      navigate(itemUrl);
                    }
                  });
                } else {
                  const itemUrl = generateItemUrl(seedId, 'item');
                  navigate(itemUrl);
                }
              }}
              className="w-full flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px]"
            >
              <ItemImage
                itemId={seedId}
                alt={seedName || `種子 ${seedId}`}
                className="w-7 h-7 object-contain flex-shrink-0"
              />
              <div className="flex flex-col items-start flex-1 min-w-0">
                <span className="hover:underline font-medium truncate w-full">
                  {seedName || `種子 (ID: ${seedId})`}
                </span>
                {!seedName && (
                  <span className="text-xs text-gray-500 mt-0.5">資料載入中...</span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Normal requirements handling (array of item IDs)
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const validRequirements = data.filter(reqId => {
    if (typeof reqId === 'number') {
      const reqData = loadedData.twItems[reqId] || loadedData.twItems[String(reqId)];
      return reqData && reqData.tw;
    }
    return false;
  });
  
  if (validRequirements.length === 0) {
    return null;
  }
  
  return (
    <div key={`requirement-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/060000/060453.png" alt="Requirement" className={commonClasses.icon} />
        <span className={commonClasses.title}>需求</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {validRequirements.map((reqId, reqIndex) => {
          const reqData = loadedData.twItems[reqId] || loadedData.twItems[String(reqId)];
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
                      onItemClick(item, { fromObtainable: true });
                    } else {
                      const itemUrl = generateItemUrl(reqId, 'item');
                      navigate(itemUrl);
                    }
                  });
                } else {
                  const itemUrl = generateItemUrl(reqId, 'item');
                  navigate(itemUrl);
                }
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
            >
              <ItemImage
                itemId={reqId}
                alt={reqName}
                className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
              />
              <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={reqName}>
                {reqName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
