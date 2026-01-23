/**
 * Get the base path for public assets
 * Uses Vite's BASE_URL which is set during build based on environment
 */
export function getAssetPath(assetName) {
  return `${import.meta.env.BASE_URL}${assetName}`;
}
