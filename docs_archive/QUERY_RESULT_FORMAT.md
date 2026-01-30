# 查询结果数据格式说明

## 函数返回格式

### `searchTwItemsWithJoin(searchText, fuzzy, signal)`
### `getItemsWithJoinByIds(itemIds, signal)`

这两个函数返回相同格式的数据数组，按 ilvl 降序排序（最高 ilvl 在前）。

## 数据格式示例

```javascript
[
  {
    id: 36221,
    name: "精金投斧",
    ilvl: 665,
    version: 70,
    marketable: true
  },
  {
    id: 36220,
    name: "精金战斧",
    ilvl: 660,
    version: 70,
    marketable: true
  },
  {
    id: 36219,
    name: "精金长斧",
    ilvl: 655,
    version: 70,
    marketable: true
  },
  {
    id: 12345,
    name: "某个不可交易物品",
    ilvl: null,        // 没有 ilvl 数据
    version: 65,
    marketable: false   // 不可交易
  },
  {
    id: 12344,
    name: "另一个物品",
    ilvl: 100,
    version: null,      // 没有版本数据
    marketable: true
  }
]
```

## 字段说明

- **id** (number): 物品 ID
- **name** (string): 物品名称（繁体中文）
- **ilvl** (number | null): 物品等级，如果没有数据则为 null
- **version** (number | null): 版本号（patch ID），如果没有数据则为 null
- **marketable** (boolean): 是否可交易，true 表示可交易，false 表示不可交易

## 排序规则

1. **主要排序**: 按 ilvl 降序（ilvl 高的在前）
2. **次要排序**: 如果 ilvl 相同或都为 null，按 id 降序
3. **特殊处理**: 有 ilvl 的物品排在无 ilvl 的物品之前

## 使用示例

```javascript
import { searchTwItemsWithJoin, getItemsWithJoinByIds } from './services/supabaseData';

// 搜索物品
const results = await searchTwItemsWithJoin('精金', false);
console.log(results);
// [
//   { id: 36221, name: "精金投斧", ilvl: 665, version: 70, marketable: true },
//   { id: 36220, name: "精金战斧", ilvl: 660, version: 70, marketable: true },
//   ...
// ]

// 根据 ID 列表获取物品
const itemIds = [36221, 36220, 12345];
const items = await getItemsWithJoinByIds(itemIds);
console.log(items);
// 结果已按 ilvl 降序排序
```

## 注意事项

1. 所有数据在查询时就已经按 ilvl 降序排序，不需要在客户端再次排序
2. `marketable` 字段通过 join `market_items` 表获取
3. `ilvl` 和 `version` 通过 join 对应的表获取
4. 如果某个字段没有数据，对应的值会是 `null`（ilvl, version）或 `false`（marketable）
