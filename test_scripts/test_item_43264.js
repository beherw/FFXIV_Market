// Test script to check item 43264 data
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { decode } from '@msgpack/msgpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataPath = join(__dirname, '..', 'public', 'data', 'obtainable-methods.msgpack');
const data = decode(readFileSync(dataPath));

// Check if item 43264 exists
const itemId = '43264';
console.log('=== Item 43264 Data ===');
console.log('Data structure:', Object.keys(data));
console.log('Version:', data.v);

if (data.i && data.i[itemId]) {
  console.log('Found with string key in data.i:');
  console.log(JSON.stringify(data.i[itemId], null, 2));
} else if (data.i && data.i[43264]) {
  console.log('Found with number key in data.i:');
  console.log(JSON.stringify(data.i[43264], null, 2));
} else if (data[itemId]) {
  console.log('Found with string key:');
  console.log(JSON.stringify(data[itemId], null, 2));
} else if (data[43264]) {
  console.log('Found with number key:');
  console.log(JSON.stringify(data[43264], null, 2));
} else {
  console.log('Item 43264 not found');
  if (data.i) {
    console.log('First 5 keys in data.i:', Object.keys(data.i).slice(0, 5));
  }
}
