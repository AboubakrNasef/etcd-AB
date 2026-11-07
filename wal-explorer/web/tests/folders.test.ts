import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupInstanceFolders, readDroppedDirectory } from '../src/folders.ts'

test('imports each child of the selected parent as a separate instance', () => {
  const files = ['cluster/node-a/member/wal/1.wal', 'cluster/node-a/member/wal/2.wal', 'cluster/node-b/member/wal/1.wal', 'cluster/readme.txt'].map(webkitRelativePath => ({ webkitRelativePath, name: webkitRelativePath.split('/').at(-1)! }))
  const groups = groupInstanceFolders(files, 'wal')
  assert.deepEqual(groups.map(group => [group.name, group.files.length]), [['node-a', 2], ['node-b', 1]])
})
test('groups databases and excludes unrelated files and files directly in parent', () => {
  const files = ['cluster/a/member/snap/db', 'cluster/b/copy.db', 'cluster/root.db', 'cluster/c/readme'].map(webkitRelativePath => ({ webkitRelativePath, name: webkitRelativePath.split('/').at(-1)! }))
  assert.deepEqual(groupInstanceFolders(files, 'database').map(group => group.name), ['a', 'b'])
})
test('reads all directory batches and nested files', async () => {
  const file = new File(['wal'], 'one.wal')
  const fileEntry = { isFile: true, isDirectory: false, name: file.name, file: (success: (file: File) => void) => success(file) }
  const batches = [[fileEntry], [fileEntry], []]
  const entry = { isFile: false, isDirectory: true, name: 'node-a', createReader: () => ({ readEntries: (success: (entries: unknown[]) => void) => success(batches.shift()!) }) }
  const files = await readDroppedDirectory(entry as never)
  assert.equal(files.length, 2)
  assert.equal(files[0].webkitRelativePath, 'node-a/one.wal')
})
