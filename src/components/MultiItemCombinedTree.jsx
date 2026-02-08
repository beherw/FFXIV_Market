// Multi-item combined tree component - Modal version
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ItemImage from './ItemImage';
import { getItemById } from '../services/itemDatabase';
import { getInternalUrl } from '../utils/internalUrl.js';
import { getAggregatedMarketData } from '../services/universalis';
import { getTwItemsByIds } from '../services/gameData';
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
      className={`p-0.5 rounded transition-all duration-200 flex-shrink-0 ${
        copied 
          ? 'text-green-400' 
          : 'text-gray-500 hover:text-ffxiv-gold hover:bg-purple-800/40'
      }`}
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
  isHighlighted = false,
  highlightMethod = null,
  isDcQuery = false,
}) {
  return (
    <div 
      className={`flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all duration-200 ${
        isHighlighted
          ? highlightMethod === 'craft'
            ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/30 border-2 border-green-500/60 hover:border-green-400 min-w-[100px] shadow-[0_0_10px_rgba(34,197,94,0.2)]'
            : 'bg-gradient-to-br from-blue-900/40 to-cyan-900/30 border-2 border-blue-500/60 hover:border-blue-400 min-w-[100px] shadow-[0_0_10px_rgba(59,130,246,0.2)]'
          : 'bg-slate-800/60 border border-purple-500/30 hover:border-purple-400/60 hover:bg-slate-700/60 min-w-[100px]'
      }`}
      onClick={() => onItemClick(node.itemId)}
      title={`查看 ${itemName}`}
    >
      {/* Item Image */}
      <div className="relative">
        <ItemImage
          itemId={node.itemId}
          alt={itemName}
          className="w-9 h-9 object-contain rounded border border-purple-500/30"
        />
        {/* Quantity badge */}
        {node.amount > 1 && (
          <div className="absolute -bottom-1 -right-1 bg-purple-900/90 text-ffxiv-gold text-xs font-bold px-1 py-0.5 rounded-full border border-purple-500/50 min-w-[18px] text-center leading-none">
            {node.amount}
          </div>
        )}
      </div>
      
      {/* Item name with copy button */}
      <div className="mt-1.5 flex items-center gap-0.5 max-w-[100px]">
        <p className="text-xs text-gray-300 truncate flex-1" title={itemName}>
          {itemName}
        </p>
        <CopyButton text={itemName} />
      </div>
      
      {/* Price info */}
      <div className={`mt-1 text-center ${priceInfo?.worldName ? 'h-[32px]' : 'h-[20px]'} flex flex-col justify-center`}>
        {priceInfo && priceInfo.price !== null && priceInfo.price !== undefined && priceInfo.price > 0 ? (
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
              {!isDcQuery && priceInfo.priceType === 'minListing' && (
                <span className="text-[8px] text-blue-400 cursor-help" title="最近四天無銷售發生，改為用最低價格">
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
        ) : (
          <span className="text-xs text-gray-500">無販售</span>
        )}
      </div>
    </div>
  );
}

/**
 * Recursively merge children at each level
 * Each level independently merges duplicate materials
 * Tracks both display amount (merged) and recipe amount (for price calculation)
 */
function mergeChildrenAtLevel(children) {
  if (!children || children.length === 0) return [];
  
  // Map to track materials at this level: itemId -> merged node
  const mergedMap = new Map();
  
  for (const child of children) {
    const childId = child.itemId;
    
    if (mergedMap.has(childId)) {
      // Same material exists at this level, add display quantities
      const existing = mergedMap.get(childId);
      existing.amount += child.amount;
      existing.occurrences = (existing.occurrences || 1) + 1;
      
      // Recursively merge children
      if (child.children && child.children.length > 0) {
        if (!existing.children) {
          existing.children = [];
        }
        // Collect all children for recursive merge
        const allSubChildren = [...existing.children, ...child.children];
        existing.children = allSubChildren;
      }
    } else {
      // New material at this level, create copy
      mergedMap.set(childId, {
        itemId: child.itemId,
        amount: child.amount,
        recipeAmount: child.amount, // Store original recipe amount for price calculation
        occurrences: 1, // Track how many times this material appears
        children: child.children ? [...child.children] : [],
        recipeId: child.recipeId,
        job: child.job,
        level: child.level,
        yields: child.yields,
        craftsNeeded: child.craftsNeeded,
        isBaseMaterial: child.isBaseMaterial,
      });
    }
  }
  
  // Process each merged node's children recursively
  const result = Array.from(mergedMap.values());
  result.forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children = mergeChildrenAtLevel(node.children);
    }
  });
  
  return result;
}

