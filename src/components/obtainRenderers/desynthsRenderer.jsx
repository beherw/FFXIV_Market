// DESYNTHS renderer (Type 5 - 精製獲得)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderDesynths({
  source,
  index,
  loadedData,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate
}) {
  const { data } = source;
  
  const validDesynthItems = data.filter(itemId => {
    const itemData = loadedData.twItems[itemId] || loadedData.twItems[String(itemId)];
    return itemData && itemData.tw;
  });
  
  if (validDesynthItems.length === 0) {
    return null;
  }
  
  return (
    <div key={`desynth-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/000000/000120.png" alt="Desynth" className={commonClasses.icon} />
        <span className={commonClasses.title}>精製獲得</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {validDesynthItems.map((desynthItemId, desynthIndex) => {
          const desynthItemData = loadedData.twItems[desynthItemId] || loadedData.twItems[String(desynthItemId)];
          const desynthName = desynthItemData?.tw;
          
          if (!desynthName) return null;
          
          return (
            <button
              key={desynthIndex}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onItemClick) {
                  getItemById(desynthItemId).then(item => {
                    if (item) {
                      onItemClick(item, { fromObtainable: true });
                    } else {
                      const itemUrl = generateItemUrl(desynthItemId, 'item');
                      navigate(itemUrl);
                    }
                  });
                } else {
                  const itemUrl = generateItemUrl(desynthItemId, 'item');
                  navigate(itemUrl);
                }
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
            >
              <ItemImage
                itemId={desynthItemId}
                alt={desynthName}
                className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
              />
              <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={desynthName}>
                {desynthName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
