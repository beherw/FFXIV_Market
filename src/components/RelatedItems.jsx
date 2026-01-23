// Related Items component - shows items that use the current item as an ingredient
import { useState, useEffect } from 'react';
import { findRelatedItems } from '../services/recipeDatabase';
import { getItemById } from '../services/itemDatabase';
import { getInternalUrl } from '../utils/internalUrl.js';
import ItemImage from './ItemImage';

export default function RelatedItems({ itemId, onItemClick }) {
  const [relatedItemIds, setRelatedItemIds] = useState([]);
  const [relatedItems, setRelatedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Find related items when itemId changes
  useEffect(() => {
    if (!itemId) {
      setRelatedItemIds([]);
      setRelatedItems([]);
      return;
    }

    setIsLoading(true);
    findRelatedItems(itemId)
      .then(ids => {
        setRelatedItemIds(ids);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to find related items:', error);
        setRelatedItemIds([]);
        setIsLoading(false);
      });
  }, [itemId]);

  // Load item details for related items
  useEffect(() => {
    if (relatedItemIds.length === 0) {
      setRelatedItems([]);
      return;
    }

    Promise.all(
      relatedItemIds.map(async (id) => {
        try {
          const item = await getItemById(id);
          return item ? { id, name: item.name } : null;
        } catch (error) {
          console.error(`Failed to load item ${id}:`, error);
          return null;
        }
      })
    )
      .then(items => {
        setRelatedItems(items.filter(item => item !== null));
      })
      .catch(error => {
        console.error('Failed to load related items:', error);
        setRelatedItems([]);
      });
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
    <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            相關物品
          </h3>
          {!isLoading && relatedItemIds.length > 0 && (
            <span className="text-xs text-gray-400 bg-purple-900/40 px-2 py-1 rounded border border-purple-500/30">
              {relatedItemIds.length} 個
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {relatedItems.map((item) => (
            <button
              key={item.id}
              onClick={(e) => {
                e.preventDefault();
                // Open in new tab
                const url = `${window.location.origin}${getInternalUrl(`/item/${item.id}`)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-800/60 border border-purple-500/30 hover:border-ffxiv-gold/60 hover:bg-slate-700/70 transition-all duration-200 group"
            >
              {/* Item Image */}
              <ItemImage
                itemId={item.id}
                alt={item.name}
                className="w-12 h-12 object-contain rounded border border-purple-500/30 group-hover:border-ffxiv-gold/60 transition-colors duration-200"
              />
              
              {/* Item name */}
              <span className="text-xs text-gray-300 group-hover:text-ffxiv-gold text-center line-clamp-2 transition-colors duration-200" title={item.name}>
                {item.name}
              </span>
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
