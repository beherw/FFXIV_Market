// Shared utilities for obtain method renderers
// Name/lookup helpers delegate to obtainableHelpers for single source of truth
import React from 'react';
import * as obtainableHelpers from '../../utils/obtainableHelpers';
import { FALLBACK_MESSAGE } from '../../constants/obtainableConstants';

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

/** Get currency name – delegates to obtainableHelpers (returns null when not found for renderer compat) */
export function getCurrencyName(currencyItemId, twItemsData) {
  if (!currencyItemId || !twItemsData) return null;
  const name = obtainableHelpers.getCurrencyName(currencyItemId, { twItems: twItemsData, zhItems: {}, items: {} });
  return name === FALLBACK_MESSAGE ? null : name;
}

/** Get shop name – delegates to obtainableHelpers */
export function getShopName(shopId, twShopsData, shopsData) {
  if (!shopId) return null;
  return obtainableHelpers.getShopName(shopId, { twShops: twShopsData || {}, shops: shopsData || {} });
}

/** Get NPC name – delegates to obtainableHelpers (returns null when not found for renderer compat) */
export function getNpcName(npcId, twNpcsData, npcsData, npcsDatabasePagesData) {
  if (!npcId) return null;
  const name = obtainableHelpers.getNpcName(npcId, {
    twNpcs: twNpcsData || {},
    npcs: npcsData || {},
    npcsDatabasePages: npcsDatabasePagesData || {}
  });
  return name === FALLBACK_MESSAGE ? null : name;
}

/**
 * Get NPC title from NPC ID (delegates to obtainableHelpers with optional titles data)
 */
export function getNpcTitle(npcId, twNpcTitlesData) {
  if (!npcId) return null;
  return obtainableHelpers.getNpcTitle(npcId, {}, twNpcTitlesData);
}

/**
 * Get zone/place name
 */
export function getZoneName(zoneId, twPlacesData, placesData) {
  if (!zoneId) return null;
  const tw = (twPlacesData || {})[zoneId] || (twPlacesData || {})[String(zoneId)];
  if (tw?.tw) return tw.tw;
  const place = (placesData || {})[zoneId] || (placesData || {})[String(zoneId)];
  if (place?.en) return place.en;
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
  /** Inner item block (280px, slate background + border) – use for method sub-cards so all methods look consistent. */
  innerItemBlock: 'w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center border border-slate-700/50',
  header: 'flex items-center gap-2 mb-2',
  title: 'text-ffxiv-gold font-medium',
  button: 'px-2 py-1 text-xs border rounded transition-all duration-200 flex items-center gap-1',
  icon: 'w-6 h-6',
  smallIcon: 'w-3 h-3 flex-shrink-0',
};
