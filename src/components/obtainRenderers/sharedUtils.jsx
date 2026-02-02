// Shared utilities for obtain method renderers
import React from 'react';

/**
 * Get job name from job ID
 */
export function getJobName(jobId, twJobAbbrData) {
  if (!jobId) return null;
  const jobName = twJobAbbrData[jobId];
  return jobName || `職業 ${jobId}`;
}

/**
 * Get job icon URL from job ID
 */
export function getJobIconUrl(jobId) {
  if (!jobId) return null;
  const jobIconMap = {
    8: 'https://xivapi.com/i/062000/062008.png',    // 鍛鐵匠
    9: 'https://xivapi.com/i/062000/062009.png',    // 鑄甲匠
    10: 'https://xivapi.com/i/062000/062010.png',   // 雕金匠
    11: 'https://xivapi.com/i/062000/062011.png',   // 製革匠
    12: 'https://xivapi.com/i/062000/062012.png',   // 裁縫匠
    13: 'https://xivapi.com/i/062000/062013.png',   // 煉金術士
    14: 'https://xivapi.com/i/062000/062014.png',   // 烹調師
    15: 'https://xivapi.com/i/062000/062015.png',   // 刻木匠
  };
  return jobIconMap[jobId] || null;
}

/**
 * Get masterbook name from ID
 */
export function getMasterbookName(masterbookId, twItemsData) {
  if (!masterbookId || !twItemsData) return null;
  const itemData = twItemsData[masterbookId] || twItemsData[String(masterbookId)];
  return itemData?.tw || null;
}

/**
 * Get currency name from currency item ID
 */
export function getCurrencyName(currencyItemId, twItemsData) {
  if (!currencyItemId || !twItemsData) return null;
  const itemData = twItemsData[currencyItemId] || twItemsData[String(currencyItemId)];
  return itemData?.tw || null;
}

/**
 * Get shop name from shop ID
 */
export function getShopName(shopId, twShopsData, shopsData) {
  if (!shopId) return null;
  
  // Try tw-shops first
  if (twShopsData) {
    const shopName = twShopsData[shopId];
    if (shopName) return shopName;
  }
  
  // Try shops (en) as fallback
  if (shopsData) {
    const shopData = shopsData[shopId];
    if (shopData && shopData.en) return shopData.en;
  }
  
  return null;
}

/**
 * Get NPC name from NPC ID
 */
export function getNpcName(npcId, twNpcsData, npcsData, npcsDatabasePagesData) {
  if (!npcId) return null;
  
  // Try tw-npcs first
  if (twNpcsData) {
    const npcData = twNpcsData[npcId] || twNpcsData[String(npcId)];
    if (npcData && npcData.tw) return npcData.tw;
  }
  
  // Try npcs (en) as fallback
  if (npcsData) {
    const npcData = npcsData[npcId];
    if (npcData && npcData.en) return npcData.en;
  }
  
  // Try npcs-database-pages as last fallback
  if (npcsDatabasePagesData) {
    const npcDbData = npcsDatabasePagesData[npcId] || npcsDatabasePagesData[String(npcId)];
    if (npcDbData && npcDbData.tw) return npcDbData.tw;
  }
  
  return null;
}

/**
 * Get NPC title from NPC ID
 */
export function getNpcTitle(npcId, twNpcTitlesData) {
  if (!npcId || !twNpcTitlesData) return null;
  return twNpcTitlesData[npcId] || null;
}

/**
 * Get zone/place name
 */
export function getZoneName(zoneId, twPlacesData, placesData) {
  if (!zoneId) return null;
  
  // Try tw-places first
  if (twPlacesData) {
    const placeData = twPlacesData[zoneId] || twPlacesData[String(zoneId)];
    if (placeData && placeData.tw) return placeData.tw;
  }
  
  // Try places (en) as fallback
  if (placesData) {
    const placeData = placesData[zoneId];
    if (placeData && placeData.en) return placeData.en;
  }
  
  return null;
}

/**
 * Render HQ indicator
 */
export function renderHQIndicator() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
      </svg>
      <span className="text-xs font-bold text-blue-400">HQ</span>
    </span>
  );
}

/**
 * Render loading spinner
 */
export function renderLoadingSpinner(size = 'h-4 w-4') {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`${size} animate-spin`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
    </svg>
  );
}

/**
 * Common class names for consistent styling
 */
export const commonClasses = {
  card: 'bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 w-full self-start',
  header: 'flex items-center gap-2 mb-2',
  title: 'text-ffxiv-gold font-medium',
  button: 'px-2 py-1 text-xs border rounded transition-all duration-200 flex items-center gap-1',
  icon: 'w-6 h-6',
  smallIcon: 'w-3 h-3 flex-shrink-0',
};
