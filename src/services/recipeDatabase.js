// Recipe database service - loads recipe data from local MessagePack binary file
// Used for building crafting price trees
// 
// Data source: /public/data/recipes.msgpack (generated at build time from CSV)
// Format: MessagePack binary (~2-3MB, 50%+ smaller than JSON, 5x faster parsing)

import { decode } from '@msgpack/msgpack';

let recipesDatabase = null;
let recipesByResult = null;
let recipesByIngredient = null;
let isLoading = false;
let loadPromise = null;

// Cache for recipes by result (for targeted queries)
const recipesByResultCache = new Map();

/**
 * Load recipes database from local MessagePack binary file
 * Loads from local recipes.msgpack (single file fetch).
 * Benefits: fast, smaller than JSON, no remote DB, works offline.
 */
export async function loadRecipeDatabase() {
  // Return cached data if available
  if (recipesDatabase && recipesByResult) {
    return { recipes: recipesDatabase, byResult: recipesByResult, byIngredient: recipesByIngredient };
  }

  // If already loading, wait for existing load
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  // Create promise for concurrent callers to wait on
  loadPromise = (async () => {
    try {
      const loadStartTime = performance.now();
      
      // Fetch MessagePack binary file
      console.log('[Recipe] 📦 Loading recipes from MessagePack...');
      const baseUrl = import.meta.env.BASE_URL || '/';
      const response = await fetch(`${baseUrl}data/recipes.msgpack`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recipes: ${response.status} ${response.statusText}`);
      }
      
      // Get binary data
      const arrayBuffer = await response.arrayBuffer();
      const fetchTime = performance.now() - loadStartTime;
      console.log(`[Recipe] ✓ Fetched ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB in ${fetchTime.toFixed(2)}ms`);
      
      // Decode MessagePack
      const decodeStartTime = performance.now();
      recipesDatabase = decode(new Uint8Array(arrayBuffer));
      const decodeTime = performance.now() - decodeStartTime;
      console.log(`[Recipe] ✓ Decoded ${recipesDatabase.length} recipes in ${decodeTime.toFixed(2)}ms`);
      
      // Build indexes for fast lookups
      const indexStartTime = performance.now();
      recipesByResult = new Map();
      recipesByIngredient = new Map();
      
      recipesDatabase.forEach(recipe => {
        // Index by result item ID
        if (recipe.result) {
          if (!recipesByResult.has(recipe.result)) {
            recipesByResult.set(recipe.result, []);
          }
          recipesByResult.get(recipe.result).push(recipe);
        }
        
        // Index by ingredient item IDs
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
          recipe.ingredients.forEach(ingredient => {
            if (ingredient.id) {
              if (!recipesByIngredient.has(ingredient.id)) {
                recipesByIngredient.set(ingredient.id, []);
              }
              recipesByIngredient.get(ingredient.id).push(recipe);
            }
          });
        }
      });
      
      const indexTime = performance.now() - indexStartTime;
      const totalTime = performance.now() - loadStartTime;
      
      console.log(`[Recipe] ✓ Built indexes in ${indexTime.toFixed(2)}ms`);
      console.log(`[Recipe] ✅ Total load time: ${totalTime.toFixed(2)}ms (${recipesDatabase.length} recipes)`);
      console.log(`[Recipe] 📊 Indexes: ${recipesByResult.size} results, ${recipesByIngredient.size} ingredients`);

      isLoading = false;
      return { recipes: recipesDatabase, byResult: recipesByResult, byIngredient: recipesByIngredient };
    } catch (error) {
      isLoading = false;
      loadPromise = null;
      console.error('[Recipe] ❌ Failed to load recipe database:', error);
      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Find recipes by result item ID (fast - uses in-memory index)
 * @param {number} itemId - The result item ID to search for
 * @returns {Promise<Array>} - Array of recipes that produce this item
 */
export async function findRecipesByResult(itemId) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  // Check cache first
  if (recipesByResultCache.has(itemId)) {
    return recipesByResultCache.get(itemId);
  }

  // Ensure database is loaded
  const { byResult } = await loadRecipeDatabase();
  
  // Get recipes from in-memory index
  const recipes = byResult.get(itemId) || [];
  
  // Cache the result
  recipesByResultCache.set(itemId, recipes);
  
  return recipes;
}

/**
 * Check if an item has a recipe (is craftable) - fast in-memory lookup
 * @param {number} itemId - The item ID to check
 * @returns {Promise<boolean>} - True if the item has at least one recipe
 */
export async function hasRecipe(itemId) {
  if (!itemId || itemId <= 0) {
    return false;
  }

  // Check cache first
  if (recipesByResultCache.has(itemId)) {
    const recipes = recipesByResultCache.get(itemId);
    return recipes.length > 0;
  }

  // Ensure database is loaded
  const { byResult } = await loadRecipeDatabase();
  
  // Get recipes from in-memory index
  const recipes = byResult.get(itemId) || [];
  
  // Cache the result
  recipesByResultCache.set(itemId, recipes);
  
  return recipes.length > 0;
}

// Crystal item IDs (shards, crystals, clusters)
const CRYSTAL_ITEM_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

/**
 * Build a complete crafting tree for an item (FAST - uses in-memory data)
 * @param {number} itemId - The item ID to build tree for
 * @param {number} amount - The amount needed (default 1)
 * @param {Set} visited - Set of visited item IDs to prevent infinite loops
 * @param {number} depth - Current depth in the tree (for limiting recursion)
 * @param {boolean} excludeCrystals - Whether to exclude crystal items from the tree (default true)
 * @param {Map} recipesByResultMap - Pre-loaded map of itemId -> recipes (optional, for internal use)
 * @returns {Promise<Object|null>} - Tree node with item info and children, or null if no recipe
 */
export async function buildCraftingTree(itemId, amount = 1, visited = new Set(), depth = 0, excludeCrystals = true, recipesByResultMap = null) {
  // If recipesByResultMap is not provided, this is the root call - load all recipes once
  if (recipesByResultMap === null) {
    // Load all recipes from MessagePack (fast - single file fetch + in-memory index)
    const { byResult } = await loadRecipeDatabase();
    recipesByResultMap = byResult;
  }

  // Phase 3: Build tree structure using pre-loaded recipes
  // Prevent infinite loops and limit depth
  if (visited.has(itemId) || depth > 10) {
    return {
      itemId,
      amount,
      children: [],
      isCyclic: visited.has(itemId),
      maxDepthReached: depth > 10,
    };
  }

  const recipes = recipesByResultMap.get(itemId) || [];
  
  if (recipes.length === 0) {
    // This is a base material (no recipe)
    return {
      itemId,
      amount,
      children: [],
      isBaseMaterial: true,
    };
  }

  // Use the first recipe (usually the main one)
  // In FFXIV, items typically have one recipe per job, and they're usually identical
  const recipe = recipes[0];
  
  // Mark this item as visited to prevent cycles
  const newVisited = new Set(visited);
  newVisited.add(itemId);

  // Calculate how many crafts needed based on yields
  const yields = recipe.yields || 1;
  const craftsNeeded = Math.ceil(amount / yields);

  // Build children for each ingredient, optionally excluding crystals/shards
  let filteredIngredients = excludeCrystals
    ? recipe.ingredients.filter(ingredient => !CRYSTAL_ITEM_IDS.has(ingredient.id))
    : recipe.ingredients;

  // If not excluding crystals, sort ingredients to place crystals in the middle of non-crystals
  if (!excludeCrystals && recipe.ingredients.length > 0) {
    const nonCrystals = recipe.ingredients.filter(ingredient => !CRYSTAL_ITEM_IDS.has(ingredient.id));
    const crystals = recipe.ingredients.filter(ingredient => CRYSTAL_ITEM_IDS.has(ingredient.id));
    
    if (nonCrystals.length > 0 && crystals.length > 0) {
      // Distribute crystals evenly among non-crystals
      const sortedIngredients = [];
      const crystalCount = crystals.length;
      const nonCrystalCount = nonCrystals.length;
      
      // Calculate how many crystals to place between each pair of non-crystals
      // We'll distribute crystals as evenly as possible
      const slots = nonCrystalCount - 1; // Number of gaps between non-crystals
      const crystalsPerSlot = slots > 0 ? Math.floor(crystalCount / slots) : 0;
      const extraCrystals = slots > 0 ? crystalCount % slots : crystalCount;
      
      let crystalIndex = 0;
      
      // Place non-crystals and distribute crystals between them
      for (let i = 0; i < nonCrystals.length; i++) {
        sortedIngredients.push(nonCrystals[i]);
        
        // Add crystals after this non-crystal (except for the last one)
        if (i < nonCrystals.length - 1) {
          const crystalsToAdd = crystalsPerSlot + (i < extraCrystals ? 1 : 0);
          for (let j = 0; j < crystalsToAdd && crystalIndex < crystals.length; j++) {
            sortedIngredients.push(crystals[crystalIndex]);
            crystalIndex++;
          }
        }
      }
      
      // Add any remaining crystals at the end
      while (crystalIndex < crystals.length) {
        sortedIngredients.push(crystals[crystalIndex]);
        crystalIndex++;
      }
      
      filteredIngredients = sortedIngredients;
    } else if (crystals.length > 0 && nonCrystals.length === 0) {
      // Only crystals, keep them as is (already on the right)
      filteredIngredients = crystals;
    }
    // If only non-crystals, filteredIngredients is already correct
  }

  // Build children recursively (all data already in memory - very fast)
  const children = filteredIngredients.map((ingredient) => {
    const ingredientAmount = ingredient.amount * craftsNeeded;
    return buildCraftingTree(
      ingredient.id,
      ingredientAmount,
      newVisited,
      depth + 1,
      excludeCrystals,
      recipesByResultMap // Pass the pre-loaded recipes map
    );
  });

  // Wait for all children to be built
  const resolvedChildren = await Promise.all(children);

  return {
    itemId,
    amount,
    recipeId: recipe.id,
    job: recipe.job,
    level: recipe.lvl,
    yields,
    craftsNeeded,
    children: resolvedChildren,
    isBaseMaterial: false,
  };
}

/**
 * Flatten a crafting tree into a list of all unique items
 * @param {Object} tree - The crafting tree root node
 * @returns {Array} - Array of { itemId, totalAmount } for all items in the tree
 */
export function flattenCraftingTree(tree) {
  const itemMap = new Map();

  function traverse(node) {
    if (!node) return;
    
    const existing = itemMap.get(node.itemId) || 0;
    itemMap.set(node.itemId, existing + node.amount);
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(tree);

  return Array.from(itemMap.entries()).map(([itemId, totalAmount]) => ({
    itemId,
    totalAmount,
  }));
}

/**
 * Get all item IDs from a crafting tree (for batch price fetching)
 * @param {Object} tree - The crafting tree root node
 * @returns {Array<number>} - Array of unique item IDs
 */
export function getAllItemIds(tree) {
  const ids = new Set();

  function traverse(node) {
    if (!node) return;
    ids.add(node.itemId);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(tree);
  return Array.from(ids);
}

/**
 * Find all items that use this item as an ingredient (fast - uses in-memory index)
 * @param {number} itemId - The ingredient item ID to search for
 * @param {number} maxResults - Maximum number of unique result items to return (default: 20)
 * @returns {Promise<Array<number>>} - Array of unique result item IDs that use this item as ingredient (limited to maxResults)
 */
export async function findRelatedItems(itemId, maxResults = 20) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  // Ensure database is loaded
  const { byIngredient } = await loadRecipeDatabase();
  
  // Get recipes that use this item as ingredient from in-memory index
  const recipes = byIngredient.get(itemId) || [];
  const relatedItemIds = new Set();

  // Extract result item IDs from recipes until we have enough unique results
  for (const recipe of recipes) {
    if (recipe.result) {
      relatedItemIds.add(recipe.result);
      // Early exit if we already have enough unique results
      if (relatedItemIds.size >= maxResults) {
        break;
      }
    }
  }

  // Convert to array and limit to maxResults (in case we got more than needed)
  return Array.from(relatedItemIds).slice(0, maxResults);
}

/**
 * Load recipes filtered by job and level range (fast - filters in-memory data)
 * @param {Array<number>} jobs - Array of job IDs to filter by (optional, empty array = all jobs)
 * @param {number} minLevel - Minimum level (optional, default 1)
 * @param {number} maxLevel - Maximum level (optional, default 100)
 * @param {AbortSignal} signal - Optional abort signal (not used in local mode, kept for API compatibility)
 * @returns {Promise<Object>} - { recipes: Array, byResult: Map } where byResult maps itemId to array of recipes
 */
export async function loadRecipesByJobAndLevel(jobs = [], minLevel = 1, maxLevel = 100, signal = null) {
  // Ensure database is loaded
  const { recipes: allRecipes } = await loadRecipeDatabase();
  
  // Filter recipes in memory (very fast)
  const filteredRecipes = allRecipes.filter(recipe => {
    // Check level range
    if (recipe.lvl < minLevel || recipe.lvl > maxLevel) {
      return false;
    }
    
    // Check job filter (if specified)
    if (jobs.length > 0 && !jobs.includes(recipe.job)) {
      return false;
    }
    
    return true;
  });
  
  // Create a lookup map by result item ID for faster searches
  const recipesByResult = new Map();
  filteredRecipes.forEach(recipe => {
    if (recipe.result) {
      // Some items may have multiple recipes (different jobs), store all of them
      if (!recipesByResult.has(recipe.result)) {
        recipesByResult.set(recipe.result, []);
      }
      recipesByResult.get(recipe.result).push(recipe);
    }
  });

  return { recipes: filteredRecipes, byResult: recipesByResult };
}
