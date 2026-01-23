/**
 * Get the full URL for internal navigation
 * Uses Vite's BASE_URL which is set during build based on environment
 */
export function getInternalUrl(path) {
  return `${import.meta.env.BASE_URL}${path}`.replace(/\/+/g, '/');
}
