/**
 * Centralized name/lookup helpers for obtainable methods.
 * All functions take loadedData (and optional static data) for a single source of truth.
 */

import { FALLBACK_MESSAGE } from '../constants/obtainableConstants';

export function getNpcName(npcId, loadedData) {
  if (!npcId || !loadedData) return FALLBACK_MESSAGE;
  const twNpc = loadedData.twNpcs?.[npcId] || loadedData.twNpcs?.[String(npcId)];
  if (twNpc?.tw) return twNpc.tw;
  const npcDb = loadedData.npcsDatabasePages?.[npcId] || loadedData.npcsDatabasePages?.[String(npcId)];
  if (npcDb?.zh) return npcDb.zh;
  const enNpc = loadedData.npcs?.[npcId] || loadedData.npcs?.[String(npcId)];
  if (enNpc?.en) return enNpc.en;
  return FALLBACK_MESSAGE;
}

export function getNpcTitle(npcId, loadedData, twNpcTitlesData) {
  if (!npcId) return null;
  if (twNpcTitlesData) {
    const titleData = twNpcTitlesData[npcId] || twNpcTitlesData[String(npcId)];
    if (titleData?.tw) return titleData.tw;
  }
  const npcDb = loadedData?.npcsDatabasePages?.[npcId] || loadedData?.npcsDatabasePages?.[String(npcId)];
  if (npcDb?.title?.zh) return npcDb.title.zh;
  if (npcDb?.title?.en) return npcDb.title.en;
  return null;
}

export function getShopName(shopId, loadedData) {
  if (!shopId || !loadedData) return null;
  const twShop = loadedData.twShops?.[shopId] || loadedData.twShops?.[String(shopId)];
  if (twShop?.tw) return twShop.tw;
  const enShop = loadedData.shops?.[shopId] || loadedData.shops?.[String(shopId)];
  if (enShop?.en) return enShop.en;
  return null;
}

export function getVendorShopName(shopName) {
  if (!shopName) return null;
  if (shopName.tw) return shopName.tw;
  if (shopName.zh) return shopName.zh;
  return null;
}

export function getCurrencyName(currencyItemId, loadedData) {
  if (!currencyItemId) return '貨幣';
  if (!loadedData) return FALLBACK_MESSAGE;
  const tw = loadedData.twItems?.[currencyItemId] || loadedData.twItems?.[String(currencyItemId)];
  if (tw?.tw) return tw.tw;
  const zh = loadedData.zhItems?.[currencyItemId] || loadedData.zhItems?.[String(currencyItemId)];
  if (zh?.zh) return zh.zh;
  const en = loadedData.items?.[currencyItemId] || loadedData.items?.[String(currencyItemId)];
  if (en?.en) return en.en;
  return FALLBACK_MESSAGE;
}

export function getItemNameWithFallback(itemId, loadedData) {
  if (!itemId) return FALLBACK_MESSAGE;
  if (!loadedData) return FALLBACK_MESSAGE;
  const tw = loadedData.twItems?.[itemId] || loadedData.twItems?.[String(itemId)];
  if (tw?.tw) return tw.tw;
  const zh = loadedData.zhItems?.[itemId] || loadedData.zhItems?.[String(itemId)];
  if (zh?.zh) return zh.zh;
  const en = loadedData.items?.[itemId] || loadedData.items?.[String(itemId)];
  if (en?.en) return en.en;
  return FALLBACK_MESSAGE;
}

export function getAchievementInfo(achievementId, loadedData) {
  if (!achievementId || !loadedData) return null;
  const achievementIdStr = String(achievementId);
  const twAchievement = loadedData.twAchievements?.[achievementIdStr] || loadedData.twAchievements?.[achievementId];
  const twDescription = loadedData.twAchievementDescriptions?.[achievementIdStr] || loadedData.twAchievementDescriptions?.[achievementId];
  const achievementData = loadedData.achievements?.[achievementIdStr] || loadedData.achievements?.[achievementId];
  const name = twAchievement?.tw || achievementData?.en || null;
  const description = twDescription?.tw || achievementData?.description?.en || null;
  if (name) {
    return {
      id: achievementId,
      name,
      description,
      icon: achievementData?.icon ? `https://xivapi.com${achievementData.icon}` : null,
      itemReward: achievementData?.itemReward ?? null,
      title: achievementData?.title ?? null,
      nameEn: achievementData?.en ?? null,
      nameJa: achievementData?.ja ?? null
    };
  }
  return null;
}

export function getInstanceName(instanceId, loadedData) {
  if (!loadedData) return instanceId != null ? `副本 ${instanceId}` : null;
  const tw = loadedData.twInstances?.[instanceId] || loadedData.twInstances?.[String(instanceId)];
  if (tw?.tw) return tw.tw;
  const instance = loadedData.instances?.[instanceId] || loadedData.instances?.[String(instanceId)];
  if (instance?.en) return instance.en;
  return instanceId != null ? `副本 ${instanceId}` : null;
}

export function getInstanceCNName(instanceId, loadedData) {
  if (!loadedData) return null;
  const zh = loadedData.zhInstances?.[instanceId] || loadedData.zhInstances?.[String(instanceId)];
  return zh?.zh ?? null;
}

export function getQuestCNName(questId, loadedData) {
  if (!loadedData) return null;
  const zh = loadedData.zhQuests?.[questId] || loadedData.zhQuests?.[String(questId)];
  return zh?.zh ?? null;
}
