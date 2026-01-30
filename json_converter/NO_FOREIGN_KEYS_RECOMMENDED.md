# 不使用外键约束的建议

## 为什么建议不使用外键？

1. **灵活性**：可以独立插入数据到各个表，不需要维护严格的引用关系
2. **数据导入**：未来导入新数据时不需要考虑外键约束
3. **维护成本**：不需要清理孤立数据或维护数据一致性

## Supabase 支持手动 JOIN

即使没有外键约束，Supabase 也支持手动指定 join 关系：

```javascript
// 方式1：使用手动 join（推荐）
const { data } = await supabase
  .from('tw_items')
  .select(`
    id,
    tw,
    ilvls!left(value),
    item_patch!left(value),
    market_items!left(id)
  `)
  .ilike('tw', '%火%');

// 方式2：分别查询然后合并（当前实现方式，更灵活）
const [names, ilvls, patches, marketable] = await Promise.all([
  getTwItemsByIds(itemIds),
  getIlvlsByIds(itemIds),
  getItemPatchByIds(itemIds),
  getMarketItemsByIds(itemIds)
]);
```

## 当前实现方式

代码中已经实现了**分别查询然后合并**的方式：
- 先查询 `tw_items` 获取物品名称
- 然后并行查询 `ilvls`, `item_patch`, `market_items` 获取辅助数据
- 最后在 JavaScript 中合并数据并排序

这种方式：
- ✅ 不需要外键约束
- ✅ 灵活性高
- ✅ 可以处理数据不一致的情况
- ✅ 前端可以安全地处理 null 值

## 如果确实需要外键约束

如果未来确实需要外键约束（比如需要数据库层面的数据完整性保证），可以：

1. **先清理孤立数据**：
```sql
DELETE FROM ilvls WHERE id NOT IN (SELECT id FROM tw_items);
DELETE FROM item_patch WHERE id NOT IN (SELECT id FROM tw_items);
DELETE FROM market_items WHERE id NOT IN (SELECT id FROM tw_items);
-- ... 其他表
```

2. **创建外键约束**（见 `create_foreign_keys.sql`）

3. **未来导入数据时**：必须先导入 `tw_items`，再导入辅助表

## 建议

**保持当前实现方式（不使用外键）**，因为：
- 更灵活
- 维护成本低
- 代码已经实现得很好
- 性能没有明显差异
