/**
 * Unified Pagination Configuration
 * Used across all components for consistent item table display
 */

export const PAGINATION_CONFIG = {
  // Default items per page
  DEFAULT_ITEMS_PER_PAGE: 20,
  
  // Maximum items per page
  MAX_ITEMS_PER_PAGE: 100,
  
  // Available pagination options (must not exceed MAX_ITEMS_PER_PAGE)
  ITEMS_PER_PAGE_OPTIONS: [20, 50, 100],
};

/**
 * Validates and returns items per page value
 * @param {number} value - The requested items per page
 * @returns {number} - The validated items per page (between 1 and MAX_ITEMS_PER_PAGE)
 */
export function validateItemsPerPage(value) {
  if (!Number.isInteger(value) || value <= 0) {
    return PAGINATION_CONFIG.DEFAULT_ITEMS_PER_PAGE;
  }
  return Math.min(value, PAGINATION_CONFIG.MAX_ITEMS_PER_PAGE);
}
