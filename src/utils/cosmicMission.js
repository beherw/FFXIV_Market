const COSMIC_MISSION_RANK_BY_GRADE = {
  1: 'D',
  2: 'C',
  3: 'B',
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

  return COSMIC_MISSION_RANK_BY_GRADE[grade] || 'A';
}

export function getCosmicMissionRankLabel(recipeOrGrade) {
  const rank = getCosmicMissionRank(recipeOrGrade);
  return rank ? `${rank}級` : null;
}
