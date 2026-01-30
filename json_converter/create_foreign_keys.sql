-- ⚠️ 不建议使用外键约束
-- 
-- 原因：
-- 1. 需要维护数据一致性，插入数据时必须先有主表数据
-- 2. 如果辅助表中有数据但主表中没有，会违反约束
-- 3. 未来新数据导入时也需要维护这种关系
--
-- 建议：不使用外键，改用 Supabase 的手动 JOIN
-- Supabase 支持手动指定 join 关系，即使没有外键也可以正常工作
-- 代码中已经实现了手动 join 的方式，不需要外键约束
--
-- 如果确实需要外键约束（不推荐），可以执行下面的 SQL
-- 但请注意：必须先清理所有孤立数据，并且未来导入数据时也要维护这种关系

-- ============================================================================
-- ⚠️ 不推荐：外键约束创建（需要先清理孤立数据）
-- ============================================================================

-- STEP 1: 检查并清理孤立数据（辅助表中有但主表中没有的数据）
-- 如果发现孤立数据，必须先清理才能创建外键

-- 检查 ilvls 表中的孤立数据
SELECT COUNT(*) as orphaned_ilvls_count
FROM ilvls
WHERE id NOT IN (SELECT id FROM tw_items);

-- 检查 item_patch 表中的孤立数据
SELECT COUNT(*) as orphaned_item_patch_count
FROM item_patch
WHERE id NOT IN (SELECT id FROM tw_items);

-- 检查 market_items 表中的孤立数据
SELECT COUNT(*) as orphaned_market_items_count
FROM market_items
WHERE id NOT IN (SELECT id FROM tw_items);

-- 检查 rarities 表中的孤立数据
SELECT COUNT(*) as orphaned_rarities_count
FROM rarities
WHERE id NOT IN (SELECT id FROM tw_items);

-- 检查 tw_item_descriptions 表中的孤立数据
SELECT COUNT(*) as orphaned_descriptions_count
FROM tw_item_descriptions
WHERE id NOT IN (SELECT id FROM tw_items);

-- 检查 equipment 表中的孤立数据
SELECT COUNT(*) as orphaned_equipment_count
FROM equipment
WHERE id NOT IN (SELECT id FROM tw_items);

-- 如果发现孤立数据，可以选择删除（可选，根据实际情况决定）
-- DELETE FROM ilvls WHERE id NOT IN (SELECT id FROM tw_items);
-- DELETE FROM item_patch WHERE id NOT IN (SELECT id FROM tw_items);
-- DELETE FROM market_items WHERE id NOT IN (SELECT id FROM tw_items);
-- DELETE FROM rarities WHERE id NOT IN (SELECT id FROM tw_items);
-- DELETE FROM tw_item_descriptions WHERE id NOT IN (SELECT id FROM tw_items);
-- DELETE FROM equipment WHERE id NOT IN (SELECT id FROM tw_items);

-- ============================================================================
-- STEP 2: 创建外键关系
-- ============================================================================

-- 1. ilvls 表：id 引用 tw_items.id
-- 这意味着：如果 ilvls 中有某个 id，这个 id 必须在 tw_items 中存在
-- 但 tw_items 中可以有 id，而 ilvls 中没有（这是正常的，前端会处理）
ALTER TABLE ilvls
ADD CONSTRAINT fk_ilvls_tw_items
FOREIGN KEY (id) REFERENCES tw_items(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 2. item_patch 表：id 引用 tw_items.id
ALTER TABLE item_patch
ADD CONSTRAINT fk_item_patch_tw_items
FOREIGN KEY (id) REFERENCES tw_items(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 3. market_items 表：id 引用 tw_items.id
ALTER TABLE market_items
ADD CONSTRAINT fk_market_items_tw_items
FOREIGN KEY (id) REFERENCES tw_items(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 4. rarities 表：id 引用 tw_items.id
ALTER TABLE rarities
ADD CONSTRAINT fk_rarities_tw_items
FOREIGN KEY (id) REFERENCES tw_items(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 5. tw_item_descriptions 表：id 引用 tw_items.id
ALTER TABLE tw_item_descriptions
ADD CONSTRAINT fk_tw_item_descriptions_tw_items
FOREIGN KEY (id) REFERENCES tw_items(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 6. equipment 表：id 引用 tw_items.id
ALTER TABLE equipment
ADD CONSTRAINT fk_equipment_tw_items
FOREIGN KEY (id) REFERENCES tw_items(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. 外键关系说明：
--    - tw_items 是主表，包含所有物品
--    - 其他表是辅助表，通过 id 引用 tw_items
--    - 如果 tw_items 中有某个 id，但辅助表中没有对应数据，这是正常的
--    - 前端会处理这种情况，显示 null 或其他默认值
--
-- 2. 外键约束的作用：
--    - 确保辅助表中的 id 必须在 tw_items 中存在
--    - 如果 tw_items 中删除某个 id，辅助表中的对应记录也会被删除（CASCADE）
--    - 如果 tw_items 中更新某个 id，辅助表中的对应记录也会被更新（CASCADE）
--
-- 3. 创建外键后，Supabase 可以使用 LEFT JOIN 进行查询：
--    SELECT 
--      tw_items.id,
--      tw_items.tw as name,
--      ilvls.value as ilvl,
--      item_patch.value as version,
--      CASE WHEN market_items.id IS NOT NULL THEN true ELSE false END as marketable
--    FROM tw_items
--    LEFT JOIN ilvls ON tw_items.id = ilvls.id
--    LEFT JOIN item_patch ON tw_items.id = item_patch.id
--    LEFT JOIN market_items ON tw_items.id = market_items.id
--    WHERE tw_items.tw ILIKE '%火%'
--    ORDER BY ilvls.value DESC NULLS LAST;
--
-- 4. 如果创建外键时遇到错误，说明有孤立数据：
--    - 先运行 STEP 1 的检查查询，查看有多少孤立数据
--    - 如果孤立数据不多，可以删除它们
--    - 如果孤立数据很多，可能需要检查数据导入过程
--
-- 5. 验证外键是否创建成功：
--    SELECT
--      tc.table_name, 
--      kcu.column_name,
--      ccu.table_name AS foreign_table_name,
--      ccu.column_name AS foreign_column_name 
--    FROM information_schema.table_constraints AS tc 
--    JOIN information_schema.key_column_usage AS kcu
--      ON tc.constraint_name = kcu.constraint_name
--    JOIN information_schema.constraint_column_usage AS ccu
--      ON ccu.constraint_name = tc.constraint_name
--    WHERE tc.constraint_type = 'FOREIGN KEY'
--      AND ccu.table_name = 'tw_items'
--    ORDER BY tc.table_name, kcu.column_name;
