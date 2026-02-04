/**
 * 檢查資料庫中 REQUIREMENTS (type=17) 的使用情況
 * Run with: node test_scripts/check_requirements_type.js
 */

import { createClient } from '@supabase/supabase-js';

// 直接設定 Supabase 憑證（從 .env 檔案讀取）
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 檢查 REQUIREMENTS (type=17) 使用情況\n');

async function checkRequirementsType() {
  try {
    // 查詢 type = 17 的記錄
    console.log('📊 查詢 extracts_unified 表中 type = 17 的記錄...\n');
    
    const { data, error, count } = await supabase
      .from('extracts_unified')
      .select('item_id, type, data', { count: 'exact' })
      .eq('type', 17)
      .limit(10); // 只取前 10 筆作為範例

    if (error) {
      console.error('❌ 查詢錯誤:', error);
      return;
    }

    console.log(`✅ 找到 ${count} 筆記錄使用 type = 17 (REQUIREMENTS)\n`);

    if (count === 0) {
      console.log('✨ 結論：資料庫中沒有物品使用 REQUIREMENTS 類型');
      console.log('建議：可以從 getMethodTypeName 中移除此類型的映射\n');
    } else {
      console.log(`📋 前 ${Math.min(count, 10)} 筆記錄範例：\n`);
      
      data.forEach((record, index) => {
        console.log(`${index + 1}. Item ID: ${record.item_id}`);
        console.log(`   Type: ${record.type}`);
        console.log(`   Data:`, JSON.stringify(record.data, null, 2));
        console.log('');
      });

      console.log('⚠️ 結論：資料庫中有物品使用 REQUIREMENTS 類型');
      console.log('建議：需要在 ObtainMethods.jsx 的 renderSource 函數中實現此類型的渲染邏輯\n');
    }

    // 同時檢查所有使用的 type 值
    console.log('📊 檢查所有使用的 type 值...\n');
    
    const { data: typesData, error: typesError } = await supabase
      .from('extracts_unified')
      .select('type')
      .not('type', 'is', null);

    if (typesError) {
      console.error('❌ 查詢錯誤:', typesError);
      return;
    }

    // 統計各 type 的使用次數
    const typeCount = {};
    typesData.forEach(record => {
      const type = record.type;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    // 排序並顯示
    const sortedTypes = Object.entries(typeCount)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    console.log('各 type 使用次數統計：\n');
    
    const typeNames = {
      0: 'DEPRECATED',
      1: 'CRAFTED_BY',
      2: 'TRADE_SOURCES',
      3: 'VENDORS',
      4: 'REDUCED_FROM',
      5: 'DESYNTHS',
      6: 'INSTANCES',
      7: 'GATHERED_BY',
      8: 'VENTURES',
      9: 'TREASURES',
      10: 'QUESTS',
      11: 'FATES',
      12: 'GARDENING',
      13: 'MOGSTATION',
      14: 'ISLAND_PASTURE',
      15: 'ISLAND_CROP',
      16: 'VOYAGES',
      17: 'REQUIREMENTS',
      18: 'MASTERBOOKS',
      19: 'ALARMS',
      20: 'DROPS',
      22: 'ACHIEVEMENTS',
    };

    sortedTypes.forEach(([type, count]) => {
      const typeName = typeNames[type] || 'UNKNOWN';
      const hasRenderer = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18, 19, 20, 22].includes(parseInt(type));
      const status = hasRenderer ? '✅' : (type === '0' || type === '14' ? '⚠️' : '❌');
      
      console.log(`${status} Type ${type} (${typeName}): ${count} 筆`);
    });

    console.log('\n圖例：');
    console.log('✅ = 已實現渲染邏輯');
    console.log('⚠️ = 預期不渲染（DEPRECATED 或 ISLAND_PASTURE）');
    console.log('❌ = 無渲染邏輯\n');

  } catch (err) {
    console.error('❌ 執行錯誤:', err);
  }
}

// 執行檢查
checkRequirementsType().then(() => {
  console.log('✨ 檢查完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 執行失敗:', err);
  process.exit(1);
});
