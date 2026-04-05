// VOYAGES renderer (Type 9 - 遠航探索)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';
import { getVoyageTwDisplayName, parseVoyageDestinationLabel } from '../../utils/voyageDisplayName';

export function renderVoyages({
  source,
  index,
  loadedData
}) {
  const { voyages, totalVoyages } = source;
  
  if (!voyages || !Array.isArray(voyages) || voyages.length === 0) {
    return null;
  }

  const subVoyages = voyages.filter(v => v && v.type === 1);
  const airVoyages = voyages.filter(v => v && v.type !== 1);
  const mixedTypes = subVoyages.length > 0 && airVoyages.length > 0;
  const singleTypeLabel =
    !mixedTypes && subVoyages.length > 0 ? '潛水艇' : !mixedTypes && airVoyages.length > 0 ? '飛空艇' : null;

  const renderRow = (voyage, idx, keyPrefix) => {
    const rawLabel = getVoyageTwDisplayName(voyage, loadedData);
    const { gridLetter, title } = parseVoyageDestinationLabel(rawLabel);
    return (
      <div
        key={`${keyPrefix}-${idx}`}
        className="flex items-center gap-2.5 py-2 px-2 rounded-md bg-slate-900/40 border border-slate-700/40"
      >
        {gridLetter ? (
          <span
            className="inline-flex flex-shrink-0 items-center justify-center min-w-[1.625rem] h-6 px-1.5 text-[11px] font-semibold tracking-wide text-slate-300 bg-slate-800/90 border border-slate-600/80 rounded font-mono leading-none"
            title="航路格點"
          >
            {gridLetter}
          </span>
        ) : null}
        <span className="text-sm text-blue-300/95 leading-normal min-w-0 flex-1">{title}</span>
      </div>
    );
  };

  return (
    <div key={`voyage-${index}`} className={commonClasses.card}>
      <div className={`${commonClasses.header} justify-between`}>
        <div className="flex items-center gap-2 min-w-0">
          <img src="https://xivapi.com/i/021000/021267.png" alt="" className={commonClasses.icon} />
          <span className={commonClasses.title}>遠航探索</span>
        </div>
        {singleTypeLabel ? (
          <span className="text-xs text-slate-500 flex-shrink-0">{singleTypeLabel}</span>
        ) : null}
      </div>
      <div className={`flex flex-col ${mixedTypes ? 'gap-3' : 'gap-1.5'} mt-2`}>
        {subVoyages.length > 0 && (
          <div>
            {mixedTypes ? (
              <div className="text-xs font-medium text-slate-400 mb-1.5">潛水艇</div>
            ) : null}
            <div className="flex flex-col gap-1.5">{subVoyages.map((v, i) => renderRow(v, i, 'sub'))}</div>
          </div>
        )}
        {airVoyages.length > 0 && (
          <div>
            {mixedTypes ? (
              <div className="text-xs font-medium text-slate-400 mb-1.5">飛空艇</div>
            ) : null}
            <div className="flex flex-col gap-1.5">{airVoyages.map((v, i) => renderRow(v, i, 'air'))}</div>
          </div>
        )}
      </div>
    </div>
  );
}
