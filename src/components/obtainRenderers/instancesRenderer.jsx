// INSTANCES renderer (Type 6 - 副本掉落)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderInstances({
  source,
  index,
  loadedDataRef,
  getInstanceName,
  getInstanceCNName
}) {
  const { data } = source;
  const currentLoadedData = loadedDataRef.current;
  
  return (
    <div key={`instance-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/061000/061801.png" alt="Instance" className={commonClasses.icon} />
        <span className={commonClasses.title}>副本掉落</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {data.map((instanceId, instanceIndex) => {
          const instanceName = getInstanceName(instanceId);
          
          if (instanceName === `副本 ${instanceId}`) {
            return null;
          }
          
          const instanceCNName = getInstanceCNName(instanceId);
          const instance = currentLoadedData.instances[instanceId] || currentLoadedData.instances[String(instanceId)];
          const iconUrl = instance?.icon 
            ? `https://xivapi.com${instance.icon}` 
            : 'https://xivapi.com/i/061000/061801.png';
          
          let contentTypeIcon = iconUrl;
          if (instance?.contentType) {
            if (instance.contentType === 4) {
              contentTypeIcon = 'https://xivapi.com/i/061000/061804.png';
            } else if (instance.contentType === 5) {
              contentTypeIcon = 'https://xivapi.com/i/061000/061802.png';
            } else if (instance.contentType === 28) {
              contentTypeIcon = 'https://xivapi.com/i/061000/061832.png';
            } else if (instance.contentType === 21) {
              contentTypeIcon = 'https://xivapi.com/i/061000/061824.png';
            }
          }
          
          const levelReq = instance?.levelReq;
          const ilvlReq = instance?.ilvlReq;
          const sync = instance?.sync;
          
          return (
            <div key={instanceIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded-lg p-3 min-h-[80px] flex flex-col justify-between border border-slate-700/30 hover:border-slate-600/50 transition-colors">
              {instanceCNName && (
                <a
                  href={`https://ff14.huijiwiki.com/wiki/${encodeURIComponent(instanceCNName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-2 group"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <img src={contentTypeIcon} alt="Instance" className="w-7 h-7 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-400 group-hover:text-ffxiv-gold transition-colors leading-tight">
                      {instanceName}
                    </span>
                  </div>
                  {(levelReq || ilvlReq) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-6 text-xs text-gray-400">
                      {levelReq && (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-gray-500">等级:</span>
                          <span className="text-gray-300 font-medium">Lv.{levelReq}</span>
                          {sync && sync !== levelReq && (
                            <span className="text-gray-500 text-[10px] leading-none -ml-0.5">(同步: {sync})</span>
                          )}
                        </div>
                      )}
                      {ilvlReq && ilvlReq > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">iLvl要求:</span>
                          <span className="text-gray-300 font-medium">{ilvlReq}</span>
                        </div>
                      )}
                    </div>
                  )}
                </a>
              )}
              {!instanceCNName && (
                <div className="flex items-center gap-2">
                  <img src={contentTypeIcon} alt="Instance" className="w-7 h-7 flex-shrink-0" />
                  <span className="text-sm font-medium text-white leading-tight">
                    {instanceName}
                  </span>
                </div>
              )}
            </div>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
}
