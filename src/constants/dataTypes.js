/**
 * 中心化的 DataType 管理
 * 
 * 这是整个项目中唯一定义 DataType 的地方！
 * 所有其他地方必须从这里导入，不得重复定义。
 * 
 * 数值来源: teamcraft_git/libs/types/src/lib/list/data-type.ts
 * CRITICAL: 这些值必须与 Teamcraft 完全一致
 */

/**
 * DataType enum - 数据获取方式类型
 * @readonly
 * @enum {number}
 */
export const DataType = {
  DEPRECATED: -1,
  NONE: 0,
  CRAFTED_BY: 1,
  TRADE_SOURCES: 2,
  VENDORS: 3,
  REDUCED_FROM: 4,
  DESYNTHS: 5,
  INSTANCES: 6,
  GATHERED_BY: 7,
  GARDENING: 8,
  VOYAGES: 9,
  DROPS: 10,
  ALARMS: 11,
  MASTERBOOKS: 12,
  TREASURES: 13,
  FATES: 14,
  VENTURES: 15,
  TRIPLE_TRIAD_DUELS: 16,
  TRIPLE_TRIAD_PACK: 17,
  QUESTS: 18,
  ACHIEVEMENTS: 19,
  REQUIREMENTS: 20,
  MOGSTATION: 21,
  ISLAND_PASTURE: 22,
  ISLAND_CROP: 23
};

/**
 * 类型字符串到数值的映射
 * 用于从 JSON 数据转换到 DataType enum
 * @readonly
 */
export const TYPE_STRING_TO_ID = {
  'craft': DataType.CRAFTED_BY,           // 1
  'specialshop': DataType.TRADE_SOURCES,  // 2
  'vendor': DataType.VENDORS,             // 3
  'reduction': DataType.REDUCED_FROM,     // 4
  'desynth': DataType.DESYNTHS,           // 5
  'instance': DataType.INSTANCES,         // 6
  'gathering': DataType.GATHERED_BY,      // 7
  'gardening': DataType.GARDENING,        // 8
  'voyage': DataType.VOYAGES,             // 9
  'drop': DataType.DROPS,                 // 10
  'alarm': DataType.ALARMS,               // 11
  'masterbook': DataType.MASTERBOOKS,     // 12
  'treasure': DataType.TREASURES,         // 13
  'fate': DataType.FATES,                 // 14
  'venture': DataType.VENTURES,           // 15
  'tripleTriadDuel': DataType.TRIPLE_TRIAD_DUELS,  // 16
  'tripleTriadPack': DataType.TRIPLE_TRIAD_PACK,   // 17
  'quest': DataType.QUESTS,               // 18
  'achievement': DataType.ACHIEVEMENTS,   // 19
  'requirement': DataType.REQUIREMENTS,   // 20
  'mobdrop': DataType.REQUIREMENTS,       // legacy alias
  'mogstation': DataType.MOGSTATION,      // 21
  'islandpasture': DataType.ISLAND_PASTURE,  // 22
  'islandcrop': DataType.ISLAND_CROP      // 23
};

/**
 * 数值到类型字符串的映射 (反向映射)
 * 用于从 DataType enum 转换到 JSON 字符串
 * @readonly
 */
export const TYPE_ID_TO_STRING = {
  [DataType.CRAFTED_BY]: 'craft',
  [DataType.TRADE_SOURCES]: 'specialshop',
  [DataType.VENDORS]: 'vendor',
  [DataType.REDUCED_FROM]: 'reduction',
  [DataType.DESYNTHS]: 'desynth',
  [DataType.INSTANCES]: 'instance',
  [DataType.GATHERED_BY]: 'gathering',
  [DataType.GARDENING]: 'gardening',
  [DataType.VOYAGES]: 'voyage',
  [DataType.DROPS]: 'drop',
  [DataType.ALARMS]: 'alarm',
  [DataType.MASTERBOOKS]: 'masterbook',
  [DataType.TREASURES]: 'treasure',
  [DataType.FATES]: 'fate',
  [DataType.VENTURES]: 'venture',
  [DataType.TRIPLE_TRIAD_DUELS]: 'tripleTriadDuel',
  [DataType.TRIPLE_TRIAD_PACK]: 'tripleTriadPack',
  [DataType.QUESTS]: 'quest',
  [DataType.ACHIEVEMENTS]: 'achievement',
  [DataType.REQUIREMENTS]: 'requirement',
  [DataType.MOGSTATION]: 'mogstation',
  [DataType.ISLAND_PASTURE]: 'islandpasture',
  [DataType.ISLAND_CROP]: 'islandcrop'
};

/**
 * 中文类型名称映射
 * @readonly
 */
export const TYPE_CHINESE_NAMES = {
  [DataType.CRAFTED_BY]: '製作',
  [DataType.TRADE_SOURCES]: '兌換',
  [DataType.VENDORS]: 'NPC商店',
  [DataType.REDUCED_FROM]: '分解獲得',
  [DataType.DESYNTHS]: '精製獲得',
  [DataType.INSTANCES]: '副本',
  [DataType.GATHERED_BY]: '採集獲得',
  [DataType.GARDENING]: '園藝獲得',
  [DataType.VOYAGES]: '遠航探索',
  [DataType.DROPS]: '怪物掉落',
  [DataType.ALARMS]: '時間限定',
  [DataType.MASTERBOOKS]: '秘籍習得',
  [DataType.TREASURES]: '寶箱/容器',
  [DataType.FATES]: '危命任務',
  [DataType.VENTURES]: '雇員探險',
  [DataType.TRIPLE_TRIAD_DUELS]: '九宮幻卡對戰',
  [DataType.TRIPLE_TRIAD_PACK]: '九宮幻卡包',
  [DataType.QUESTS]: '任務獎勵',
  [DataType.ACHIEVEMENTS]: '成就獎勵',
  [DataType.REQUIREMENTS]: '需求材料',
  [DataType.MOGSTATION]: '商城購買',
  [DataType.ISLAND_PASTURE]: '無人島牧場',
  [DataType.ISLAND_CROP]: '無人島農作'
};

/**
 * 转换类型字符串为 DataType 数值
 * @param {string} typeStr - 类型字符串 (例如: 'craft', 'voyage')
 * @returns {number} DataType 数值
 */
export function getTypeIdFromString(typeStr) {
  if (!typeStr) return DataType.NONE;
  
  // 直接从映射表查找
  if (TYPE_STRING_TO_ID[typeStr] !== undefined) {
    return TYPE_STRING_TO_ID[typeStr];
  }
  
  // 支持 'type_XX' 格式 (遗留格式)
  if (typeof typeStr === 'string' && typeStr.startsWith('type_')) {
    const parsed = Number.parseInt(typeStr.slice(5), 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  
  console.warn(`[DataType] Unknown type string: ${typeStr}`);
  return DataType.NONE;
}

/**
 * 转换 DataType 数值为类型字符串
 * @param {number} typeId - DataType 数值
 * @returns {string} 类型字符串
 */
export function getStringFromTypeId(typeId) {
  return TYPE_ID_TO_STRING[typeId] || `type_${typeId}`;
}

/**
 * 获取类型的中文名称
 * @param {number|string} type - DataType 数值或字符串
 * @returns {string} 中文名称
 */
export function getChineseName(type) {
  const typeId = typeof type === 'string' ? getTypeIdFromString(type) : type;
  return TYPE_CHINESE_NAMES[typeId] || '未知類型';
}
