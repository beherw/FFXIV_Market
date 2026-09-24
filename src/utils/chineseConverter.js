// Traditional ↔ Simplified Chinese conversion using opencc-js
// Provides accurate bidirectional conversion for display and search

import { Converter as T2CNConverter } from 'opencc-js/t2cn'; // Traditional to Simplified
import { Converter as CN2TConverter } from 'opencc-js/cn2t'; // Simplified to Traditional

// Initialize converters with proper options
// t2cn: Traditional to Simplified (from: 't', to: 'cn')
const traditionalToSimplifiedConverter = T2CNConverter({ from: 't', to: 'cn' });

// cn2t: Simplified to Traditional (from: 'cn', to: 't')
const simplifiedToTraditionalConverter = CN2TConverter({ from: 'cn', to: 't' });

/**
 * Converts any Chinese text (Traditional or Simplified) to Simplified Chinese (for search)
 * This function handles both Traditional and Simplified input, converting to Simplified for database search
 * @param {string} text - Text in Traditional or Simplified Chinese
 * @returns {string} Text in Simplified Chinese
 */
export function convertTraditionalToSimplified(text) {
  if (!text) return text;
  try {
    // t2cn converter can handle both Traditional and Simplified input
    // If input is already Simplified, it will mostly remain unchanged
    // If input is Traditional, it will be converted to Simplified
    return traditionalToSimplifiedConverter(text);
  } catch (error) {
    console.error('Error converting to Simplified Chinese:', error);
    return text; // Return original text on error
  }
}

/**
 * Converts Simplified Chinese to Traditional Chinese (for display)
 * @param {string} text - Text in Simplified Chinese
 * @returns {string} Text in Traditional Chinese
 */
export function convertSimplifiedToTraditional(text) {
  if (!text) return text;
  try {
    return simplifiedToTraditionalConverter(text);
  } catch (error) {
    console.error('Error converting Simplified to Traditional:', error);
    return text; // Return original text on error
  }
}

/**
 * Detects if text contains Traditional Chinese characters
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains Traditional Chinese
 */
export function isTraditionalChinese(text) {
  if (!text) return false;
  // Convert to simplified and check if it changed
  const simplified = convertTraditionalToSimplified(text);
  return simplified !== text;
}

/**
 * Detects if text contains Chinese characters (Traditional or Simplified)
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains Chinese characters
 */
export function containsChinese(text) {
  if (!text) return false;
  // Check for Chinese characters (CJK Unified Ideographs)
  // Range: \u4e00-\u9fff (CJK Unified Ideographs)
  // Range: \u3400-\u4dbf (CJK Extension A)
  // Range: \uf900-\ufaff (CJK Compatibility Ideographs)
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
  return chineseRegex.test(text);
}
