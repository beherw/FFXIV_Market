// VENTURES renderer (Type 15 - 雇員探險)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderVentures({
  source,
  index
}) {
  const { tasks } = source;
  
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return null;
  }
  
  return (
    <div key={`venture-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/021000/021267.png" alt="Venture" className={commonClasses.icon} />
        <span className={commonClasses.title}>雇員探險</span>
      </div>
      <div className="flex flex-col gap-2 mt-2">
        {tasks.map((task, idx) => {
          const maxQuantity = task.quantities?.[task.quantities.length - 1]?.quantity || '?';
          
          return (
            <div key={idx} className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-400">
                  等級 {task.level} 雇員探險
                </div>
                <div className="text-xs text-gray-400">
                  最多 {maxQuantity} 個
                </div>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-gray-400">
                {task.reqGathering > 0 && (
                  <span>採集力 {task.reqGathering}+</span>
                )}
                {task.reqIlvl > 0 && (
                  <span>裝等 {task.reqIlvl}+</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
