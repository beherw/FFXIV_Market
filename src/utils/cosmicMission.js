const COSMIC_MISSION_RANK_BY_GRADE = {
  1: 'D',
  2: 'C',
  3: 'B',
  4: 'A',
  5: 'EX',
  6: 'EX+',
};

const COSMIC_MISSION_RANK_ORDER = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  EX: 5,
  'EX+': 6,
};

export function getCosmicMissionRank(recipeOrGrade) {
  const grade = Number(
    typeof recipeOrGrade === 'object'
      ? recipeOrGrade?.cosmicMissionGrade
      : recipeOrGrade,
  );

  if (!Number.isFinite(grade) || grade <= 0) {
    return null;
  }

  return COSMIC_MISSION_RANK_BY_GRADE[grade] || null;
}

export function getCosmicMissionRankLabel(recipeOrGrade) {
  const rank = getCosmicMissionRank(recipeOrGrade);
  return rank ? `${rank}級` : null;
}

/**
 * Returns a new recipe list with Cosmic Exploration ranks first, from A to D.
 * Recipes without a rank retain their relative order after ranked recipes.
 */
export function sortRecipesByCosmicMissionRank(recipes) {
  return recipes
    .map((recipe, index) => ({
      recipe,
      index,
      rankOrder: COSMIC_MISSION_RANK_ORDER[getCosmicMissionRank(recipe)] || 0,
    }))
    .sort((left, right) => right.rankOrder - left.rankOrder || left.index - right.index)
    .map(({ recipe }) => recipe);
}