/**
 * Merge all ingredients from multiple trees
 * Creates a combined tree with all parent items at the top level
 * Each level of children independently merges duplicate materials
 */
function mergeTrees(itemList) {
  if (!itemList || itemList.length === 0) return null;
  
  // Collect all first-level children from all parent items
  const allChildren = [];
  
  itemList.forEach(item => {
    if (!item.tree || !item.tree.children || item.tree.children.length === 0) return;
    
    // Deep copy children to avoid modifying original tree
    for (const child of item.tree.children) {
      allChildren.push(JSON.parse(JSON.stringify(child)));
    }
  });
  
  // Recursively merge children at each level
  const mergedChildren = mergeChildrenAtLevel(allChildren);
  
  // Create a virtual root node containing all parent items
  const parentNodes = itemList.map(item => {
    const itemId = item.itemId || item.id;
    return {
      itemId: itemId,
      amount: 1,
      children: [],
      isParent: true,
    };
  });
  
  // Create the combined tree structure
  const combinedTree = {
    itemId: 'multi-root',
    amount: 1,
    children: mergedChildren,
    parentItems: parentNodes, // Special field for parent items
    isCombinedRoot: true,
  };
  
  console.log('=== MERGED TREE ===', JSON.stringify(combinedTree, null, 2));
  
  return combinedTree;
}

/**
 * Recursively calculate the cheapest cost to obtain an item
 */
