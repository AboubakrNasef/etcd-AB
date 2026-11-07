import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareRecords } from '../src/compare.ts'

test('matches WAL entries by index, ignoring positional numbers and object key order', () => {
  const left = [{ number: 1, recordType: 'entry', index: 5, data: { a: 1, b: 2 } }]
  const right = [{ number: 9, recordType: 'entry', index: 5, data: { b: 2, a: 1 } }]
  assert.equal(compareRecords(left, right)[0].status, 'unchanged')
})
test('reports changes, additions and removals', () => {
  const entry = (index: number, value: string) => ({ number: index, recordType: 'entry', index, data: { value } })
  assert.deepEqual(compareRecords([entry(1, 'old'), entry(2, 'gone')], [entry(1, 'new'), entry(3, 'added')]).map(row => row.status), ['changed', 'removed', 'added'])
})
test('preserves repeated metadata records instead of overwriting them', () => {
  const record = { number: 1, recordType: 'hardState', data: { term: 2 } }
  assert.deepEqual(compareRecords([record, { ...record, number: 2 }], [record]).map(row => row.status), ['unchanged', 'removed'])
})
test('matches database history by revision, subrevision and key', () => {
  const record = { number: 1, recordType: 'keyValue', revision: 3, subRevision: 0, data: { key: 'foo', value: 'a' } }
  assert.equal(compareRecords([record], [{ ...record, number: 7, tombstone: true }])[0].status, 'changed')
  assert.deepEqual(compareRecords([record], [{ ...record, revision: 4 }]).map(row => row.status), ['removed', 'added'])
})
test('handles empty files and nested field changes', () => {
  assert.deepEqual(compareRecords([], []), [])
  const left = { number: 1, recordType: 'entry', index: 1, data: { txn: { value: 'a' } } }
  const rows = compareRecords([left], [{ ...left, data: { txn: { value: 'b' } } }])
  assert.equal(rows[0].status, 'changed')
})
