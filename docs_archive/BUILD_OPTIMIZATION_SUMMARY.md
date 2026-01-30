# 构建优化总结

## ✅ 已处理的超大文件（>10MB）- 全部改为动态导入

| 文件 | 大小 | 状态 | 位置 |
|------|------|------|------|
| `extracts.json` | 27MB | ✅ 动态导入 | `extractsService.js` |
| `shops-by-npc.json` | 27MB | ✅ 动态导入 | `ObtainMethods.jsx` |
| `npcs.json` | 16MB | ✅ 动态导入 | `ObtainMethods.jsx` |
| `npcs-database-pages.json` | 14MB | ✅ 动态导入 | `ObtainMethods.jsx` |
| `tw-recipes.json` | 11MB | ✅ 动态导入 | `recipeDatabase.js` |
| `shops.json` | 9.2MB | ✅ 动态导入 | `ObtainMethods.jsx` |

## ✅ 已处理的大文件（1-10MB）- 已优化

| 文件 | 大小 | 状态 | 位置 |
|------|------|------|------|
| `quests-database-pages.json` | 6.7MB | ✅ 动态导入 | `ObtainMethods.jsx` |
| `equipment.json` | 6.2MB | ✅ 动态导入 | `AdvancedSearch.jsx`, `MSQPriceChecker.jsx` |

## 📝 核心文件（保持静态导入）- 必需文件

| 文件 | 大小 | 原因 |
|------|------|------|
| `tw-items.json` | 2.1MB | 核心文件，频繁使用 |
| `tw-item-descriptions.json` | 2.1MB | 核心文件，频繁使用 |

## 🔧 构建配置优化

1. **内存限制**: 从4GB增加到8GB (`NODE_OPTIONS=--max-old-space-size=8192`)
2. **optimizeDeps.exclude**: 排除所有JSON文件，避免预构建
3. **minify**: 使用`esbuild`替代`terser`（更省内存）
4. **sourcemap**: 禁用以减少内存使用
5. **manualChunks**: 优化chunk分割策略

## ⚠️ 重要提醒

- **所有超大文件（>10MB）必须使用动态导入**
- **修改任何JSON文件导入时，请检查文件大小**
- **如果文件大小超过1MB，考虑改为动态导入**
- **参考 `JSON_FILES_SIZE_REFERENCE.md` 查看所有文件大小**

## 🎯 验证清单

在修改代码前，请确认：
- [ ] 没有静态导入任何>10MB的文件
- [ ] 所有动态导入的文件都有缓存机制
- [ ] 文件大小注释已更新
- [ ] 构建配置已优化
