// Crafting Tree component - displays a vertical crafting price tree
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ItemImage from './ItemImage';
import { getItemById } from '../services/itemDatabase';
import { getInternalUrl } from '../utils/internalUrl.js';
import { getAggregatedMarketData } from '../services/universalis';
import { getTwItemsByIds } from '../services/supabaseData';
import { generateItemUrl } from '../utils/urlSlug';

/**
 * Format number with rounding to integer and locale string
 */
function formatPrice(value) {
  if (value === null || value === undefined) return '0';
  return Math.round(value).toLocaleString();
}

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
 * Calculation breakdown modal component
 */
function CalculationModal({ isOpen, onClose, breakdown, itemNames, itemPrices, parentPrice, childrenTotalPrice, yields, isRoot = false, amount = 1, parentUnitPrice = null }) {
  if (!isOpen) return null;
  
  // Calculate unit price if not provided
  const unitPrice = parentUnitPrice !== null ? parentUnitPrice : (parentPrice !== null && amount > 1 ? parentPrice / amount : parentPrice);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-purple-500/50 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30">
          <h3 className="text-lg font-semibold text-ffxiv-gold">計算公式詳情</h3>
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
          {/* Materials breakdown */}
          {breakdown && breakdown.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">材料成本明細：</h4>
              <div className="space-y-2">
                {breakdown.map((item, index) => {
                  const itemName = itemNames[item.itemId] || `物品 ${item.itemId}`;
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                      <div className="flex-1">
                        <div className="text-sm text-gray-300">{itemName}</div>
                        <div className="text-xs text-gray-500">
                          {item.amount} 個 × {formatPrice(item.unitCost)} = {formatPrice(item.totalCost)}
                          {item.method === 'craft' && ' (製作)'}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-green-400">
                        {formatPrice(item.totalCost)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-purple-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">材料總成本：</span>
                  <span className="text-base font-bold text-green-400">
                    {formatPrice(breakdown.reduce((sum, item) => sum + item.totalCost, 0))}
                  </span>
                </div>
                {yields && yields > 1 && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">
                        製作產出數量：<span className="text-blue-300 font-semibold">{yields}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-gray-300">單個成本 = 總成本 ÷ 產出數量：</span>
                      <span className="text-base font-bold text-blue-400">
                        {formatPrice(breakdown.reduce((sum, item) => sum + item.totalCost, 0))} ÷ {yields} ≈ {formatPrice(breakdown.reduce((sum, item) => sum + item.totalCost, 0) / yields)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : childrenTotalPrice !== null && typeof childrenTotalPrice === 'number' ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">材料成本：</h4>
              <div className="p-2 bg-slate-700/50 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">材料總成本：</span>
                  <span className="text-base font-bold text-green-400">
                    {yields && yields > 1 
                      ? `${formatPrice(childrenTotalPrice * yields)} ÷ ${yields} ≈ ${formatPrice(childrenTotalPrice)}`
                      : formatPrice(childrenTotalPrice)
                    }
                  </span>
                </div>
                {yields && yields > 1 && (
                  <div className="mt-2 pt-2 border-t border-purple-500/20">
                    <div className="text-xs text-gray-500">
                      製作產出數量：<span className="text-blue-300 font-semibold">{yields}</span>，已納入成本考量
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Comparison */}
          {parentPrice !== null && childrenTotalPrice !== null && typeof childrenTotalPrice === 'number' && (
            <div className="pt-4 border-t border-purple-500/30">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">價格比較：</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-sm text-gray-300">製作成本{isRoot && yields && yields > 1 ? ` (已考慮產出數量=${yields})` : ''}：</span>
                  <span className="text-sm font-semibold text-green-400">
                    {yields && yields > 1 
                      ? `${formatPrice(childrenTotalPrice * yields)} ÷ ${yields} ≈ ${formatPrice(childrenTotalPrice)}`
                      : formatPrice(childrenTotalPrice)
                    }
                  </span>
                </div>
                <div className="p-2 bg-slate-700/50 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">購買成本：</span>
                  <span className="text-sm font-semibold text-yellow-400">
                    {formatPrice(parentPrice)}
                  </span>
                </div>
                {amount > 1 && unitPrice !== null && (
                  <div className="text-xs text-gray-500 mt-1">
                    單價：{formatPrice(unitPrice)} × {amount} 個 = {formatPrice(parentPrice)}
                  </div>
                )}
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded mt-2">
                  <span className="text-sm font-semibold text-gray-200">差額：</span>
                  <span className={`text-sm font-bold ${parentPrice - childrenTotalPrice > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {parentPrice > childrenTotalPrice ? '+' : ''}{formatPrice(parentPrice - childrenTotalPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
  isDcQuery = false, // Whether this is a DC query (not specific server)
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
        ) : priceInfo && priceInfo.price !== null && priceInfo.price !== undefined && priceInfo.price > 0 ? (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              {priceInfo.isHQ && (
                <span className="px-1 py-0.5 text-[10px] font-bold text-ffxiv-gold border border-ffxiv-gold/50 rounded bg-ffxiv-gold/10 cursor-default">
                  HQ
                </span>
              )}
              <span className={`text-xs font-semibold ${priceInfo.isHQ ? 'text-yellow-400' : 'text-green-400'}`}>
                {formatPrice(priceInfo.price)}
              </span>
              {/* Fallback indicator - show when using minListing for server query (fallback from average) */}
              {/* Only show for non-DC queries where average price was not available */}
              {!isDcQuery && priceInfo.priceType === 'minListing' && (
                <span 
                  className="text-[8px] text-blue-400 cursor-help" 
                  title="最近四天無銷售發生，改為用最低價格"
                >
                  ⚠
                </span>
              )}
            </div>
            {priceInfo.worldName && (
              <span className="text-[10px] text-gray-500 truncate max-w-[80px]" title={priceInfo.worldName}>
                {priceInfo.worldName}
              </span>
            )}
          </div>
        ) : isPriceQueried ? (
          <span className="text-xs text-gray-500">無販售</span>
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
 * Returns cost as: number (price), 'N/A' (missing materials), or null (not queried)
 */
function getCheapestCost(node, itemPrices, queriedItemIds) {
  const priceInfo = itemPrices[node.itemId];
  const marketPrice = priceInfo?.price ?? null;
  const hasChildren = node.children && node.children.length > 0;
  const isQueried = queriedItemIds.has(node.itemId);
  
  // Leaf node - only option is market price
  if (!hasChildren) {
    // If queried but no price, return 'N/A'
    if (isQueried && marketPrice === null) {
      return { cost: 'N/A', method: 'buy', breakdown: null };
    }
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
  
  // Check if all children have been queried
  let allChildrenQueried = true;
  for (const child of node.children) {
    if (!queriedItemIds.has(child.itemId)) {
      allChildrenQueried = false;
      break;
    }
  }
  
  // If not all children are queried, can't calculate crafting cost
  if (!allChildrenQueried) {
    // If market price is available, use it; otherwise return null (still loading)
    if (isQueried && marketPrice === null) {
      return { cost: 'N/A', method: 'buy', breakdown: null };
    }
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
  
  // Calculate crafting cost (sum of children's cheapest costs × amounts)
  let craftingCost = 0;
  let hasNAChild = false;
  const childBreakdown = [];
  
  for (const child of node.children) {
    const childResult = getCheapestCost(child, itemPrices, queriedItemIds);
    if (childResult.cost === 'N/A') {
      hasNAChild = true;
      break;
    } else if (childResult.cost !== null && typeof childResult.cost === 'number') {
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
      // Child not queried yet (shouldn't happen if allChildrenQueried is true, but handle it)
      hasNAChild = true;
      break;
    }
  }
  
  // If any child has N/A, crafting cost is N/A
  if (hasNAChild) {
    // If market price is available, use it; otherwise return N/A
    if (marketPrice !== null) {
      return { cost: marketPrice, method: 'buy', breakdown: null };
    } else if (isQueried) {
      return { cost: 'N/A', method: 'buy', breakdown: null };
    } else {
      return { cost: null, method: 'buy', breakdown: null };
    }
  }
  
  // Adjust crafting cost by yields: if yields > 1, divide by yields to get cost per unit
  // This is because one craft produces multiple items
  const yields = node.yields || 1;
  const craftingCostPerUnit = yields > 1 ? craftingCost / yields : craftingCost;
  
  // Return the cheaper option
  if (marketPrice === null) {
    if (isQueried) {
      // Market price is N/A, use crafting cost per unit
      return { cost: craftingCostPerUnit, method: 'craft', breakdown: childBreakdown, yields };
    } else {
      // Not queried yet, return null
      return { cost: null, method: 'buy', breakdown: null };
    }
  }
  
  if (craftingCostPerUnit < marketPrice) {
    return { cost: craftingCostPerUnit, method: 'craft', breakdown: childBreakdown, yields };
  } else {
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
}

/**
 * Calculate the crafting cost for a node (sum of children's cheapest costs × amounts)
 * This always returns the crafting cost, regardless of whether buying is cheaper
 * Returns: number (crafting cost), 'N/A' (missing materials), or null (not queried)
 */
function calculateCraftingCost(node, itemPrices, queriedItemIds) {
  if (!node.children || node.children.length === 0) {
    return null; // No recipe, can't craft
  }
  
  // Check if all children have been queried
  let allChildrenQueried = true;
  for (const child of node.children) {
    if (!queriedItemIds.has(child.itemId)) {
      allChildrenQueried = false;
      break;
    }
  }
  
  if (!allChildrenQueried) {
    return null; // Still loading
  }
  
  // Calculate crafting cost (sum of children's cheapest costs × amounts)
  let craftingCost = 0;
  
  for (const child of node.children) {
    const childResult = getCheapestCost(child, itemPrices, queriedItemIds);
    if (childResult.cost === 'N/A') {
      return 'N/A'; // Missing material
    } else if (childResult.cost !== null && typeof childResult.cost === 'number') {
      const childTotal = childResult.cost * child.amount;
      craftingCost += childTotal;
    } else {
      return null; // Still loading
    }
  }
  
  // Adjust crafting cost by yields: if yields > 1, divide by yields to get cost per unit
  const yields = node.yields || 1;
  return yields > 1 ? craftingCost / yields : craftingCost;
}

/**
 * Build a map of crafting methods for each node in the tree
 * Used to highlight the crafting path when crafting is cheaper
 * This function marks nodes as 'craft' if they should be crafted (have children and crafting is viable)
 * and 'buy' if they should be bought (leaf nodes or can't be crafted)
 */
function buildCraftingPathMap(node, itemPrices, queriedItemIds, pathMap = new Map()) {
  // Check if this node can be crafted (has children)
  const hasChildren = node.children && node.children.length > 0;
  
  if (!hasChildren) {
    // Leaf node - must buy
    pathMap.set(node.itemId, 'buy');
    return pathMap;
  }
  
  // Check if all children have been queried
  let allChildrenQueried = true;
  for (const child of node.children) {
    if (!queriedItemIds.has(child.itemId)) {
      allChildrenQueried = false;
      break;
    }
  }
  
  if (!allChildrenQueried) {
    // Still loading, can't determine path
    return pathMap;
  }
  
  // Calculate crafting cost for this node using calculateCraftingCost
  // This always returns the crafting cost, not the market price
  const craftingCost = calculateCraftingCost(node, itemPrices, queriedItemIds);
  
  // Check if we can calculate crafting cost
  if (craftingCost === null || craftingCost === 'N/A') {
    // Can't craft - mark as buy
    pathMap.set(node.itemId, 'buy');
    return pathMap;
  }
  
  // Get market price
  const marketPrice = itemPrices[node.itemId]?.price ?? null;
  
  // If we can craft and (no market price OR crafting is cheaper), mark as craft
  if (typeof craftingCost === 'number' && (marketPrice === null || craftingCost < marketPrice)) {
    pathMap.set(node.itemId, 'craft');
    // Recurse into children to mark them as well
    for (const child of node.children) {
      buildCraftingPathMap(child, itemPrices, queriedItemIds, pathMap);
    }
  } else {
    // Can't craft or buying is cheaper - mark as buy
    pathMap.set(node.itemId, 'buy');
  }
  
  return pathMap;
}

/**
 * Root item price comparison badge - uses cheapest route calculation
 * Compares: main item market price vs optimal crafting route (cheapest for each sub-item)
 */
function RootPriceComparisonBadge({ tree, itemPrices, queriedItemIds, itemNames }) {
  const [showModal, setShowModal] = useState(false);
  
  // Get root unit price and amount
  const rootUnitPrice = itemPrices[tree.itemId]?.price ?? null;
  const rootAmount = tree.amount || 1;
  
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
    
    // Check if root item has been queried
    const rootQueried = queriedItemIds.has(tree.itemId);
    if (!rootQueried) {
      return null; // Still loading
    }
    
    // Get cheapest cost with breakdown
    const cheapestResult = getCheapestCost(tree, itemPrices, queriedItemIds);
    const craftingCost = calculateCraftingCost(tree, itemPrices, queriedItemIds);
    
    // If we can't calculate crafting cost (still loading), don't show badge yet
    if (craftingCost === null) {
      return null;
    }
    
    const rootPrice = itemPrices[tree.itemId]?.price ?? null;
    const cheapestRouteCost = craftingCost; // Use crafting cost, not getCheapestCost result
    const rootIsNA = rootPrice === null;
    const materialsIsNA = cheapestRouteCost === 'N/A';
    const materialsHasPrice = typeof cheapestRouteCost === 'number';
    const breakdown = cheapestResult?.breakdown || null;
    const yields = tree.yields || 1;
    
    // 材料 N/A vs 成品 N/A，資訊不足，不做比對
    if (materialsIsNA && rootIsNA) {
      return {
        canCraft: false,
        isInsufficientInfo: true,
      };
    }
    
    // 材料 N/A vs 成品 有數值，用成品
    if (materialsIsNA && rootPrice !== null) {
      return {
        rootPrice,
        cheapestRouteCost: 'N/A',
        canCraft: true,
        isMaterialsNA: true,
        isCraftOnly: false,
        breakdown,
        yields,
      };
    }
    
    // 材料有價格 vs 成品 N/A，用材料
    if (materialsHasPrice && rootIsNA) {
      // If we can calculate crafting cost, show it
      return {
        rootPrice: null,
        cheapestRouteCost,
        canCraft: true,
        isCraftOnly: true,
        breakdown,
        yields,
      };
    }
    
    // Both have prices - normal comparison
    if (materialsHasPrice && rootPrice !== null) {
      const savings = rootPrice - cheapestRouteCost;
      return {
        rootPrice,
        cheapestRouteCost,
        savings,
        canCraft: true,
        isCraftOnly: false,
        breakdown,
        yields,
      };
    }
    
    return { canCraft: false };
  }, [tree, itemPrices, queriedItemIds]);
  
  if (!result) return null;
  
  // 材料 N/A vs 成品 N/A，顯示缺乏關鍵素材且無成品購買
  if (result.isInsufficientInfo) {
    return (
      <div className="px-4 py-2.5 rounded-lg text-sm font-medium bg-orange-900/50 border border-orange-500/40 text-orange-300 w-max min-w-max">
        <div className="flex flex-col items-center gap-1 whitespace-nowrap">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-bold flex-shrink-0">該服缺乏關鍵素材且無成品購買</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (!result.canCraft) return null;
  
  // 材料 N/A vs 成品 有數值，用成品
  if (result.isMaterialsNA) {
    return (
      <>
        <div 
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-900/50 border border-blue-500/40 text-blue-300 w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowModal(true)}
          title="點擊查看計算公式"
        >
          <div className="flex flex-col items-center gap-1 whitespace-nowrap">
            {/* Explanation */}
            <div className="text-xs opacity-70 text-center whitespace-nowrap">
              以最優路線計算（每項材料取買/製的較低價）
            </div>
            {/* Price breakdown */}
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className="flex-shrink-0">最優製作: N/A</span>
              <span className="opacity-60 flex-shrink-0">vs</span>
              <span className="flex-shrink-0">直購成品: {formatPrice(result.rootPrice)}</span>
            </div>
            {/* Recommendation */}
            <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">建議直購</span>
            </div>
          </div>
        </div>
        <CalculationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          breakdown={result.breakdown}
          itemNames={itemNames}
          itemPrices={itemPrices}
          parentPrice={result.rootPrice}
          childrenTotalPrice={null}
          yields={result.yields}
          isRoot={true}
          amount={rootAmount}
          parentUnitPrice={rootUnitPrice}
        />
      </>
    );
  }
  
  // If root has no price but can be crafted, show crafting cost only
  if (result.isCraftOnly) {
    return (
      <>
        <div 
          className="px-4 py-2.5 rounded-lg text-sm font-medium bg-green-900/50 border border-green-500/40 text-green-300 w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowModal(true)}
          title="點擊查看計算公式"
        >
          <div className="flex flex-col items-center gap-1 whitespace-nowrap">
            {/* Explanation */}
            <div className="text-xs opacity-70 text-center whitespace-nowrap">
              以最優路線計算（每項材料取買/製的較低價）
            </div>
            {/* Price display */}
            <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">自製最佳: {formatPrice(result.cheapestRouteCost)}</span>
            </div>
          </div>
        </div>
        <CalculationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          breakdown={result.breakdown}
          itemNames={itemNames}
          itemPrices={itemPrices}
          parentPrice={null}
          childrenTotalPrice={result.cheapestRouteCost}
          yields={result.yields}
          isRoot={true}
          amount={rootAmount}
          parentUnitPrice={rootUnitPrice}
        />
      </>
    );
  }
  
  // Root has price - show comparison
  const { rootPrice, cheapestRouteCost, savings } = result;
  const isCraftCheaper = savings > 0;
  const absSavings = Math.abs(savings);
  
  // Use a small tolerance (1 gil) to account for floating point precision issues
  // If the difference is less than 1, consider prices equal
  if (absSavings < 1) {
    return (
      <>
        <div 
          className="px-4 py-2.5 rounded-lg bg-gray-700/50 border border-gray-500/30 text-sm text-gray-400 w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowModal(true)}
          title="點擊查看計算公式"
        >
          <div className="flex flex-col items-center gap-1 whitespace-nowrap">
            {/* Explanation */}
            <div className="text-xs opacity-70 text-center whitespace-nowrap">
              以最優路線計算（每項材料取買/製的較低價）
            </div>
            {/* Price breakdown */}
            <div className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className="flex-shrink-0">最優製作: {formatPrice(cheapestRouteCost)}</span>
              <span className="opacity-60 flex-shrink-0">vs</span>
              <span className="flex-shrink-0">直購成品: {formatPrice(rootPrice)}</span>
            </div>
            {/* Status */}
            <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">價格相同</span>
            </div>
          </div>
        </div>
        <CalculationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          breakdown={result.breakdown}
          itemNames={itemNames}
          itemPrices={itemPrices}
          parentPrice={rootPrice}
          childrenTotalPrice={cheapestRouteCost}
          yields={result.yields}
          isRoot={true}
          amount={rootAmount}
          parentUnitPrice={rootUnitPrice}
        />
      </>
    );
  }
  
  return (
    <>
      <div 
        className={`
          px-4 py-2.5 rounded-lg text-sm font-medium w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity
          ${isCraftCheaper 
            ? 'bg-green-900/50 border border-green-500/40 text-green-300' 
            : 'bg-red-900/50 border border-red-500/40 text-red-300'
          }
        `}
        onClick={() => setShowModal(true)}
        title="點擊查看計算公式"
      >
        <div className="flex flex-col items-center gap-1 whitespace-nowrap">
          {/* Explanation */}
          <div className="text-xs opacity-70 text-center whitespace-nowrap">
            以最優路線計算（每項材料取買/製的較低價）
          </div>
          {/* Price breakdown */}
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <span className="flex-shrink-0">最優製作: {formatPrice(cheapestRouteCost)}</span>
            <span className="opacity-60 flex-shrink-0">vs</span>
            <span className="flex-shrink-0">直購成品: {formatPrice(rootPrice)}</span>
          </div>
          {/* Recommendation */}
          <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
            {isCraftCheaper ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold flex-shrink-0">建議自製，省 {formatPrice(absSavings)}</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-bold flex-shrink-0">建議直購，省 {formatPrice(absSavings)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <CalculationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        breakdown={result.breakdown}
        itemNames={itemNames}
        itemPrices={itemPrices}
        parentPrice={rootPrice}
        childrenTotalPrice={cheapestRouteCost}
        yields={result.yields}
        isRoot={true}
      />
    </>
  );
}

/**
 * Price comparison badge component for non-root items
 * Compares: parent item TOTAL market price (unit × amount) vs sum of children material costs
 * - If materials cost < parent price: recommend crafting (buy materials, craft yourself)
 * - If materials cost > parent price: recommend buying the finished item directly
 * Handles N/A cases:
 * - 材料 N/A vs 成品 有數值，用成品
 * - 材料 N/A vs 成品 N/A，資訊不足，不做比對
 * - 材料有價格 vs 成品 N/A，用材料
 */
function PriceComparisonBadge({ parentPrice, childrenTotalPrice, isReady, amount = 1, breakdown = null, itemNames = {}, itemPrices = {}, yields = 1, parentUnitPrice = null }) {
  const [showModal, setShowModal] = useState(false);
  
  if (!isReady) {
    return null;
  }

  const parentHasPrice = parentPrice !== null && parentPrice !== undefined;
  const childrenHasPrice = childrenTotalPrice !== null && childrenTotalPrice !== 'N/A' && typeof childrenTotalPrice === 'number';
  const childrenIsNA = childrenTotalPrice === 'N/A';
  const parentIsNA = parentPrice === null || parentPrice === undefined;
  
  // Calculate unit price if not provided
  const unitPrice = parentUnitPrice !== null ? parentUnitPrice : (parentPrice !== null && amount > 1 ? parentPrice / amount : parentPrice);

  // 材料 N/A vs 成品 N/A，資訊不足，不做比對
  if (childrenIsNA && parentIsNA) {
    return (
      <div className="px-2 py-1 rounded-lg bg-gray-700/50 border border-gray-500/30 text-xs text-gray-400">
        資訊不足
      </div>
    );
  }

  // 材料 N/A vs 成品 有數值，用成品
  if (childrenIsNA && parentHasPrice) {
    return (
      <>
        <div 
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-900/50 border border-blue-500/40 text-blue-300 w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowModal(true)}
          title="點擊查看計算公式"
        >
          <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
            <div className="flex items-center gap-2 text-xs opacity-80 whitespace-nowrap">
              <span className="flex-shrink-0">材料: N/A</span>
              <span className="flex-shrink-0">vs</span>
              <span className="flex-shrink-0">{amount > 1 ? `${amount}個` : ''}成品: {formatPrice(parentPrice)}</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">建議直購</span>
            </div>
          </div>
        </div>
        <CalculationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          breakdown={breakdown}
          itemNames={itemNames}
          itemPrices={itemPrices}
          parentPrice={parentPrice}
          childrenTotalPrice={null}
          yields={yields}
          isRoot={false}
          amount={amount}
          parentUnitPrice={unitPrice}
        />
      </>
    );
  }

  // 材料有價格 vs 成品 N/A，用材料
  if (childrenHasPrice && parentIsNA) {
    return (
      <>
        <div 
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-900/50 border border-green-500/40 text-green-300 w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowModal(true)}
          title="點擊查看計算公式"
        >
          <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
            <div className="flex items-center gap-2 text-xs opacity-80 whitespace-nowrap">
              <span className="flex-shrink-0">材料: {formatPrice(childrenTotalPrice)}</span>
              <span className="flex-shrink-0">vs</span>
              <span className="flex-shrink-0">{amount > 1 ? `${amount}個` : ''}成品: N/A</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">建議自製</span>
            </div>
          </div>
        </div>
        <CalculationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          breakdown={breakdown}
          itemNames={itemNames}
          itemPrices={itemPrices}
          parentPrice={null}
          childrenTotalPrice={childrenTotalPrice}
          yields={yields}
          isRoot={false}
          amount={amount}
          parentUnitPrice={unitPrice}
        />
      </>
    );
  }

  // Both have prices - normal comparison
  if (!childrenHasPrice || !parentHasPrice) {
    return null;
  }

  // parentPrice = cost to buy finished item directly
  // childrenTotalPrice = cost to buy all materials (sum of child price * amount)
  const savings = parentPrice - childrenTotalPrice;
  const isCraftCheaper = savings > 0; // materials cost less than finished item
  const absSavings = Math.abs(savings);

  // Use a small tolerance (1 gil) to account for floating point precision issues
  // If the difference is less than 1, consider prices equal
  if (absSavings < 1) {
    return (
      <>
        <div 
          className="px-3 py-1.5 rounded-lg bg-gray-700/50 border border-gray-500/30 text-xs text-gray-400 w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowModal(true)}
          title="點擊查看計算公式"
        >
          <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
            {/* Price breakdown */}
            <div className="flex items-center gap-2 text-xs opacity-80 whitespace-nowrap">
              <span className="flex-shrink-0">材料: {formatPrice(childrenTotalPrice)}</span>
              <span className="flex-shrink-0">vs</span>
              <span className="flex-shrink-0">{amount > 1 ? `${amount}個` : ''}成品: {formatPrice(parentPrice)}</span>
            </div>
            {/* Status */}
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">價格相同</span>
            </div>
          </div>
        </div>
        <CalculationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          breakdown={breakdown}
          itemNames={itemNames}
          itemPrices={itemPrices}
          parentPrice={parentPrice}
          childrenTotalPrice={childrenTotalPrice}
          yields={yields}
          isRoot={false}
        />
      </>
    );
  }

  return (
    <>
      <div 
        className={`
          px-3 py-1.5 rounded-lg text-xs font-medium w-max min-w-max cursor-pointer hover:opacity-80 transition-opacity
          ${isCraftCheaper 
            ? 'bg-green-900/50 border border-green-500/40 text-green-300' 
            : 'bg-red-900/50 border border-red-500/40 text-red-300'
          }
        `}
        onClick={() => setShowModal(true)}
        title="點擊查看計算公式"
      >
        <div className="flex flex-col items-center gap-0.5 whitespace-nowrap">
          {/* Price breakdown */}
          <div className="flex items-center gap-2 text-xs opacity-80 whitespace-nowrap">
            <span className="flex-shrink-0">材料: {formatPrice(childrenTotalPrice)}</span>
              <span className="flex-shrink-0">vs</span>
            <span className="flex-shrink-0">{amount > 1 ? `${amount}個` : ''}成品: {formatPrice(parentPrice)}</span>
          </div>
          {/* Recommendation */}
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {isCraftCheaper ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold flex-shrink-0">自製省 {formatPrice(absSavings)}</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="font-bold flex-shrink-0">直購省 {formatPrice(absSavings)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <CalculationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        breakdown={breakdown}
        itemNames={itemNames}
        itemPrices={itemPrices}
        parentPrice={parentPrice}
        childrenTotalPrice={childrenTotalPrice}
        yields={yields}
        isRoot={false}
        amount={amount}
        parentUnitPrice={unitPrice}
      />
    </>
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
  isDcQuery = false,
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

  // Calculate children total price (considering amounts) and get breakdown
  // Returns: number (total price), 'N/A' (some materials missing), or null (still loading)
  const { childrenTotalPrice, breakdown } = useMemo(() => {
    if (!hasChildren) return { childrenTotalPrice: null, breakdown: null };
    
    // Check if all children have been queried
    let allChildrenQueried = true;
    for (const child of node.children) {
      if (!queriedItemIds.has(child.itemId)) {
        allChildrenQueried = false;
        break;
      }
    }
    
    // If not all children are queried yet, return null (still loading)
    if (!allChildrenQueried) return { childrenTotalPrice: null, breakdown: null };
    
    // Use getCheapestCost to get the proper cost calculation (which considers yields)
    const cheapestResult = getCheapestCost(node, itemPrices, queriedItemIds);
    
    if (cheapestResult.cost === 'N/A') {
      return { childrenTotalPrice: 'N/A', breakdown: cheapestResult.breakdown };
    } else if (cheapestResult.cost === null) {
      return { childrenTotalPrice: null, breakdown: null };
    } else if (typeof cheapestResult.cost === 'number') {
      // Always calculate breakdown for materials, regardless of whether crafting or buying is cheaper
      // This allows users to see the material cost breakdown even when buying is cheaper
      let breakdownData = cheapestResult.breakdown;
      
      // If breakdown is not available (e.g., when buying is cheaper), calculate it from children
      if (!breakdownData) {
        breakdownData = [];
        for (const child of node.children) {
          const childPrice = itemPrices[child.itemId];
          if (childPrice && childPrice.price !== undefined) {
            const childTotal = childPrice.price * child.amount;
            breakdownData.push({
              itemId: child.itemId,
              amount: child.amount,
              unitCost: childPrice.price,
              totalCost: childTotal,
              method: 'buy', // These are market prices
            });
          }
        }
      }
      
      // Use the crafting cost if available (already adjusted for yields), otherwise calculate from market prices
      if (cheapestResult.method === 'craft' && cheapestResult.breakdown) {
        // Use the crafting cost (already adjusted for yields)
        return { childrenTotalPrice: cheapestResult.cost, breakdown: breakdownData };
      } else {
        // Calculate from market prices (for comparison when buying is cheaper)
        let total = 0;
        for (const child of node.children) {
          const childPrice = itemPrices[child.itemId];
          if (childPrice && childPrice.price !== undefined) {
            total += childPrice.price * child.amount;
          } else {
            return { childrenTotalPrice: 'N/A', breakdown: breakdownData.length > 0 ? breakdownData : null };
          }
        }
        // Adjust by yields if applicable
        const yields = node.yields || 1;
        const totalPerUnit = yields > 1 ? total / yields : total;
        return { childrenTotalPrice: totalPerUnit, breakdown: breakdownData.length > 0 ? breakdownData : null };
      }
    }
    
    return { childrenTotalPrice: null, breakdown: null };
  }, [hasChildren, node, itemPrices, queriedItemIds]);

  // Check if comparison is ready (parent and all children prices loaded)
  // Also check if we should show N/A message
  const isComparisonReady = useMemo(() => {
    if (!hasChildren) return false;
    // Check if all children have been queried
    let allChildrenQueried = true;
    for (const child of node.children) {
      if (!queriedItemIds.has(child.itemId)) {
        allChildrenQueried = false;
        break;
      }
    }
    if (!allChildrenQueried) return false;
    // If childrenTotalPrice is 'N/A', we still want to show comparison
    // If it's null, it means still loading
    if (childrenTotalPrice === null) return false;
    // Parent price check: if parent is queried, we can show comparison
    const parentQueried = queriedItemIds.has(node.itemId);
    return parentQueried;
  }, [hasChildren, node.children, priceInfo, childrenTotalPrice, queriedItemIds]);

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
        isDcQuery={isDcQuery}
      />
      
      {/* Children */}
      {hasChildren && (
        <div className="flex flex-col items-center">
          {/* Vertical line down from parent */}
          <div className={`${lineWidth} ${node.yields && node.yields > 1 ? 'h-2' : 'h-4'} ${lineColor} ${lineGlow}`}></div>
          
          {/* Yields indicator - show above price comparison badge */}
          {node.yields && node.yields > 1 && (
            <div className="flex flex-col items-center">
              <div className="px-2 py-0.5 rounded-md bg-yellow-900/40 border border-yellow-600/50 text-[10px] text-yellow-300 whitespace-nowrap">
                單次製作產出 {node.yields} 個
              </div>
              {/* Vertical line connecting yields indicator to price comparison badge */}
              <div className={`${lineWidth} h-2 ${lineColor} ${lineGlow}`}></div>
            </div>
          )}
          
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
              breakdown={breakdown}
              itemNames={itemNames}
              itemPrices={itemPrices}
              yields={node.yields || 1}
              parentUnitPrice={priceInfo?.price || null}
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
                    isDcQuery={isDcQuery}
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
  excludeCrystals = true,
  onExcludeCrystalsChange,
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

  // Load item names using batch query (much faster than individual queries)
  useEffect(() => {
    if (!tree) return;

    const itemIds = Array.from(getAllItemIds(tree));
    if (itemIds.length === 0) {
      setIsLoadingNames(false);
      return;
    }

    setIsLoadingNames(true);

    // Use batch query instead of individual queries for much better performance
    getTwItemsByIds(itemIds)
      .then((itemsData) => {
        const names = {};
        itemIds.forEach((id) => {
          // Extract name from batch query result
          const itemData = itemsData[id];
          if (itemData && itemData.tw) {
            // Clean name (remove quotes)
            names[id] = itemData.tw.replace(/^["']|["']$/g, '').trim();
          } else {
            // Fallback if item not found
            names[id] = `物品 ${id}`;
          }
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

    // Get all item IDs and ensure they are unique (no duplicates)
    const itemIdsSet = getAllItemIds(tree);
    const itemIds = Array.from(itemIdsSet);
    
    // Double-check: ensure no duplicates in the array
    const uniqueItemIds = [...new Set(itemIds)];
    
    setIsLoadingPrices(true);
    setQueriedItemIds(new Set());
    setItemPrices({});
    setError(null);

    // Fetch prices for all items using aggregated API (up to 100 items at once)
    const fetchPrices = async () => {
      try {
        // Batch items into groups of 100 (API limit)
        const batches = [];
        for (let i = 0; i < uniqueItemIds.length; i += 100) {
          batches.push(uniqueItemIds.slice(i, i + 100));
        }

        // Determine the worldDcRegion to pass to API:
        // - DC selected: selectedServerOption equals DC name (string like "陸行鳥")
        // - Specific server selected: selectedServerOption is world ID (number like 4031)
        // Pass selectedServerOption directly - the Universalis API accepts both
        // Process batches sequentially but with minimal delay to avoid rate limiting
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const batchResults = await getAggregatedMarketData(
            selectedServerOption,
            batch,
            worlds
          );

          // Update prices and queried IDs for this batch
          setItemPrices(prev => ({ ...prev, ...batchResults }));
          setQueriedItemIds(prev => new Set([...prev, ...batch]));

          // Reduced delay between batches (from 100ms to 50ms) for faster loading
          // Only add delay if not the last batch
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } catch (err) {
        console.error('Failed to fetch prices:', err);
        // Mark all items as queried even on error
        setQueriedItemIds(new Set(uniqueItemIds));
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
          const itemUrl = generateItemUrl(itemId, 'item');
          const url = `${window.location.origin}${getInternalUrl(itemUrl)}`;
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    } else {
      // Open in new tab
      const itemUrl = generateItemUrl(itemId, 'item');
      const url = `${window.location.origin}${getInternalUrl(itemUrl)}`;
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
    
    // Calculate crafting cost separately (always returns crafting cost, not market price)
    const craftingCost = calculateCraftingCost(tree, itemPrices, queriedItemIds);
    
    // If we can't calculate crafting cost (null), it means the path is incomplete (still loading)
    if (craftingCost === null) {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // If cost is 'N/A', don't show optimal path
    if (craftingCost === 'N/A') {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    const rootPrice = itemPrices[tree.itemId]?.price ?? null;
    
    // If root has no price, but we can craft it (cost is a number), show the crafting path
    if (rootPrice === null) {
      // If we can calculate crafting cost, show the crafting path
      if (typeof craftingCost === 'number') {
        const pathMap = buildCraftingPathMap(tree, itemPrices, queriedItemIds);
        return { optimalPathMap: pathMap, isCraftingCheaper: true };
      }
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // If root has price, compare with crafting cost
    // Only compare if both are numbers
    if (typeof craftingCost !== 'number') {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    const craftingIsCheaper = craftingCost < rootPrice;
    
    // Only highlight if crafting is cheaper than buying
    if (!craftingIsCheaper) {
      return { optimalPathMap: null, isCraftingCheaper: false };
    }
    
    // Build the crafting path map for highlighting
    // Use buildCraftingPathMap instead of buildOptimalPathMap to correctly mark all crafting nodes
    const pathMap = buildCraftingPathMap(tree, itemPrices, queriedItemIds);
    
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
          {/* Server/DC info badge */}
          {selectedServerOption && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-900/40 border border-purple-500/30 text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="text-purple-300">{serverDisplayName}</span>
            </div>
          )}
          {/* Crystal toggle switch */}
          {onExcludeCrystalsChange && (
            <div 
              className={`relative flex items-center gap-2 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-600/40 text-xs group overflow-hidden ${
                !excludeCrystals ? '' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
              style={!excludeCrystals ? {
                boxShadow: '0 0 8px rgba(147, 51, 234, 0.3)',
                animation: 'crystalShimmer 3s ease-in-out infinite'
              } : {}}
            >
              {/* Subtle shimmer effect - only when enabled */}
              {!excludeCrystals && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none"></div>
              )}
              
              {/* Crystal icon with effects */}
              <div className="relative z-10 translate-y-0.5">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-all duration-200 crystal-icon-svg ${
                    !excludeCrystals 
                      ? 'text-purple-400 crystal-icon-active' 
                      : 'text-indigo-500 crystal-icon-inactive'
                  }`}
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  {/* Faceted crystal gem */}
                  <path d="M12 1l-5.5 7.5L12 16l5.5-7.5L12 1z" fill="currentColor"/>
                  <path d="M12 1l-5.5 7.5L12 9l5.5-7.5L12 1z" fill="white" className="crystal-highlight"/>
                  <path d="M6.5 8.5l5.5 7.5v-7.5H6.5zm11 0l-5.5 7.5v-7.5h5.5z" fill="currentColor" opacity="0.4"/>
                </svg>
                {/* Sparkle effect overlay - always visible */}
                <div className="absolute inset-0 pointer-events-none">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-4 w-4 crystal-sparkle ${
                      !excludeCrystals ? 'crystal-sparkle-active' : 'crystal-sparkle-inactive'
                    }`}
                    fill="none" 
                    viewBox="0 0 24 24"
                    stroke={!excludeCrystals ? "rgba(255,255,255,0.8)" : "rgba(99,102,241,0.6)"}
                    strokeWidth="1"
                  >
                    <path d="M12 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              
              <span className="text-gray-400 cursor-help relative z-10">
                水晶開關
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExcludeCrystalsChange(!excludeCrystals);
                }}
                className={`
                  relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ease-in-out z-10
                  ${!excludeCrystals 
                    ? 'bg-ffxiv-gold/70 shadow-[0_0_6px_rgba(212,175,55,0.4)]' 
                    : 'bg-purple-600/50'
                  }
                  focus:outline-none focus:ring-2 focus:ring-ffxiv-gold focus:ring-offset-2 focus:ring-offset-slate-800
                `}
                role="switch"
                aria-checked={!excludeCrystals}
                aria-label="水晶開關"
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
                    ${!excludeCrystals ? 'translate-x-5' : 'translate-x-1'}
                    ${!excludeCrystals ? 'shadow-[0_0_4px_rgba(255,255,255,0.5)]' : ''}
                  `}
                />
              </button>
              {/* Custom tooltip with high z-index */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900/95 text-white text-xs rounded shadow-lg border border-purple-500/50 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[9999]">
                提供給大量製作的匠人更精確定位價格
                {/* Tooltip arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-purple-500/50"></div>
              </div>
            </div>
          )}
          
          {/* Add CSS animations for crystal effects */}
          <style>{`
            @keyframes crystalShimmer {
              0%, 100% {
                box-shadow: 0 0 8px rgba(147, 51, 234, 0.3);
              }
              50% {
                box-shadow: 0 0 12px rgba(147, 51, 234, 0.5), 0 0 20px rgba(147, 51, 234, 0.2);
              }
            }
            @keyframes crystalPulse {
              0%, 100% {
                transform: scale(1);
                filter: drop-shadow(0 0 4px rgba(147,51,234,0.9)) drop-shadow(0 0 8px rgba(147,51,234,0.5));
              }
              50% {
                transform: scale(1.08);
                filter: drop-shadow(0 0 6px rgba(147,51,234,1)) drop-shadow(0 0 12px rgba(147,51,234,0.7)) drop-shadow(0 0 16px rgba(147,51,234,0.4));
              }
            }
            @keyframes crystalPulseInactive {
              0%, 100% {
                transform: scale(1);
                filter: drop-shadow(0 0 3px rgba(99,102,241,0.6)) drop-shadow(0 0 6px rgba(99,102,241,0.4));
              }
              50% {
                transform: scale(1.05);
                filter: drop-shadow(0 0 4px rgba(99,102,241,0.8)) drop-shadow(0 0 8px rgba(99,102,241,0.5));
              }
            }
            @keyframes crystalShimmerGlow {
              0%, 100% {
                filter: drop-shadow(0 0 4px rgba(147,51,234,0.9)) drop-shadow(0 0 8px rgba(147,51,234,0.5));
              }
              50% {
                filter: drop-shadow(0 0 6px rgba(147,51,234,1)) drop-shadow(0 0 12px rgba(147,51,234,0.7)) drop-shadow(0 0 16px rgba(147,51,234,0.4));
              }
            }
            @keyframes crystalShimmerGlowInactive {
              0%, 100% {
                filter: drop-shadow(0 0 3px rgba(99,102,241,0.6)) drop-shadow(0 0 6px rgba(99,102,241,0.4));
              }
              50% {
                filter: drop-shadow(0 0 4px rgba(99,102,241,0.8)) drop-shadow(0 0 8px rgba(99,102,241,0.5));
              }
            }
            @keyframes highlightShimmer {
              0% {
                fill-opacity: 0.2;
              }
              50% {
                fill-opacity: 0.6;
              }
              100% {
                fill-opacity: 0.2;
              }
            }
            @keyframes highlightShimmerInactive {
              0% {
                fill-opacity: 0.1;
              }
              50% {
                fill-opacity: 0.3;
              }
              100% {
                fill-opacity: 0.1;
              }
            }
            @keyframes sparkle {
              0%, 100% {
                opacity: 0.8;
                transform: scale(0.8) rotate(0deg);
              }
              50% {
                opacity: 1;
                transform: scale(1.2) rotate(180deg);
              }
            }
            @keyframes sparkleInactive {
              0%, 100% {
                opacity: 0.3;
                transform: scale(0.8) rotate(0deg);
              }
              50% {
                opacity: 0.5;
                transform: scale(1.1) rotate(180deg);
              }
            }
            .crystal-icon-active {
              animation: crystalPulse 2s ease-in-out infinite, crystalShimmerGlow 3s ease-in-out infinite;
            }
            .crystal-icon-inactive {
              animation: crystalPulseInactive 2.5s ease-in-out infinite, crystalShimmerGlowInactive 3.5s ease-in-out infinite;
            }
            .crystal-highlight {
              fill-opacity: 0.3;
            }
            .crystal-icon-active .crystal-highlight {
              animation: highlightShimmer 2s ease-in-out infinite;
            }
            .crystal-icon-inactive .crystal-highlight {
              animation: highlightShimmerInactive 2.5s ease-in-out infinite;
            }
            .crystal-sparkle-active {
              animation: sparkle 1.5s ease-in-out infinite;
            }
            .crystal-sparkle-inactive {
              animation: sparkleInactive 2s ease-in-out infinite;
            }
          `}</style>
        </div>
        <div className="flex items-center gap-3">
          {/* Price type explanation and Daily Sale Velocity for root item */}
          {!isLoadingPrices && tree && itemPrices[tree.itemId] && (() => {
            const rootPriceInfo = itemPrices[tree.itemId];
            const rootPriceType = rootPriceInfo?.priceType || (isDcQuery ? 'minListing' : 'average');
            const isFallback = !isDcQuery && rootPriceType === 'minListing';
            const hasPrice = rootPriceInfo.price !== null && rootPriceInfo.price !== undefined;
            const hasVelocityWorld = rootPriceInfo.velocityWorld !== undefined;
            const hasVelocityDc = rootPriceInfo.velocityDc !== undefined;
            const velocityWorldValue = rootPriceInfo.velocityWorld ?? 0;
            const velocityDcValue = rootPriceInfo.velocityDc ?? 0;
            
            // Check if no price at all (no average and no minListing fallback)
            const noPriceAtAll = !isDcQuery && !hasPrice;
            
            return (
              <div className="flex flex-col gap-1">
                {/* Price type explanation - always show */}
                {isDcQuery ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-900/30 border border-blue-500/20 text-xs text-blue-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="whitespace-nowrap">價格為全服最低在售價格</span>
                  </div>
                ) : noPriceAtAll ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-900/50 border border-red-500/40 text-xs text-red-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="whitespace-nowrap">該服無平均價格且無最低價格，無法顯示價格</span>
                  </div>
                ) : isFallback ? (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-900/50 border border-orange-500/40 text-xs text-orange-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="whitespace-nowrap">
                      {hasVelocityWorld || hasVelocityDc 
                        ? '部分物品4天內無銷售記錄，無平均值改用該服最低價格' 
                        : '最近四天沒有成功銷售記錄，無平均值和日均銷售，部分價格會使用該服最低價格'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-900/30 border border-blue-500/20 text-xs text-blue-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="whitespace-nowrap">價格為4天內該服賣出平均價格</span>
                  </div>
                )}
                
                {/* Daily Sale Velocity - show for server queries (always show single server, even if 0) */}
                {/* For DC queries, only show DC velocity */}
                {/* For server queries, always show single server velocity (even if 0), and DC velocity if available */}
                {!isDcQuery ? (
                  // Server query: show single server velocity (always, even if 0) and DC velocity if available
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-600/40 text-xs w-fit self-end">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-gray-400">日均銷量:</span>
                    <span className="text-cyan-300" title="單服日均銷量">
                      單服 {hasVelocityWorld ? velocityWorldValue.toFixed(1) : '0.0'}
                    </span>
                    {hasVelocityDc && (
                      <>
                        <span className="text-gray-500">/</span>
                        <span className="text-emerald-300" title="全服日均銷量">
                          全服 {velocityDcValue.toFixed(1)}
                        </span>
                      </>
                    )}
                  </div>
                ) : hasVelocityDc ? (
                  // DC query: only show DC velocity
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-600/40 text-xs w-fit self-end">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-gray-400">日均銷量:</span>
                    <span className="text-emerald-300" title="全服日均銷量">
                      全服 {velocityDcValue.toFixed(1)}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })()}
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
            isDcQuery={isDcQuery}
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
          <span className="px-1 py-0.5 text-[10px] font-bold text-ffxiv-gold border border-ffxiv-gold/50 rounded bg-ffxiv-gold/10 cursor-default">HQ</span>
          <span className="text-yellow-400 font-semibold">價格</span>
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
