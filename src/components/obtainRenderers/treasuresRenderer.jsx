// TREASURES renderer (Type 9 - 寶箱/容器)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderTreasures({
  source,
  index,
  loadedData,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate
}) {
  const { data } = source;
  
  return (
    <div key={`treasure-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/061000/061808.png" alt="Treasure" className={commonClasses.icon} />
        <span className={commonClasses.title}>寶箱/容器</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {data.map((treasureId, treasureIndex) => {
          const treasureItemData = loadedData.twItems[treasureId] || loadedData.twItems[String(treasureId)];
          if (!treasureItemData || !treasureItemData.tw) {
            return null;
          }
          
          const treasureName = treasureItemData.tw;
          
          return (
            <button
              key={treasureIndex}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onItemClick) {
                  getItemById(treasureId).then(item => {
                    if (item) {
                      onItemClick(item, { fromObtainable: true });
                    } else {
                      const itemUrl = generateItemUrl(treasureId, 'item');
                      navigate(itemUrl);
                    }
                  });
                } else {
                  const itemUrl = generateItemUrl(treasureId, 'item');
                  navigate(itemUrl);
                }
              }}
              className="w-[280px] flex-grow-0 flex items-center justify-start gap-2 text-left text-sm text-blue-400 hover:text-ffxiv-gold transition-colors bg-slate-900/50 rounded p-2 hover:bg-slate-800/70 min-h-[70px] border border-slate-700/50"
            >
              <ItemImage
                itemId={treasureId}
                alt={treasureName}
                className="w-7 h-7 object-contain"
              />
              <span className="hover:underline">{treasureName}</span>
            </button>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
}
