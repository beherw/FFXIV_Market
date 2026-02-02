// MASTERBOOKS renderer (Type 16 - 製作書)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderMasterbooks({
  source,
  index,
  itemId,
  loadedData,
  wikiUrl,
  onItemClick,
  getItemById,
  generateItemUrl,
  navigate
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Extract masterbook IDs from objects or use direct IDs
  const masterbookEntries = data.map(book => {
    if (typeof book === 'object' && book !== null) {
      const bookId = typeof book.id === 'string' ? parseInt(book.id, 10) : book.id;
      const bookName = book.name?.tw || book.name?.zh || book.name?.en;
      return { id: bookId, name: bookName };
    } else {
      const bookId = typeof book === 'string' ? parseInt(book, 10) : book;
      return { id: bookId, name: null };
    }
  }).filter(entry => entry.id && !isNaN(entry.id));

  // Filter valid masterbooks
  const validMasterbooks = masterbookEntries.filter(entry => {
    const bookData = loadedData.twItems[entry.id] || loadedData.twItems[String(entry.id)];
    const hasItemData = bookData && bookData.tw;
    const hasNameFromSource = entry.name;
    return hasItemData || hasNameFromSource;
  });
  
  const allMissing = masterbookEntries.length > 0 && validMasterbooks.length === 0;
  
  if (validMasterbooks.length > 0) {
    const huijiUrl = `https://ff14.huijiwiki.com/wiki/物品:${encodeURIComponent(itemId)}`;
    
    return (
      <div key={`masterbook-${index}`} className={commonClasses.card}>
        <div className={commonClasses.header}>
          <img src="https://xivapi.com/i/065000/065002.png" alt="Masterbook" className={commonClasses.icon} />
          <span className={commonClasses.title}>製作書</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {validMasterbooks.map((entry, bookIndex) => {
            const bookId = entry.id;
            const bookData = loadedData.twItems[bookId] || loadedData.twItems[String(bookId)];
            const bookName = bookData?.tw || entry.name;
            
            return (
              <button
                key={bookIndex}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onItemClick) {
                    getItemById(bookId).then(item => {
                      if (item) {
                        onItemClick(item, { fromObtainable: true });
                      } else {
                        const itemUrl = generateItemUrl(bookId, 'item');
                        navigate(itemUrl);
                      }
                    });
                  } else {
                    const itemUrl = generateItemUrl(bookId, 'item');
                    navigate(itemUrl);
                  }
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-ffxiv-gold/60 hover:bg-slate-800/70 transition-all duration-200 group"
              >
                <ItemImage
                  itemId={bookId}
                  alt={bookName}
                  className="w-10 h-10 object-contain rounded border border-slate-700/50 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
                />
                <span className="text-xs text-blue-400 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={bookName}>
                  {bookName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  
  if (allMissing) {
    return (
      <div key={`masterbook-${index}`} className={commonClasses.card}>
        <div className={commonClasses.header}>
          <img src="https://xivapi.com/i/065000/065002.png" alt="Masterbook" className={commonClasses.icon} />
          <span className={commonClasses.title}>製作書</span>
        </div>
        <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-yellow-300 mb-2">
                此物品的製作書資訊可能來自限時活動內容，資料庫中暫無詳細資料。
              </p>
              {wikiUrl ? (
                <a
                  href={wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-600/30 hover:bg-yellow-600/50 border border-yellow-500/50 rounded text-sm text-yellow-200 hover:text-yellow-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  查看灰機 Wiki
                </a>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-600/30 border border-yellow-500/50 rounded text-sm text-yellow-200 opacity-50">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent"></div>
                  載入中...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
}
