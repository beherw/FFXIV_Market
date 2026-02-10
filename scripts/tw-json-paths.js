/**
 * Resolved TW JSON directory and path helper for build scripts.
 * Run "npm run resolve-tw-json" (or prebuild) first to populate .tw-json/.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Directory containing resolved tw-*.json (newer of teamcraft vs tw_dataminer/output) */
export const TW_JSON_DIR = path.join(__dirname, '..', '.tw-json');

/**
 * @param {string} filename - e.g. 'tw-items.json'
 * @returns {string} Absolute path to the resolved JSON file
 */
export function getTwJsonPath(filename) {
  return path.join(TW_JSON_DIR, filename);
}
