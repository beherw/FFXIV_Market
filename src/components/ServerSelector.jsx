// Server selector - shows Traditional Chinese data centers and worlds
export default function ServerSelector({
  datacenters,
  worlds,
  selectedWorld,
  onWorldChange,
  selectedServerOption,
  onServerOptionChange,
  serverOptions,
  disabled = false,
}) {
  // Filter to only Traditional Chinese data centers
  const tradChineseDCs = datacenters?.filter(dc => 
    dc.region && dc.region.startsWith('繁中服')
  ) || [];

  // Get all worlds for the selected data center
  const allWorldsForDC = selectedWorld?.dcObj?.worlds || [];

  return (
    <div className="flex items-center gap-1.5 mid:gap-2 detail:gap-3 w-full detail:w-auto relative z-10 group">
      {/* Server Options: Data Center (全服搜尋) + All Worlds */}
      {selectedWorld && allWorldsForDC.length > 0 && (
        <div className="flex gap-1 mid:gap-1.5 detail:gap-2 flex-wrap w-full detail:w-auto relative pl-1">
          {/* Data Center Option (全服搜尋) */}
          <button
            onClick={() => !disabled && onServerOptionChange(selectedWorld.section)}
            disabled={disabled}
            className={`relative z-10 px-2 mid:px-3 detail:px-4 py-1 mid:py-1.5 detail:py-2 rounded-lg text-xs font-medium transition-all border whitespace-nowrap hover:!translate-y-0 ${
              disabled
                ? 'bg-slate-700/30 border-slate-600/20 text-gray-600 cursor-not-allowed opacity-50'
                : selectedServerOption === selectedWorld.section
                  ? 'bg-gradient-to-r from-ffxiv-gold/30 to-ffxiv-gold/20 border-ffxiv-gold text-ffxiv-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                  : 'bg-purple-800/50 border-purple-500/40 text-gray-300 hover:border-purple-400/60 hover:bg-purple-700/60'
            }`}
          >
            <span className="hidden detail:inline">{selectedWorld.section}（全服搜尋）</span>
            <span className="hidden mid:inline detail:hidden">{selectedWorld.section}（全服）</span>
            <span className="mid:hidden">全服</span>
          </button>
          
          {/* Individual World Options */}
          {allWorldsForDC.map((worldId) => {
            const worldName = worlds[worldId];
            const isSelected = selectedServerOption === worldId;

            return (
              <button
                key={worldId}
                onClick={() => !disabled && onServerOptionChange(worldId)}
                disabled={disabled}
                className={`relative z-10 px-2 mid:px-3 detail:px-4 py-1 mid:py-1.5 detail:py-2 rounded-lg text-xs font-medium transition-all border whitespace-nowrap hover:!translate-y-0 ${
                  disabled
                    ? 'bg-slate-700/30 border-slate-600/20 text-gray-600 cursor-not-allowed opacity-50'
                    : isSelected
                      ? 'bg-gradient-to-r from-ffxiv-gold/30 to-ffxiv-gold/20 border-ffxiv-gold text-ffxiv-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                      : 'bg-purple-800/50 border-purple-500/40 text-gray-300 hover:border-purple-400/60 hover:bg-purple-700/60'
                }`}
              >
                {worldName}
              </button>
            );
          })}
        </div>
      )}
      
      {/* Tooltip for disabled state */}
      {disabled && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 border border-slate-700">
          請耐心等待物品加載完成
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-0">
            <div className="border-4 border-transparent border-b-slate-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}
