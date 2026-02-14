// Tax Rates Display Component - Shows market tax rates for servers in 陸行鳥 data center
export default function TaxRatesDisplay({ taxRates, worlds, isLoading, selectedWorld }) {
  if (!selectedWorld || !selectedWorld.dcObj) {
    return null;
  }

  const dcName = selectedWorld.section;
  const isLuXingNiao = dcName === '陸行鳥' || dcName === '陆行鸟';
  
  if (!isLuXingNiao) {
    return null;
  }

  const worldIds = selectedWorld.dcObj.worlds || [];
  const hasTaxRates = Object.keys(taxRates).length > 0;

  // City names mapping (Traditional Chinese)
  // Note: API returns keys like "Ul'dah" (with apostrophe), not "Ul_dah"
  const cityNames = {
    LimsaLominsa: '利姆薩·羅敏薩',
    Gridania: '格里達尼亞',
    'Ul\'dah': '烏爾達哈',
    Ishgard: '伊修加德',
    Kugane: '黃金港',
    Crystarium: '水晶都',
    OldSharlayan: '舊薩雷安'
  };

  if (isLoading) {
    return (
      <div className="mb-4 p-4 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ffxiv-gold"></div>
          <span className="text-sm text-gray-300">載入市場稅率...</span>
        </div>
      </div>
    );
  }

  if (!hasTaxRates) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20">
      <div className="flex items-center gap-2 mb-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-ffxiv-gold"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-sm font-semibold text-ffxiv-gold">市場稅率 - {dcName}</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {worldIds.map((worldId) => {
          const worldName = worlds[worldId];
          const rates = taxRates[worldId];
          
          if (!rates || !worldName) {
            return null;
          }

          return (
            <div
              key={worldId}
              className="p-3 bg-slate-900/40 rounded-lg border border-purple-500/20"
            >
              <div className="font-semibold text-ffxiv-gold text-sm mb-2">{worldName}</div>
              <div className="space-y-1 text-xs">
                {Object.entries(cityNames).map(([key, name]) => {
                  // API returns keys exactly as defined in cityNames (e.g., "Ul'dah")
                  const tax = rates[key];
                  
                  if (tax === null || tax === undefined) {
                    return null;
                  }

                  return (
                    <div key={key} className="flex justify-between text-gray-300">
                      <span>{name}:</span>
                      <span className="font-medium text-ffxiv-gold">{tax}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
