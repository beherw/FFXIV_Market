// Recipe database service - loads recipe data from Supabase
// Used for building crafting price trees

import { getTwRecipes, getTwRecipesByResultIds, getTwRecipesByIngredientId, getTwRecipesByJobAndLevel } from './supabaseData';

let recipesDatabase = null;
let recipesByResult = null;
let isLoading = false;
// Cache for recipes by result (for targeted queries)
const recipesByResultCache = new Map();

/**
 * Load recipes database from local tw-recipes.json
 */
export async function loadRecipeDatabase() {
  if (recipesDatabase && recipesByResult) {
    return { recipes: recipesDatabase, byResult: recipesByResult };
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { recipes: recipesDatabase, byResult: recipesByResult };
  }

  isLoading = true;

  try {
    // Load recipes from Supabase
    recipesDatabase = await getTwRecipes();
    
    // Create a lookup map by result item ID for faster searches
    recipesByResult = new Map();
    recipesDatabase.forEach(recipe => {
      if (recipe.result) {
        // Some items may have multiple recipes (different jobs), store all of them
        if (!recipesByResult.has(recipe.result)) {
          recipesByResult.set(recipe.result, []);
        }
        recipesByResult.get(recipe.result).push(recipe);
      }
    });

    isLoading = false;
    return { recipes: recipesDatabase, byResult: recipesByResult };
  } catch (error) {
    isLoading = false;
    console.error('Failed to load recipe database:', error);
    throw error;
  }
}

/**
 * Find recipes by result item ID (optimized - uses targeted query)
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

  // Use targeted query instead of loading all recipes
  const recipes = await getTwRecipesByResultIds([itemId]);
  
  // Cache the result
  recipesByResultCache.set(itemId, recipes);
  
  return recipes;
}

/**
 * Check if an item has a recipe (is craftable) - optimized with targeted query
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

  // Use targeted query instead of loading all recipes
  const recipes = await getTwRecipesByResultIds([itemId]);
  
  // Cache the result
  recipesByResultCache.set(itemId, recipes);
  
  return recipes.length > 0;
}

// Crystal item IDs (shards, crystals, clusters)
const CRYSTAL_ITEM_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

/**
 * Build a complete crafting tree for an item (OPTIMIZED - batch queries all recipes first)
 * @param {number} itemId - The item ID to build tree for
 * @param {number} amount - The amount needed (default 1)
 * @param {Set} visited - Set of visited item IDs to prevent infinite loops
 * @param {number} depth - Current depth in the tree (for limiting recursion)
 * @param {boolean} excludeCrystals - Whether to exclude crystal items from the tree (default true)
 * @param {Map} recipesByResult - Pre-loaded map of itemId -> recipes (optional, for internal use)
 * @returns {Promise<Object|null>} - Tree node with item info and children, or null if no recipe
 */
