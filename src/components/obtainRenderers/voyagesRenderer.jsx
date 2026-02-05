// VOYAGES renderer (Type 9 - 遠航探索)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderVoyages({
  source,
  index
}) {
  const { voyages, totalVoyages } = source;
  
  if (!voyages || !Array.isArray(voyages) || voyages.length === 0) {
    return null;
  }

  return (
    <div key={`voyage-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/021000/021267.png" alt="Voyage" className={commonClasses.icon} />
        <span className={commonClasses.title}>遠航探索</span>
      </div>
      <div className="flex flex-col gap-2 mt-2">
        {voyages.map((voyage, idx) => {
          const voyageName = voyage.name?.en || `Voyage ${voyage.id}`;
          const voyageType = voyage.type === 1 ? '潛水艇' : '飛空艇';
          
          return (
            <div key={idx} className="bg-slate-900/50 rounded p-2 border border-slate-700/50">
              <div className="text-sm text-blue-400">
                <span className="text-gray-500">[{voyageType}]</span> {voyageName}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
