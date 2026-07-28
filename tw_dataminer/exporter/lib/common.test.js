const test = require('node:test')
const assert = require('node:assert/strict')
require('./common')

test('findById keeps fast lookup behavior for normal sorted rows', () => {
  const rows = [{ '#': 0 }, { '#': 1 }, { '#': 2 }]
  assert.equal(rows.findById(2), rows[2])
  assert.equal(rows.findById(9), null)
})

test('findById safely falls back for sparse rows', () => {
  const rows = [{ '#': 1 }, undefined, { '#': 3 }]
  assert.equal(rows.findById(3), rows[2])
  assert.equal(rows.findById(2), null)
})
