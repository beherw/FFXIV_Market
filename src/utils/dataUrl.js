/**
 * URLs for files under public/data.
 * Every build gets a new BUILD_ID (see vite.config.js), and data URLs carry it as ?v=, so after a
 * deploy the new build fetches the new data instead of a browser/CDN-cached copy of the old file.
 */

// eslint-disable-next-line no-undef
export const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');

/** @param {string} path - path inside public/data, e.g. 'tw-items.msgpack' or 'shards/npcs/3.msgpack' */
export function dataUrl(path) {
  return `${BASE}/data/${path.replace(/^\//, '')}?v=${BUILD_ID}`;
}
