// Market listings component - replicates ObservableHQ's market listings table
export default function MarketListings({ listings, onRefresh }) {
  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>暫無在售列表</p>
      </div>
    );
  }

  // Sort by price (ascending)
  const sortedListings = [...listings].sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  return (
    <div className="overflow-x-auto bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-700/50 border-b border-slate-600">
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">物品名</th>
            <th className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">單價</th>
            <th className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">數量</th>
            <th className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">總計</th>
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">雇員</th>
            <th className="px-3 py-2 text-left text-ffxiv-gold font-semibold text-xs">服務器</th>
          </tr>
        </thead>
        <tbody>
          {sortedListings.map((listing, index) => (
            <tr
              key={index}
              className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors"
            >
              <td className="px-3 py-2 text-white text-xs">
                {listing.itemName}
                {listing.hq && <span className="ml-1 px-1 py-0.5 bg-ffxiv-gold/20 text-ffxiv-gold rounded text-xs">HQ</span>}
              </td>
              <td className="px-3 py-2 text-right text-green-400 font-semibold text-xs">
                {listing.pricePerUnit.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-gray-300 text-xs">{listing.quantity}</td>
              <td className="px-3 py-2 text-right text-ffxiv-gold font-semibold text-xs">
                {listing.total.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-gray-400 text-xs">{listing.retainerName || '-'}</td>
              <td className="px-3 py-2 text-gray-400 text-xs">{listing.worldName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
