import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertRecipeToSimulatorRecipe,
  createCraftingStatus,
  getRecipeCollectability,
  getRecipeQualityTarget,
  simulateCraftingOneStep,
} from '../src/services/craftingSolver.js';
import {
  getCosmicMissionRank,
  getCosmicMissionRankLabel,
  sortRecipesByCosmicMissionRank,
} from '../src/utils/cosmicMission.js';

const outdoorFirewoodRecipe = {
  lvl: 100,
  stars: 0,
  progress: 4422,
  quality: 6360,
  durability: 60,
  suggestedCraftsmanship: 4207,
  rlvl: 690,
  progressDivider: 170,
  qualityDivider: 150,
  progressModifier: 90,
  qualityModifier: 75,
  conditionsFlag: 15,
};

test('simulator keeps the real recipe level for level correction', () => {
  const simulatorRecipe = convertRecipeToSimulatorRecipe(outdoorFirewoodRecipe);

  assert.equal(simulatorRecipe.job_level, 100);
  assert.equal(simulatorRecipe.rlv.quality_modifier, 75);
});

test('Reflect applies the level 100 recipe quality modifier', async () => {
  const attributes = {
    level: 100,
    craftsmanship: 4420,
    control: 4068,
    craft_points: 578,
  };
  const recipe = convertRecipeToSimulatorRecipe(outdoorFirewoodRecipe);
  const status = await createCraftingStatus(attributes, recipe);
  const result = await simulateCraftingOneStep(status, 'reflect', true);

  assert.equal(result.status.quality, 687);
});

test('lower-level sandbox simulation remains available and keeps the modifier', async () => {
  const attributes = {
    level: 69,
    craftsmanship: 4420,
    control: 4068,
    craft_points: 578,
  };
  const recipe = convertRecipeToSimulatorRecipe(outdoorFirewoodRecipe);
  const status = await createCraftingStatus(attributes, recipe);
  const result = await simulateCraftingOneStep(status, 'basic_touch', true);

  assert.equal(result.status.quality, 229);
});

test('Cosmic Exploration mission grades use the in-game rank groups', () => {
  assert.equal(getCosmicMissionRank({ cosmicMissionGrade: 1 }), 'D');
  assert.equal(getCosmicMissionRankLabel({ cosmicMissionGrade: 4 }), 'A級');
  assert.equal(getCosmicMissionRankLabel({}), null);
});

test('simulator recipe choices sort Cosmic Exploration ranks from A to D', () => {
  const recipes = [
    { id: 'normal-first' },
    { id: 'c', cosmicMissionGrade: 2 },
    { id: 'a', cosmicMissionGrade: 4 },
    { id: 'd', cosmicMissionGrade: 1 },
    { id: 'b', cosmicMissionGrade: 3 },
    { id: 'normal-last' },
  ];

  assert.deepEqual(
    sortRecipesByCosmicMissionRank(recipes).map(({ id }) => id),
    ['a', 'b', 'c', 'd', 'normal-first', 'normal-last'],
  );
  assert.deepEqual(recipes.map(({ id }) => id), [
    'normal-first', 'c', 'a', 'd', 'b', 'normal-last',
  ]);
});

test('collectables use their first and final grade thresholds as solver targets', () => {
  const collectableRecipe = {
    quality: 8100,
    collectability: { low: 360, mid: 540, high: 720 },
  };

  assert.equal(getRecipeQualityTarget(collectableRecipe, 'low'), 3600);
  assert.equal(getRecipeQualityTarget(collectableRecipe, 'high'), 7200);
  assert.equal(getRecipeQualityTarget({ quality: 8100 }, 'low'), 0);
  assert.equal(getRecipeQualityTarget({ quality: 8100 }, 'high'), null);
});

test('only flagged Cosmic Exploration collectables use the one-tenth scale', () => {
  const cosmicRecipe = { quality: 11682, cosmicMissionGrade: 2, isCollectable: true };
  assert.deepEqual(getRecipeCollectability(cosmicRecipe), {
    max: 1168, low: 233, mid: 467, high: 817,
  });
  assert.equal(getRecipeQualityTarget(cosmicRecipe, 817), 8170);
  assert.equal(getRecipeCollectability({ quality: 6000, cosmicMissionGrade: 2 }), null);
});
