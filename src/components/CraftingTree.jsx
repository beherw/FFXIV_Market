// Crafting Tree component - displays a vertical crafting price tree
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ItemImage from './ItemImage';
import { getItemById } from '../services/itemDatabase';
import { getAggregatedMarketData } from '../services/universalis';

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
  isHighlighted = false,
  highlightMethod = null, // 'craft' or 'buy'
}) {
  return (
    <div 
      ref={nodeRef}
      className={`
        flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all duration-200
        ${isRoot 
          ? 'bg-gradient-to-br from-ffxiv-gold/20 to-yellow-500/10 border-2 border-ffxiv-gold/50 hover:border-ffxiv-gold min-w-[120px]' 
          : isHighlighted
            ? highlightMethod === 'craft'
              ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/30 border-2 border-green-500/60 hover:border-green-400 min-w-[100px] shadow-[0_0_10px_rgba(34,197,94,0.2)]'
              : 'bg-gradient-to-br from-blue-900/40 to-cyan-900/30 border-2 border-blue-500/60 hover:border-blue-400 min-w-[100px] shadow-[0_0_10px_rgba(59,130,246,0.2)]'
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
      <div className={`mt-1 text-center ${priceInfo?.worldName ? 'h-[32px]' : 'h-[20px]'} flex flex-col justify-center`}>
        {isLoading ? (
          <div className="text-xs text-gray-500 animate-pulse">載入中...</div>
        ) : priceInfo ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-xs font-semibold ${priceInfo.isHQ ? 'text-yellow-400' : 'text-green-400'}`}>
              {priceInfo.isHQ ? '⭐ ' : ''}{priceInfo.price.toLocaleString()}
            </span>
            {priceInfo.worldName && (
              <span className="text-[10px] text-gray-500 truncate max-w-[80px]" title={priceInfo.worldName}>
                {priceInfo.worldName}
              </span>
            )}
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
 * Recursively calculate the cheapest cost to obtain an item
 * For each node: min(market price, sum of children's cheapest costs × amounts)
 */
function getCheapestCost(node, itemPrices, queriedItemIds) {
  const priceInfo = itemPrices[node.itemId];
  const marketPrice = priceInfo?.price ?? null;
  const hasChildren = node.children && node.children.length > 0;
  
  // Leaf node - only option is market price
  if (!hasChildren) {
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
  
  // Calculate crafting cost (sum of children's cheapest costs × amounts)
  let craftingCost = 0;
  let allChildrenHaveCost = true;
  const childBreakdown = [];
  
  for (const child of node.children) {
    const childResult = getCheapestCost(child, itemPrices, queriedItemIds);
    if (childResult.cost !== null) {
      const childTotal = childResult.cost * child.amount;
      craftingCost += childTotal;
      childBreakdown.push({
        itemId: child.itemId,
        amount: child.amount,
        unitCost: childResult.cost,
        totalCost: childTotal,
        method: childResult.method,
      });
    } else {
      allChildrenHaveCost = false;
      break;
    }
  }
  
  // If we can't calculate crafting cost, use market price
  if (!allChildrenHaveCost) {
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
  
  // Return the cheaper option
  if (marketPrice === null) {
    return { cost: craftingCost, method: 'craft', breakdown: childBreakdown };
  }
  
  if (craftingCost < marketPrice) {
    return { cost: craftingCost, method: 'craft', breakdown: childBreakdown };
  } else {
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
}

/**
 * Build a map of optimal methods for each node in the tree
 * Used to highlight the optimal crafting path
 */
function buildOptimalPathMap(node, itemPrices, queriedItemIds, pathMap = new Map()) {
  const result = getCheapestCost(node, itemPrices, queriedItemIds);
  pathMap.set(node.itemId, result.method);
  
  // If this node's optimal method is 'craft', recurse into children
  // If 'buy', don't recurse - children are not part of the optimal path
  if (result.method === 'craft' && node.children) {
    for (const child of node.children) {
      buildOptimalPathMap(child, itemPrices, queriedItemIds, pathMap);
    }
  }
  
  return pathMap;
}

/**
 * Root item price comparison badge - uses cheapest route calculation
 * Compares: main item market price vs optimal crafting route (cheapest for each sub-item)
 */
function RootPriceComparisonBadge({ tree, itemPrices, queriedItemIds, itemNames }) {
  // Calculate cheapest route for the root's children
  const result = useMemo(() => {
    if (!tree || !tree.children || tree.children.length === 0) return null;
    
    // Wait for all children to be queried
    let allChildrenQueried = true;
    for (const child of tree.children) {
      if (!queriedItemIds.has(child.itemId)) {
        // Still loading
        allChildrenQueried = false;
        break;
      }
    }
    
    if (!allChildrenQueried) return null;
    
    // Use getCheapestCost to check if we can craft the root item
    const rootResult = getCheapestCost(tree, itemPrices, queriedItemIds);
    
    // If we can't calculate a cost, the path is incomplete
    if (rootResult.cost === null) {
      return { canCraft: false };
    }
    
    const rootPrice = itemPrices[tree.itemId]?.price ?? null;
    const cheapestRouteCost = rootResult.cost;
    
    // If root has no price, but we can craft it, show crafting cost
    if (rootPrice === null) {
      if (rootResult.method === 'craft') {
        return {
          rootPrice: null,
          cheapestRouteCost,
          canCraft: true,
          isCraftOnly: true,
        };
      }
      return { canCraft: false };
    }
    
    // Root has price - compare with crafting cost
    return {
      rootPrice,
      cheapestRouteCost,
      savings: rootPrice - cheapestRouteCost,
      canCraft: true,
      isCraftOnly: false,
    };
  }, [tree, itemPrices, queriedItemIds]);
  
  if (!result || !result.canCraft) return null;
  
  // If root has no price but can be crafted, show crafting cost only
  if (result.isCraftOnly) {
    return (
      <div className="px-4 py-2.5 rounded-lg text-sm font-medium bg-green-900/50 border border-green-500/40 text-green-300">
        <div className="flex flex-col items-center gap-1">
          {/* Explanation */}
          <div className="text-xs opacity-70 text-center">
            以最優路線計算（每項材料取買/製的較低價）
          </div>
          {/* Price display */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold">自製最佳: {result.cheapestRouteCost.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Root has price - show comparison
  const { rootPrice, cheapestRouteCost, savings } = result;
  const isCraftCheaper = savings > 0;
  const absSavings = Math.abs(savings);
  
  if (absSavings === 0) {
    return (
      <div className="px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-500/30 text-sm text-gray-400">
        價格相同
      </div>
    );
  }
  
  return (
    <div 
      className={`
        px-4 py-2.5 rounded-lg text-sm font-medium
        ${isCraftCheaper 
          ? 'bg-green-900/50 border border-green-500/40 text-green-300' 
          : 'bg-red-900/50 border border-red-500/40 text-red-300'
        }
      `}
    >
      <div className="flex flex-col items-center gap-1">
        {/* Explanation */}
        <div className="text-xs opacity-70 text-center">
          以最優路線計算（每項材料取買/製的較低價）
        </div>
        {/* Price breakdown */}
        <div className="flex items-center gap-2 text-sm">
          <span>最優製作: {cheapestRouteCost.toLocaleString()}</span>
          <span className="opacity-60">vs</span>
          <span>直購成品: {rootPrice.toLocaleString()}</span>
        </div>
        {/* Recommendation */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {isCraftCheaper ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold">建議自製，省 {absSavings.toLocaleString()}</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold">建議直購，省 {absSavings.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Price comparison badge component for non-root items
 * Compares: parent item TOTAL market price (unit × amount) vs sum of children material costs
 * - If materials cost < parent price: recommend crafting (buy materials, craft yourself)
 * - If materials cost > parent price: recommend buying the finished item directly
 */
function PriceComparisonBadge({ parentPrice, childrenTotalPrice, isReady, amount = 1 }) {
  if (!isReady || parentPrice === null || childrenTotalPrice === null) {
    return null;
  }

  // parentPrice = cost to buy finished item directly
  // childrenTotalPrice = cost to buy all materials (sum of child price * amount)
  const savings = parentPrice - childrenTotalPrice;
  const isCraftCheaper = savings > 0; // materials cost less than finished item
  const absSavings = Math.abs(savings);

  if (absSavings === 0) {
    return (
      <div className="px-2 py-1 rounded-lg bg-gray-700/50 border border-gray-500/30 text-xs text-gray-400">
        價格相同
      </div>
    );
  }

  return (
    <div 
      className={`
        px-3 py-1.5 rounded-lg text-xs font-medium
        ${isCraftCheaper 
          ? 'bg-green-900/50 border border-green-500/40 text-green-300' 
          : 'bg-red-900/50 border border-red-500/40 text-red-300'
        }
      `}
    >
      <div className="flex flex-col items-center gap-0.5">
        {/* Price breakdown */}
        <div className="flex items-center gap-2 text-xs opacity-80">
          <span>材料: {childrenTotalPrice.toLocaleString()}</span>
          <span>vs</span>
          <span>{amount > 1 ? `${amount}個` : ''}成品: {parentPrice.toLocaleString()}</span>
        </div>
        {/* Recommendation */}
        <div className="flex items-center gap-1.5">
          {isCraftCheaper ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold">自製省 {absSavings.toLocaleString()}</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold">直購省 {absSavings.toLocaleString()}</span>
            </>
          )}
        </div>
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
  optimalPathMap = null,
  isCraftingCheaper = false,
}) {
  const childrenRef = useRef(null);
  const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
  const hasChildren = node.children && node.children.length > 0;
  const itemName = itemNames[node.itemId] || `物品 ${node.itemId}`;
  const priceInfo = itemPrices[node.itemId];
  const isPriceQueried = queriedItemIds.has(node.itemId);
  
  // Determine if this node is on the optimal path and should be highlighted
  const optimalMethod = optimalPathMap?.get(node.itemId);
  const isOnOptimalPath = isCraftingCheaper && optimalMethod !== undefined;
  const shouldHighlightChildren = isOnOptimalPath && optimalMethod === 'craft';

  // Calculate children total price (considering amounts)
  const childrenTotalPrice = useMemo(() => {
    if (!hasChildren) return null;
    
    let total = 0;
    let allPricesAvailable = true;
    
    for (const child of node.children) {
      const childPrice = itemPrices[child.itemId];
      if (childPrice && childPrice.price !== undefined) {
        total += childPrice.price * child.amount;
      } else if (queriedItemIds.has(child.itemId)) {
        // Price was queried but no result - treat as 0 or skip
        // For now, we'll still calculate but this item has no market price
      } else {
        allPricesAvailable = false;
      }
    }
    
    return allPricesAvailable ? total : null;
  }, [hasChildren, node.children, itemPrices, queriedItemIds]);

  // Check if comparison is ready (parent and all children prices loaded)
  const isComparisonReady = useMemo(() => {
    if (!hasChildren) return false;
    if (!priceInfo || priceInfo.price === undefined) return false;
    if (childrenTotalPrice === null) return false;
    return true;
  }, [hasChildren, priceInfo, childrenTotalPrice]);

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

  // Connector line styles based on highlighting
  const lineColor = shouldHighlightChildren ? 'bg-green-400' : 'bg-purple-500/50';
  const lineWidth = shouldHighlightChildren ? 'w-0.5' : 'w-px';
  const lineGlow = shouldHighlightChildren ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : '';

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
        isHighlighted={isOnOptimalPath && !isRoot}
        highlightMethod={optimalMethod}
      />
      
      {/* Children */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down from parent */}
          <div className={`${lineWidth} h-4 ${lineColor} ${lineGlow}`}></div>
          
          {/* Price comparison badge - Root uses cheapest route, others use direct comparison */}
          {isRoot ? (
            <RootPriceComparisonBadge 
              tree={node}
              itemPrices={itemPrices}
              queriedItemIds={queriedItemIds}
              itemNames={itemNames}
            />
          ) : (
            <PriceComparisonBadge 
              parentPrice={priceInfo?.price ? priceInfo.price * node.amount : null}
              childrenTotalPrice={childrenTotalPrice}
              isReady={isComparisonReady}
              amount={node.amount}
            />
          )}
          
          {/* Vertical line to children */}
          <div className={`${lineWidth} h-4 ${lineColor} ${lineGlow}`}></div>
          
          {/* Children row with horizontal connector */}
          <div className="relative">
            {/* Horizontal connector bar - dynamically positioned */}
            {node.children.length > 1 && lineStyle.width > 0 && (
              <div 
                className={`absolute top-0 ${shouldHighlightChildren ? 'h-0.5' : 'h-px'} ${lineColor} ${lineGlow}`}
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
                  <div className={`${shouldHighlightChildren ? 'w-0.5 bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'w-px bg-purple-500/50'} h-4`}></div>
                  
                  {/* Recursive child */}
                  <TreeNodeVertical
                    node={child}
                    itemNames={itemNames}
                    itemPrices={itemPrices}
                    queriedItemIds={queriedItemIds}
                    onItemClick={onItemClick}
                    isLoading={isLoading}
                    optimalPathMap={optimalPathMap}
                    isCraftingCheaper={isCraftingCheaper && shouldHighlightChildren}
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
  selectedWorld,
  worlds = {},
  onItemSelect,
}) {
  const [itemNames, setItemNames] = useState({});
  const [itemPrices, setItemPrices] = useState({});
  const [queriedItemIds, setQueriedItemIds] = useState(new Set());
  const [isLoadingNames, setIsLoadingNames] = useState(true);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [error, setError] = useState(null);
  const scrollContainerRef = useRef(null);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);

  // Check if it's a DC query (not a specific server)
  const isDcQuery = useMemo(() => {
    if (!selectedServerOption) return false;
    const dcName = selectedWorld?.section;
    return selectedServerOption === dcName;
  }, [selectedServerOption, selectedWorld]);

  // Get display name for the selected server/DC
  const serverDisplayName = useMemo(() => {
    if (!selectedServerOption) return null;
    
    // Check if it's a DC (string matching DC name) or a specific world (number)
    const dcName = selectedWorld?.section;
    if (selectedServerOption === dcName) {
      // It's the DC, show with "全服搜尋"
      return `${dcName}（全服搜尋）`;
    } else if (typeof selectedServerOption === 'number' || !isNaN(Number(selectedServerOption))) {
      // It's a world ID, look up the name
      const worldId = typeof selectedServerOption === 'number' ? selectedServerOption : Number(selectedServerOption);
      return worlds[worldId] || `伺服器 ${selectedServerOption}`;
    } else {
      // It's a string but not the DC name - could be a world name
      return selectedServerOption;
    }
  }, [selectedServerOption, selectedWorld, worlds]);

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

  // Load market prices using aggregated API (faster, batch request)
  useEffect(() => {
    // Wait for worlds to be populated before fetching prices
    const worldsReady = worlds && Object.keys(worlds).length > 0;
    if (!tree || !selectedServerOption || !worldsReady) return;

    const itemIds = Array.from(getAllItemIds(tree));
    setIsLoadingPrices(true);
    setQueriedItemIds(new Set());
    setItemPrices({});
    setError(null);

    // Fetch prices for all items using aggregated API (up to 100 items at once)
    const fetchPrices = async () => {
      try {
        // Batch items into groups of 100 (API limit)
        const batches = [];
        for (let i = 0; i < itemIds.length; i += 100) {
          batches.push(itemIds.slice(i, i + 100));
        }

        // Determine the worldDcRegion to pass to API:
        // - DC selected: selectedServerOption equals DC name (string like "陸行鳥")
        // - Specific server selected: selectedServerOption is world ID (number like 4031)
        // Pass selectedServerOption directly - the Universalis API accepts both
        for (const batch of batches) {
          const batchResults = await getAggregatedMarketData(
            selectedServerOption,
            batch,
            worlds
          );

          // Update prices and queried IDs for this batch
          setItemPrices(prev => ({ ...prev, ...batchResults }));
          setQueriedItemIds(prev => new Set([...prev, ...batch]));

          // Small delay between batches if there are multiple
          if (batches.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } catch (err) {
        console.error('Failed to fetch prices:', err);
        // Mark all items as queried even on error
        setQueriedItemIds(new Set(itemIds));
      }
      
      setIsLoadingPrices(false);
    };

    fetchPrices();
  }, [tree, selectedServerOption, worlds, getAllItemIds]);

  // Handle item click - open item page in new tab
  const handleItemClick = useCallback((itemId) => {
    if (onItemSelect) {
      // Use the callback if provided
      getItemById(itemId).then(item => {
        if (item) {
          onItemSelect(item);
        } else {
          // Open in new tab
          const url = `${window.location.origin}/item/${itemId}`;
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    } else {
      // Open in new tab
      const url = `${window.location.origin}/item/${itemId}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [onItemSelect]);

  // Check if horizontal scroll is needed
  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const hasScroll = container.scrollWidth > container.clientWidth;
        setHasHorizontalScroll(hasScroll);
      }
    };

    checkScroll();
    // Check on resize and content changes
    const resizeObserver = new ResizeObserver(checkScroll);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    // Also check periodically in case content loads asynchronously
    const intervalId = setInterval(checkScroll, 500);

    return () => {
      resizeObserver.disconnect();
      clearInterval(intervalId);
    };
  }, [tree, itemNames, itemPrices]);

  // Handle drag to scroll
  const handleMouseDown = useCallback((e) => {
    if (!scrollContainerRef.current || !hasHorizontalScroll) return;
    
    // Only start drag if clicking on empty space (not on interactive elements)
    const target = e.target;
    // Check if clicking on interactive elements or their children
    if (
      target.closest('button, a, [data-item-id], img, svg, path') ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'IMG' ||
      target.tagName === 'SVG' ||
      target.tagName === 'PATH' ||
      target.closest('.cursor-pointer')
    ) {
      return;
    }

    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartScrollLeft(scrollContainerRef.current.scrollLeft);
    e.preventDefault();
    e.stopPropagation();
  }, [hasHorizontalScroll]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    
    const deltaX = e.clientX - dragStartX;
    scrollContainerRef.current.scrollLeft = dragStartScrollLeft - deltaX;
    e.preventDefault();
    e.stopPropagation();
  }, [isDragging, dragStartX, dragStartScrollLeft]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleDragMove, handleMouseUp]);

  // Calculate optimal path for highlighting
  const { optimalPathMap, isCraftingCheaper } = useMemo(() => {
    if (!tree || isLoadingPrices || Object.keys(itemPrices).length === 0) {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // If no children, can't craft
    if (!tree.children || tree.children.length === 0) {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // Wait for all children to be queried
    for (const child of tree.children) {
      if (!queriedItemIds.has(child.itemId)) {
        // Still loading
        return { optimalPathMap: null, isCraftingCheaper: false };
      }
    }
    
    // Calculate cheapest route cost for the root item using getCheapestCost
    // This will recursively check if we can craft the item through the tree
    const rootResult = getCheapestCost(tree, itemPrices, queriedItemIds);
    
    // If we can't calculate a cost (null), it means the path is incomplete
    if (rootResult.cost === null) {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    const rootPrice = itemPrices[tree.itemId]?.price ?? null;
    
    // If root has no price, but we can craft it (cost is not null), show the crafting path
    if (rootPrice === null) {
      // Only show path if the optimal method is 'craft' (meaning we can craft it)
      if (rootResult.method === 'craft') {
        const pathMap = buildOptimalPathMap(tree, itemPrices, queriedItemIds);
        return { optimalPathMap: pathMap, isCraftingCheaper: true };
      }
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // If root has price, compare with crafting cost
    const cheapestRouteCost = rootResult.cost;
    const craftingIsCheaper = cheapestRouteCost < rootPrice;
    
    // Only highlight if crafting is cheaper than buying
    if (!craftingIsCheaper) {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // Build the optimal path map for highlighting
    const pathMap = buildOptimalPathMap(tree, itemPrices, queriedItemIds);
    
    return { optimalPathMap: pathMap, isCraftingCheaper: true };
  }, [tree, itemPrices, queriedItemIds, isLoadingPrices]);

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
        <div className="flex items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            製作價格樹
          </h3>
          {/* Server/DC info badge with price type note */}
          {selectedServerOption && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-900/40 border border-purple-500/30 text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-purple-300">{serverDisplayName}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-400">{isDcQuery ? '最低價' : '平均價格'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Daily Sale Velocity for root item */}
          {!isLoadingPrices && tree && itemPrices[tree.itemId] && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-600/40 text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-gray-400">日均銷量:</span>
              {itemPrices[tree.itemId].velocityWorld !== undefined && (
                <span className="text-cyan-300" title="單服日均銷量">
                  單服 {itemPrices[tree.itemId].velocityWorld.toFixed(1)}
                </span>
              )}
              {itemPrices[tree.itemId].velocityWorld !== undefined && itemPrices[tree.itemId].velocityDc !== undefined && (
                <span className="text-gray-500">/</span>
              )}
              {itemPrices[tree.itemId].velocityDc !== undefined && (
                <span className="text-emerald-300" title="全服日均銷量">
                  全服 {itemPrices[tree.itemId].velocityDc.toFixed(1)}
                </span>
              )}
            </div>
          )}
          {isLoadingPrices && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-ffxiv-gold"></div>
              載入價格中...
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-900/30 border border-red-500/30 rounded text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tree display - vertical with horizontal scroll */}
      <div 
        ref={scrollContainerRef}
        className={`overflow-x-auto pb-2 relative ${hasHorizontalScroll && !isDragging ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={() => {
          // Reset dragging state when mouse leaves
          if (isDragging) {
            setIsDragging(false);
          }
        }}
      >
        <div className="flex justify-center min-w-min py-2">
          <TreeNodeVertical
            node={tree}
            itemNames={itemNames}
            itemPrices={itemPrices}
            queriedItemIds={queriedItemIds}
            onItemClick={handleItemClick}
            isRoot={true}
            isLoading={isLoadingNames}
            optimalPathMap={optimalPathMap}
            isCraftingCheaper={isCraftingCheaper}
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
        {isCraftingCheaper && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-green-900/40 to-emerald-900/30 border-2 border-green-500/60"></div>
              <span className="text-green-400">最優路線(製作)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-900/40 to-cyan-900/30 border-2 border-blue-500/60"></div>
              <span className="text-blue-400">最優路線(購買)</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-green-400 font-semibold">價格</span>
          <span>= NQ{isDcQuery ? '最低價' : '平均價'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-yellow-400 font-semibold">⭐ 價格</span>
          <span>= HQ{isDcQuery ? '最低價' : '平均價'}</span>
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
