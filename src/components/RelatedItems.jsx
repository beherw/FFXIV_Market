// Related Items component - shows items that use the current item as an ingredient
import { useState, useEffect } from 'react';
import { findRelatedItems } from '../services/recipeDatabase';
import { getItemById } from '../services/itemDatabase';
import { getInternalUrl } from '../utils/internalUrl.js';
import { generateItemUrl } from '../utils/urlSlug';
import ItemImage from './ItemImage';

export default function RelatedItems({ itemId, relatedItemIds: providedRelatedItemIds, onItemClick, compact = false }) {
  const [relatedItemIds, setRelatedItemIds] = useState(providedRelatedItemIds || []);
  const [relatedItems, setRelatedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Find related items when itemId changes
  useEffect(() => {
    // The item page can pass its already-loaded result to avoid querying the
    // recipe database a second time (for example from the crafting simulator).
    if (Array.isArray(providedRelatedItemIds)) {
      setRelatedItemIds(providedRelatedItemIds);
      setIsLoading(false);
      return undefined;
    }

    if (!itemId) {
      setRelatedItemIds([]);
      setRelatedItems([]);
      return;
    }

    setIsLoading(true);
    // findRelatedItems now handles the limit internally (optimized at database level)
    findRelatedItems(itemId, 20)
      .then(ids => {
        setRelatedItemIds(ids);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to find related items:', error);
        setRelatedItemIds([]);
        setIsLoading(false);
      });
  }, [itemId, providedRelatedItemIds]);

  // Load item details for related items (optimized - batch query instead of individual queries)
  useEffect(() => {
    if (relatedItemIds.length === 0) {
      setRelatedItems([]);
      return;
    }

    // Use batch query instead of individual queries for better performance
    (async () => {
      try {
        const { getTwItemsByIds } = await import('../services/gameData');
        const itemsData = await getTwItemsByIds(relatedItemIds);
        const items = relatedItemIds.map(id => {
          const itemData = itemsData[id];
          if (!itemData || !itemData.tw) {
            return null;
          }
          const cleanName = itemData.tw.replace(/^["']|["']$/g, '').trim();
          return { id, name: cleanName };
        }).filter(item => item !== null);
        setRelatedItems(items);
      } catch (error) {
        console.error('Failed to load related items:', error);
        setRelatedItems([]);
      }
    })();
  }, [relatedItemIds]);

  // Expose loading state and item count to parent
  useEffect(() => {
    // This will be handled by parent component
  }, [isLoading, relatedItemIds.length]);

  // Don't render if no related items (after loading completes)
  if (!isLoading && relatedItemIds.length === 0) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? 'min-w-0 overflow-hidden rounded-xl border border-purple-400/25 bg-slate-950/45 p-2.5'
          : 'rounded-lg border border-purple-500/20 bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 p-4'
      }
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
          <h3 className={`flex items-center font-semibold text-ffxiv-gold ${compact ? 'gap-1.5 text-xs' : 'gap-2 text-base sm:text-lg'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={compact ? 'h-4 w-4' : 'h-5 w-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {compact ? '可製品' : '相關物品'}
          </h3>
          {!isLoading && relatedItemIds.length > 0 && (
            <span className={`shrink-0 rounded border border-purple-500/30 bg-purple-900/40 text-gray-400 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'}`}>
              {relatedItems.length} 個
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-4 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ffxiv-gold mx-auto mb-2"></div>
          <span className="text-sm">載入中...</span>
        </div>
      )}

      {/* Related items list */}
      {!isLoading && relatedItems.length > 0 && (
        <div
          className={compact ? 'grid min-w-0 gap-2' : 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5'}
          style={compact ? { gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' } : undefined}
        >
          {relatedItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={(e) => {
                e.preventDefault();
                if (onItemClick) {
                  onItemClick(item);
                  return;
                }

                const itemUrl = generateItemUrl(item.id, item.nameTW || item.name || 'item');
                const url = `${window.location.origin}${getInternalUrl(itemUrl)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className={`group relative transition-all duration-200 ${compact
                ? 'flex min-w-0 flex-col items-center gap-1 rounded-lg border border-slate-600/60 bg-slate-900/70 px-1 py-2 hover:border-ffxiv-gold/55 hover:bg-slate-700/90'
                : 'flex flex-col items-center gap-2 rounded-lg border border-purple-500/30 bg-slate-800/60 p-3 hover:border-ffxiv-gold/60 hover:bg-slate-700/70'}`}
              title={item.name}
              aria-label={item.name}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-900/40 transition-colors duration-200 group-hover:border-ffxiv-gold/60 group-hover:bg-slate-800/80">
                <ItemImage
                  itemId={item.id}
                  alt={item.name}
                  noContainer
                  className="h-10 w-10 object-contain"
                />
              </div>

              {!compact && (
                <span className="text-xs text-gray-300 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200">
                  {item.name}
                </span>
              )}

              {compact && (
                <span className="w-full truncate px-0.5 text-center text-[10px] leading-4 text-slate-300 transition-colors group-hover:text-ffxiv-gold">
                  {item.name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state - should not show if we return null above, but just in case */}
      {!isLoading && relatedItems.length === 0 && relatedItemIds.length > 0 && (
        <div className="text-center py-4 text-gray-400 text-sm">
          載入物品資訊中...
        </div>
      )}
    </div>
  );
}
