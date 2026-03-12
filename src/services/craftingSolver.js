const DEFAULT_CRAFTER_ATTRIBUTES = {
  level: 100,
  craftsmanship: 4000,
  control: 4000,
  craft_points: 700,
};

const DEFAULT_RAPHAEL_OPTIONS = {
  targetQuality: null,
  useManipulation: true,
  useHeartAndSoul: false,
  useQuickInnovation: false,
  useTrainedEye: false,
  backloadProgress: false,
  adversarial: false,
};

const DEFAULT_SOLVER_OPTIONS = {
  solverType: 'raphael',
  depth: 6,
  specialist: false,
  useObserve: false,
  ...DEFAULT_RAPHAEL_OPTIONS,
};

let wasmModule = null;
let wasmModulePromise = null;

async function loadWasmModule() {
  if (wasmModule) {
    return wasmModule;
  }

  if (!wasmModulePromise) {
    wasmModulePromise = import('../vendor/crafting-wasm/app_wasm.js').then((module) => {
      wasmModule = module;
      return module;
    });
  }

  return wasmModulePromise;
}

export function getDefaultCrafterAttributes() {
  return { ...DEFAULT_CRAFTER_ATTRIBUTES };
}

export function convertRecipeToSimulatorRecipe(recipe) {
  if (!recipe) {
    throw new Error('缺少配方資料');
  }

  return {
    rlv: {
      id: recipe.rlvl ?? 0,
      class_job_level: recipe.lvl ?? 0,
      stars: recipe.stars ?? 0,
      suggested_craftsmanship: recipe.suggestedCraftsmanship ?? 0,
      suggested_control: null,
      difficulty: recipe.progress ?? 0,
      quality: recipe.quality ?? 0,
      progress_divider: recipe.progressDivider ?? 100,
      quality_divider: recipe.qualityDivider ?? 100,
      progress_modifier: recipe.progressModifier ?? 100,
      quality_modifier: recipe.qualityModifier ?? 100,
      durability: recipe.durability ?? 0,
      conditions_flag: recipe.conditionsFlag ?? 15,
    },
    job_level: recipe.lvl ?? 0,
    difficulty: recipe.progress ?? 0,
    quality: recipe.quality ?? 0,
    durability: recipe.durability ?? 0,
    conditions_flag: recipe.conditionsFlag ?? 15,
  };
}

export async function createCraftingStatus(attributes, recipe) {
  const wasm = await loadWasmModule();
  return wasm.new_status(attributes, recipe);
}

export async function simulateCrafting(status, actions) {
  const wasm = await loadWasmModule();
  return wasm.simulate(status, actions);
}

export async function simulateCraftingDetail(status, actions) {
  const wasm = await loadWasmModule();
  return wasm.simulate_detail(status, actions);
}

export async function simulateCraftingOneStep(status, action, forceSuccess = true) {
  const wasm = await loadWasmModule();
  return wasm.simulate_one_step(status, action, forceSuccess);
}

export async function getHighQualityProbability(status) {
  const wasm = await loadWasmModule();
  return wasm.high_quality_probability(status);
}

export async function getAllowedActions(status, actions) {
  const wasm = await loadWasmModule();
  return wasm.allowed_list(status, actions);
}

export async function getCraftPointsList(status, actions) {
  const wasm = await loadWasmModule();
  return wasm.craftpoints_list(status, actions);
}

function hasUsableDetailedStatuses(entries, expectedLength) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return false;
  }

  if (expectedLength > 0 && entries.length !== expectedLength) {
    return false;
  }

  return entries.some((entry) => {
    const status = entry?.status && typeof entry.status === 'object' ? entry.status : entry;
    if (!status || typeof status !== 'object') {
      return false;
    }

    return ['progress', 'quality', 'durability', 'craft_points'].some((key) => Number.isFinite(Number(status[key])));
  });
}

async function buildDetailedStatusesFromSteps(initialStatus, actions) {
  if (!initialStatus || !Array.isArray(actions) || actions.length === 0) {
    return [];
  }

  const statuses = [];
  let currentStatus = initialStatus;

  for (const action of actions) {
    const oneStepResult = await simulateCraftingOneStep(currentStatus, action, true);
    const nextStatus = oneStepResult?.status && typeof oneStepResult.status === 'object'
      ? oneStepResult.status
      : oneStepResult;

    if (!nextStatus || typeof nextStatus !== 'object') {
      break;
    }

    statuses.push(nextStatus);
    currentStatus = nextStatus;
  }

  return statuses;
}

function invokeSolver(name, args) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./craftingSolverWorker.js', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event) => {
      const payload = event.data;
      worker.terminate();

      if (payload?.error) {
        reject(new Error(payload.error));
        return;
      }

      resolve(payload);
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || '求解 Worker 啟動失敗'));
    };

    worker.postMessage({
      name,
      args: JSON.stringify(args),
    });
  });
}

export async function solveWithRaphael(status, options = {}) {
  return invokeSolver('raphael_solve', {
    status,
    ...DEFAULT_RAPHAEL_OPTIONS,
    ...options,
  });
}

export async function solveWithSelectedSolver(status, options = {}) {
  const mergedOptions = {
    ...DEFAULT_SOLVER_OPTIONS,
    ...options,
  };

  switch (mergedOptions.solverType) {
    case 'dfs':
      return invokeSolver('dfs_solve', {
        status,
        depth: mergedOptions.depth,
        specialist: mergedOptions.specialist,
      });
    case 'nq':
      return invokeSolver('nq_solve', {
        status,
        depth: mergedOptions.depth,
        specialist: mergedOptions.specialist,
      });
    case 'reflect':
      return invokeSolver('reflect_solve', {
        status,
        useObserve: mergedOptions.useObserve,
      });
    case 'raphael':
    default:
      return solveWithRaphael(status, mergedOptions);
  }
}

export async function runAutoCraftSimulation(
  recipe,
  attributes = DEFAULT_CRAFTER_ATTRIBUTES,
  solverOptions = DEFAULT_SOLVER_OPTIONS,
  startingQuality = 0,
) {
  const simulatorRecipe = convertRecipeToSimulatorRecipe(recipe);
  const initialStatus = await createCraftingStatus(attributes, simulatorRecipe);
  const clampedStartingQuality = Math.max(0, Math.min(Number(startingQuality) || 0, simulatorRecipe.quality || 0));
  initialStatus.quality = clampedStartingQuality;
  const actions = await solveWithSelectedSolver(initialStatus, solverOptions);
  const simulation = await simulateCrafting(initialStatus, actions);

  let detailedStatuses = [];
  try {
    detailedStatuses = await buildDetailedStatusesFromSteps(initialStatus, actions);
  } catch (error) {
    console.warn('[CraftingSimulator] Failed to build detailed simulation from one-step states:', error);
  }

  if (!hasUsableDetailedStatuses(detailedStatuses, actions.length)) {
    try {
      detailedStatuses = await simulateCraftingDetail(initialStatus, actions);
    } catch (error) {
      console.warn('[CraftingSimulator] Failed to calculate detailed simulation states:', error);
    }
  }

  let hqProbability = null;
  try {
    hqProbability = await getHighQualityProbability(simulation.status);
  } catch (error) {
    console.warn('[CraftingSimulator] Failed to calculate HQ probability:', error);
  }

  return {
    initialStatus,
    finalStatus: simulation.status,
    actions,
    errors: simulation.errors || [],
    detailedStatuses,
    hqProbability,
  };
}