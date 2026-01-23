/**
 * Get the full URL for internal navigation
 * Automatically adds the /FFXIV_Market/ base path on GitHub Pages
 */
export function getInternalUrl(path) {
  const isGitHubPages = window.location.hostname === 'beherw.github.io';
  const base = isGitHubPages ? '/FFXIV_Market' : '';
  return `${base}${path}`;
}
