// Market history component - replicates ObservableHQ's market history table
export default function MarketHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <p className="text-sm">暫無歷史交易記錄</p>
      </div>
    );
  }

  // Sort by timestamp (newest first)
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="overflow-x-auto bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-700/50 border-b border-slate-600">
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">物品名</th>
            <th className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">單價</th>
            <th className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">數量</th>
            <th className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">總計</th>
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">買家</th>
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">服務器</th>
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">時間</th>
          </tr>
        </thead>
        <tbody>
          {sortedHistory.map((entry, index) => (
            <tr
              key={index}
              className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors"
            >
              <td className="px-3 py-2 text-white text-xs">
                {entry.itemName}
                {entry.hq && <span className="ml-1 px-1 py-0.5 bg-ffxiv-gold/20 text-ffxiv-gold rounded text-xs">HQ</span>}
              </td>
              <td className="px-3 py-2 text-right text-green-400 font-semibold text-xs">
                {entry.pricePerUnit.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-gray-300 text-xs">{entry.quantity}</td>
              <td className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">
                {entry.total.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs">{entry.buyerName || '-'}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{entry.worldName}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">
                {new Date(entry.timestamp * 1000).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