export async function buildCraftingTree(itemId, amount = 1, visited = new Set(), depth = 0, excludeCrystals = true, recipesByResult = null) {
  // If recipesByResult is not provided, this is the root call - collect all item IDs first
  if (recipesByResult === null) {
    // Phase 1: Collect all item IDs that will be needed by traversing recipes level by level
    // We need to query recipes level by level to discover ingredient IDs, but we'll only
    // use these queries to collect IDs, then do one final batch query
    const itemIdsToQuery = new Set([itemId]);
    const recipesByResultTemp = new Map();
    let currentLevelItemIds = [itemId];
    let maxDepth = 10; // Safety limit
    let currentDepth = 0;
    
    // Traverse recipe tree level by level, collecting all item IDs
    // We query level by level to discover what items we need, but this is still
    // much better than querying one item at a time
    while (currentLevelItemIds.length > 0 && currentDepth < maxDepth) {
      currentDepth++;
      
      // Batch query recipes for all items at current level
      const recipes = await getTwRecipesByResultIds(currentLevelItemIds);
      
      // Store recipes in temp map
      recipes.forEach(recipe => {
        if (recipe.result) {
          if (!recipesByResultTemp.has(recipe.result)) {
            recipesByResultTemp.set(recipe.result, []);
          }
          recipesByResultTemp.get(recipe.result).push(recipe);
        }
      });
      
      // Find next level of items to query (ingredients from current level)
      const nextLevelItemIds = new Set();
      currentLevelItemIds.forEach(id => {
        const itemRecipes = recipesByResultTemp.get(id);
        if (itemRecipes && itemRecipes.length > 0) {
          const recipe = itemRecipes[0];
          let ingredients = excludeCrystals
            ? recipe.ingredients.filter(ing => !CRYSTAL_ITEM_IDS.has(ing.id))
            : recipe.ingredients;
          
          ingredients.forEach(ing => {
            // Only add if we haven't seen it yet
            if (!itemIdsToQuery.has(ing.id)) {
              nextLevelItemIds.add(ing.id);
              itemIdsToQuery.add(ing.id);
            }
          });
        }
      });
      
      currentLevelItemIds = Array.from(nextLevelItemIds);
    }
    
    // Phase 2: Use the recipes we already queried (no need for another query)
    // The recipesByResultTemp already has all the recipes we need
    recipesByResult = recipesByResultTemp;
    
    // Populate cache for future use
    Array.from(itemIdsToQuery).forEach(id => {
      const recipes = recipesByResult.get(id) || [];
      if (recipes.length > 0) {
        recipesByResultCache.set(id, recipes);
      }
    });
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

  const recipes = recipesByResult.get(itemId) || [];
  
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

  // Build children synchronously (recipes are already loaded)
  const children = filteredIngredients.map((ingredient) => {
    const ingredientAmount = ingredient.amount * craftsNeeded;
    return buildCraftingTree(
      ingredient.id,
      ingredientAmount,
      newVisited,
      depth + 1,
      excludeCrystals,
      recipesByResult // Pass the pre-loaded recipes map
    );
  });

  // Wait for all children to be built (they're now synchronous since recipes are pre-loaded)
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
 * Find all items that use this item as an ingredient (optimized - uses targeted query with limit)
 * @param {number} itemId - The ingredient item ID to search for
 * @param {number} maxResults - Maximum number of unique result items to return (default: 20)
 * @returns {Promise<Array<number>>} - Array of unique result item IDs that use this item as ingredient (limited to maxResults)
 */
export async function findRelatedItems(itemId, maxResults = 20) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  // Optimize: Fetch more recipes than needed to ensure we get enough unique results
  // Since multiple recipes can produce the same item, fetch 3x the desired results
  // This ensures we get at least maxResults unique result IDs
  const recipeLimit = maxResults * 3;

  // Use targeted query with limit instead of loading all recipes
  const recipes = await getTwRecipesByIngredientId(itemId, null, recipeLimit);
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
 * Load recipes filtered by job and level range (optimized - uses targeted query with WHERE clauses)
 * This replaces the need to load all recipes and filter in JavaScript
 * @param {Array<number>} jobs - Array of job IDs to filter by (optional, empty array = all jobs)
 * @param {number} minLevel - Minimum level (optional, default 1)
 * @param {number} maxLevel - Maximum level (optional, default 100)
 * @param {AbortSignal} signal - Optional abort signal to cancel the request
 * @returns {Promise<Object>} - { recipes: Array, byResult: Map } where byResult maps itemId to array of recipes
 */
export async function loadRecipesByJobAndLevel(jobs = [], minLevel = 1, maxLevel = 100, signal = null) {
  // Use targeted query instead of loading all recipes
  const recipes = await getTwRecipesByJobAndLevel(jobs, minLevel, maxLevel, signal);
  
  // Create a lookup map by result item ID for faster searches
  const recipesByResult = new Map();
  recipes.forEach(recipe => {
    if (recipe.result) {
      // Some items may have multiple recipes (different jobs), store all of them
      if (!recipesByResult.has(recipe.result)) {
        recipesByResult.set(recipe.result, []);
      }
      recipesByResult.get(recipe.result).push(recipe);
    }
  });

  return { recipes, byResult: recipesByResult };
}
