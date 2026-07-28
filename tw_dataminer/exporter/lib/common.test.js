const test = require('node:test');
const assert = require('node:assert/strict');
require('./common');

test('findById handles sparse or malformed rows without crashing', () => {
  const rows = [
    { '#': 1, name: 'one' },
    undefined,
    { '#': 3, name: 'three' }
  ];

  assert.deepStrictEqual(rows.findById(3), rows[2]);
  assert.equal(rows.findById(2), null);
});
