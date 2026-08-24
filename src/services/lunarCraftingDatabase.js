import { decode } from '@msgpack/msgpack';

let lunarCraftingData = null;
let loadPromise = null;

export async function loadLunarCraftingData() {
  if (lunarCraftingData) return lunarCraftingData;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}data/lunar-crafting.msgpack`);
    if (!response.ok) {
      throw new Error(`Failed to fetch lunar crafting data: ${response.status}`);
    }

    lunarCraftingData = decode(new Uint8Array(await response.arrayBuffer()));
    return lunarCraftingData;
  })().catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}
