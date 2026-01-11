// Server selector - shows Traditional Chinese data centers and worlds
export default function ServerSelector({
  datacenters,
  worlds,
  selectedWorld,
  onWorldChange,
  selectedServerOption,
  onServerOptionChange,
  serverOptions,
}) {
  // Filter to only Traditional Chinese data centers
  const tradChineseDCs = datacenters?.filter(dc => 
    dc.region && dc.region.startsWith('繁中服')
  ) || [];

  // Get all worlds for the selected data center
  const allWorldsForDC = selectedWorld?.dcObj?.worlds || [];

  return (
    <div className="flex items-center gap-3">
      {/* Server Options: Data Center (全服搜尋) + All Worlds */}
      {selectedWorld && allWorldsForDC.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {/* Data Center Option (全服搜尋) */}
          <button
            onClick={() => onServerOptionChange(selectedWorld.section)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
              selectedServerOption === selectedWorld.section
                ? 'bg-gradient-to-r from-ffxiv-gold/30 to-ffxiv-gold/20 border-ffxiv-gold text-ffxiv-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                : 'bg-slate-700/50 border-slate-600 text-gray-300 hover:border-slate-500 hover:bg-slate-700'
            }`}
          >
            {selectedWorld.section}（全服搜尋）
          </button>
          
          {/* Individual World Options */}
          {allWorldsForDC.map((worldId) => {
            const worldName = worlds[worldId];
            const isSelected = selectedServerOption === worldId;

            return (
              <button
                key={worldId}
                onClick={() => onServerOptionChange(worldId)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
                  isSelected
                    ? 'bg-gradient-to-r from-ffxiv-gold/30 to-ffxiv-gold/20 border-ffxiv-gold text-ffxiv-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                    : 'bg-slate-700/50 border-slate-600 text-gray-300 hover:border-slate-500 hover:bg-slate-700'
                }`}
              >
                {worldName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
