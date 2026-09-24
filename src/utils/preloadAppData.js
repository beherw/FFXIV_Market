// Background warm-up for the main user flow: open site -> search -> click an item.
// Everything here is kept out of the initial bundle and fetched after first paint, in order of
// when the user is going to need it, so the first search does not wait on data downloads.

import { preloadSearchData, getEquipment } from '../services/gameData';
import { loadItemIconsData } from './itemImage';
import { loadChineseConverter } from './chineseConverter';

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

export function preloadAppData() {
  if (started) return;
  started = true;

  (async () => {
    // Wave 1: search index + data the search pipeline reads (tw-items, marketable ids, ilvl, patch)
    await whenIdle(() => preloadSearchData(), 1000);
    // Wave 2: search results table (icons, equipment level)
    await whenIdle(() => Promise.allSettled([loadItemIconsData(), getEquipment()]));
    // Wave 3: only needed for simplified-Chinese input fallback / OCR
    await whenIdle(() => loadChineseConverter());
  })();
}
