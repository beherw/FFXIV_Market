/**
 * Get the base path for public assets
 * Automatically detects if running on GitHub Pages or local/Vercel
 */
export function getAssetPath(assetName) {
  const isGitHubPages = window.location.hostname === 'beherw.github.io';
  const base = isGitHubPages ? '/FFXIV_Market/' : '/';
  return `${base}${assetName}`;
}
