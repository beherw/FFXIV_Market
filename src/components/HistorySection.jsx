import { useHistory } from '../hooks/useHistory';
import ItemImage from './ItemImage';

export default function HistorySection({ onItemSelect }) {
  // Use the centralized history hook
  const { historyItems, isLoading, clearHistory } = useHistory();

  const handleClearHistory = () => {
    if (window.confirm('確定要清空所有歷史記錄嗎？')) {
      clearHistory();
    }
  };

  if (isLoading) {
    return (
      <div className="mb-6 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
          <span className="ml-3 text-sm text-gray-400">載入歷史記錄...</span>
        </div>
      </div>
    );
  }

  if (historyItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-semibold text-ffxiv-gold flex items-center gap-2">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 sm:h-6 sm:w-6" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          最近查看的物品
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-gray-400">({historyItems.length}/10)</span>
          <button
            onClick={handleClearHistory}
            className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium bg-red-800/60 hover:bg-red-700/70 text-gray-200 hover:text-white rounded-md border border-red-500/40 hover:border-red-400/60 transition-all duration-200 flex items-center gap-1.5"
            title="清空歷史記錄"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-3.5 w-3.5 sm:h-4 sm:w-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
              />
            </svg>
            <span>清空</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {historyItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemSelect && onItemSelect(item)}
            className="bg-gradient-to-br from-purple-900/30 via-pink-900/20 to-indigo-900/30 rounded-lg p-3 sm:p-4 border border-purple-500/30 hover:border-ffxiv-gold/50 transition-all hover:scale-105 group"
          >
            <div className="flex flex-col items-center gap-2">
              <ItemImage
                itemId={item.id}
                alt={item.name}
                className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded border border-purple-500/30 bg-slate-900/50 group-hover:border-ffxiv-gold/50 transition-colors"
              />
              <p className="text-xs sm:text-sm text-white font-medium text-center line-clamp-2 group-hover:text-ffxiv-gold transition-colors" title={item.name}>
                {item.name}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
