// Item table component - replicates ObservableHQ's item selection table
import ItemImage from './ItemImage';

export default function ItemTable({ items, onSelect, selectedItem }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="overflow-x-auto bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-700/50 border-b border-slate-600">
            <th className="px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs w-16">圖片</th>
            <th className="px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs">ID</th>
            <th className="px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs">物品名</th>
            <th className="px-4 py-2 text-right text-ffxiv-gold font-semibold text-xs">品級</th>
            <th className="px-4 py-2 text-right text-ffxiv-gold font-semibold text-xs">NPC售價</th>
            <th className="px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs">說明</th>
            <th className="px-4 py-2 text-left text-ffxiv-gold font-semibold text-xs">鏈接</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            return (
              <tr
                key={item.id || index}
                onClick={() => onSelect && onSelect(item)}
                className={`border-b border-slate-700/30 cursor-pointer transition-colors ${
                  selectedItem?.id === item.id 
                    ? 'bg-ffxiv-gold/20' 
                    : 'hover:bg-slate-700/30'
                }`}
              >
                <td className="px-4 py-2">
                  <ItemImage
                    itemId={item.id}
                    alt={item.name}
                    className="w-10 h-10 object-contain rounded border border-slate-600/50 bg-slate-900/50"
                  />
                </td>
                <td className="px-4 py-2 text-right text-gray-400 font-mono text-xs">{item.id}</td>
                <td className="px-4 py-2 text-white font-medium text-sm">{item.name}</td>
                <td className="px-4 py-2 text-right text-gray-400 text-xs">{item.itemLevel || '-'}</td>
                <td className="px-4 py-2 text-right text-ffxiv-gold text-xs">
                  {item.inShop ? (item.shopPrice ? `${parseInt(item.shopPrice).toLocaleString()}` : '無') : '無'}
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs max-w-xs">
                  <span className="block truncate" title={item.description}>
                    {item.description || '-'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 text-xs">
                    <a
                      href={`https://ff14.huijiwiki.com/wiki/${item.id > 1000 || item.id < 20 ? '物品:' : ''}${encodeURIComponent(item.nameSimplified || item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Wiki
                    </a>
                    <a
                      href={`https://www.garlandtools.cn/db/#item/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Garland
                    </a>
                    <a
                      href={`https://universalis.app/market/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ffxiv-accent hover:text-ffxiv-gold transition-colors"
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
