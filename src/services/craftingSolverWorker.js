self.onmessage = async (event) => {
  const { name, args: argsJson } = event.data;

  try {
    const args = JSON.parse(argsJson);
    const {
      dfs_solve,
      nq_solve,
      reflect_solve,
      raphael_solve,
    } = await import('../vendor/crafting-wasm/app_wasm.js');

    let result;

    switch (name) {
      case 'dfs_solve':
        result = dfs_solve(args.status, args.depth, args.specialist);
        break;
      case 'nq_solve':
        result = nq_solve(args.status, args.depth, args.specialist);
        break;
      case 'reflect_solve':
        result = reflect_solve(args.status, args.useObserve);
        break;
      case 'raphael_solve':
        result = raphael_solve(
          args.status,
          args.targetQuality,
          args.useManipulation,
          args.useHeartAndSoul,
          args.useQuickInnovation,
          args.useTrainedEye,
          args.backloadProgress,
          args.adversarial,
        );
        break;
      default:
        throw new Error(`Unknown solver: ${name}`);
    }

    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : '求解失敗',
    });
  }
};