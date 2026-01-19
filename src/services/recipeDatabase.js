// Recipe database service - loads recipe data from tw-recipes.json
// Used for building crafting price trees

import twRecipesData from '../../teamcraft_git/libs/data/src/lib/json/tw/tw-recipes.json';

let recipesDatabase = null;
let recipesByResult = null;
let isLoading = false;

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
    // Recipes are already loaded from the JSON import
    recipesDatabase = twRecipesData;
    
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
 * Find recipes by result item ID
 * @param {number} itemId - The result item ID to search for
 * @returns {Promise<Array>} - Array of recipes that produce this item
 */
export async function findRecipesByResult(itemId) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  const { byResult } = await loadRecipeDatabase();
  return byResult.get(itemId) || [];
}

/**
 * Check if an item has a recipe (is craftable)
 * @param {number} itemId - The item ID to check
 * @returns {Promise<boolean>} - True if the item has at least one recipe
 */
export async function hasRecipe(itemId) {
  if (!itemId || itemId <= 0) {
    return false;
  }

  const { byResult } = await loadRecipeDatabase();
  return byResult.has(itemId);
}

// Item IDs to exclude from crafting tree (crystals/shards)
const EXCLUDED_ITEM_IDS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

/**
 * Build a complete crafting tree for an item
 * @param {number} itemId - The item ID to build tree for
 * @param {number} amount - The amount needed (default 1)
 * @param {Set} visited - Set of visited item IDs to prevent infinite loops
 * @param {number} depth - Current depth in the tree (for limiting recursion)
 * @returns {Promise<Object|null>} - Tree node with item info and children, or null if no recipe
 */
export async function buildCraftingTree(itemId, amount = 1, visited = new Set(), depth = 0) {
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

  const recipes = await findRecipesByResult(itemId);
  
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

  // Build children for each ingredient, excluding crystals/shards (IDs 2-7)
  const filteredIngredients = recipe.ingredients.filter(
    ingredient => !EXCLUDED_ITEM_IDS.has(ingredient.id)
  );

  const children = await Promise.all(
    filteredIngredients.map(async (ingredient) => {
      const ingredientAmount = ingredient.amount * craftsNeeded;
      return await buildCraftingTree(
        ingredient.id,
        ingredientAmount,
        newVisited,
        depth + 1
      );
    })
  );

  return {
    itemId,
    amount,
    recipeId: recipe.id,
    job: recipe.job,
    level: recipe.lvl,
    yields,
    craftsNeeded,
    children,
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
 * Find all items that use this item as an ingredient
 * @param {number} itemId - The ingredient item ID to search for
 * @returns {Promise<Array<number>>} - Array of unique result item IDs that use this item as ingredient
 */
export async function findRelatedItems(itemId) {
  if (!itemId || itemId <= 0) {
    return [];
  }

  const { recipes } = await loadRecipeDatabase();
  const relatedItemIds = new Set();

  // Search through all recipes
  recipes.forEach(recipe => {
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      // Check if this item is in the ingredients
      const isIngredient = recipe.ingredients.some(
        ingredient => ingredient.id === itemId
      );
      
      if (isIngredient && recipe.result) {
        relatedItemIds.add(recipe.result);
      }
    }
  });

  return Array.from(relatedItemIds);
}
