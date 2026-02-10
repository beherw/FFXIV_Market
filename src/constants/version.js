// Application version - update this when deploying new versions
export const APP_VERSION = '2025-02-11';

/**
 * Cache invalidation for loaded-data caches only (e.g. msgpack-derived state).
 * Any such cache with no timestamp or timestamp before this value is invalid.
 * Set to 2025-02-11 00:00 UTC. Not used for history or search recommendations
 * (item IDs/keywords only).
 *
 * To force reload of all versioned caches after a future data migration,
 * set this to Date.now() (or a future date) and deploy.
 */
export const CACHE_MIN_VALID_TIMESTAMP = new Date(Date.UTC(2025, 1, 11, 0, 0, 0, 0)).getTime(); // 2025-02-11 00:00 UTC
