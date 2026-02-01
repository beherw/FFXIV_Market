/**
 * Generate search patterns with variable spacing before brackets
 * This handles item names like "綠金頭冠 (琥珀)" where spacing before brackets may vary
 * 
 * @param {string} searchTerm - The original search term
 * @returns {string[]} Array of search patterns to try, in order of likelihood
 */
export function generateBracketPatterns(searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return [searchTerm || ''];
  }

  const patterns = new Set();
  
  // Always include the original term first
  patterns.add(searchTerm);

  // Check if the term contains parentheses or brackets
  const hasParens = searchTerm.includes('(') || searchTerm.includes('（');
  const hasBrackets = searchTerm.includes('[') || searchTerm.includes('【');

  if (hasParens) {
    // Handle both English and Chinese parentheses
    // Pattern 1: Remove spaces before English parentheses
    let pattern1 = searchTerm.replace(/\s+\(/g, '(');
    if (pattern1 !== searchTerm) patterns.add(pattern1);

    // Pattern 2: Add space before English parentheses
    let pattern2 = searchTerm.replace(/([^\s])\(/g, '$1 (');
    if (pattern2 !== searchTerm) patterns.add(pattern2);

    // Pattern 3: Remove spaces before Chinese parentheses (fullwidth)
    let pattern3 = searchTerm.replace(/\s+（/g, '（');
    if (pattern3 !== searchTerm) patterns.add(pattern3);

    // Pattern 4: Add space before Chinese parentheses (fullwidth)
    let pattern4 = searchTerm.replace(/([^\s])（/g, '$1 （');
    if (pattern4 !== searchTerm) patterns.add(pattern4);

    // Pattern 5: Normalize - convert Chinese parentheses to English, remove extra spaces
    let pattern5 = searchTerm.replace(/\s+/g, ' ').replace(/（/g, ' (').replace(/）/g, ')');
    if (pattern5 !== searchTerm && pattern5 !== pattern2) patterns.add(pattern5);
  }

  if (hasBrackets) {
    // Handle both English and Chinese brackets
    // Pattern 1: Remove spaces before English brackets
    let pattern1 = searchTerm.replace(/\s+\[/g, '[');
    if (pattern1 !== searchTerm) patterns.add(pattern1);

    // Pattern 2: Add space before English brackets
    let pattern2 = searchTerm.replace(/([^\s])\[/g, '$1 [');
    if (pattern2 !== searchTerm) patterns.add(pattern2);

    // Pattern 3: Remove spaces before Chinese brackets (fullwidth)
    let pattern3 = searchTerm.replace(/\s+【/g, '【');
    if (pattern3 !== searchTerm) patterns.add(pattern3);

    // Pattern 4: Add space before Chinese brackets (fullwidth)
    let pattern4 = searchTerm.replace(/([^\s])【/g, '$1 【');
    if (pattern4 !== searchTerm) patterns.add(pattern4);

    // Pattern 5: Normalize - convert Chinese brackets to English, remove extra spaces
    let pattern5 = searchTerm.replace(/\s+/g, ' ').replace(/【/g, ' [').replace(/】/g, ']');
    if (pattern5 !== searchTerm && pattern5 !== pattern2) patterns.add(pattern5);
  }

  // Always try the original term with normalized spacing (no duplicate spaces)
  let normalized = searchTerm.replace(/\s+/g, ' ').trim();
  if (normalized !== searchTerm) {
    patterns.add(normalized);
  }

  // Convert Set back to array, maintaining order
  return Array.from(patterns);
}
