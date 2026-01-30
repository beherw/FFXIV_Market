# 超大文件处理验证清单

## ✅ 所有超大文件（>10MB）已改为动态导入

### 已确认处理的文件：

1. ✅ **extracts.json** (27MB)
   - 位置: `src/services/extractsService.js`
   - 状态: 动态导入 (`await import(...)`)
   - 注释: `// FILE SIZE: 27MB - MUST BE LAZY LOADED`

2. ✅ **shops-by-npc.json** (27MB)
   - 位置: `src/components/ObtainMethods.jsx`
   - 状态: 动态导入 (`loadShopsByNpcData()`)
   - 注释: `// FILE SIZE: 27MB, 1.5M+ lines - MUST BE LAZY LOADED`

3. ✅ **npcs.json** (16MB)
   - 位置: `src/components/ObtainMethods.jsx`
   - 状态: 动态导入 (`loadNpcsData()`)
   - 注释: `// FILE SIZE: 16MB, 1M+ lines - MUST BE LAZY LOADED`

4. ✅ **npcs-database-pages.json** (14MB)
   - 位置: `src/components/ObtainMethods.jsx`
   - 状态: 动态导入 (`loadNpcsDatabasePagesData()`)
   - 注释: `// FILE SIZE: 14MB - MUST BE LAZY LOADED`

5. ✅ **tw-recipes.json** (11MB)
   - 位置: `src/services/recipeDatabase.js`
   - 状态: 动态导入 (`await import(...)`)
   - 注释: `// FILE SIZE: 11MB, 600K+ lines - MUST BE LAZY LOADED`

6. ✅ **shops.json** (9.2MB)
   - 位置: `src/components/ObtainMethods.jsx`
   - 状态: 动态导入 (`loadShopsData()`)
   - 注释: `// FILE SIZE: 9.2MB, 595K lines - MUST BE LAZY LOADED`

7. ✅ **quests-database-pages.json** (6.7MB)
   - 位置: `src/components/ObtainMethods.jsx`
   - 状态: 动态导入 (`loadQuestsDatabasePagesData()`)
   - 注释: `// FILE SIZE: 6.7MB - MUST BE LAZY LOADED`

## ✅ 构建配置优化

1. ✅ 内存限制: 8GB (`NODE_OPTIONS=--max-old-space-size=8192`)
2. ✅ optimizeDeps.exclude: 排除所有JSON文件
3. ✅ minify: esbuild (更省内存)
4. ✅ sourcemap: false (减少内存使用)

## 📋 验证命令

运行以下命令确认没有超大文件的静态导入：
```bash
grep -r "^import.*\.json" src/ | grep -E "(extracts|shops-by-npc|npcs\.json|tw-recipes|shops\.json|npcs-database-pages|quests-database-pages)" | grep -v "// import"
```

如果结果只显示小文件（如`twNpcsData`, `twShopsData`），说明所有超大文件都已正确处理。

## ⚠️ 注意事项

- 所有超大文件现在都是动态导入，不会在构建时被打包
- 这些文件会在运行时按需加载
- 已添加缓存机制，避免重复加载
- 所有文件都有大小注释，方便后续维护
