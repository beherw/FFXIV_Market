// Background warm-up for the main user flow: open site -> search -> click an item.
// Everything here is kept out of the initial bundle and fetched after first paint, in order of
// when the user is going to need it, so no step of the flow waits on a data download.

import { preloadSearchData, getEquipment, getTwItems } from '../services/gameData';
import { loadItemIconsData } from './itemImage';
import { loadChineseConverter } from './chineseConverter';
import { loadRecipeDatabase } from '../services/recipeDatabase';

let started = false;

const whenIdle = (fn, timeout = 2000) =>
  new Promise(resolve => {
    const run = () => Promise.resolve().then(fn).catch(() => {}).finally(resolve);
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout });
    } else {
      setTimeout(run, 200);
    }
  });

const now = fn => Promise.resolve().then(fn).catch(() => {});

export function preloadAppData() {
  if (started) return;
  started = true;

  const path = window.location.pathname.replace(/^\/FFXIV_Market/, '') || '/';
  const landedOnItemPage = /^\/item\/\d+/.test(path);
  // Tool pages (advanced search, company craft, ...) load their own data on mount; give them the
  // bandwidth first and warm the search data afterwards
  const landedOnToolPage = !landedOnItemPage && !/^\/(search)?$/.test(path);

  (async () => {
    if (landedOnItemPage) {
      // Item page first (e.g. opened from a search engine). Its name and icon come from small shards;
      // the recipe table drives the 製作價格樹 / 可製品 buttons, so it goes first. Full tables follow.
      await now(() => loadRecipeDatabase());
      await whenIdle(() => Promise.allSettled([getTwItems(), loadItemIconsData()]));
      await whenIdle(() => preloadSearchData());
      await whenIdle(() => getEquipment());
    } else {
      if (landedOnToolPage) await new Promise(resolve => setTimeout(resolve, 2500));
      // Wave 1: search index + data the search pipeline reads (tw-items, marketable ids, ilvl, patch).
      // Kept alone so it gets the full bandwidth on slow connections.
      await whenIdle(() => preloadSearchData(), 1000);
      // Wave 2: search results table (icons, equipment level), then the item page's recipe data
      await whenIdle(() => Promise.allSettled([loadItemIconsData(), getEquipment()]));
      await whenIdle(() => loadRecipeDatabase());
    }
    // Last: only needed for simplified-Chinese input fallback / OCR
    await whenIdle(() => loadChineseConverter());
  })();
}
