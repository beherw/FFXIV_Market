import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertRecipeToSimulatorRecipe,
  createCraftingStatus,
  simulateCraftingOneStep,
} from '../src/services/craftingSolver.js';
import {
  getCosmicMissionRank,
  getCosmicMissionRankLabel,
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
