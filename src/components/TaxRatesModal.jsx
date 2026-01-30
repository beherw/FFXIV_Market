// Tax Rates Modal Component - Shows market tax rates with highlighted selected server
import { useEffect } from 'react';

export default function TaxRatesModal({ 
  isOpen, 
  onClose, 
  taxRates, 
  worlds, 
  isLoading, 
  selectedWorld,
  selectedServerOption,
  onServerOptionChange
}) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!selectedWorld || !selectedWorld.dcObj) {
    return (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div 
          className="relative bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-lg border-2 border-purple-500/50 shadow-2xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-gray-400 text-center">請先選擇伺服器</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-purple-800/50 hover:bg-purple-700/70 rounded-lg text-white transition-all"
          >
            關閉
          </button>
        </div>
      </div>
    );
  }

  const worldIds = selectedWorld.dcObj.worlds || [];
  const hasTaxRates = Object.keys(taxRates).length > 0;
  
  // Check if a specific server is selected (not DC)
  // selectedServerOption is a number (worldId) when a specific server is selected
  // selectedServerOption is a string (datacenter name) when DC is selected
  const isSpecificServerSelected = selectedServerOption && typeof selectedServerOption === 'number';

  // City names mapping (Traditional Chinese)
  const cityNames = {
    LimsaLominsa: '利姆薩·羅敏薩',
    Gridania: '格里達尼亞',
    'Ul\'dah': '烏爾達哈',
    Ishgard: '伊修加德',
    Kugane: '黃金港',
    Crystarium: '水晶都',
    OldSharlayan: '舊薩雷安'
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal Content */}
      <div 
        className="relative bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 rounded-lg border-2 border-purple-500/50 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-500/30">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-ffxiv-gold"
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
            <h2 className="text-xl sm:text-2xl font-bold text-ffxiv-gold">
              市場稅率 - {selectedWorld.section}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-purple-800/40 rounded-lg transition-all"
            title="關閉"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
                <span className="text-lg text-gray-300">載入市場稅率...</span>
              </div>
            </div>
          ) : !hasTaxRates ? (
            <div className="text-center py-12">
              <p className="text-gray-400">暫無稅率資料</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {worldIds.map((worldId) => {
                const worldName = worlds[worldId];
                const rates = taxRates[worldId];
                
                if (!rates || !worldName) {
                  return null;
                }

                // Check if this is the selected server
                // Compare as numbers to ensure type consistency
                // Also check if selectedServerOption matches worldId (for both number and string cases)
                const isSelectedServer = (isSpecificServerSelected && Number(selectedServerOption) === Number(worldId)) ||
                                       (selectedServerOption === worldId);

                // Find lowest and second lowest tax rates for this server
                const validTaxes = Object.values(rates)
                  .filter(tax => tax !== null && tax !== undefined)
                  .map(tax => Number(tax))
                  .sort((a, b) => a - b);
                
                const lowestTax = validTaxes.length > 0 ? validTaxes[0] : null;
                const secondLowestTax = validTaxes.length > 1 ? validTaxes[1] : null;

                return (
                  <div
                    key={worldId}
                    onClick={() => onServerOptionChange && onServerOptionChange(worldId)}
                    className={`relative p-4 rounded-lg border transition-all cursor-pointer ${
                      isSelectedServer
                        ? `server-box-rotating-light bg-gradient-to-br from-ffxiv-gold/20 via-yellow-500/15 to-ffxiv-gold/20 border-ffxiv-gold/50 shadow-lg shadow-ffxiv-gold/20`
                        : 'bg-slate-900/40 border-purple-500/20 hover:bg-slate-800/60 hover:border-purple-400/40'
                    }`}
                  >
                    {/* Content wrapper with proper z-index to be above rotating light */}
                    <div className="relative z-[2]">
                      <div className={`font-semibold text-sm mb-3 flex items-center gap-2 ${
                        isSelectedServer ? 'text-ffxiv-gold' : 'text-ffxiv-gold'
                      }`}>
                        {worldName}
                      </div>
                      <div className="space-y-2 text-xs">
                        {Object.entries(cityNames)
                          .map(([key, name]) => {
                            const tax = rates[key];
                            if (tax === null || tax === undefined) {
                              return null;
                            }
                            return { key, name, tax: Number(tax) };
                          })
                          .filter(item => item !== null)
                          .sort((a, b) => b.tax - a.tax)
                          .map(({ key, name, tax: taxValue }) => {
                            const isLowest = taxValue === lowestTax;
                            const isSecondLowest = taxValue === secondLowestTax && !isLowest;

                            return (
                              <div 
                                key={key} 
                                className={`flex justify-between items-center ${
                                  isSelectedServer ? 'text-gray-200' : 'text-gray-300'
                                }`}
                              >
                                <span>{name}:</span>
                                <span className={`font-medium ${
                                  isLowest
                                    ? 'text-green-400 font-bold text-sm'
                                    : isSecondLowest
                                      ? 'text-green-300 font-semibold'
                                      : isSelectedServer
                                        ? 'text-ffxiv-gold'
                                        : 'text-ffxiv-gold'
                                }`}>
                                  {taxValue}%
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
