import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDisplayCraftingStatus } from './craftingSimulatorState.js';

test('uses the auto initial status before a solve is run', () => {
  const status = resolveDisplayCraftingStatus({
    simulationMode: 'auto',
    needsSolve: true,
    finalStatus: null,
    autoInitialStatus: { progress: 0, quality: 0, durability: 80, craft_points: 700 },
    simulationResultInitialStatus: null,
  });

  assert.equal(status?.progress, 0);
  assert.equal(status?.quality, 0);
  assert.equal(status?.durability, 80);
  assert.equal(status?.craft_points, 700);
});

test('prefers the final auto status after a solve has completed', () => {
  const status = resolveDisplayCraftingStatus({
    simulationMode: 'auto',
    needsSolve: false,
    finalStatus: { progress: 100, quality: 500, durability: 60, craft_points: 300 },
    autoInitialStatus: { progress: 0, quality: 0, durability: 80, craft_points: 700 },
    simulationResultInitialStatus: { progress: 0, quality: 0, durability: 80, craft_points: 700 },
  });

  assert.equal(status?.progress, 100);
  assert.equal(status?.quality, 500);
});

test('uses manual statuses when the manual simulation mode is active', () => {
  const status = resolveDisplayCraftingStatus({
    simulationMode: 'manual',
    needsSolve: true,
    finalStatus: null,
    manualInitialStatus: { progress: 0, quality: 0, durability: 80, craft_points: 700 },
    manualResultStatus: { progress: 20, quality: 100, durability: 70, craft_points: 650 },
    manualStepStatus: { progress: 10, quality: 50, durability: 75, craft_points: 680 },
    simulationResultInitialStatus: { progress: 0, quality: 0, durability: 80, craft_points: 700 },
  });

  assert.equal(status?.progress, 20);
  assert.equal(status?.quality, 100);
});
