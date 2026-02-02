// REDUCED_FROM renderer (Type 4 - 分解獲得)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderReducedFrom({
  source,
  index,
  loadedData,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const validReductionItems = data.filter(itemId => {
    const itemData = loadedData.twItems[itemId] || loadedData.twItems[String(itemId)];
    return itemData && itemData.tw;
  });
  
  if (validReductionItems.length === 0) {
    return null;
  }
  
  return (
    <div key={`reduced-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/061000/061808.png" alt="Reduction" className={commonClasses.icon} />
        <span className={commonClasses.title}>分解獲得</span>
      </div>
      <div className={validReductionItems.length === 1 ? "flex justify-center gap-2 mt-2" : "grid grid-cols-3 gap-2 mt-2"}>
        {validReductionItems.map((reductionItemId, reductionIndex) => {
          const reductionItemData = loadedData.twItems[reductionItemId] || loadedData.twItems[String(reductionItemId)];
          const reductionName = reductionItemData?.tw;
          
          if (!reductionName) return null;
          
          return (
            <button
              key={reductionIndex}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onItemClick) {
                  getItemById(reductionItemId).then(item => {
                    if (item) {
                      onItemClick(item, { fromObtainable: true });
                    } else {
                      const itemUrl = generateItemUrl(reductionItemId, 'item');
                      navigate(itemUrl);
                    }
                  });
                } else {
                  const itemUrl = generateItemUrl(reductionItemId, 'item');
                  navigate(itemUrl);
                }
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
            >
              <ItemImage
                itemId={reductionItemId}
                alt={reductionName}
                className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
              />
              <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={reductionName}>
                {reductionName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
