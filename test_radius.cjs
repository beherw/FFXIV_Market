const fs = require('fs');

// 測試 minified 數據
const minData = fs.readFileSync('public/data/obtainable-methods.min.json', 'utf8');
console.log('Min file size:', (minData.length / 1024 / 1024).toFixed(2), 'MB');

const parsed = JSON.parse(minData);
const item = parsed['5519'];

if (!item) {
  console.log('ERROR: Item 5519 not found!');
  process.exit(1);
}

console.log('\nItem 5519 sources:', item.map(s => s.type).join(', '));

const gathering = item.find(s => s.type === 'gathering');
if (!gathering) {
  console.log('ERROR: Gathering source not found!');
  process.exit(1);
}

console.log('\n=== Gathering Data ===');
console.log('Type:', gathering.type);
console.log('Level:', gathering.level);
console.log('gatheringType:', gathering.gatheringType);
console.log('Nodes count:', gathering.nodes?.length || 0);

if (gathering.nodes && gathering.nodes[0]) {
  const node = gathering.nodes[0];
  console.log('\n=== First Node ===');
  console.log('mapId:', node.mapId);
  console.log('coords:', { x: node.x, y: node.y });
  console.log('radius:', node.radius);
  console.log('nodeId:', node.nodeId);
  console.log('All node keys:', Object.keys(node));
}

console.log('\n=== Vendor Data ===');
const vendor = item.find(s => s.type === 'vendor');
if (vendor && vendor.data && vendor.data[0]) {
  const v = vendor.data[0];
  console.log('First vendor NPC ID:', v.npcId);
  console.log('Coords:', v.coords);
  console.log('Zone ID:', v.zoneId);
}
