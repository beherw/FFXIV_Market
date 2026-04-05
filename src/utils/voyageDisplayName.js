/**
 * Resolve voyage destination display name (Traditional Chinese when available).
 * type: 1 = submarine, 0 = airship (Teamcraft / game convention).
 */

/**
 * Split game strings like `B　探險家的中繼基地` or English `Voyagers' Reprieve (B)` for layout.
 * @param {string} full
 * @returns {{ gridLetter: string | null, title: string }}
 */
export function parseVoyageDestinationLabel(full) {
  if (full == null || typeof full !== 'string') {
    return { gridLetter: null, title: full ? String(full) : '' };
  }
  const s = full.trim();
  const twStyle = s.match(/^([A-Za-z]{1,3})[　\s]+(.+)$/);
  if (twStyle) {
    return { gridLetter: twStyle[1], title: twStyle[2].trim() };
  }
  const enStyle = s.match(/^(.+?)\s*\(([A-Za-z]{1,3})\)\s*$/);
  if (enStyle) {
    return { gridLetter: enStyle[2], title: enStyle[1].trim() };
  }
  return { gridLetter: null, title: s };
}

/**
 * @param {{ id: number, type?: number, name?: { en?: string } }} voyage
 * @param {{ twSubmarineVoyages?: Record<string|number, { tw?: string }>, twAirshipVoyages?: Record<string|number, { tw?: string }> }} [loadedData]
 * @returns {string}
 */
export function getVoyageTwDisplayName(voyage, loadedData) {
  if (!voyage || voyage.id == null) return '';
  const id = voyage.id;
  const key = String(id);
  const isSub = voyage.type === 1;
  const map = isSub ? loadedData?.twSubmarineVoyages : loadedData?.twAirshipVoyages;
  const row = map?.[id] ?? map?.[key];
  const tw = row?.tw;
  if (tw != null && String(tw).trim() !== '') return String(tw);
  return voyage.name?.en || `Voyage ${id}`;
}
