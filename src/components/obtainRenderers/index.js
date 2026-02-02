/**
 * Dynamic renderer loader for obtainable methods
 * This allows lazy-loading only the renderers needed for a specific item
 */

import { DataType } from '../../services/extractsService';

// Renderer module cache to avoid re-importing
const rendererCache = {};

/**
 * Get renderer function for a specific DataType
 * @param {number} dataType - DataType enum value
 * @returns {Promise<Function|null>} Renderer function or null if not found
 */
export async function getRenderer(dataType) {
  // Return cached renderer if available
  if (rendererCache[dataType]) {
    return rendererCache[dataType];
  }

  try {
    let rendererModule = null;

    switch (dataType) {
      case DataType.CRAFTED_BY:
        rendererModule = await import('./craftedByRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderCraftedBy;
        break;

      case DataType.TRADE_SOURCES:
        rendererModule = await import('./tradeSourcesRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderTradeSources;
        break;

      case DataType.VENDORS:
        rendererModule = await import('./vendorsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderVendors;
        break;

      case DataType.TREASURES:
        rendererModule = await import('./treasuresRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderTreasures;
        break;

      case DataType.INSTANCES:
        rendererModule = await import('./instancesRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderInstances;
        break;

      case DataType.DROPS:
        rendererModule = await import('./dropsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderDrops;
        break;

      case DataType.DESYNTHS:
        rendererModule = await import('./desynthsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderDesynths;
        break;

      case DataType.QUESTS:
        rendererModule = await import('./questsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderQuests;
        break;

      case DataType.FATES:
        rendererModule = await import('./fatesRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderFates;
        break;

      case DataType.GATHERED_BY:
        rendererModule = await import('./gatheredByRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderGatheredBy;
        break;

      case DataType.REDUCED_FROM:
        rendererModule = await import('./reducedFromRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderReducedFrom;
        break;

      case DataType.VENTURES:
        rendererModule = await import('./venturesRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderVentures;
        break;

      case DataType.GARDENING:
        rendererModule = await import('./gardeningRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderGardening;
        break;

      case DataType.MOGSTATION:
        rendererModule = await import('./mogstationRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderMogstation;
        break;

      case DataType.ISLAND_CROP:
        rendererModule = await import('./levesRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderLeves;
        break;

      case DataType.VOYAGES:
        rendererModule = await import('./voyagesRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderVoyages;
        break;

      case DataType.MASTERBOOKS:
        rendererModule = await import('./masterbooksRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderMasterbooks;
        break;

      case DataType.ALARMS:
        rendererModule = await import('./alarmsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderAlarms;
        break;

      case DataType.ACHIEVEMENTS:
        rendererModule = await import('./achievementsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderAchievements;
        break;

      case DataType.REQUIREMENTS:
      case 23: // Teamcraft uses 23 for REQUIREMENTS
        rendererModule = await import('./requirementsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderRequirements;
        break;

      case 19: // RETAINER_TASKS (not in standard DataType enum)
        rendererModule = await import('./retainerTasksRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderRetainerTasks;
        break;

      case 21: // EXPLORATION_RESULTS (not in standard DataType enum)
        rendererModule = await import('./explorationResultsRenderer.jsx');
        rendererCache[dataType] = rendererModule.renderExplorationResults;
        break;

      case DataType.ISLAND_PASTURE:
        // Return null renderer - these are filtered out
        return null;

      default:
        console.warn(`[RendererLoader] No renderer found for DataType ${dataType}`);
        return null;
    }

    return rendererCache[dataType];
  } catch (error) {
    console.error(`[RendererLoader] Failed to load renderer for DataType ${dataType}:`, error);
    return null;
  }
}

/**
 * Preload specific renderers
 * @param {number[]} dataTypes - Array of DataType enum values to preload
 */
export async function preloadRenderers(dataTypes) {
  const promises = dataTypes.map(dataType => getRenderer(dataType));
  await Promise.all(promises);
}

/**
 * Clear renderer cache (useful for hot module replacement in development)
 */
export function clearRendererCache() {
  Object.keys(rendererCache).forEach(key => delete rendererCache[key]);
}
