// EXPLORATION_RESULTS renderer (Type 21 - 探險成果)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderExplorationResults({
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

  const validExplorationItems = data.filter(itemId => {
    const itemData = loadedData.twItems[itemId] || loadedData.twItems[String(itemId)];
    return itemData && itemData.tw;
  });
  
  if (validExplorationItems.length === 0) {
    return null;
  }
  
  return (
    <div key={`exploration-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/021000/021267.png" alt="Exploration" className={commonClasses.icon} />
        <span className={commonClasses.title}>探險成果</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {validExplorationItems.map((explorationItemId, explorationIndex) => {
          const explorationItemData = loadedData.twItems[explorationItemId] || loadedData.twItems[String(explorationItemId)];
          const explorationName = explorationItemData?.tw;
          
          if (!explorationName) return null;
          
          return (
            <button
              key={explorationIndex}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onItemClick) {
                  getItemById(explorationItemId).then(item => {
                    if (item) {
                      onItemClick(item, { fromObtainable: true });
                    } else {
                      const itemUrl = generateItemUrl(explorationItemId, 'item');
                      navigate(itemUrl);
                    }
                  });
                } else {
                  const itemUrl = generateItemUrl(explorationItemId, 'item');
                  navigate(itemUrl);
                }
              }}
              className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
            >
              <ItemImage
                itemId={explorationItemId}
                alt={explorationName}
                className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
              />
              <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={explorationName}>
                {explorationName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
