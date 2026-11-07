import assert from 'node:assert/strict'
import { test } from 'node:test'
import { combineInstanceResults } from '../src/instances.ts'

test('combines segments per instance and keeps instances with the same name separate', () => {
  const result = { fileName: 'segment.wal', records: [{ number: 1, recordType: 'entry', index: 1 }] }
  const combined = combineInstanceResults([
    { instanceId: 'a', instanceName: 'member', result },
    { instanceId: 'a', instanceName: 'member', result: { ...result, records: [{ number: 1, recordType: 'entry', index: 2 }] } },
    { instanceId: 'b', instanceName: 'member', result },
    { result },
  ])
  assert.equal(combined.length, 3)
  assert.deepEqual(combined[0].records.map(record => record.index), [1, 2])
  assert.deepEqual(combined[0].records.map(record => record.number), [1, 2])
  assert.equal(result.records[0].number, 1)
  assert.equal(combined[1].records.length, 1)
})
test('keeps source file names on instance decoding errors', () => {
  const result = combineInstanceResults([{ instanceId: 'a', instanceName: 'node-a', result: { fileName: 'bad.wal', records: [], errors: ['truncated'] } }])
  assert.deepEqual(result[0].errors, ['bad.wal: truncated'])
})
