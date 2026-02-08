import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemImage from './ItemImage';
import { getTwItemsByIds } from '../services/gameData';
import { hasRecipe } from '../services/recipeDatabase';

/**
 * Modal for managing multiple items for combined tree
 */
export default function MultiItemListModal({ 
  isOpen, 
  onClose, 
  itemList, 
  onItemListChange,
  currentItemId,
  onBuildTree,
  itemNames = {},
  getVersion = () => null,
  getIlvl = () => null,
  getVersionColor = () => '#9CA3AF',
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState(itemList || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemMetaById, setItemMetaById] = useState({});
  const itemMetaByIdRef = useRef({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const MAX_ITEMS = 15;
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setItems(itemList || []);
  }, [itemList]);

  useEffect(() => {
    if (!items || items.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const ids = items.map(item => item.id).filter(id => id !== undefined && id !== null);
        const uncached = ids.filter(id => !itemMetaByIdRef.current[id]);
        if (uncached.length === 0) return;
        const meta = await getTwItemsByIds(uncached);
        if (cancelled || !meta) return;
        itemMetaByIdRef.current = { ...itemMetaByIdRef.current, ...meta };
        setItemMetaById(prev => ({ ...prev, ...meta }));
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load item meta for multi-item list:', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [items]);

  const handleAddCurrentItem = async () => {
    if (!currentItemId) return;
    
    // Check if item already exists
    if (items.some(item => item.id === currentItemId)) {
      return;
    }

    // Check max items
    if (items.length >= MAX_ITEMS) {
      return;
    }

    // Check if item has recipe
    const itemHasRecipe = await hasRecipe(currentItemId);
    if (!itemHasRecipe) {
      // Don't add items without recipes
      return;
    }

    // Get item name from cache or fetch from game data
    let itemName = itemNames[currentItemId] || itemMetaById[currentItemId]?.tw;
    
    // If not in cache, fetch from game data
    if (!itemName) {
      try {
        const meta = await getTwItemsByIds([currentItemId]);
        if (meta && meta[currentItemId]) {
          itemName = meta[currentItemId].tw;
          // Update cache
          itemMetaByIdRef.current[currentItemId] = meta[currentItemId];
          setItemMetaById(prev => ({ ...prev, [currentItemId]: meta[currentItemId] }));
        }
      } catch (err) {
        console.error('Failed to fetch item name:', err);
      }
    }

    const newItems = [...items, {
      id: currentItemId,
      name: itemName || `Item ${currentItemId}`,
    }];
    setItems(newItems);
    onItemListChange(newItems);
  };

  const handleRemoveItem = (itemId) => {
    const newItems = items.filter(item => item.id !== itemId);
    setItems(newItems);
    onItemListChange(newItems);
    
    // Adjust page if needed
    const maxPage = Math.ceil(newItems.length / ITEMS_PER_PAGE);
    if (currentPage > maxPage && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    setItems([]);
    onItemListChange([]);
    setCurrentPage(1);
    setShowClearConfirm(false);
  };

  const handleBuildTree = () => {
    if (items.length > 0) {
      onBuildTree(items);
      onClose();
    }
  };

  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div 
          className="bg-slate-800 rounded-lg border border-purple-500/50 shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30">
          <h3 className="text-lg font-semibold text-ffxiv-gold">組合樹清單</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Item count */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>物品數量: {items.length}/{MAX_ITEMS}</span>
            {items.length >= MAX_ITEMS && (
              <span className="text-orange-400">已達上限</span>
            )}
          </div>

          {/* Add current item button */}
          <button
            onClick={handleAddCurrentItem}
            disabled={!currentItemId || items.length >= MAX_ITEMS || items.some(item => item.id === currentItemId)}
            className={`
              w-full px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${!currentItemId || items.length >= MAX_ITEMS || items.some(item => item.id === currentItemId)
                ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600/50 hover:bg-blue-600 border border-blue-500/50 text-blue-100'
              }
            `}
          >
            新增當前物品
          </button>
          
          {/* Info message */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-900/20 border border-blue-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-300">
              提示：沒有製作樹的物品無法加入清單
            </p>
          </div>

          {/* Items list */}
          <div className="bg-slate-700/30 rounded-lg border border-slate-600/50 p-3 max-h-64 overflow-y-auto space-y-2">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item) => {
                // Get item's own version and ilvl data
                const meta = itemMetaById[item.id] || null;
                const ilvl = getIlvl ? (getIlvl(item.id) ?? meta?.ilvl ?? null) : (meta?.ilvl ?? null);
                const version = getVersion ? getVersion(item.id) : null;
                const equipLevel = meta?.equipLevel ?? null;
                
                return (
                  <div
                    key={item.id}
                    className="group relative w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-600/40 hover:border-slate-500/60 transition-all duration-200"
                  >
                    <ItemImage 
                      itemId={item.id} 
                      size="small"
                      className="h-10 w-10 rounded border border-slate-600/40 flex-shrink-0 cursor-pointer hover:border-slate-500/60 transition-colors"
                      onClick={() => {
                        onClose();
                        navigate(`/item/${item.id}`);
                      }}
                    />
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        onClose();
                        navigate(`/item/${item.id}`);
                      }}
                    >
                      <p className="text-sm text-gray-200 font-semibold truncate">
                        {item.name || itemNames[item.id] || meta?.tw || `Item ${item.id}`}
                      </p>
                      {/* Tags row */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {version && (
                          <span 
                            className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap"
                            style={{
                              background: `${getVersionColor(version)}20`,
                              borderColor: `${getVersionColor(version)}50`,
                              border: `1px solid ${getVersionColor(version)}50`,
                              color: getVersionColor(version),
                            }}
                          >
                            版本: {version}
                          </span>
                        )}
                        {ilvl !== null && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap bg-emerald-900/30 border border-emerald-400/40 text-emerald-300">
                            ilvl: {ilvl}
                          </span>
                        )}
                        {equipLevel !== null && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap bg-amber-900/30 border border-amber-400/40 text-amber-300">
                            裝等: {equipLevel}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Delete button - shows on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      className="p-2 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-900/30 transition-all opacity-0 group-hover:opacity-100"
                      title="刪除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p className="text-sm">尚無物品</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs text-gray-400">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={handleClearAll}
              disabled={items.length === 0}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                ${items.length === 0
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600/30 hover:bg-red-600/50 border border-red-500/30 text-red-300'
                }
              `}
            >
              清空清單
            </button>
            <button
              onClick={handleBuildTree}
              disabled={items.length === 0}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                ${items.length === 0
                  ? 'bg-slate-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-ffxiv-gold/30 hover:bg-ffxiv-gold/50 border border-ffxiv-gold/50 text-ffxiv-gold'
                }
              `}
            >
              生成組合樹
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearConfirm(false);
          }}
        >
          <div 
            className="bg-slate-800 rounded-lg border border-red-500/50 shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-white mb-1">確認清空</h4>
                <p className="text-sm text-gray-300">確定要清除所有物品嗎？此操作無法復原。</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-gray-300 hover:text-white transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={confirmClearAll}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600/50 hover:bg-red-600 border border-red-500/50 text-red-200 hover:text-white transition-all duration-200"
              >
                確定清空
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
