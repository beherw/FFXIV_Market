# JSON文件大小参考文档

本文档列出项目中使用的所有JSON文件及其大小，方便在修改时不会漏掉任何大文件。

## 超大文件（>10MB）- 必须使用动态导入

| 文件路径 | 大小 | 行数 | 加载方式 | 使用位置 |
|---------|------|------|---------|---------|
| `shops-by-npc.json` | 27MB | 1.5M+ | 动态导入 | ObtainMethods.jsx |
| `extracts.json` | 27MB | - | 动态导入 | extractsService.js |
| `npcs.json` | 16MB | 1M+ | 动态导入 | ObtainMethods.jsx |
| `npcs-database-pages.json` | 14MB | - | 静态导入 | ObtainMethods.jsx (fallback) |
| `tw-recipes.json` | 11MB | 600K+ | 动态导入 | recipeDatabase.js |
| `shops.json` | 9.2MB | 595K | 动态导入 | ObtainMethods.jsx |

## 大文件（1-10MB）- 建议使用动态导入

| 文件路径 | 大小 | 行数 | 加载方式 | 使用位置 |
|---------|------|------|---------|---------|
| `quests-database-pages.json` | 6.7MB | - | 静态导入 | ObtainMethods.jsx |
| `equipment.json` | 6.2MB | 461K | 动态导入 | AdvancedSearch.jsx, MSQPriceChecker.jsx |
| `zh-items.json` | 2.3MB | 143K | 动态导入 | itemDatabase.js |
| `tw-items.json` | 2.1MB | 128K | 静态导入 | itemDatabase.js, ObtainMethods.jsx, AdvancedSearch.jsx (核心文件) |
| `tw-item-descriptions.json` | 2.1MB | 57K | 静态导入 | itemDatabase.js |
| `fates.json` | 2.1MB | 44K | 静态导入 | ObtainMethods.jsx |
| `quests.json` | 1.9MB | 96K | 静态导入 | ObtainMethods.jsx |
| `fates-database-pages.json` | 1.8MB | - | 静态导入 | ObtainMethods.jsx |
| `tw-npcs.json` | 1.3MB | 84K | 静态导入 | ObtainMethods.jsx |
| `instances.json` | 1.3MB | 19K | 静态导入 | ObtainMethods.jsx |
| `achievements.json` | 924KB | 31K | 静态导入 | ObtainMethods.jsx |
| `places.json` | 736KB | 33K | 静态导入 | ObtainMethods.jsx |

## 中等文件（100KB-1MB）- 已优化为动态导入

| 文件路径 | 大小 | 行数 | 加载方式 | 使用位置 |
|---------|------|------|---------|---------|
| `ui-categories.json` | 732KB | 50K | 动态导入 | AdvancedSearch.jsx |
| `ilvls.json` | 748KB | 50K | 动态导入 | App.jsx, ItemTable.jsx, AdvancedSearch.jsx, MSQPriceChecker.jsx, CraftingInspiration.jsx |
| `rarities.json` | 688KB | 50K | 动态导入 | ItemTable.jsx, AdvancedSearch.jsx |
| `item-patch.json` | 696KB | 48K | 动态导入 | App.jsx, ItemTable.jsx |
| `maps.json` | 460KB | 20K | 静态导入 | MapModal.jsx |
| `zh-fates.json` | 460KB | 14K | 动态导入 | ObtainMethods.jsx |
| `tw-fates.json` | 436KB | 14K | 静态导入 | ObtainMethods.jsx |
| `zh-quests.json` | 268KB | 15K | 动态导入 | ObtainMethods.jsx |
| `tw-quests.json` | 256KB | 15K | 静态导入 | ObtainMethods.jsx |
| `market-items.json` | 144KB | 16K | 动态导入 | universalis.js |
| `gil-shop-names.json` | 156KB | 6.6K | 动态导入 | ObtainMethods.jsx |
| `loot-sources.json` | 116KB | 12K | 静态导入 | ObtainMethods.jsx |
| `tw-shops.json` | 108KB | 5.5K | 静态导入 | ObtainMethods.jsx |

## 小文件（<100KB）- 静态导入

| 文件路径 | 大小 | 行数 | 加载方式 | 使用位置 |
|---------|------|------|---------|---------|
| `tw-achievement-descriptions.json` | 276KB | 10K | 静态导入 | ObtainMethods.jsx |
| `tw-achievements.json` | 172KB | 10K | 静态导入 | ObtainMethods.jsx |
| `tw-places.json` | 208KB | 14K | 静态导入 | ObtainMethods.jsx |
| `tw-npc-titles.json` | 76KB | 4.8K | 静态导入 | ObtainMethods.jsx |
| `zh-instances.json` | 36KB | 1.9K | 动态导入 | ObtainMethods.jsx |
| `tw-instances.json` | 36KB | 1.7K | 静态导入 | ObtainMethods.jsx |
| `patch-names.json` | 32KB | 1.3K | 动态导入 | App.jsx, ItemTable.jsx |
| `fate-sources.json` | 16KB | 1.6K | 静态导入 | ObtainMethods.jsx |
| `tw-item-ui-categories.json` | 8KB | 338 | 静态导入 | AdvancedSearch.jsx |
| `equip-slot-categories.json` | 8KB | 385 | 静态导入 | MSQPriceChecker.jsx |
| `tw-job-abbr.json` | 4KB | 128 | 静态导入 | ObtainMethods.jsx, AdvancedSearch.jsx, CraftingInspiration.jsx |

## 优化建议

1. **>10MB的文件**：必须使用动态导入，避免初始bundle过大
2. **1-10MB的文件**：建议使用动态导入，除非是核心文件（如tw-items.json）
3. **<1MB的文件**：可以根据使用频率决定是否动态导入
4. **<100KB的文件**：通常可以静态导入

## 注意事项

- 所有文件大小注释已添加到代码中，格式：`// FILE SIZE: XMB/XKB, Y lines - [加载方式]`
- 修改任何JSON文件导入时，请检查文件大小并更新注释
- 如果文件大小超过1MB，考虑改为动态导入
- 核心文件（如tw-items.json）即使较大也可能需要静态导入
