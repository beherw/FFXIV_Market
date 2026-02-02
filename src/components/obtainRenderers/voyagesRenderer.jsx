// VOYAGES renderer (Type 15 - 遠征)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderVoyages({
  source,
  index
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return (
    <div key={`voyage-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/021000/021267.png" alt="Voyage" className={commonClasses.icon} />
        <span className={commonClasses.title}>遠征</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <div className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center">
          <div className="text-sm text-gray-300 text-center">
            可通過遠征獲得
          </div>
        </div>
      </div>
    </div>
  );
}
