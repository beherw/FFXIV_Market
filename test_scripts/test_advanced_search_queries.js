/**
 * 測試進階搜尋功能的查詢組合
 * 這個文件用於手動測試各種查詢組合，確保join查詢正確工作
 */

import { supabase } from '../src/services/supabaseClient.js';

// 測試1: 單選職業（例如：PLD）
async function testSingleJob() {
  console.log('\n=== 測試1: 單選職業 (PLD) ===');
  
  const jobAbbrs = ['PLD'];
  
  // 使用join查詢：equipment表 join ilvls表
  const { data, error } = await supabase
    .from('equipment')
    .select(`
      id,
      jobs,
      level,
      equipSlotCategory,
      ilvls(value)
    `)
    .filter('jobs', 'cs', JSON.stringify([jobAbbrs[0]]));
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`找到 ${data.length} 個物品`);
  if (data.length > 0) {
    console.log('前5個物品:', data.slice(0, 5).map(item => ({
      id: item.id,
      jobs: item.jobs,
      level: item.level,
      ilvl: item.ilvls?.[0]?.value || null
    })));
  }
}

// 測試2: 單選分類（例如：category 5 - 單手劍）
async function testSingleCategory() {
  console.log('\n=== 測試2: 單選分類 (category 5) ===');
  
  const categoryId = 5;
  
  // 使用join查詢：ui_categories表 join ilvls表
  const { data, error } = await supabase
    .from('ui_categories')
    .select(`
      id,
      category,
      ilvls(value)
    `)
    .eq('category', categoryId);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`找到 ${data.length} 個物品`);
  if (data.length > 0) {
    console.log('前5個物品:', data.slice(0, 5).map(item => ({
      id: item.id,
      category: item.category,
      ilvl: item.ilvls?.[0]?.value || null
    })));
  }
}

// 測試3: 職業 + 分類一起選
async function testJobAndCategory() {
  console.log('\n=== 測試3: 職業 + 分類一起選 (PLD + category 5) ===');
  
  const jobAbbrs = ['PLD'];
  const categoryId = 5;
  
  // 步驟1: 先查分類
  const { data: categoryData, error: categoryError } = await supabase
    .from('ui_categories')
    .select('id')
    .eq('category', categoryId);
  
  if (categoryError) {
    console.error('Category Error:', categoryError);
    return;
  }
  
  const categoryItemIds = categoryData.map(row => row.id);
  console.log(`分類找到 ${categoryItemIds.length} 個物品`);
  
  if (categoryItemIds.length === 0) {
    console.log('沒有找到物品');
    return;
  }
  
  // 步驟2: 再查職業，並join ilvls
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select(`
      id,
      jobs,
      level,
      equipSlotCategory,
      ilvls(value)
    `)
    .filter('jobs', 'cs', JSON.stringify([jobAbbrs[0]]))
    .in('id', categoryItemIds.slice(0, 1000)); // Supabase限制1000個
  
  if (equipmentError) {
    console.error('Equipment Error:', equipmentError);
    return;
  }
  
  console.log(`職業+分類交集找到 ${equipmentData.length} 個物品`);
  if (equipmentData.length > 0) {
    console.log('前5個物品:', equipmentData.slice(0, 5).map(item => ({
      id: item.id,
      jobs: item.jobs,
      level: item.level,
      ilvl: item.ilvls?.[0]?.value || null
    })));
  }
}

// 測試4: 職業 + ilvl範圍
async function testJobAndIlvlRange() {
  console.log('\n=== 測試4: 職業 + ilvl範圍 (PLD + ilvl 660-665) ===');
  
  const jobAbbrs = ['PLD'];
  const minIlvl = 660;
  const maxIlvl = 665;
  
  // 步驟1: 先查ilvl範圍
  const { data: ilvlData, error: ilvlError } = await supabase
    .from('ilvls')
    .select('id')
    .gte('value', minIlvl)
    .lte('value', maxIlvl);
  
  if (ilvlError) {
    console.error('Ilvl Error:', ilvlError);
    return;
  }
  
  const ilvlItemIds = ilvlData.map(row => row.id);
  console.log(`ilvl範圍找到 ${ilvlItemIds.length} 個物品`);
  
  if (ilvlItemIds.length === 0) {
    console.log('沒有找到物品');
    return;
  }
  
  // 步驟2: 再查職業，並join ilvls
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select(`
      id,
      jobs,
      level,
      equipSlotCategory,
      ilvls!inner(value)
    `)
    .filter('jobs', 'cs', JSON.stringify([jobAbbrs[0]]))
    .in('id', ilvlItemIds.slice(0, 1000)); // Supabase限制1000個
  
  if (equipmentError) {
    console.error('Equipment Error:', equipmentError);
    return;
  }
  
  console.log(`職業+ilvl交集找到 ${equipmentData.length} 個物品`);
  if (equipmentData.length > 0) {
    console.log('前5個物品:', equipmentData.slice(0, 5).map(item => ({
      id: item.id,
      jobs: item.jobs,
      level: item.level,
      ilvl: item.ilvls?.[0]?.value || null
    })));
  }
}

