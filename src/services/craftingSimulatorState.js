export function resolveDisplayCraftingStatus({
  simulationMode,
  needsSolve,
  finalStatus,
  autoInitialStatus,
  simulationResultInitialStatus,
  manualInitialStatus,
  manualResultStatus,
  manualStepStatus,
}) {
  if (simulationMode === 'manual') {
    return manualResultStatus || manualStepStatus || manualInitialStatus || simulationResultInitialStatus || null;
  }

  if (!needsSolve && finalStatus) {
    return finalStatus;
  }

  return autoInitialStatus || simulationResultInitialStatus || null;
}
