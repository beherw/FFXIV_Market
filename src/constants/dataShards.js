// Sharded data layout, shared by scripts/build-data-shards.js (writer) and src/services/dataShards.js (reader).
// Each domain msgpack is split into N files by id so a page only downloads the few shards it needs:
// public/data/shards/<domain>/<shard>.msgpack, shard = shardOf(id, N).
// "flat" domains are a single id-keyed map at the top level; the others are { tableName: { id: value } }.

export const SHARDED_DOMAINS = {
  'obtainable-methods': { shards: 256, flat: true },
  npcs: { shards: 256 },
  shops: { shards: 128 },
  quests: { shards: 128 },
  leves: { shards: 64 },
  instances: { shards: 16 },
  achievements: { shards: 16 },
  places: { shards: 16 },
  fates: { shards: 32 }, // fatesById (by fate id) + fateSourcesByItemId (by item id)
  'drop-monsters': { shards: 32 },
  'tw-items': { shards: 64, flat: true },
  'zh-items': { shards: 64, flat: true },
  'en-items': { shards: 64, flat: true },
  // Built from teamcraft item-icons.json (not a public/data msgpack)
  'item-icons': { shards: 64, flat: true },
  // Built from teamcraft tw/tw-mobs.json (monster names for 怪物掉落 / 需求材料)
  'tw-mobs': { shards: 32, flat: true },
  // itemId -> UI category id, from ui_categories.msgpack (item page category badge)
  'item-ui-category': { shards: 32, flat: true },
  // Built from teamcraft market-items.json (item page's 非賣品 check without the 160KB list)
  'market-items': { shards: 64, flat: true },
};

export function shardOf(id, shardCount) {
  const n = typeof id === 'number' ? id : parseInt(id, 10);
  if (!Number.isFinite(n)) return 0;
  return ((Math.trunc(n) % shardCount) + shardCount) % shardCount;
}
