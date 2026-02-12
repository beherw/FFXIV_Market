/**
 * Single source of truth for app version and cache invalidation.
 *
 * When releasing: update DEPLOY_DATE to the deploy date/time (UTC).
 * APP_VERSION and CACHE_MIN_VALID_TIMESTAMP are derived from it.
 * Only versioned caches (script/msgpack-derived) are invalidated; user history
 * and preferences are NOT cleared.
 */

// Set to deploy date/time (UTC) when you release
const DEPLOY_DATE = new Date(Date.UTC(2026, 1, 12, 0, 0, 0, 0)); // 2026-02-12 00:00 UTC

const y = DEPLOY_DATE.getUTCFullYear();
const m = String(DEPLOY_DATE.getUTCMonth() + 1).padStart(2, '0');
const d = String(DEPLOY_DATE.getUTCDate()).padStart(2, '0');

export const APP_VERSION = `${y}-${m}-${d}`;

export const CACHE_MIN_VALID_TIMESTAMP = DEPLOY_DATE.getTime();
