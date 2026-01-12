// Market history component - replicates ObservableHQ's market history table
export default function MarketHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center py-8 text-gray-400 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20">
        <p className="text-sm">暫無歷史交易記錄</p>
      </div>
    );
  }

  // Sort by timestamp (newest first)
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex-1 flex flex-col overflow-x-auto bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20">
      <table className="w-full border-collapse text-sm min-w-[600px]">
        <thead>
          <tr className="bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border-b border-purple-500/30">
            <th className="px-2 sm:px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs min-w-[80px] sm:min-w-[100px]">物品名</th>
            <th className="px-2 sm:px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs w-20 sm:w-24">單價</th>
            <th className="px-2 sm:px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs w-16 sm:w-20">數量</th>
            <th className="px-2 sm:px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs w-20 sm:w-24">總計</th>
            <th className="px-2 sm:px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs hidden sm:table-cell min-w-[80px]">買家</th>
            <th className="px-2 sm:px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs min-w-[80px] sm:min-w-[100px]">服務器</th>
            <th className="px-2 sm:px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs w-16 sm:w-20">時間</th>
          </tr>
        </thead>
        <tbody>
          {sortedHistory.map((entry, index) => (
            <tr
              key={index}
              className="border-b border-purple-500/20 hover:bg-purple-900/30 transition-colors"
            >
              <td className="px-2 sm:px-3 py-2 text-white text-xs break-words" style={{ minWidth: '80px', maxWidth: '150px' }}>
                <div className="flex items-start gap-1 flex-wrap">
                  <span className="block min-w-0" style={{ wordBreak: 'break-word', lineHeight: '1.4' }} title={entry.itemName}>
                    {entry.itemName}
                  </span>
                  {entry.hq && <span className="px-1 py-0.5 bg-ffxiv-gold/20 text-ffxiv-gold rounded text-xs whitespace-nowrap flex-shrink-0">HQ</span>}
                </div>
              </td>
              <td className="px-2 sm:px-3 py-2 text-right text-green-400 font-semibold text-xs whitespace-nowrap">
                {entry.pricePerUnit.toLocaleString()}
              </td>
              <td className="px-2 sm:px-3 py-2 text-right text-gray-300 text-xs whitespace-nowrap">{entry.quantity}</td>
              <td className="px-2 sm:px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs whitespace-nowrap">
                {entry.total.toLocaleString()}
              </td>
              <td className="px-2 sm:px-3 py-2 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[100px]" title={entry.buyerName || '-'}>
                {entry.buyerName || '-'}
              </td>
              <td className="px-2 sm:px-3 py-2 text-gray-400 text-xs truncate max-w-[120px]" title={entry.worldName}>
                {entry.worldName}
              </td>
              <td className="px-2 sm:px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                {(() => {
                  const date = new Date(entry.timestamp * 1000);
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  return `${month}/${day} ${hours}:${minutes}`;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
