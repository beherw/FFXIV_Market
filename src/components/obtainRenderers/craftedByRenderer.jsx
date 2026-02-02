// Renderer for CRAFTED_BY (Type 1) - 製作
import React from 'react';
import {
  getJobName,
  getJobIconUrl,
  getMasterbookName,
  renderLoadingSpinner,
  commonClasses
} from './sharedUtils.jsx';

export function renderCraftedBy({
  source,
  index,
  dataLoaded,
  onExpandCraftingTree,
  isCraftingTreeExpanded,
  loadedDataRef,
  onItemClick,
  navigate,
  getItemById,
  generateItemUrl,
  twJobAbbrData
}) {
  const { data } = source;
  
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div key={`crafted-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/000000/000501.png" alt="Craft" className={commonClasses.icon} />
        <span className={commonClasses.title}>製作</span>
        {onExpandCraftingTree && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dataLoaded) {
                onExpandCraftingTree();
              }
            }}
            disabled={!dataLoaded}
            className={`ml-auto ${commonClasses.button} ${
              !dataLoaded
                ? 'bg-gray-900/50 border-gray-600/40 text-gray-500 cursor-not-allowed opacity-60'
                : isCraftingTreeExpanded
                ? 'bg-amber-900/50 hover:bg-amber-800/70 border-ffxiv-gold/60 hover:border-ffxiv-gold text-ffxiv-gold'
                : 'bg-purple-900/50 hover:bg-purple-800/70 border-purple-500/40 hover:border-purple-400/60 text-purple-200 hover:text-ffxiv-gold'
            }`}
            title={!dataLoaded ? '正在加載數據...' : isCraftingTreeExpanded ? '收起製作價格樹' : '展開製作價格樹'}
          >
            {!dataLoaded ? (
              renderLoadingSpinner('h-3 w-3')
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )}
            {isCraftingTreeExpanded ? '收起樹' : '展開樹'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {data.map((craft, craftIndex) => {
          const jobId = craft.job;
          const jobName = getJobName(jobId, twJobAbbrData);
          const jobIconUrl = getJobIconUrl(jobId);
          const level = craft.lvl || craft.rlvl || 0;
          const stars = craft.stars_tooltip || '';
          
          // Skip if no valid job data
          if (!jobName || jobName === `職業 ${jobId}`) {
            return null;
          }

          return (
            <button
              key={`craft-${index}-${craftIndex}`}
              disabled={!dataLoaded}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dataLoaded && onExpandCraftingTree) {
                  onExpandCraftingTree();
                }
              }}
              className={`w-[280px] flex-grow-0 rounded p-2 min-h-[70px] flex flex-col justify-center transition-all duration-200 ${
                !dataLoaded
                  ? 'bg-gray-900/40 border border-gray-700/40 text-gray-500 cursor-not-allowed opacity-50'
                  : isCraftingTreeExpanded
                  ? 'bg-amber-900/30 hover:bg-amber-800/40 border border-ffxiv-gold/40 cursor-pointer'
                  : 'bg-slate-900/50 hover:bg-slate-800/70 cursor-pointer'
              }`}
              title={!dataLoaded ? '正在加載數據...' : isCraftingTreeExpanded ? '點擊收起製作價格樹' : '點擊展開製作價格樹'}
            >
              <div className="flex items-center gap-2">
                {!dataLoaded ? (
                  <div className="w-7 h-7 flex items-center justify-center">
                    {renderLoadingSpinner('h-4 w-4')}
                  </div>
                ) : (
                  jobIconUrl && (
                    <img src={jobIconUrl} alt={jobName} className="w-7 h-7 object-contain" />
                  )
                )}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{jobName}</span>
                    {level > 0 && (
                      <span className="text-xs text-gray-400">Lv.{level}</span>
                    )}
                    {stars && (
                      <span className="text-xs text-yellow-400">{stars}</span>
                    )}
                  </div>
                  {craft.masterbook && (() => {
                    const masterbookId = craft.masterbook.id 
                      ? (typeof craft.masterbook.id === 'string' ? parseInt(craft.masterbook.id, 10) : craft.masterbook.id)
                      : null;
                    const currentLoadedData = loadedDataRef.current;
                    const masterbookName = masterbookId 
                      ? getMasterbookName(masterbookId, currentLoadedData.twItems) 
                      : (craft.masterbook.name?.tw || craft.masterbook.name?.en);
                    const displayName = masterbookName || '專用配方書';
                    
                    return (
                      <div className="text-xs text-gray-400 mt-1">
                        {masterbookId ? (
                          <span
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onItemClick) {
                                getItemById(masterbookId).then(item => {
                                  if (item) {
                                    onItemClick(item, { fromObtainable: true });
                                  } else {
                                    const itemUrl = generateItemUrl(masterbookId, 'item');
                                    navigate(itemUrl);
                                  }
                                });
                              } else {
                                const itemUrl = generateItemUrl(masterbookId, 'item');
                                navigate(itemUrl);
                              }
                            }}
                            className="text-ffxiv-gold hover:text-yellow-400 hover:underline transition-colors cursor-pointer"
                          >
                            {displayName}
                          </span>
                        ) : (
                          <span>{displayName}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </button>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
}
