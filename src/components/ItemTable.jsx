// Item table component - replicates ObservableHQ's item selection table
import ItemImage from './ItemImage';

export default function ItemTable({ items, onSelect, selectedItem }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="overflow-x-auto bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20">
      <table className="w-full border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-indigo-900/40 border-b border-purple-500/30">
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-12 sm:w-16">圖片</th>
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-16 sm:w-20">ID</th>
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs min-w-[140px] sm:min-w-[180px]">物品名</th>
            <th className="px-2 sm:px-4 py-2 text-right text-ffxiv-gold font-semibold text-xs w-16 sm:w-20">品級</th>
            <th className="px-2 sm:px-4 py-2 text-right text-ffxiv-gold font-semibold text-xs w-20 sm:w-24">NPC售價</th>
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs hidden md:table-cell max-w-xs">說明</th>
            <th className="px-2 sm:px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-24 sm:w-32">鏈接</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            return (
              <tr
                key={item.id || index}
                onClick={() => onSelect && onSelect(item)}
                className={`border-b border-purple-500/20 cursor-pointer transition-colors ${
                  selectedItem?.id === item.id 
                    ? 'bg-ffxiv-gold/20' 
                    : 'hover:bg-purple-900/30'
                }`}
              >
                <td className="px-2 sm:px-4 py-2">
                  <ItemImage
                    itemId={item.id}
                    alt={item.name}
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded border border-purple-500/30 bg-slate-900/50"
                    priority={index < 5}
                    loadDelay={index >= 5 ? (index - 5) * 200 : 0}
                  />
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-gray-400 font-mono text-xs">{item.id}</td>
                <td className="px-2 sm:px-4 py-2 text-white font-medium text-xs sm:text-sm break-words" style={{ minWidth: '140px', maxWidth: '240px' }}>
                  <span className="block" style={{ wordBreak: 'break-word', lineHeight: '1.4' }} title={item.name}>
                    {item.name}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-gray-400 text-xs">{item.itemLevel || '-'}</td>
                <td className="px-2 sm:px-4 py-2 text-right text-ffxiv-gold text-xs">
                  {item.inShop ? (item.shopPrice ? `${parseInt(item.shopPrice).toLocaleString()}` : '無') : '無'}
                </td>
                <td className="px-2 sm:px-4 py-2 text-gray-400 text-xs max-w-xs hidden md:table-cell">
                  <span className="block truncate" title={item.description}>
                    {item.description || '-'}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2">
                  <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
                    <a
                      href={`https://ff14.huijiwiki.com/wiki/${item.id > 1000 || item.id < 20 ? '物品:' : ''}${encodeURIComponent(item.nameSimplified || item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Wiki
                    </a>
                    <a
                      href={`https://www.garlandtools.cn/db/#item/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Garland
                    </a>
                    <a
                      href={`https://universalis.app/market/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Market
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
