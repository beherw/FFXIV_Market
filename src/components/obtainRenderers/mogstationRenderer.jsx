// MOGSTATION renderer (Type 13 - 商城購買)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderMogstation({
  source,
  index
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return (
    <div key={`mogstation-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/065000/065002.png" alt="Mogstation" className={commonClasses.icon} />
        <span className={commonClasses.title}>商城購買</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <div className={commonClasses.innerItemBlock}>
          <div className="text-sm text-gray-300 text-center">
            可在 Mog Station 商城購買
          </div>
        </div>
      </div>
    </div>
  );
}
