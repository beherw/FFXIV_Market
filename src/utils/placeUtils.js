/**
 * Place/Zone utility functions for centralized zone ID handling
 * 區域/地圖工具函數 - 用於中心化處理 zone ID
 */

/**
 * Get place/zone name by zone ID
 * 根據 zone ID 獲取區域名稱
 * 
 * @param {number|string} zoneId - Zone ID
 * @param {Object} placeData - Place data object with twPlaces and places
 * @param {Object} placeData.twPlaces - Traditional Chinese places: {zoneId: {tw: "name"}}
 * @param {Object} placeData.places - English places: {zoneId: {en: "name"}}
 * @returns {string} Place name in Traditional Chinese, or English fallback, or "Zone {zoneId}"
 */
export function getPlaceName(zoneId, placeData = {}) {
  if (!zoneId) return '';
  
  const { twPlaces = {}, places = {} } = placeData;
  
  // Try Traditional Chinese first
  const twPlace = twPlaces[zoneId] || twPlaces[String(zoneId)];
  if (twPlace?.tw) {
    return twPlace.tw;
  }
  
  // Fallback to English places
  const place = places[zoneId] || places[String(zoneId)];
  if (place?.en) {
    return place.en;
  }
  
  // If still not found, return zone ID as fallback
  return `Zone ${zoneId}`;
}

/**
 * Get place name with fallback display
 * 獲取區域名稱，帶有備用顯示
 * 
 * @param {number|string} zoneId - Zone ID
 * @param {Object} placeData - Place data object
 * @param {string} fallbackPrefix - Fallback prefix (default: "區域")
 * @returns {string} Place name or fallback text
 */
export function getPlaceNameWithFallback(zoneId, placeData = {}, fallbackPrefix = '區域') {
  if (!zoneId) return '';
  
  const name = getPlaceName(zoneId, placeData);
  
  // If it's still the fallback "Zone {zoneId}", use custom prefix
  if (name === `Zone ${zoneId}`) {
    return `${fallbackPrefix} ${zoneId}`;
  }
  
  return name;
}

/**
 * Check if place data is available for a zone ID
 * 檢查是否有可用的區域數據
 * 
 * @param {number|string} zoneId - Zone ID
 * @param {Object} placeData - Place data object
 * @returns {boolean} True if place data exists
 */
export function hasPlaceData(zoneId, placeData = {}) {
  if (!zoneId) return false;
  
  const { twPlaces = {}, places = {} } = placeData;
  return !!(twPlaces[zoneId] || twPlaces[String(zoneId)] || places[zoneId] || places[String(zoneId)]);
}
