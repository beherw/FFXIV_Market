/**
 * 測試套裝查詢：給定裝備 ID 19623，列出同套裝所有裝備（僅用本地 JSON，不呼叫 API）
 * 執行：node scripts/test-item-set.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectRoot = path.resolve(__dirname, '..');
const equipment = require(path.join(projectRoot, 'teamcraft_git/libs/data/src/lib/json/equipment.json'));
const ilvls = require(path.join(projectRoot, 'teamcraft_git/libs/data/src/lib/json/ilvls.json'));
const itemPatch = require(path.join(projectRoot, 'teamcraft_git/libs/data/src/lib/json/item-patch.json'));
const twItems = require(path.join(projectRoot, 'teamcraft_git/libs/data/src/lib/json/tw/tw-items.json'));

const EQUIP_SLOT_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SLOT_NAMES = { 3: '頭', 4: '身', 5: '手', 6: '腰', 7: '腿', 8: '腳', 9: '耳', 10: '項', 11: '腕', 12: '指' };

function getItemSet(itemId) {
  const seedEquip = equipment[String(itemId)];
  if (!seedEquip) return { setItemIds: [itemId], isEquipmentSet: false };

  const seedIlvl = ilvls[String(itemId)];
  const seedPatch = itemPatch[String(itemId)];
  const seedLevel = seedEquip.level;
  const seedJobsKey = [...(seedEquip.jobs || [])].sort().join(',');

  const setItemIds = [];
  for (const idStr of Object.keys(equipment)) {
    const eq = equipment[idStr];
    if (!eq || eq.level !== seedLevel) continue;
    const jobsKey = [...(eq.jobs || [])].sort().join(',');
    if (jobsKey !== seedJobsKey) continue;
    if (ilvls[idStr] !== seedIlvl || itemPatch[idStr] !== seedPatch) continue;
    setItemIds.push(parseInt(idStr, 10));
  }

  setItemIds.sort((a, b) => {
    const slotA = equipment[String(a)]?.equipSlotCategory ?? 99;
    const slotB = equipment[String(b)]?.equipSlotCategory ?? 99;
    const orderA = EQUIP_SLOT_ORDER.indexOf(slotA);
    const orderB = EQUIP_SLOT_ORDER.indexOf(slotB);
    if (orderA !== orderB) return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
    return a - b;
  });

  return {
    setItemIds,
    seedItemId: itemId,
    isEquipmentSet: true,
    ilvl: seedIlvl,
    patch: seedPatch,
    level: seedLevel,
  };
}

const itemId = 19623;
const result = getItemSet(itemId);
console.log('套裝查詢 輸入:', itemId);
console.log('同套裝裝備數:', result.setItemIds.length);
console.log('ilvl:', result.ilvl, ' patch:', result.patch, ' 裝備等級:', result.level);
console.log('');
console.log('同套裝裝備列表（依部位排序）:');
for (const id of result.setItemIds) {
  const slot = equipment[String(id)]?.equipSlotCategory;
  const slotName = SLOT_NAMES[slot] || slot;
  const name = twItems[String(id)]?.tw || '(無繁中名)';
  console.log(`  ${id}  [${slotName}] ${name}`);
}
