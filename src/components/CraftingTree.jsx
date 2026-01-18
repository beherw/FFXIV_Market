// Crafting Tree component - displays a vertical crafting price tree
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemImage from './ItemImage';
import { getItemById } from '../services/itemDatabase';
import { getMarketData } from '../services/universalis';

/**
 * Copy button component
 */
function CopyButton({ text, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        p-0.5 rounded transition-all duration-200 flex-shrink-0
        ${copied 
          ? 'text-green-400' 
          : 'text-gray-500 hover:text-ffxiv-gold hover:bg-purple-800/40'
        }
      `}
      title={copied ? '已複製' : '複製名稱'}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Single item card component
 */
function ItemCard({ 
  node, 
  itemName, 
  priceInfo, 
  onItemClick, 
  isRoot = false,
  isLoading = false,
  isPriceQueried = false,
  nodeRef,
}) {
  return (
    <div 
      ref={nodeRef}
      className={`
        flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all duration-200
        ${isRoot 
          ? 'bg-gradient-to-br from-ffxiv-gold/20 to-yellow-500/10 border-2 border-ffxiv-gold/50 hover:border-ffxiv-gold min-w-[120px]' 
          : 'bg-slate-800/60 border border-purple-500/30 hover:border-purple-400/60 hover:bg-slate-700/60 min-w-[100px]'
        }
      `}
      onClick={() => onItemClick(node.itemId)}
      title={`查看 ${itemName}`}
    >
      {/* Item Image */}
      <div className="relative">
        <ItemImage
          itemId={node.itemId}
          alt={itemName}
          className={`${isRoot ? 'w-12 h-12' : 'w-9 h-9'} object-contain rounded border border-purple-500/30`}
          priority={isRoot}
        />
        {/* Quantity badge - don't show for root */}
        {!isRoot && node.amount > 1 && (
          <div className="absolute -bottom-1 -right-1 bg-purple-900/90 text-ffxiv-gold text-xs font-bold px-1 py-0.5 rounded-full border border-purple-500/50 min-w-[18px] text-center leading-none">
            {node.amount}
          </div>
        )}
      </div>
      
      {/* Item name with copy button */}
      <div className={`mt-1.5 flex items-center gap-0.5 max-w-[100px] ${isRoot ? 'max-w-[120px]' : ''}`}>
        <p 
          className={`${isRoot ? 'text-xs font-semibold text-ffxiv-gold' : 'text-xs text-gray-300'} truncate flex-1`} 
          title={itemName}
        >
          {itemName}
        </p>
        <CopyButton text={itemName} />
      </div>
      
      {/* Price info - fixed height to prevent layout shift */}
      <div className="mt-1 text-center h-[30px] flex flex-col justify-center">
        {isLoading ? (
          <div className="text-xs text-gray-500 animate-pulse">載入中...</div>
        ) : priceInfo ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-semibold text-green-400">
              {priceInfo.price.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 truncate max-w-[80px]" title={priceInfo.worldName}>
              {priceInfo.worldName}
            </span>
          </div>
        ) : isPriceQueried ? (
          <span className="text-xs text-gray-500">無價格</span>
        ) : (
          <div className="text-xs text-gray-500 animate-pulse">查詢中...</div>
        )}
      </div>
    </div>
  );
}

/**
 * Recursive tree node with vertical layout
 */
function TreeNodeVertical({
  node,
  itemNames,
  itemPrices,
  queriedItemIds,
  onItemClick,
  isRoot = false,
  isLoading = false,
}) {
  const childrenRef = useRef(null);
  const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
  const hasChildren = node.children && node.children.length > 0;
  const itemName = itemNames[node.itemId] || `物品 ${node.itemId}`;
  const priceInfo = itemPrices[node.itemId];
  const isPriceQueried = queriedItemIds.has(node.itemId);

  // Calculate horizontal line position
  const calculateLinePosition = useCallback(() => {
    if (hasChildren && node.children.length > 1 && childrenRef.current) {
      const container = childrenRef.current;
      const children = container.children;
      if (children.length >= 2) {
        const firstChild = children[0];
        const lastChild = children[children.length - 1];
        const containerRect = container.getBoundingClientRect();
        const firstRect = firstChild.getBoundingClientRect();
        const lastRect = lastChild.getBoundingClientRect();
        
        // Calculate from center of first child to center of last child
        const left = (firstRect.left + firstRect.width / 2) - containerRect.left;
        const right = (lastRect.left + lastRect.width / 2) - containerRect.left;
        
        if (right - left > 0) {
          setLineStyle({
            left: left,
            width: right - left,
          });
        }
      }
    }
  }, [hasChildren, node.children?.length]);

  // Calculate on mount and when content changes
  useEffect(() => {
    // Initial calculation with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(calculateLinePosition, 50);
    
    // Set up ResizeObserver to recalculate when children resize
    let resizeObserver;
    if (childrenRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        calculateLinePosition();
      });
      resizeObserver.observe(childrenRef.current);
    }
    
    return () => {
      clearTimeout(timeoutId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [calculateLinePosition, itemNames, itemPrices]);

  return (
    <div className="flex flex-col items-center">
      {/* Current node */}
      <ItemCard
        node={node}
        itemName={itemName}
        priceInfo={priceInfo}
        onItemClick={onItemClick}
        isRoot={isRoot}
        isLoading={isLoading}
        isPriceQueried={isPriceQueried}
      />
      
      {/* Children */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down from parent */}
          <div className="w-px h-4 bg-purple-500/50"></div>
          
          {/* Children row with horizontal connector */}
          <div className="relative">
            {/* Horizontal connector bar - dynamically positioned */}
            {node.children.length > 1 && lineStyle.width > 0 && (
              <div 
                className="absolute top-0 h-px bg-purple-500/50"
                style={{
                  left: `${lineStyle.left}px`,
                  width: `${lineStyle.width}px`,
                }}
              ></div>
            )}
            
            {/* Children */}
            <div ref={childrenRef} className="flex gap-3 items-start">
              {node.children.map((child, index) => (
                <div key={`${child.itemId}-${index}`} className="flex flex-col items-center">
                  {/* Vertical line down to child */}
                  <div className="w-px h-4 bg-purple-500/50"></div>
                  
                  {/* Recursive child */}
                  <TreeNodeVertical
                    node={child}
                    itemNames={itemNames}
                    itemPrices={itemPrices}
                    queriedItemIds={queriedItemIds}
                    onItemClick={onItemClick}
                    isLoading={isLoading}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main CraftingTree component
 */
export default function CraftingTree({ 
  tree, 
  selectedServerOption,
  onItemSelect,
}) {
  const navigate = useNavigate();
  const [itemNames, setItemNames] = useState({});
  const [itemPrices, setItemPrices] = useState({});
  const [queriedItemIds, setQueriedItemIds] = useState(new Set());
  const [isLoadingNames, setIsLoadingNames] = useState(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [error, setError] = useState(null);

  // Get all unique item IDs from tree
  const getAllItemIds = useCallback((node, ids = new Set()) => {
    if (!node) return ids;
    ids.add(node.itemId);
    if (node.children) {
      node.children.forEach(child => getAllItemIds(child, ids));
    }
    return ids;
  }, []);

  // Load item names
  useEffect(() => {
    if (!tree) return;

    const itemIds = Array.from(getAllItemIds(tree));
    setIsLoadingNames(true);

    Promise.all(
      itemIds.map(async (id) => {
        const item = await getItemById(id);
        return { id, name: item?.name || `物品 ${id}` };
      })
    )
      .then((results) => {
        const names = {};
        results.forEach(({ id, name }) => {
          names[id] = name;
        });
        setItemNames(names);
        setIsLoadingNames(false);
      })
      .catch((err) => {
        console.error('Failed to load item names:', err);
        setError('載入物品名稱失敗');
        setIsLoadingNames(false);
      });
  }, [tree, getAllItemIds]);

  // Load market prices
  useEffect(() => {
    if (!tree || !selectedServerOption) return;

    const itemIds = Array.from(getAllItemIds(tree));
    setIsLoadingPrices(true);
    setQueriedItemIds(new Set());
    setItemPrices({});
    setError(null);

    // Fetch prices for all items (with some delay to avoid rate limiting)
    const fetchPrices = async () => {
      const prices = {};
      
      // Batch fetch with delays to avoid rate limiting
      for (let i = 0; i < itemIds.length; i++) {
        const id = itemIds[i];
        try {
          const data = await getMarketData(selectedServerOption, id, {
            listings: 1,
            entries: 0,
          });
          
          if (data && data.listings && data.listings.length > 0) {
            // Get the cheapest listing
            const cheapestListing = data.listings
              .sort((a, b) => a.pricePerUnit - b.pricePerUnit)[0];
            
            prices[id] = {
              price: cheapestListing.pricePerUnit,
              worldName: cheapestListing.worldName || data.worldName || selectedServerOption,
            };
          }
          
          // Update state incrementally for better UX
          setItemPrices(prev => ({ ...prev, [id]: prices[id] }));
          // Mark this item as queried
          setQueriedItemIds(prev => new Set([...prev, id]));
          
          // Small delay between requests to avoid rate limiting
          if (i < itemIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (err) {
          console.error(`Failed to fetch price for item ${id}:`, err);
          // Mark as queried even on error
          setQueriedItemIds(prev => new Set([...prev, id]));
          // Continue with other items even if one fails
        }
      }
      
      setIsLoadingPrices(false);
    };

    fetchPrices();
  }, [tree, selectedServerOption, getAllItemIds]);

  // Handle item click - navigate to item page
  const handleItemClick = useCallback((itemId) => {
    if (onItemSelect) {
      // Use the callback if provided
      getItemById(itemId).then(item => {
        if (item) {
          onItemSelect(item);
        } else {
          navigate(`/item/${itemId}`);
        }
      });
    } else {
      navigate(`/item/${itemId}`);
    }
  }, [navigate, onItemSelect]);

  if (!tree) {
    return (
      <div className="p-4 text-center text-gray-400">
        無製作配方
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          製作價格樹
        </h3>
        {isLoadingPrices && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ffxiv-gold"></div>
            載入價格中...
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900/30 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tree display - vertical with horizontal scroll */}
      <div className="overflow-x-auto pb-2">
        <div className="flex justify-center min-w-min py-2">
          <TreeNodeVertical
            node={tree}
            itemNames={itemNames}
            itemPrices={itemPrices}
            queriedItemIds={queriedItemIds}
            onItemClick={handleItemClick}
            isRoot={true}
            isLoading={isLoadingNames}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-purple-500/20 flex flex-wrap gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-ffxiv-gold/20 to-yellow-500/10 border border-ffxiv-gold/50"></div>
          <span>成品</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-800/60 border border-purple-500/30"></div>
          <span>材料</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-green-400 font-semibold">價格</span>
          <span>= 市場最低價</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>= 複製名稱</span>
        </div>
      </div>
    </div>
  );
}