// 測試5: 分類 + ilvl範圍
async function testCategoryAndIlvlRange() {
  console.log('\n=== 測試5: 分類 + ilvl範圍 (category 5 + ilvl 660-665) ===');
  
  const categoryId = 5;
  const minIlvl = 660;
  const maxIlvl = 665;
  
  // 步驟1: 先查分類
  const { data: categoryData, error: categoryError } = await supabase
    .from('ui_categories')
    .select('id')
    .eq('category', categoryId);
  
  if (categoryError) {
    console.error('Category Error:', categoryError);
    return;
  }
  
  const categoryItemIds = categoryData.map(row => row.id);
  console.log(`分類找到 ${categoryItemIds.length} 個物品`);
  
  // 步驟2: 再查ilvl範圍
  const { data: ilvlData, error: ilvlError } = await supabase
    .from('ilvls')
    .select('id')
    .gte('value', minIlvl)
    .lte('value', maxIlvl);
  
  if (ilvlError) {
    console.error('Ilvl Error:', ilvlError);
    return;
  }
  
  const ilvlItemIds = ilvlData.map(row => row.id);
  console.log(`ilvl範圍找到 ${ilvlItemIds.length} 個物品`);
  
  // 步驟3: 求交集
  const categorySet = new Set(categoryItemIds);
  const ilvlSet = new Set(ilvlItemIds);
  const intersection = categoryItemIds.filter(id => ilvlSet.has(id));
  
  console.log(`分類+ilvl交集找到 ${intersection.length} 個物品`);
  
  if (intersection.length > 0) {
    // 使用join查詢獲取詳細信息
    const { data: itemsData, error: itemsError } = await supabase
      .from('tw_items')
      .select(`
        id,
        tw,
        ilvls(value)
      `)
      .in('id', intersection.slice(0, 100));
    
    if (itemsError) {
      console.error('Items Error:', itemsError);
      return;
    }
    
    console.log('前5個物品:', itemsData.slice(0, 5).map(item => ({
      id: item.id,
      name: item.tw,
      ilvl: item.ilvls?.[0]?.value || null
    })));
  }
}

// 測試6: 職業 + 分類 + ilvl範圍（完整組合）
async function testFullCombination() {
  console.log('\n=== 測試6: 職業 + 分類 + ilvl範圍 (PLD + category 5 + ilvl 660-665) ===');
  
  const jobAbbrs = ['PLD'];
  const categoryId = 5;
  const minIlvl = 660;
  const maxIlvl = 665;
  
  // 步驟1: 查分類
  const { data: categoryData, error: categoryError } = await supabase
    .from('ui_categories')
    .select('id')
    .eq('category', categoryId);
  
  if (categoryError) {
    console.error('Category Error:', categoryError);
    return;
  }
  
  const categoryItemIds = categoryData.map(row => row.id);
  console.log(`分類找到 ${categoryItemIds.length} 個物品`);
  
  // 步驟2: 查ilvl範圍
  const { data: ilvlData, error: ilvlError } = await supabase
    .from('ilvls')
    .select('id')
    .gte('value', minIlvl)
    .lte('value', maxIlvl);
  
  if (ilvlError) {
    console.error('Ilvl Error:', ilvlError);
    return;
  }
  
  const ilvlItemIds = ilvlData.map(row => row.id);
  console.log(`ilvl範圍找到 ${ilvlItemIds.length} 個物品`);
  
  // 步驟3: 求分類和ilvl的交集
  const categorySet = new Set(categoryItemIds);
  const ilvlSet = new Set(ilvlItemIds);
  const categoryIlvlIntersection = categoryItemIds.filter(id => ilvlSet.has(id));
  console.log(`分類+ilvl交集找到 ${categoryIlvlIntersection.length} 個物品`);
  
  if (categoryIlvlIntersection.length === 0) {
    console.log('沒有找到物品');
    return;
  }
  
  // 步驟4: 查職業，並join ilvls
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select(`
      id,
      jobs,
      level,
      equipSlotCategory,
      ilvls!inner(value)
    `)
    .filter('jobs', 'cs', JSON.stringify([jobAbbrs[0]]))
    .in('id', categoryIlvlIntersection.slice(0, 1000));
  
  if (equipmentError) {
    console.error('Equipment Error:', equipmentError);
    return;
  }
  
  console.log(`完整組合找到 ${equipmentData.length} 個物品`);
  if (equipmentData.length > 0) {
    console.log('前5個物品:', equipmentData.slice(0, 5).map(item => ({
      id: item.id,
      jobs: item.jobs,
      level: item.level,
      ilvl: item.ilvls?.[0]?.value || null
    })));
  }
}

// 執行所有測試
async function runAllTests() {
  console.log('開始測試進階搜尋功能的查詢組合...\n');
  
  try {
    await testSingleJob();
    await testSingleCategory();
    await testJobAndCategory();
    await testJobAndIlvlRange();
    await testCategoryAndIlvlRange();
    await testFullCombination();
    
    console.log('\n所有測試完成！');
  } catch (error) {
    console.error('測試過程中發生錯誤:', error);
  }
}

// 如果直接運行此文件，執行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export {
  testSingleJob,
  testSingleCategory,
  testJobAndCategory,
  testJobAndIlvlRange,
  testCategoryAndIlvlRange,
  testFullCombination,
  runAllTests
};