function getCheapestCost(node, itemPrices, queriedItemIds) {
  const priceInfo = itemPrices[node.itemId];
  const marketPrice = priceInfo?.price ?? null;
  const hasChildren = node.children && node.children.length > 0;
  const isQueried = queriedItemIds.has(node.itemId);
  
  if (!hasChildren) {
    if (isQueried && marketPrice === null) {
      return { cost: 'N/A', method: 'buy', breakdown: null };
    }
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
  
  let allChildrenQueried = true;
  for (const child of node.children) {
    if (!queriedItemIds.has(child.itemId)) {
      allChildrenQueried = false;
      break;
    }
  }
  
  if (!allChildrenQueried) {
    if (isQueried && marketPrice === null) {
      return { cost: 'N/A', method: 'buy', breakdown: null };
    }
    return { cost: marketPrice, method: 'buy', breakdown: null };
  }
  
  let craftingCost = 0;
  let hasNAChild = false;
  const childBreakdown = [];
  
  for (const child of node.children) {
    const childResult = getCheapestCost(child, itemPrices, queriedItemIds);
    if (childResult.cost === 'N/A') {
      hasNAChild = true;
      break;
    } else if (childResult.cost !== null && typeof childResult.cost === 'number') {
      // Use original amount from the tree (not recipeAmount from merged tree)
      const childAmount = child.amount;
      const childTotal = childResult.cost * childAmount;
      craftingCost += childTotal;
      childBreakdown.push({
        itemId: child.itemId,
        amount: childAmount,
        unitCost: childResult.cost,
        totalCost: childTotal,
        method: childResult.method,
      });
    } else {
      hasNAChild = true;
      break;
    }
  }
  
  if (hasNAChild) {
    if (marketPrice !== null) {
      return { cost: marketPrice, method: 'buy', breakdown: null };
    } else if (isQueried) {
      return { cost: 'N/A', method: 'buy', breakdown: null };
    } else {
      return { cost: null, method: 'buy', breakdown: null };
    }
  }
  
  const yields = node.yields || 1;
  const craftingCostPerUnit = yields > 1 ? craftingCost / yields : craftingCost;
  
  if (marketPrice === null) {
    if (isQueried) {
      return { cost: craftingCostPerUnit, method: 'craft', breakdown: childBreakdown, yields };
    } else {
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
 * Calculate the crafting cost for a node
 */
function calculateCraftingCost(node, itemPrices, queriedItemIds) {
  if (!node.children || node.children.length === 0) {
    return null;
  }
  
  let allChildrenQueried = true;
  for (const child of node.children) {
    if (!queriedItemIds.has(child.itemId)) {
      allChildrenQueried = false;
      break;
    }
  }
  
  if (!allChildrenQueried) {
    return null;
  }
  
  let craftingCost = 0;
  
  for (const child of node.children) {
    const childResult = getCheapestCost(child, itemPrices, queriedItemIds);
    if (childResult.cost === 'N/A') {
      return 'N/A';
    } else if (childResult.cost !== null && typeof childResult.cost === 'number') {
      const childTotal = childResult.cost * child.amount;
      craftingCost += childTotal;
    } else {
      return null;
    }
  }
  
  const yields = node.yields || 1;
  return yields > 1 ? craftingCost / yields : craftingCost;
}

/**
 * Build a map of crafting methods for highlighting
 */
function buildCraftingPathMap(node, itemPrices, queriedItemIds, pathMap = new Map()) {
  const hasChildren = node.children && node.children.length > 0;
  
  if (!hasChildren) {
    pathMap.set(node.itemId, 'buy');
    return pathMap;
  }
  
  let allChildrenQueried = true;
  for (const child of node.children) {
    if (!queriedItemIds.has(child.itemId)) {
      allChildrenQueried = false;
      break;
    }
  }
  
  if (!allChildrenQueried) {
    return pathMap;
  }
  
  const craftingCost = calculateCraftingCost(node, itemPrices, queriedItemIds);
  
  if (craftingCost === null || craftingCost === 'N/A') {
    pathMap.set(node.itemId, 'buy');
    return pathMap;
  }
  
  const marketPrice = itemPrices[node.itemId]?.price ?? null;
  
  if (typeof craftingCost === 'number' && (marketPrice === null || craftingCost < marketPrice)) {
    pathMap.set(node.itemId, 'craft');
    for (const child of node.children) {
      buildCraftingPathMap(child, itemPrices, queriedItemIds, pathMap);
    }
  } else {
    pathMap.set(node.itemId, 'buy');
  }
  
  return pathMap;
}

/**
 * Recursively check if all items in a node tree have been queried
 */
function areAllNodesQueried(node, queriedItemIds) {
  if (!queriedItemIds.has(node.itemId)) {
    return false;
  }
  
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (!areAllNodesQueried(child, queriedItemIds)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Calculate total cost for each parent item separately, then sum
 * This ensures accurate cost calculation based on original recipes
 */
function calculateMultiItemPriceComparison(combinedNode, itemPrices, queriedItemIds, originalItemList) {
  if (!combinedNode) return null;

  const parentItems = combinedNode.parentItems || [];

  // Calculate total price of all finished products (buying them)
  let totalFinishedPrice = 0;
  let hasFinishedPrice = false;
  let allFinishedQueried = true;
  let finishedCount = 0;

  for (const parent of parentItems) {
    if (!queriedItemIds.has(parent.itemId)) {
      allFinishedQueried = false;
      continue;
    }
    
    const priceInfo = itemPrices[parent.itemId];
    if (priceInfo && priceInfo.price !== null && priceInfo.price !== undefined) {
      const itemAmount = parent.amount || 1;
      totalFinishedPrice += priceInfo.price * itemAmount;
      hasFinishedPrice = true;
      finishedCount += itemAmount;
    }
  }

  // Calculate total cost by processing ORIGINAL trees separately
  // This avoids the problem of merged trees losing recipe ratio information
  let totalMaterialsCost = 0;
  let hasMaterialsPrice = false;
  let allMaterialsQueried = true;
  let materialsMissingPrice = false;

  console.log(`[calculateMultiItemPriceComparison] Processing ${originalItemList.length} original items`);

  for (const item of originalItemList) {
    if (!item.tree || !item.tree.children || item.tree.children.length === 0) {
      console.log(`[calculateMultiItemPriceComparison] Item ${item.id} has no tree, skipping`);
      continue;
    }

    const itemId = item.itemId || item.id;
    console.log(`[calculateMultiItemPriceComparison] Processing item ${itemId}`);

    // Calculate cost for this item's tree
    const treeResult = getCheapestCost(item.tree, itemPrices, queriedItemIds);
    
    console.log(`[calculateMultiItemPriceComparison] Item ${itemId} tree result:`, treeResult);

    if (treeResult.cost === 'N/A') {
      materialsMissingPrice = true;
      continue;
    }

    if (treeResult.cost === null) {
      allMaterialsQueried = false;
      continue;
    }

    if (typeof treeResult.cost === 'number') {
      totalMaterialsCost += treeResult.cost;
      hasMaterialsPrice = true;
      console.log(`[calculateMultiItemPriceComparison] Item ${itemId}: added cost ${treeResult.cost}, total now ${totalMaterialsCost}`);
    }
  }

  console.log(`[calculateMultiItemPriceComparison] FINAL: totalMaterialsCost=${totalMaterialsCost}, totalFinishedPrice=${totalFinishedPrice}`);

  // Determine comparison result
  const materialsIsNA = !hasMaterialsPrice || materialsMissingPrice;
  const finishedIsNA = !hasFinishedPrice || !allFinishedQueried;

  return {
    totalMaterialsCost: hasMaterialsPrice ? totalMaterialsCost : null,
    totalFinishedPrice: hasFinishedPrice ? totalFinishedPrice : null,
    materialsIsNA,
    finishedIsNA,
    parentCount: finishedCount,
    allQueried: allMaterialsQueried && allFinishedQueried && !materialsMissingPrice,
  };
}

/**
 * Multi-item price comparison badge component
 * Shows: "材料: X vs N個成品: Y"
 */
function MultiItemPriceComparisonBadge({ 
  priceComparison, 
  isReady 
}) {
  if (!isReady || !priceComparison) {
    return null;
  }

  const { 
    totalMaterialsCost, 
    totalFinishedPrice, 
    materialsIsNA, 
    finishedIsNA, 
    parentCount 
  } = priceComparison;

  // 材料 N/A vs 成品 N/A，資訊不足，不做比對
  if (materialsIsNA && finishedIsNA) {
    return (
      <div className="px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-500/30 text-sm text-gray-400">
        資訊不足
      </div>
    );
  }

  // 材料 N/A vs 成品 有數值，用成品
  if (materialsIsNA && !finishedIsNA) {
    return (
      <div className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-900/50 border border-blue-500/40 text-blue-300 w-max min-w-max">
        <div className="flex flex-col items-center gap-1 whitespace-nowrap">
          <div className="flex items-center gap-2 text-sm opacity-80 whitespace-nowrap">
            <span className="flex-shrink-0">材料: N/A</span>
            <span className="flex-shrink-0">vs</span>
            <span className="flex-shrink-0">{parentCount}個成品: {formatPrice(totalFinishedPrice)}</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="font-bold flex-shrink-0">建議直購</span>
          </div>
        </div>
      </div>
    );
  }

  // 材料有價格 vs 成品 N/A，用材料
  if (!materialsIsNA && finishedIsNA) {
    return (
      <div className="px-3 py-2 rounded-lg text-sm font-medium bg-green-900/50 border border-green-500/40 text-green-300 w-max min-w-max">
        <div className="flex flex-col items-center gap-1 whitespace-nowrap">
          <div className="flex items-center gap-2 text-sm opacity-80 whitespace-nowrap">
            <span className="flex-shrink-0">材料: {formatPrice(totalMaterialsCost)}</span>
            <span className="flex-shrink-0">vs</span>
            <span className="flex-shrink-0">{parentCount}個成品: N/A</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold flex-shrink-0">建議自製</span>
          </div>
        </div>
      </div>
    );
  }

  // Both have prices - normal comparison
  const savings = totalFinishedPrice - totalMaterialsCost;
  const isCraftCheaper = savings > 0; // materials cost less than finished items
  const absSavings = Math.abs(savings);

  // Use a small tolerance (1 gil) to account for floating point precision issues
  if (absSavings < 1) {
    return (
      <div className="px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-500/30 text-sm text-gray-400 w-max min-w-max">
        <div className="flex flex-col items-center gap-1 whitespace-nowrap">
          <div className="flex items-center gap-2 text-sm opacity-80 whitespace-nowrap">
            <span className="flex-shrink-0">材料: {formatPrice(totalMaterialsCost)}</span>
            <span className="flex-shrink-0">vs</span>
            <span className="flex-shrink-0">{parentCount}個成品: {formatPrice(totalFinishedPrice)}</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold flex-shrink-0">價格相同</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        px-3 py-2 rounded-lg text-sm font-medium w-max min-w-max
        ${isCraftCheaper 
          ? 'bg-green-900/50 border border-green-500/40 text-green-300' 
          : 'bg-red-900/50 border border-red-500/40 text-red-300'
        }
      `}
    >
      <div className="flex flex-col items-center gap-1 whitespace-nowrap">
        {/* Price breakdown */}
        <div className="flex items-center gap-2 text-sm opacity-80 whitespace-nowrap">
          <span className="flex-shrink-0">材料: {formatPrice(totalMaterialsCost)}</span>
          <span className="flex-shrink-0">vs</span>
          <span className="flex-shrink-0">{parentCount}個成品: {formatPrice(totalFinishedPrice)}</span>
        </div>
        {/* Recommendation */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {isCraftCheaper ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">自製省 {formatPrice(absSavings)}</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-bold flex-shrink-0">直購省 {formatPrice(absSavings)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Combined tree node component for multi-item display
 * Shows all parent items at top, with merged ingredients below
 */
function CombinedTreeNode({
  combinedNode,
  itemNames,
  itemPrices,
  queriedItemIds,
  onItemClick,
  isDcQuery = false,
  originalItemList = [],
}) {
  const childrenRef = useRef(null);
  const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
  
  const parentItems = combinedNode.parentItems || [];
  const mergedChildren = combinedNode.children || [];
  
  // Calculate price comparison
  const priceComparison = useMemo(() => {
    return calculateMultiItemPriceComparison(combinedNode, itemPrices, queriedItemIds, originalItemList);
  }, [combinedNode, itemPrices, queriedItemIds, originalItemList]);
  
  // Check if all items are queried for price comparison
  const allQueried = useMemo(() => {
    const allParentQueried = parentItems.every(p => queriedItemIds.has(p.itemId));
    const allChildQueried = mergedChildren.every(c => queriedItemIds.has(c.itemId));
    return allParentQueried && allChildQueried;
  }, [parentItems, mergedChildren, queriedItemIds]);
  
  const calculateLinePosition = useCallback(() => {
    if (mergedChildren.length > 1 && childrenRef.current) {
      const container = childrenRef.current;
      const children = container.children;
      if (children.length >= 2) {
        const firstChild = children[0];
        const lastChild = children[children.length - 1];
        const containerRect = container.getBoundingClientRect();
        const firstRect = firstChild.getBoundingClientRect();
        const lastRect = lastChild.getBoundingClientRect();
        
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
  }, [mergedChildren.length]);

  useEffect(() => {
    const timeoutId = setTimeout(calculateLinePosition, 50);
    
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
      {/* Parent items row */}
      <div className="flex gap-3 items-center justify-center mb-2">
        {parentItems.map((parentNode, index) => {
          const itemName = itemNames[parentNode.itemId] || `物品 ${parentNode.itemId}`;
          const priceInfo = itemPrices[parentNode.itemId];
          
          return (
            <ItemCard
              key={`parent-${parentNode.itemId}-${index}`}
              node={parentNode}
              itemName={itemName}
              priceInfo={priceInfo}
              onItemClick={onItemClick}
              isHighlighted={false}
              isDcQuery={isDcQuery}
            />
          );
        })}
      </div>
      
      {/* Connecting line */}
      {mergedChildren.length > 0 && (
        <>
          <div className="w-px h-6 bg-purple-500/50"></div>
          <div className="flex flex-col items-center gap-2">
            <div className="px-3 py-1 rounded-md bg-purple-900/40 border border-purple-500/30 text-xs text-purple-300">
              合併素材清單
            </div>
            
            {/* Price comparison badge */}
            <MultiItemPriceComparisonBadge 
              priceComparison={priceComparison}
              isReady={allQueried}
            />
          </div>
          <div className="w-px h-6 bg-purple-500/50"></div>
        </>
      )}
      
      {/* Merged children */}
      {mergedChildren.length > 0 && (
        <div className="relative">
          {mergedChildren.length > 1 && lineStyle.width > 0 && (
            <div 
              className="absolute top-0 h-px bg-purple-500/50"
              style={{
                left: `${lineStyle.left}px`,
                width: `${lineStyle.width}px`,
              }}
            ></div>
          )}
          
          <div ref={childrenRef} className="flex gap-3 items-start">
            {mergedChildren.map((child, index) => {
              // Calculate optimal path for each child node
              const hasChildren = child.children && child.children.length > 0;
              let childOptimalPathMap = null;
              let childIsCraftingCheaper = false;
              
              if (hasChildren) {
                // Check if all children of this child are queried
                let allChildrenQueried = true;
                const checkAllQueried = (node) => {
                  if (!node.children || node.children.length === 0) return;
                  for (const c of node.children) {
                    if (!queriedItemIds.has(c.itemId)) {
                      allChildrenQueried = false;
                      return;
                    }
                    checkAllQueried(c);
                  }
                };
                checkAllQueried(child);
                
                if (allChildrenQueried) {
                  // Calculate crafting cost
                  const craftingCost = calculateCraftingCost(child, itemPrices, queriedItemIds);
                  const marketPrice = itemPrices[child.itemId]?.price ?? null;
                  
                  // Determine if crafting is cheaper
                  if (craftingCost !== null && craftingCost !== 'N/A' && typeof craftingCost === 'number') {
                    if (marketPrice === null) {
                      // No market price, must craft
                      childIsCraftingCheaper = true;
                      childOptimalPathMap = buildCraftingPathMap(child, itemPrices, queriedItemIds);
                    } else if (craftingCost < marketPrice) {
                      // Crafting is cheaper
                      childIsCraftingCheaper = true;
                      childOptimalPathMap = buildCraftingPathMap(child, itemPrices, queriedItemIds);
                    }
                  }
                }
              }
              
              return (
                <div key={`${child.itemId}-${index}`} className="flex flex-col items-center">
                  <div className="w-px h-4 bg-purple-500/50"></div>
                  
                  <TreeNodeVertical
                    node={child}
                    itemNames={itemNames}
                    itemPrices={itemPrices}
                    queriedItemIds={queriedItemIds}
                    onItemClick={onItemClick}
                    optimalPathMap={childOptimalPathMap}
                    isCraftingCheaper={childIsCraftingCheaper}
                    isDcQuery={isDcQuery}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Recursive tree node component
 */
function TreeNodeVertical({
  node,
  itemNames,
  itemPrices,
  queriedItemIds,
  onItemClick,
  optimalPathMap = null,
  isCraftingCheaper = false,
  isDcQuery = false,
}) {
  const childrenRef = useRef(null);
  const [lineStyle, setLineStyle] = useState({ left: 0, width: 0 });
  const hasChildren = node.children && node.children.length > 0;
  const itemName = itemNames[node.itemId] || `物品 ${node.itemId}`;
  const priceInfo = itemPrices[node.itemId];
  
  const optimalMethod = optimalPathMap?.get(node.itemId);
  const isOnOptimalPath = isCraftingCheaper && optimalMethod !== undefined;
  const shouldHighlightChildren = isOnOptimalPath && optimalMethod === 'craft';

  // Note: childrenTotalPrice calculation disabled as it's not used anymore
  // (we don't show per-node price comparison in merged trees)
  const childrenTotalPrice = null;

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

  useEffect(() => {
    const timeoutId = setTimeout(calculateLinePosition, 50);
    
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

  const lineColor = shouldHighlightChildren ? 'bg-green-400' : 'bg-purple-500/50';
  const lineWidth = shouldHighlightChildren ? 'w-0.5' : 'w-px';
  const lineGlow = shouldHighlightChildren ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : '';

  // Calculate total buy price for this node (market price × amount)
  const totalBuyPrice = useMemo(() => {
    if (!priceInfo || priceInfo.price === null) return null;
    return priceInfo.price * node.amount;
  }, [priceInfo, node.amount]);

  // Calculate total crafting cost (sum of all children costs)
  const totalCraftPrice = useMemo(() => {
    if (!hasChildren) return null;
    
    // Check if all children are queried
    for (const child of node.children) {
      if (!queriedItemIds.has(child.itemId)) {
        return null;
      }
    }
    
    let totalCost = 0;
    let hasInvalidChild = false;
    
    for (const child of node.children) {
      const childPriceInfo = itemPrices[child.itemId];
      const childMarketPrice = childPriceInfo?.price ?? null;
      
      if (childMarketPrice === null) {
        hasInvalidChild = true;
        break;
      }
      
      // For each child, use market price × amount
      totalCost += childMarketPrice * child.amount;
    }
    
    if (hasInvalidChild) return null;
    
    return totalCost;
  }, [hasChildren, node.children, itemPrices, queriedItemIds]);

  return (
    <div className="flex flex-col items-center">
      <ItemCard
        node={node}
        itemName={itemName}
        priceInfo={priceInfo}
        onItemClick={onItemClick}
        isHighlighted={isOnOptimalPath}
        highlightMethod={optimalMethod}
        isDcQuery={isDcQuery}
      />
      
      {/* Price comparison info - show total buy price vs total craft price */}
      {hasChildren && totalCraftPrice !== null && (
        <div className="mt-1 flex flex-col items-center gap-0.5 text-[10px]">
          {/* Total market price vs total crafting cost */}
          {totalBuyPrice !== null && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-600/40">
              <span className="text-blue-300">購買: {formatPrice(totalBuyPrice)}</span>
              <span className="text-gray-500">vs</span>
              <span className="text-green-300">製作: {formatPrice(totalCraftPrice)}</span>
            </div>
          )}
          
          {/* Savings or loss indicator */}
          {totalBuyPrice !== null && (
            <div className={`px-1.5 py-0.5 rounded font-semibold ${
              totalCraftPrice < totalBuyPrice
                ? 'bg-green-900/40 text-green-300 border border-green-500/30'
                : totalCraftPrice > totalBuyPrice
                ? 'bg-red-900/40 text-red-300 border border-red-500/30'
                : 'bg-gray-700/40 text-gray-300 border border-gray-500/30'
            }`}>
              {totalCraftPrice < totalBuyPrice
                ? `省 ${formatPrice(totalBuyPrice - totalCraftPrice)}`
                : totalCraftPrice > totalBuyPrice
                ? `虧 ${formatPrice(totalCraftPrice - totalBuyPrice)}`
                : '相同'
              }
            </div>
          )}
          
          {/* If no market price, show crafting cost only */}
          {totalBuyPrice === null && (
            <div className="px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-500/30 font-semibold">
              製作: {formatPrice(totalCraftPrice)}
            </div>
          )}
        </div>
      )}
      
      {hasChildren && (
        <div className="flex flex-col items-center">
          <div className={`${lineWidth} ${node.yields && node.yields > 1 ? 'h-2' : 'h-4'} ${lineColor} ${lineGlow}`}></div>
          
          {node.yields && node.yields > 1 && (
            <div className="flex flex-col items-center">
              <div className="px-2 py-0.5 rounded-md bg-yellow-900/40 border border-yellow-600/50 text-[10px] text-yellow-300 whitespace-nowrap">
                單次製作產出 {node.yields} 個
              </div>
              <div className={`${lineWidth} h-2 ${lineColor} ${lineGlow}`}></div>
            </div>
          )}
          
          <div className={`${lineWidth} h-4 ${lineColor} ${lineGlow}`}></div>
          
          <div className="relative">
            {node.children.length > 1 && lineStyle.width > 0 && (
              <div 
                className={`absolute top-0 ${shouldHighlightChildren ? 'h-0.5' : 'h-px'} ${lineColor} ${lineGlow}`}
                style={{
                  left: `${lineStyle.left}px`,
                  width: `${lineStyle.width}px`,
                }}
              ></div>
            )}
            
            <div ref={childrenRef} className="flex gap-3 items-start">
              {node.children.map((child, index) => (
                <div key={`${child.itemId}-${index}`} className="flex flex-col items-center">
                  <div className={`${shouldHighlightChildren ? 'w-0.5 bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'w-px bg-purple-500/50'} h-4`}></div>
                  
                  <TreeNodeVertical
                    node={child}
                    itemNames={itemNames}
                    itemPrices={itemPrices}
                    queriedItemIds={queriedItemIds}
                    onItemClick={onItemClick}
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
 * Main MultiItemCombinedTree Modal component
 */
export default function MultiItemCombinedTree({
  isOpen,
  onClose,
  itemList,
  selectedServerOption,
  selectedWorld,
  worlds = {},
  onItemSelect,
  excludeCrystals = true,
  onExcludeCrystalsChange,
  currentItemId,
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

  const isDcQuery = useMemo(() => {
    if (!selectedServerOption) return false;
    const dcName = selectedWorld?.section;
    return selectedServerOption === dcName;
  }, [selectedServerOption, selectedWorld]);

  const serverDisplayName = useMemo(() => {
    if (!selectedServerOption) return null;
    const dcName = selectedWorld?.section;
    if (selectedServerOption === dcName) {
      return `${dcName}（全服搜尋）`;
    } else if (typeof selectedServerOption === 'number' || !isNaN(Number(selectedServerOption))) {
      const worldId = typeof selectedServerOption === 'number' ? selectedServerOption : Number(selectedServerOption);
      return worlds[worldId] || `伺服器 ${selectedServerOption}`;
    } else {
      return selectedServerOption;
    }
  }, [selectedServerOption, selectedWorld, worlds]);

  // Handle backdrop click to close
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Load item names from all items in all trees
  useEffect(() => {
    if (!itemList || itemList.length === 0) return;

    setIsLoadingNames(true);

    // Collect all unique item IDs from all trees
    const itemIdsSet = new Set();
    
    const collectItemIds = (node) => {
      if (!node) return;
      itemIdsSet.add(node.itemId);
      if (node.children) {
        node.children.forEach(child => collectItemIds(child));
      }
    };
    
    itemList.forEach(item => {
      const mainItemId = item.itemId || item.id;
      itemIdsSet.add(mainItemId);
      if (item.tree) {
        collectItemIds(item.tree);
      }
    });
    
    const itemIds = Array.from(itemIdsSet);
    
    getTwItemsByIds(itemIds)
      .then((itemsData) => {
        const names = {};
        itemIds.forEach((id) => {
          const itemData = itemsData[id];
          if (itemData && itemData.tw) {
            names[id] = itemData.tw.replace(/^["']|["']$/g, '').trim();
          } else {
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
  }, [itemList]);

  // Load prices from all items in all trees
  useEffect(() => {
    const worldsReady = worlds && Object.keys(worlds).length > 0;
    if (!itemList || itemList.length === 0 || !selectedServerOption || !worldsReady) return;

    // Collect all unique item IDs from all trees
    const itemIdsSet = new Set();
    
    const collectItemIds = (node) => {
      if (!node) return;
      itemIdsSet.add(node.itemId);
      if (node.children) {
        node.children.forEach(child => collectItemIds(child));
      }
    };
    
    itemList.forEach(item => {
      const mainItemId = item.itemId || item.id;
      itemIdsSet.add(mainItemId);
      if (item.tree) {
        collectItemIds(item.tree);
      }
    });
    
    const itemIds = Array.from(itemIdsSet);
    const uniqueItemIds = [...new Set(itemIds)];
    
    setIsLoadingPrices(true);
    setQueriedItemIds(new Set());
    setItemPrices({});
    setError(null);

    const fetchPrices = async () => {
      try {
        const batches = [];
        for (let i = 0; i < uniqueItemIds.length; i += 100) {
          batches.push(uniqueItemIds.slice(i, i + 100));
        }

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          const batchResults = await getAggregatedMarketData(
            selectedServerOption,
            batch,
            worlds
          );

          setItemPrices(prev => ({ ...prev, ...batchResults }));
          setQueriedItemIds(prev => new Set([...prev, ...batch]));

          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } catch (err) {
        console.error('Failed to fetch prices:', err);
        setQueriedItemIds(new Set(uniqueItemIds));
      }
      
      setIsLoadingPrices(false);
    };

    fetchPrices();
  }, [itemList, selectedServerOption, worlds]);

  const handleItemClick = useCallback((itemId) => {
    if (onItemSelect) {
      getItemById(itemId).then(item => {
        if (item) {
          onItemSelect(item);
        } else {
          const itemUrl = generateItemUrl(itemId, 'item');
          const url = `${window.location.origin}${getInternalUrl(itemUrl)}`;
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    } else {
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
    const resizeObserver = new ResizeObserver(checkScroll);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    const intervalId = setInterval(checkScroll, 500);

    return () => {
      resizeObserver.disconnect();
      clearInterval(intervalId);
    };
  }, [itemList, itemNames, itemPrices]);

  // Build combined tree
  const combinedTree = useMemo(() => {
    if (!itemList || itemList.length === 0) return null;
    return mergeTrees(itemList);
  }, [itemList]);

  // Handle drag to scroll
  const handleMouseDown = useCallback((e) => {
    if (!scrollContainerRef.current || !hasHorizontalScroll) return;
    
    const target = e.target;
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-purple-500/50 shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-ffxiv-gold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              多物品組合樹
            </h3>
            {selectedServerOption && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-900/40 border border-purple-500/30 text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span className="text-purple-300">{serverDisplayName}</span>
              </div>
            )}
          </div>
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
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-2 bg-red-900/30 border border-red-500/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          {isLoadingNames || isLoadingPrices ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ffxiv-gold"></div>
                <span className="text-gray-400">載入中...</span>
              </div>
            </div>
          ) : combinedTree ? (
            <div 
              ref={scrollContainerRef}
              className={`overflow-x-auto pb-2 relative ${hasHorizontalScroll && !isDragging ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseLeave={() => {
                if (isDragging) {
                  setIsDragging(false);
                }
              }}
            >
              <div className="flex justify-center min-w-min py-4">
                <CombinedTreeNode
                  combinedNode={combinedTree}
                  itemNames={itemNames}
                  itemPrices={itemPrices}
                  queriedItemIds={queriedItemIds}
                  onItemClick={handleItemClick}
                  isDcQuery={isDcQuery}
                  originalItemList={itemList}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-400">
              無物品列表
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="border-t border-purple-500/20 p-4 flex-shrink-0">
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-slate-800/60 border border-purple-500/30"></div>
              <span>材料</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-400 font-semibold">價格</span>
              <span>= {isDcQuery ? '最低價' : '平均價'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>= 複製名稱</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
